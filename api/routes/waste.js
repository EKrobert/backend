const express = require("express");
const router = express.Router();
const wasteController = require("../controllers/wasteController");

// Basic waste operations
router.post("/add", wasteController.addWaste);
router.get("/list", wasteController.listWaste);
router.get("/", wasteController.listWaste); // Alternative endpoint
router.put("/update-status", wasteController.updateWasteStatus);

// Blockchain-specific routes
router.get("/history/:wasteId", wasteController.getWasteHistory);
router.get("/blockchain-status", wasteController.getBlockchainStatus);

module.exports = router;
