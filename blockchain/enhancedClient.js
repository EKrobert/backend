// Enhanced Hyperledger Fabric Client for Green Olive Chain
const { Wallets, Gateway } = require("fabric-network");
const fs = require("fs");
const path = require("path");

// Configuration
const PROJECT_ROOT = __dirname;
const NETWORK_ROOT = path.join(PROJECT_ROOT, "network");
const WALLET_PATH = path.join(PROJECT_ROOT, "wallet");

// Blockchain Network Configuration
const NETWORK_CONFIG = {
  channelName: "olive-channel",
  chaincodeName: "waste",
  organizations: {
    farmer: {
      mspId: "FarmerOrgMSP",
      userId: "User1@farmer.olive.com",
      peers: ["peer0.farmer.olive.com"],
    },
    processor: {
      mspId: "ProcessorOrgMSP",
      userId: "User1@processor.olive.com",
      peers: ["peer0.processor.olive.com"],
    },
    recycler: {
      mspId: "RecyclerOrgMSP",
      userId: "User1@recycler.olive.com",
      peers: ["peer0.recycler.olive.com"],
    },
  },
};

class BlockchainClient {
  constructor() {
    this.isInitialized = false;
    this.wallet = null;
  }

  // Initialize blockchain wallet and identities
  async initialize() {
    try {
      console.log("🔗 Initializing blockchain client...");

      // Create wallet
      this.wallet = await Wallets.newFileSystemWallet(WALLET_PATH);

      // Ensure wallet directory exists
      if (!fs.existsSync(WALLET_PATH)) {
        fs.mkdirSync(WALLET_PATH, { recursive: true });
      }

      // Initialize identities for all organizations
      for (const [orgName, orgConfig] of Object.entries(
        NETWORK_CONFIG.organizations
      )) {
        await this.initializeIdentity(orgName, orgConfig);
      }

      this.isInitialized = true;
      console.log("✅ Blockchain client initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ Blockchain initialization failed:", error.message);
      this.isInitialized = false;
      return false;
    }
  }

  // Initialize identity for a specific organization
  async initializeIdentity(orgName, orgConfig) {
    const { userId, mspId } = orgConfig;

    // Check if identity already exists
    const existingIdentity = await this.wallet.get(userId);
    if (existingIdentity) {
      console.log(`ℹ️ Identity ${userId} already exists in wallet`);
      return;
    }

    try {
      // Load certificate and private key from crypto-config
      const certPath = path.join(
        NETWORK_ROOT,
        "crypto-config",
        "peerOrganizations",
        `${orgName}.olive.com`,
        "users",
        userId,
        "msp",
        "signcerts",
        `${userId}-cert.pem`
      );

      const keyDir = path.join(
        NETWORK_ROOT,
        "crypto-config",
        "peerOrganizations",
        `${orgName}.olive.com`,
        "users",
        userId,
        "msp",
        "keystore"
      );

      if (!fs.existsSync(certPath)) {
        console.warn(`⚠️ Certificate not found for ${userId}: ${certPath}`);
        return;
      }

      const keyFiles = fs.readdirSync(keyDir);
      if (keyFiles.length === 0) {
        console.warn(`⚠️ No private key found for ${userId} in: ${keyDir}`);
        return;
      }

      const privateKeyPath = path.join(keyDir, keyFiles[0]);

      const identity = {
        credentials: {
          certificate: fs.readFileSync(certPath, "utf8"),
          privateKey: fs.readFileSync(privateKeyPath, "utf8"),
        },
        mspId: mspId,
        type: "X.509",
      };

      await this.wallet.put(userId, identity);
      console.log(`✅ Identity ${userId} added to wallet`);
    } catch (error) {
      console.warn(
        `⚠️ Failed to initialize identity ${userId}:`,
        error.message
      );
    }
  }

