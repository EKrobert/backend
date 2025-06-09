const express = require("express");
const router = express.Router();
const recyclingController = require("../controllers/recyclingController");

// Basic recycling operations
router.post("/add", recyclingController.addRecycling);
router.get("/list", recyclingController.listRecyclings);
router.get("/", recyclingController.listRecyclings); // Alternative endpoint

// Enhanced blockchain routes
router.get("/by-id/:recyclingId", recyclingController.getRecyclingById);
router.get("/by-waste/:wasteId", recyclingController.getRecyclingsByWasteId);
router.get(
  "/traceability/:wasteId",
  recyclingController.getCompleteTraceability
);

module.exports = router;
