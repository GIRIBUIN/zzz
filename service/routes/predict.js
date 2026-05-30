const express = require("express");
const { postPresleepPrediction } = require("../controllers/predictController");
const { proxyOrFallback } = require("../utils/gatewayProxy");

const router = express.Router();

router.post("/presleep", (req, res) =>
  proxyOrFallback(req, res, "/predict/presleep", postPresleepPrediction)
);

module.exports = router;