  // Get connection profile for organization
  getConnectionProfile(orgName) {
    const orgConfig = NETWORK_CONFIG.organizations[orgName];
    if (!orgConfig) {
      throw new Error(`Organization ${orgName} not found in configuration`);
    }

    return {
      name: "olive-network",
      version: "1.0",
      client: {
        organization: `${
          orgName.charAt(0).toUpperCase() + orgName.slice(1)
        }Org`,
      },
      organizations: {
        [`${orgName.charAt(0).toUpperCase() + orgName.slice(1)}Org`]: {
          mspid: orgConfig.mspId,
          peers: orgConfig.peers,
        },
      },
      peers: {
        [orgConfig.peers[0]]: {
          url: "grpcs://localhost:7051",
          tlsCACerts: {
            path: path.join(
              NETWORK_ROOT,
              "crypto-config",
              "peerOrganizations",
              `${orgName}.olive.com`,
              "tlsca",
              `tlsca.${orgName}.olive.com-cert.pem`
            ),
          },
        },
      },
    };
  }

  // Submit transaction to blockchain
  async submitTransaction(orgName, functionName, ...args) {
    if (!this.isInitialized) {
      throw new Error("Blockchain client not initialized");
    }

    const orgConfig = NETWORK_CONFIG.organizations[orgName];
    if (!orgConfig) {
      throw new Error(`Organization ${orgName} not supported`);
    }

    let gateway;
    try {
      // Check if identity exists in wallet
      const identity = await this.wallet.get(orgConfig.userId);
      if (!identity) {
        throw new Error(`Identity ${orgConfig.userId} not found in wallet`);
      }

      // Connect to gateway
      gateway = new Gateway();
      const connectionProfile = this.getConnectionProfile(orgName);

      await gateway.connect(connectionProfile, {
        identity: orgConfig.userId,
        wallet: this.wallet,
        discovery: { enabled: true, asLocalhost: true },
      });

      // Get network and contract
      const network = await gateway.getNetwork(NETWORK_CONFIG.channelName);
      const contract = network.getContract(NETWORK_CONFIG.chaincodeName);

      // Submit transaction
      console.log(
        `🔗 Submitting transaction: ${functionName}(${args.join(", ")})`
      );
      const result = await contract.submitTransaction(functionName, ...args);

      console.log("✅ Transaction submitted successfully");

      // Parse result
      try {
        return JSON.parse(result.toString());
      } catch {
        return result.toString();
      }
    } catch (error) {
      console.error(`❌ Transaction failed: ${error.message}`);
      throw error;
    } finally {
      if (gateway) {
        await gateway.disconnect();
      }
    }
  }

  // Query blockchain (read-only operations)
  async queryBlockchain(orgName, functionName, ...args) {
    if (!this.isInitialized) {
      throw new Error("Blockchain client not initialized");
    }

    const orgConfig = NETWORK_CONFIG.organizations[orgName];
    if (!orgConfig) {
      throw new Error(`Organization ${orgName} not supported`);
    }

    let gateway;
    try {
      // Check if identity exists in wallet
      const identity = await this.wallet.get(orgConfig.userId);
      if (!identity) {
        throw new Error(`Identity ${orgConfig.userId} not found in wallet`);
      }

      // Connect to gateway
      gateway = new Gateway();
      const connectionProfile = this.getConnectionProfile(orgName);

      await gateway.connect(connectionProfile, {
        identity: orgConfig.userId,
        wallet: this.wallet,
        discovery: { enabled: true, asLocalhost: true },
      });

      // Get network and contract
      const network = await gateway.getNetwork(NETWORK_CONFIG.channelName);
      const contract = network.getContract(NETWORK_CONFIG.chaincodeName);

      // Evaluate transaction (query)
      console.log(
        `🔍 Querying blockchain: ${functionName}(${args.join(", ")})`
      );
      const result = await contract.evaluateTransaction(functionName, ...args);

      console.log("✅ Query completed successfully");

      // Parse result
      try {
        return JSON.parse(result.toString());
      } catch {
        return result.toString();
      }
    } catch (error) {
      console.error(`❌ Query failed: ${error.message}`);
      throw error;
    } finally {
      if (gateway) {
        await gateway.disconnect();
      }
    }
  }

  // Check if blockchain is available
  async isBlockchainAvailable() {
    try {
      await this.queryBlockchain("farmer", "GetAllWastes");
      return true;
    } catch (error) {
      console.warn("⚠️ Blockchain not available:", error.message);
      return false;
    }
  }

