const express = require("express");
const { postFeedback } = require("../controllers/feedbackController");
const { proxyOrFallback } = require("../utils/gatewayProxy");

const router = express.Router();

router.post("/", (req, res) =>
  proxyOrFallback(req, res, "/feedback", postFeedback)
);

module.exports = router;