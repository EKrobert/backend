// Enhanced Waste Controller with Blockchain Integration
const path = require("path");
const BlockchainClient = require(path.join(
  __dirname,
  "..",
  "..",
  "blockchain",
  "enhancedClient"
));

// Initialize enhanced blockchain client
const blockchainClient = new BlockchainClient();
let blockchainInitialized = false;

const initializeBlockchain = async () => {
  try {
    await blockchainClient.initialize();
    blockchainInitialized = true;
    console.log("✅ Enhanced blockchain client initialized successfully");
  } catch (error) {
    console.error("❌ Blockchain initialization error:", error);
    blockchainInitialized = false;
  }
};

// Initialize on startup
initializeBlockchain();

// Temporary data for development (will be replaced by blockchain data)
let tempWastes = [
  {
    id: "WASTE_DEFAULT_1",
    wasteId: "WASTE_DEFAULT_1",
    farmerId: "farmer_001",
    type: "Branches",
    quantity: 50,
    harvestDate: new Date().toISOString(),
    status: "READY",
    location: "Farm Block A",
    qualityGrade: "A",
    moistureContent: "15%",
    timestamp: new Date().toISOString(),
    transferDate: null,
  },
  {
    id: "WASTE_DEFAULT_2",
    wasteId: "WASTE_DEFAULT_2",
    farmerId: "farmer_001",
    type: "Feuilles",
    quantity: 30,
    harvestDate: new Date(Date.now() - 86400000).toISOString(),
    status: "TRANSFERRED",
    location: "Farm Block B",
    qualityGrade: "A",
    moistureContent: "18%",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    transferDate: new Date().toISOString(),
  },
];

