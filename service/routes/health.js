const express = require("express");
const { proxyOrFallback } = require("../utils/gatewayProxy");

const router = express.Router();

function localHealth(req, res) {
  res.status(200).json({
    status: "ok",
    service: "zzz-service",
    time: new Date().toISOString()
  });
}

router.get("/", (req, res) =>
  proxyOrFallback(req, res, "/health", localHealth)
);

module.exports = router;