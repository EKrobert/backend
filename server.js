const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const cors = require("cors");

// Load environment variables
dotenv.config();

const wasteRoutes = require("./api/routes/waste");
const extractionRoutes = require("./api/routes/extraction");
const recyclingRoutes = require("./api/routes/recycling");
const app = express();

// Middleware CORS - utilise la variable d'environnement
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Middleware pour parser JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes API
app.use("/api/waste", wasteRoutes);
app.use("/api/extraction", extractionRoutes);
app.use("/api/recycling", recyclingRoutes);

// Route de santé
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Route racine
app.get("/", (req, res) => {
  res.json({
    message: "Green Olive Chain Backend API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      waste: "/api/waste",
      extraction: "/api/extraction",
      recycling: "/api/recycling",
      blockchain: {
        status: "/api/blockchain/status",
        traceability: "/api/traceability/:wasteId",
      },
    },
  });
});

// Blockchain status route
app.get("/api/blockchain/status", async (req, res) => {
  try {
    const wasteController = require("./api/controllers/wasteController");
    await wasteController.getBlockchainStatus(req, res);
  } catch (error) {
    res.status(500).json({
      error: "Error checking blockchain status",
      details: error.message,
    });
  }
});

// Complete traceability route
app.get("/api/traceability/:wasteId", async (req, res) => {
  try {
    const recyclingController = require("./api/controllers/recyclingController");
    await recyclingController.getCompleteTraceability(req, res);
  } catch (error) {
    res.status(500).json({
      error: "Error fetching traceability data",
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 API available at: http://localhost:${PORT}`);
  console.log(
    `✅ CORS enabled for: ${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }`
  );
});
