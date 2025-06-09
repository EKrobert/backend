const express = require("express");
const router = express.Router();
const extractionController = require("../controllers/extractionController");

// Basic extraction operations
router.post("/add", extractionController.addExtraction);
router.get("/list", extractionController.listExtractions);
router.get("/", extractionController.listExtractions); // Alternative endpoint

// Enhanced blockchain routes
router.get("/by-id/:extractionId", extractionController.getExtractionById);
router.get("/by-waste/:wasteId", extractionController.getExtractionsByWasteId);
router.put("/update-status", extractionController.updateExtractionStatus);

module.exports = router;