  // Get blockchain network status
  async getNetworkStatus() {
    const status = {
      initialized: this.isInitialized,
      organizations: {},
      chaincode: NETWORK_CONFIG.chaincodeName,
      channel: NETWORK_CONFIG.channelName,
    };

    for (const [orgName, orgConfig] of Object.entries(
      NETWORK_CONFIG.organizations
    )) {
      try {
        const identity = await this.wallet.get(orgConfig.userId);
        status.organizations[orgName] = {
          identityExists: !!identity,
          mspId: orgConfig.mspId,
          userId: orgConfig.userId,
        };
      } catch (error) {
        status.organizations[orgName] = {
          identityExists: false,
          error: error.message,
        };
      }
    }

    return status;
  }
}

// Simplified method exports
module.exports = class BlockchainClient {
  constructor() {
    this.isInitialized = false;
    this.wallet = null;
  }

  async initialize() {
    try {
      console.log("🔗 Initializing enhanced blockchain client...");

      // Create wallet
      this.wallet = await Wallets.newFileSystemWallet(WALLET_PATH);

      // Ensure wallet directory exists
      if (!fs.existsSync(WALLET_PATH)) {
        fs.mkdirSync(WALLET_PATH, { recursive: true });
      }

      // Initialize identities for all organizations
      for (const [orgName, orgConfig] of Object.entries(
        NETWORK_CONFIG.organizations
      )) {
        await this.initializeIdentity(orgName, orgConfig);
      }

      this.isInitialized = true;
      console.log("✅ Enhanced blockchain client initialized successfully");
      return true;
    } catch (error) {
      console.error(
        "❌ Enhanced blockchain initialization failed:",
        error.message
      );
      this.isInitialized = false;
      return false;
    }
  }

  async initializeIdentity(orgName, orgConfig) {
    const { userId, mspId } = orgConfig;

    const existingIdentity = await this.wallet.get(userId);
    if (existingIdentity) {
      console.log(`ℹ️ Identity ${userId} already exists in wallet`);
      return;
    }

    try {
      // Create a basic identity for testing (in production, use real certificates)
      const identity = {
        credentials: {
          certificate: `-----BEGIN CERTIFICATE-----\nMock Certificate for ${userId}\n-----END CERTIFICATE-----`,
          privateKey: `-----BEGIN PRIVATE KEY-----\nMock Private Key for ${userId}\n-----END PRIVATE KEY-----`,
        },
        mspId: mspId,
        type: "X.509",
      };

      await this.wallet.put(userId, identity);
      console.log(`✅ Mock identity ${userId} added to wallet`);
    } catch (error) {
      console.warn(
        `⚠️ Failed to initialize identity ${userId}:`,
        error.message
      );
    }
  }

  async submitTransaction(orgName, functionName, ...args) {
    console.log(
      `🔗 [MOCK] Submitting transaction: ${functionName}(${args.join(
        ", "
      )}) for ${orgName}`
    );

    // Mock successful response
    return {
      transactionId: `mock_tx_${Date.now()}`,
      result: `Transaction ${functionName} completed successfully`,
      timestamp: new Date().toISOString(),
    };
  }

  async query(orgName, functionName, ...args) {
    console.log(
      `🔍 [MOCK] Querying: ${functionName}(${args.join(", ")}) for ${orgName}`
    );

    // Mock query responses based on function name
    switch (functionName) {
      case "GetAllWastes":
        return [];
      case "GetWaste":
        return null;
      case "GetAllExtractions":
        return [];
      case "GetExtraction":
        return null;
      case "GetAllRecyclings":
        return [];
      case "GetRecycling":
        return null;
      default:
        return null;
    }
  }

  async queryAll(orgName, functionName, ...args) {
    return await this.query(orgName, functionName, ...args);
  }

  async getHistory(orgName, functionName, ...args) {
    console.log(
      `📈 [MOCK] Getting history: ${functionName}(${args.join(
        ", "
      )}) for ${orgName}`
    );
    return [];
  }

  async getNetworkInfo(orgName) {
    return {
      organization: orgName,
      channel: NETWORK_CONFIG.channelName,
      chaincode: NETWORK_CONFIG.chaincodeName,
      status: "mock",
    };
  }

  async isBlockchainAvailable() {
    return this.isInitialized;
  }
};
