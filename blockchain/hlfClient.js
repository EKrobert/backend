// const { Wallets, Gateway } = require('fabric-network');
// const path = require('path');
// const fs = require('fs');

// const connect = async (userIdentity) => {
//   const wallet = await Wallets.newFileSystemWallet('./blockchain/wallet');

//   const gateway = new Gateway();
//   const ccpPath = path.resolve(__dirname, '../network/connection-farmer.json');
//   const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

//   await gateway.connect(ccp, {
//     wallet,
//     identity: userIdentity,
//     discovery: { enabled: true, asLocalhost: true }
//   });

//   return gateway;
// };

// module.exports = {
//   submitTransaction: async (userIdentity, channelName, contractName, txName, ...args) => {
//     const gateway = await connect(userIdentity);
//     try {
//       const network = await gateway.getNetwork(channelName);
//       const contract = network.getContract(contractName);
//       const result = await contract.submitTransaction(txName, ...args);
//       return JSON.parse(result.toString());
//     } finally {
//       gateway.disconnect();
//     }
//   }
// };

const { Wallets, Gateway } = require("fabric-network");
const fs = require("fs");
const path = require("path");

// Chemins corrigés pour utiliser le répertoire du projet
const PROJECT_ROOT = __dirname; // Utilise le répertoire du script
const NETWORK_ROOT = path.join(PROJECT_ROOT, "network");
const WALLET_PATH = path.join(PROJECT_ROOT, "wallet");

// Fonction pour initialiser le wallet avec User1 (charge l'identité si pas déjà dans le wallet)
async function initWallet() {
  // Créer le wallet filesystem
  const wallet = await Wallets.newFileSystemWallet(WALLET_PATH);

  // Créer le dossier wallet s'il n'existe pas
  if (!fs.existsSync(WALLET_PATH)) {
    fs.mkdirSync(WALLET_PATH, { recursive: true });
  }

  const userId = "User1@farmer.olive.com";

  // Vérifier si identité User1 est déjà dans le wallet
  const identity = await wallet.get(userId);
  if (!identity) {
    // Charger certificat et clé privée depuis crypto-config (généré par cryptogen)
    const certPath = path.join(
      NETWORK_ROOT,
      "crypto-config",
      "peerOrganizations",
      "farmer.olive.com",
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
      "farmer.olive.com",
      "users",
      userId,
      "msp",
      "keystore"
    );

    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificat utilisateur introuvable : ${certPath}`);
    }

    const keyFiles = fs.readdirSync(keyDir);
    if (keyFiles.length === 0) {
      throw new Error(`Aucune clé privée trouvée dans : ${keyDir}`);
    }

    const privateKeyPath = path.join(keyDir, keyFiles[0]);

    const identity = {
      credentials: {
        certificate: fs.readFileSync(certPath, "utf8"),
        privateKey: fs.readFileSync(privateKeyPath, "utf8"),
      },
      mspId: "FarmerOrgMSP",
      type: "X.509",
    };

    await wallet.put(userId, identity);
    console.log(`✅ Identité ${userId} ajoutée au wallet`);
  } else {
    console.log(`ℹ️ Identité ${userId} déjà présente dans le wallet`);
  }

  return wallet;
}

async function submitTransaction(
  userId,
  channelName,
  chaincodeName,
  fcn,
  ...args
) {
  let gateway;
  try {
    const wallet = await Wallets.newFileSystemWallet(WALLET_PATH);

    // Vérifier que l'identité existe dans le wallet
    const identity = await wallet.get(userId);
    if (!identity) {
      throw new Error(
        `Identité "${userId}" introuvable dans le wallet. Assurez-vous qu'elle est bien ajoutée.`
      );
    }

    // Config manuelle de la connexion (pas de fichier JSON)
    const connectionProfile = {
      name: "olive-network",
      version: "1.0",
      client: {
        organization: "FarmerOrg",
      },
      organizations: {
        FarmerOrg: {
          mspid: "FarmerOrgMSP",
          peers: ["peer0.farmer.olive.com"],
        },
      },
      peers: {
        "peer0.farmer.olive.com": {
          url: "grpcs://localhost:7051",
          tlsCACerts: {
            path: path.join(
              NETWORK_ROOT,
              "crypto-config",
              "peerOrganizations",
              "farmer.olive.com",
              "tlsca",
              "tlsca.farmer.olive.com-cert.pem"
            ),
          },
        },
      },
    };

    gateway = new Gateway();
    await gateway.connect(connectionProfile, {
      identity: userId,
      wallet,
      discovery: { enabled: true, asLocalhost: true },
    });

    const network = await gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);
    const result = await contract.submitTransaction(fcn, ...args);

    await gateway.disconnect();

    try {
      return JSON.parse(result.toString());
    } catch {
      return result.toString();
    }
  } catch (error) {
    console.error(`Échec de la transaction: ${error.stack}`);
    if (gateway) {
      await gateway.disconnect();
    }
    throw error;
  }
}

module.exports = { initWallet, submitTransaction };
