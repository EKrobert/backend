// Enhanced Extraction Controller with Blockchain Integration
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
      "✅ Enhanced blockchain client initialized successfully for extractions"
    );
  } catch (error) {
    console.error("❌ Blockchain initialization error:", error);
    blockchainInitialized = false;
  }
};

// Initialize on startup
initializeBlockchain();

// Temporary storage for extraction data (will be replaced by blockchain data)
let extractions = [
  {
    id: "EXTRACTION_DEFAULT_1",
    extractionId: "EXTRACTION_DEFAULT_1",
    wasteId: "WASTE_DEFAULT_1",
    processorId: "processor_001",
    extractionDate: new Date().toISOString(),
    productType: "Huile d'olive",
    quantity: 10,
    quality: "Extra Vierge",
    extractionMethod: "Cold Press",
    temperature: "27°C",
    pressure: "3 bars",
    yieldPercentage: 20,
    status: "PROCESSED",
    timestamp: new Date().toISOString(),
  },
];

// Add new extraction with blockchain integration
exports.addExtraction = async (req, res) => {
  console.log("📥 Extraction request received:", req.body);

  try {
    const { extractionData } = req.body;

    if (!extractionData) {
      return res.status(400).json({
        error: "Missing extraction data",
        details: "The 'extractionData' field is required",
      });
    }

    // Validate required fields
    const { wasteId, productType, quantity, quality } = extractionData;
    if (!wasteId || !productType || !quantity || !quality) {
      return res.status(400).json({
        error: "Incomplete data",
        details:
          "All fields are required: wasteId, productType, quantity, quality",
      });
    }

    // Create extraction object with additional blockchain fields
    const extractionId = `EXTRACTION_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const blockchainExtractionData = {
      extractionId,
      wasteId,
      processorId:
        req.body.processorId || extractionData.processorId || "processor_001",
      extractionDate: extractionData.extractionDate || new Date().toISOString(),
      productType,
      quantity: parseFloat(quantity),
      quality,
      extractionMethod: extractionData.extractionMethod || "Cold Press",
      temperature: extractionData.temperature || "27°C",
      pressure: extractionData.pressure || "3 bars",
      yieldPercentage: extractionData.yieldPercentage || 20,
      status: "PROCESSED",
      timestamp: new Date().toISOString(),
    };

    // Try blockchain transaction first
    if (blockchainInitialized) {
      try {
        const result = await blockchainClient.submitTransaction(
          "processor",
          "CreateExtraction",
          extractionId,
          JSON.stringify(blockchainExtractionData)
        );

        console.log("✅ Blockchain extraction transaction successful:", result);

        // Also add to temp storage for immediate UI feedback
        const newExtraction = {
          id: extractionId,
          ...blockchainExtractionData,
        };
        extractions.push(newExtraction);

        // Try to link with waste on blockchain
        try {
          await blockchainClient.submitTransaction(
            "processor",
            "LinkExtractionToWaste",
            wasteId,
            extractionId
          );
          console.log(
            "✅ Successfully linked extraction to waste on blockchain"
          );
        } catch (linkError) {
          console.warn(
            "⚠️ Could not link extraction to waste on blockchain:",
            linkError.message
          );
        }

        return res.status(201).json({
          success: true,
          message: "Extraction successfully recorded on blockchain",
          data: newExtraction,
          blockchainTxId: result?.transactionId || "pending",
          source: "blockchain",
        });
      } catch (blockchainError) {
        console.error("❌ Blockchain error:", blockchainError);

        // Fallback to temporary storage
        const newExtraction = {
          id: extractionId,
          ...blockchainExtractionData,
        };
        extractions.push(newExtraction);

        return res.status(201).json({
          success: true,
          message:
            "Extraction added to temporary storage (blockchain unavailable)",
          data: newExtraction,
          warning:
            "Blockchain temporarily unavailable: " + blockchainError.message,
          source: "fallback",
        });
      }
    } else {
      // Blockchain not initialized, use temporary storage
      const newExtraction = {
        id: extractionId,
        ...blockchainExtractionData,
      };
      extractions.push(newExtraction);

      console.log("⚠️ Blockchain not initialized, data added temporarily");
      return res.status(201).json({
        success: true,
        message:
          "Extraction added to temporary storage (blockchain initializing)",
        data: newExtraction,
        source: "temporary",
      });
    }
  } catch (error) {
    console.error("❌ Error in addExtraction:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Get list of extractions with blockchain integration
exports.listExtractions = async (req, res) => {
  try {
    console.log("📋 Fetching extractions list...");

    let extractionList = [];
    let source = "temporary";

    // Try to fetch from blockchain first
    if (blockchainInitialized) {
      try {
        const blockchainExtractions = await blockchainClient.queryAll(
          "processor",
          "GetAllExtractions"
        );
        if (blockchainExtractions && blockchainExtractions.length > 0) {
          extractionList = blockchainExtractions.map((extraction) => {
            try {
              return typeof extraction === "string"
                ? JSON.parse(extraction)
                : extraction;
            } catch (e) {
              return extraction;
            }
          });
          source = "blockchain";
          console.log(
            `✅ Retrieved ${extractionList.length} extractions from blockchain`
          );
        } else {
          // No blockchain data, use temporary
          extractionList = extractions;
          source = "temporary";
        }
      } catch (blockchainError) {
        console.error("❌ Blockchain query error:", blockchainError);
        // Fall back to temporary data
        extractionList = extractions;
        source = "fallback";
      }
    } else {
      // Use temporary data
      extractionList = extractions;
    }

    res.status(200).json({
      success: true,
      data: extractionList,
      count: extractionList.length,
      source: source,
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ Sent list of ${extractionList.length} extractions`);
  } catch (error) {
    console.error("❌ Error in listExtractions:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Get extraction by ID with blockchain integration
exports.getExtractionById = async (req, res) => {
  try {
    const { extractionId } = req.params;

    if (!extractionId) {
      return res.status(400).json({
        error: "Missing extractionId parameter",
      });
    }

    console.log(`🔍 Fetching extraction ${extractionId}`);

    // Try blockchain query first
    if (blockchainInitialized) {
      try {
        const blockchainExtraction = await blockchainClient.query(
          "processor",
          "GetExtraction",
          extractionId
        );
        if (blockchainExtraction) {
          const extractionData =
            typeof blockchainExtraction === "string"
              ? JSON.parse(blockchainExtraction)
              : blockchainExtraction;

          return res.status(200).json({
            success: true,
            data: extractionData,
            source: "blockchain",
          });
        }
      } catch (blockchainError) {
        console.error("❌ Blockchain query error:", blockchainError);
      }
    }

    // Fallback: search in temporary data
    const extraction = extractions.find(
      (e) => e.id === extractionId || e.extractionId === extractionId
    );
    if (extraction) {
      return res.status(200).json({
        success: true,
        data: extraction,
        source: blockchainInitialized ? "fallback" : "temporary",
      });
    } else {
      return res.status(404).json({
        error: "Extraction not found",
        extractionId: extractionId,
      });
    }
  } catch (error) {
    console.error("❌ Error in getExtractionById:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Get extractions by waste ID with blockchain integration
exports.getExtractionsByWasteId = async (req, res) => {
  try {
    const { wasteId } = req.params;

    if (!wasteId) {
      return res.status(400).json({
        error: "Missing wasteId parameter",
      });
    }

    console.log(`🔍 Fetching extractions for waste ${wasteId}`);

    let relatedExtractions = [];
    let source = "temporary";

    // Try blockchain query first
    if (blockchainInitialized) {
      try {
        const blockchainExtractions = await blockchainClient.query(
          "processor",
          "GetExtractionsByWasteId",
          wasteId
        );
        if (blockchainExtractions && blockchainExtractions.length > 0) {
          relatedExtractions = blockchainExtractions.map((extraction) => {
            try {
              return typeof extraction === "string"
                ? JSON.parse(extraction)
                : extraction;
            } catch (e) {
              return extraction;
            }
          });
          source = "blockchain";
        }
      } catch (blockchainError) {
        console.error("❌ Blockchain query error:", blockchainError);
        // Fall back to temporary data
        relatedExtractions = extractions.filter((e) => e.wasteId === wasteId);
        source = "fallback";
      }
    } else {
      // Use temporary data
      relatedExtractions = extractions.filter((e) => e.wasteId === wasteId);
    }

    res.status(200).json({
      success: true,
      data: relatedExtractions,
      count: relatedExtractions.length,
      wasteId: wasteId,
      source: source,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error in getExtractionsByWasteId:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Update extraction status with blockchain integration
exports.updateExtractionStatus = async (req, res) => {
  try {
    const { extractionId, newStatus, updateData } = req.body;

    if (!extractionId || !newStatus) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "extractionId and newStatus are required",
      });
    }

    console.log(
      `🔄 Updating extraction ${extractionId} status to ${newStatus}`
    );

    // Try blockchain update first
    if (blockchainInitialized) {
      try {
        const updatePayload = {
          status: newStatus,
          updatedAt: new Date().toISOString(),
          ...updateData,
        };

        const result = await blockchainClient.submitTransaction(
          "processor",
          "UpdateExtractionStatus",
          extractionId,
          newStatus,
          JSON.stringify(updatePayload)
        );

        console.log("✅ Blockchain extraction status update successful");

        // Also update temporary storage for consistency
        const extractionIndex = extractions.findIndex(
          (e) => e.id === extractionId || e.extractionId === extractionId
        );
        if (extractionIndex !== -1) {
          extractions[extractionIndex] = {
            ...extractions[extractionIndex],
            status: newStatus,
            ...updatePayload,
          };
        }

        return res.status(200).json({
          success: true,
          message: "Extraction status updated on blockchain",
          extractionId: extractionId,
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
    const extractionIndex = extractions.findIndex(
      (e) => e.id === extractionId || e.extractionId === extractionId
    );
    if (extractionIndex !== -1) {
      extractions[extractionIndex] = {
        ...extractions[extractionIndex],
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...updateData,
      };

      return res.status(200).json({
        success: true,
        message: "Extraction status updated in temporary storage",
        extractionId: extractionId,
        newStatus: newStatus,
        source: blockchainInitialized ? "fallback" : "temporary",
      });
    } else {
      return res.status(404).json({
        error: "Extraction not found",
        extractionId: extractionId,
      });
    }
  } catch (error) {
    console.error("❌ Error in updateExtractionStatus:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};
