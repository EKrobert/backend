// Enhanced Recycling Controller with Blockchain Integration
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
    console.log(
      "✅ Enhanced blockchain client initialized successfully for recycling"
    );
  } catch (error) {
    console.error("❌ Blockchain initialization error:", error);
    blockchainInitialized = false;
  }
};

// Initialize on startup
initializeBlockchain();

// Temporary storage for recycling data (will be replaced by blockchain data)
let recyclings = [
  {
    id: "RECYCLING_DEFAULT_1",
    recyclingId: "RECYCLING_DEFAULT_1",
    wasteId: "WASTE_DEFAULT_2",
    recyclerId: "recycler_001",
    recyclingDate: new Date().toISOString(),
    recycledProduct: "Compost",
    quantity: 25,
    method: "Compostage",
    qualityGrade: "Premium",
    processingTime: "14 days",
    environmentalImpact: "Carbon Negative",
    certifications: ["Organic", "EU Certified"],
    status: "COMPLETED",
    timestamp: new Date().toISOString(),
  },
];

// Add new recycling with blockchain integration
exports.addRecycling = async (req, res) => {
  console.log("📥 Recycling request received:", req.body);

  try {
    const { recyclingData } = req.body;

    if (!recyclingData) {
      return res.status(400).json({
        error: "Missing recycling data",
        details: "The 'recyclingData' field is required",
      });
    }

    // Validate required fields
    const { wasteId, recycledProduct, quantity, method } = recyclingData;
    if (!wasteId || !recycledProduct || !quantity || !method) {
      return res.status(400).json({
        error: "Incomplete data",
        details:
          "All fields are required: wasteId, recycledProduct, quantity, method",
      });
    }

    // Create recycling object with additional blockchain fields
    const recyclingId = `RECYCLING_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const blockchainRecyclingData = {
      recyclingId,
      wasteId,
      recyclerId:
        req.body.recyclerId || recyclingData.recyclerId || "recycler_001",
      recyclingDate: recyclingData.recyclingDate || new Date().toISOString(),
      recycledProduct,
      quantity: parseFloat(quantity),
      method,
      qualityGrade: recyclingData.qualityGrade || "Standard",
      processingTime: recyclingData.processingTime || "7 days",
      environmentalImpact: recyclingData.environmentalImpact || "Positive",
      certifications: recyclingData.certifications || ["Standard"],
      status: "COMPLETED",
      timestamp: new Date().toISOString(),
    };

    // Try blockchain transaction first
    if (blockchainInitialized) {
      try {
        const result = await blockchainClient.submitTransaction(
          "recycler",
          "CreateRecycling",
          recyclingId,
          JSON.stringify(blockchainRecyclingData)
        );

        console.log("✅ Blockchain recycling transaction successful:", result);

        // Also add to temp storage for immediate UI feedback
        const newRecycling = {
          id: recyclingId,
          ...blockchainRecyclingData,
        };
        recyclings.push(newRecycling);

        // Try to link with waste on blockchain
        try {
          await blockchainClient.submitTransaction(
            "recycler",
            "LinkRecyclingToWaste",
            wasteId,
            recyclingId
          );
          console.log(
            "✅ Successfully linked recycling to waste on blockchain"
          );
        } catch (linkError) {
          console.warn(
            "⚠️ Could not link recycling to waste on blockchain:",
            linkError.message
          );
        }

        return res.status(201).json({
          success: true,
          message: "Recycling successfully recorded on blockchain",
          data: newRecycling,
          blockchainTxId: result?.transactionId || "pending",
          source: "blockchain",
        });
      } catch (blockchainError) {
        console.error("❌ Blockchain error:", blockchainError);

        // Fallback to temporary storage
        const newRecycling = {
          id: recyclingId,
          ...blockchainRecyclingData,
        };
        recyclings.push(newRecycling);

        return res.status(201).json({
          success: true,
          message:
            "Recycling added to temporary storage (blockchain unavailable)",
          data: newRecycling,
          warning:
            "Blockchain temporarily unavailable: " + blockchainError.message,
          source: "fallback",
        });
      }
    } else {
      // Blockchain not initialized, use temporary storage
      const newRecycling = {
        id: recyclingId,
        ...blockchainRecyclingData,
      };
      recyclings.push(newRecycling);

      console.log("⚠️ Blockchain not initialized, data added temporarily");
      return res.status(201).json({
        success: true,
        message:
          "Recycling added to temporary storage (blockchain initializing)",
        data: newRecycling,
        source: "temporary",
      });
    }
  } catch (error) {
    console.error("❌ Error in addRecycling:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Get list of recyclings with blockchain integration
exports.listRecyclings = async (req, res) => {
  try {
    console.log("📋 Fetching recyclings list...");

    let recyclingList = [];
    let source = "temporary";

    // Try to fetch from blockchain first
    if (blockchainInitialized) {
      try {
        const blockchainRecyclings = await blockchainClient.queryAll(
          "recycler",
          "GetAllRecyclings"
        );
        if (blockchainRecyclings && blockchainRecyclings.length > 0) {
          recyclingList = blockchainRecyclings.map((recycling) => {
            try {
              return typeof recycling === "string"
                ? JSON.parse(recycling)
                : recycling;
            } catch (e) {
              return recycling;
            }
          });
          source = "blockchain";
          console.log(
            `✅ Retrieved ${recyclingList.length} recyclings from blockchain`
          );
        } else {
          // No blockchain data, use temporary
          recyclingList = recyclings;
          source = "temporary";
        }
      } catch (blockchainError) {
        console.error("❌ Blockchain query error:", blockchainError);
        // Fall back to temporary data
        recyclingList = recyclings;
        source = "fallback";
      }
    } else {
      // Use temporary data
      recyclingList = recyclings;
    }

    res.status(200).json({
      success: true,
      data: recyclingList,
      count: recyclingList.length,
      source: source,
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ Sent list of ${recyclingList.length} recyclings`);
  } catch (error) {
    console.error("❌ Error in listRecyclings:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Get recycling by ID with blockchain integration
exports.getRecyclingById = async (req, res) => {
  try {
    const { recyclingId } = req.params;

    if (!recyclingId) {
      return res.status(400).json({
        error: "Missing recyclingId parameter",
      });
    }

    console.log(`🔍 Fetching recycling ${recyclingId}`);

    // Try blockchain query first
    if (blockchainInitialized) {
      try {
        const blockchainRecycling = await blockchainClient.query(
          "recycler",
          "GetRecycling",
          recyclingId
        );
        if (blockchainRecycling) {
          const recyclingData =
            typeof blockchainRecycling === "string"
              ? JSON.parse(blockchainRecycling)
              : blockchainRecycling;

          return res.status(200).json({
            success: true,
            data: recyclingData,
            source: "blockchain",
          });
        }
      } catch (blockchainError) {
        console.error("❌ Blockchain query error:", blockchainError);
      }
    }

    // Fallback: search in temporary data
    const recycling = recyclings.find(
      (r) => r.id === recyclingId || r.recyclingId === recyclingId
    );
    if (recycling) {
      return res.status(200).json({
        success: true,
        data: recycling,
        source: blockchainInitialized ? "fallback" : "temporary",
      });
    } else {
      return res.status(404).json({
        error: "Recycling not found",
        recyclingId: recyclingId,
      });
    }
  } catch (error) {
    console.error("❌ Error in getRecyclingById:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Get recyclings by waste ID with blockchain integration
exports.getRecyclingsByWasteId = async (req, res) => {
  try {
    const { wasteId } = req.params;

    if (!wasteId) {
      return res.status(400).json({
        error: "Missing wasteId parameter",
      });
    }

    console.log(`🔍 Fetching recyclings for waste ${wasteId}`);

    let relatedRecyclings = [];
    let source = "temporary";

    // Try blockchain query first
    if (blockchainInitialized) {
      try {
        const blockchainRecyclings = await blockchainClient.query(
          "recycler",
          "GetRecyclingsByWasteId",
          wasteId
        );
        if (blockchainRecyclings && blockchainRecyclings.length > 0) {
          relatedRecyclings = blockchainRecyclings.map((recycling) => {
            try {
              return typeof recycling === "string"
                ? JSON.parse(recycling)
                : recycling;
            } catch (e) {
              return recycling;
            }
          });
          source = "blockchain";
        }
      } catch (blockchainError) {
        console.error("❌ Blockchain query error:", blockchainError);
        // Fall back to temporary data
        relatedRecyclings = recyclings.filter((r) => r.wasteId === wasteId);
        source = "fallback";
      }
    } else {
      // Use temporary data
      relatedRecyclings = recyclings.filter((r) => r.wasteId === wasteId);
    }

    res.status(200).json({
      success: true,
      data: relatedRecyclings,
      count: relatedRecyclings.length,
      wasteId: wasteId,
      source: source,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error in getRecyclingsByWasteId:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Get complete traceability chain with blockchain integration
exports.getCompleteTraceability = async (req, res) => {
  try {
    const { wasteId } = req.params;

    if (!wasteId) {
      return res.status(400).json({
        error: "Missing wasteId parameter",
      });
    }

    console.log(`🔗 Building complete traceability chain for waste ${wasteId}`);

    let traceabilityChain = {
      wasteId: wasteId,
      waste: null,
      extractions: [],
      recyclings: [],
      source: "constructed",
    };

    // Try blockchain complete traceability query first
    if (blockchainInitialized) {
      try {
        const blockchainTrace = await blockchainClient.query(
          "recycler",
          "GetCompleteTraceability",
          wasteId
        );
        if (blockchainTrace) {
          const traceData =
            typeof blockchainTrace === "string"
              ? JSON.parse(blockchainTrace)
              : blockchainTrace;

          return res.status(200).json({
            success: true,
            data: traceData,
            source: "blockchain",
          });
        }
      } catch (blockchainError) {
        console.error(
          "❌ Blockchain traceability query error:",
          blockchainError
        );
      }
    }

    // Fallback: construct from individual components
    try {
      // Get waste data
      const wasteResponse = await fetch(`http://localhost:5000/api/waste`);
      if (wasteResponse.ok) {
        const wasteData = await wasteResponse.json();
        traceabilityChain.waste =
          wasteData.data?.find(
            (w) => w.id === wasteId || w.wasteId === wasteId
          ) || null;
      }

      // Get extraction data
      const extractionResponse = await fetch(
        `http://localhost:5000/api/extraction`
      );
      if (extractionResponse.ok) {
        const extractionData = await extractionResponse.json();
        traceabilityChain.extractions =
          extractionData.data?.filter((e) => e.wasteId === wasteId) || [];
      }

      // Get recycling data
      traceabilityChain.recyclings = recyclings.filter(
        (r) => r.wasteId === wasteId
      );
    } catch (fetchError) {
      console.error("❌ Error fetching related data:", fetchError);
      // Use basic data if API calls fail
      traceabilityChain.recyclings = recyclings.filter(
        (r) => r.wasteId === wasteId
      );
    }

    res.status(200).json({
      success: true,
      data: traceabilityChain,
      source: blockchainInitialized ? "fallback" : "temporary",
    });
  } catch (error) {
    console.error("❌ Error in getCompleteTraceability:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};
