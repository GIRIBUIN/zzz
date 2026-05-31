const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const healthRouter = require("./routes/health");
const authRouter = require("./routes/auth");
const googleHealthRouter = require("./routes/googleHealth");
const predictRouter = require("./routes/predict");
const resultRouter = require("./routes/result");
const feedbackRouter = require("./routes/feedback");
const devicesRouter = require("./routes/devices");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/google-health", googleHealthRouter);
app.use("/predict", predictRouter);
app.use("/result", resultRouter);
app.use("/feedback", feedbackRouter);
app.use("/devices", devicesRouter);

app.get("/js/runtime-config.js", (req, res) => {
  const config = {
    apiGatewayBaseUrl: process.env.API_GATEWAY_BASE_URL || ""
  };

  res.type("application/javascript");
  res.send(`window.ZZZ_CONFIG = Object.assign({}, window.ZZZ_CONFIG, ${JSON.stringify(config)});`);
});

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Root page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`ZZZ service running on http://localhost:${PORT}`);
});