// Create new waste with blockchain integration
exports.addWaste = async (req, res) => {
  console.log("📥 Waste creation request received:", req.body);

  try {
    const { wasteData } = req.body;

    if (!wasteData) {
      return res.status(400).json({
        error: "Missing waste data",
        details: "The 'wasteData' field is required",
      });
    }

    // Validate required fields
    const { type, quantity, harvestDate, status } = wasteData;
    if (!type || !quantity || !harvestDate || !status) {
      return res.status(400).json({
        error: "Incomplete data",
        details: "All fields are required: type, quantity, harvestDate, status",
      });
    }

    // Create waste object with additional blockchain fields
    const wasteId = `WASTE_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const blockchainWasteData = {
      wasteId,
      farmerId: req.body.farmerId || wasteData.farmerId || "farmer_001",
      type,
      quantity: parseFloat(quantity),
      harvestDate,
      status,
      location:
        req.body.location || wasteData.location || "Default Farm Location",
      qualityGrade: req.body.qualityGrade || wasteData.qualityGrade || "A",
      moistureContent:
        req.body.moistureContent || wasteData.moistureContent || "15%",
      timestamp: new Date().toISOString(),
      transferDate: null,
    };

    // Try blockchain transaction first
    if (blockchainInitialized) {
      try {
        const result = await blockchainClient.submitTransaction(
          "farmer",
          "CreateWaste",
          wasteId,
          JSON.stringify(blockchainWasteData)
        );

        console.log("✅ Blockchain transaction successful:", result);

        // Also add to temp storage for immediate UI feedback
        const newWaste = {
          id: wasteId,
          ...blockchainWasteData,
        };
        tempWastes.push(newWaste);

        return res.status(201).json({
          success: true,
          message: "Waste successfully recorded on blockchain",
          data: newWaste,
          blockchainTxId: result?.transactionId || "pending",
          source: "blockchain",
        });
      } catch (blockchainError) {
        console.error("❌ Blockchain error:", blockchainError);

        // Fallback to temporary storage
        const newWaste = {
          id: wasteId,
          ...blockchainWasteData,
        };
        tempWastes.push(newWaste);

        return res.status(201).json({
          success: true,
          message: "Waste added to temporary storage (blockchain unavailable)",
          data: newWaste,
          warning:
            "Blockchain temporarily unavailable: " + blockchainError.message,
          source: "fallback",
        });
      }
    } else {
      // Blockchain not initialized, use temporary storage
      const newWaste = {
        id: wasteId,
        ...blockchainWasteData,
      };
      tempWastes.push(newWaste);

      console.log("⚠️ Blockchain not initialized, data added temporarily");
      return res.status(201).json({
        success: true,
        message: "Waste added to temporary storage (blockchain initializing)",
        data: newWaste,
        source: "temporary",
      });
    }
  } catch (error) {
    console.error("❌ Error in addWaste:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Get waste list with blockchain integration
exports.listWaste = async (req, res) => {
  try {
    console.log("📋 Fetching waste list...");

    let wastes = [];
    let source = "temporary";

    // Try to fetch from blockchain first
    if (blockchainInitialized) {
      try {
        const blockchainWastes = await blockchainClient.queryAll(
          "farmer",
          "GetAllWastes"
        );
        if (blockchainWastes && blockchainWastes.length > 0) {
          wastes = blockchainWastes.map((waste) => {
            try {
              return typeof waste === "string" ? JSON.parse(waste) : waste;
            } catch (e) {
              return waste;
            }
          });
          source = "blockchain";
          console.log(`✅ Retrieved ${wastes.length} wastes from blockchain`);
        } else {
          // No blockchain data, use temporary
          wastes = tempWastes;
          source = "temporary";
        }
      } catch (blockchainError) {
        console.error("❌ Blockchain query error:", blockchainError);
        // Fall back to temporary data
        wastes = tempWastes;
        source = "fallback";
      }
    } else {
      // Use temporary data
      wastes = tempWastes;
    }

    res.status(200).json({
      success: true,
      data: wastes,
      count: wastes.length,
      source: source,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error in listWaste:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Update waste status with blockchain integration
exports.updateWasteStatus = async (req, res) => {
  try {
    const { wasteId, newStatus, transferData } = req.body;

    if (!wasteId || !newStatus) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "wasteId and newStatus are required",
      });
    }

    console.log(`🔄 Updating waste ${wasteId} status to ${newStatus}`);

    // Try blockchain update first
    if (blockchainInitialized) {
      try {
        const updateData = {
          status: newStatus,
          transferDate: transferData?.transferDate || new Date().toISOString(),
          processorId: transferData?.processorId || "processor_001",
          updatedAt: new Date().toISOString(),
        };

        const result = await blockchainClient.submitTransaction(
          "farmer",
          "UpdateWasteStatus",
          wasteId,
          newStatus,
          JSON.stringify(updateData)
        );

        console.log("✅ Blockchain status update successful");

        // Also update temporary storage for consistency
        const wasteIndex = tempWastes.findIndex(
          (w) => w.id === wasteId || w.wasteId === wasteId
        );
        if (wasteIndex !== -1) {
          tempWastes[wasteIndex] = {
            ...tempWastes[wasteIndex],
            status: newStatus,
            ...updateData,
          };
        }

        return res.status(200).json({
          success: true,
          message: "Waste status updated on blockchain",
          wasteId: wasteId,
          newStatus: newStatus,
          blockchainTxId: result?.transactionId || "pending",
          source: "blockchain",
        });
      } catch (blockchainError) {
        console.error("❌ Blockchain update error:", blockchainError);
        // Fall back to temporary storage update
      }
    }

    // Update temporary storage (fallback or if blockchain not available)
    const wasteIndex = tempWastes.findIndex(
      (w) => w.id === wasteId || w.wasteId === wasteId
    );
    if (wasteIndex !== -1) {
      tempWastes[wasteIndex] = {
        ...tempWastes[wasteIndex],
        status: newStatus,
        transferDate: transferData?.transferDate || new Date().toISOString(),
        processorId: transferData?.processorId || "processor_001",
        updatedAt: new Date().toISOString(),
      };

      return res.status(200).json({
        success: true,
        message: "Waste status updated in temporary storage",
        wasteId: wasteId,
        newStatus: newStatus,
        source: blockchainInitialized ? "fallback" : "temporary",
      });
    } else {
      return res.status(404).json({
        error: "Waste not found",
        wasteId: wasteId,
      });
    }
  } catch (error) {
    console.error("❌ Error in updateWasteStatus:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Get waste traceability history with blockchain integration
exports.getWasteHistory = async (req, res) => {
  try {
    const { wasteId } = req.params;

    if (!wasteId) {
      return res.status(400).json({
        error: "Missing wasteId parameter",
      });
    }

    console.log(`📈 Fetching history for waste ${wasteId}`);

    // Try blockchain history query first
    if (blockchainInitialized) {
      try {
        const history = await blockchainClient.getHistory(
          "farmer",
          "GetWasteHistory",
          wasteId
        );

        if (history && history.length > 0) {
          return res.status(200).json({
            success: true,
            data: history,
            wasteId: wasteId,
            source: "blockchain",
          });
        }
      } catch (blockchainError) {
        console.error("❌ Blockchain history query error:", blockchainError);
      }
    }

    // Fallback: construct basic history from current state
    const waste = tempWastes.find(
      (w) => w.id === wasteId || w.wasteId === wasteId
    );
    if (waste) {
      const basicHistory = [
        {
          timestamp: waste.timestamp || waste.harvestDate,
          action: "CREATED",
          status: "READY",
          details: "Waste created and ready for processing",
        },
      ];

      if (waste.status === "TRANSFERRED" && waste.transferDate) {
        basicHistory.push({
          timestamp: waste.transferDate,
          action: "TRANSFERRED",
          status: "TRANSFERRED",
          details: "Waste transferred to processor",
        });
      }

      return res.status(200).json({
        success: true,
        data: basicHistory,
        wasteId: wasteId,
        source: "constructed",
      });
    } else {
      return res.status(404).json({
        error: "Waste not found",
        wasteId: wasteId,
      });
    }
  } catch (error) {
    console.error("❌ Error in getWasteHistory:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Get blockchain network status
exports.getBlockchainStatus = async (req, res) => {
  try {
    let status = {
      initialized: blockchainInitialized,
      timestamp: new Date().toISOString(),
    };

    if (blockchainInitialized) {
      try {
        const networkInfo = await blockchainClient.getNetworkInfo("farmer");
        status = {
          ...status,
          connected: true,
          network: networkInfo,
        };
      } catch (error) {
        status = {
          ...status,
          connected: false,
          error: error.message,
        };
      }
    } else {
      status.connected = false;
    }

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("❌ Error in getBlockchainStatus:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};
