const express = require("express");
const router = express.Router();
const resultController = require("../controllers/resultController");
const { proxyOrFallback } = require("../utils/gatewayProxy");

router.get("/latest", (req, res) =>
  proxyOrFallback(req, res, "/result/latest", resultController.getLatestResult)
);

router.get("/sleep-score-history", (req, res) =>
  proxyOrFallback(req, res, "/result/sleep-score-history", resultController.getSleepScoreHistory)
);

module.exports = router;