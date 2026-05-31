const express = require("express");
const { postPresleepPrediction } = require("../controllers/predictController");
const { collectPresleep } = require("../../rpi/google_health/collect_google_health");
const { proxyOrFallback } = require("../utils/gatewayProxy");
const { requireUserIdFromRequest } = require("../utils/userContext");

const router = express.Router();

async function collectPresleepBeforePrediction(req, res, next) {
  if (req.query.skip_collect === "true") {
    return next();
  }

  try {
    const userId = await requireUserIdFromRequest(req);
    console.log("[predictRoute] Google Health presleep sync start");
    await collectPresleep({ user_id: userId });
    console.log("[predictRoute] Google Health presleep sync complete");
  } catch (error) {
    console.warn("[predictRoute] Google Health presleep sync skipped:", error.message);
  }

  return next();
}

router.post("/presleep", collectPresleepBeforePrediction, (req, res) =>
  proxyOrFallback(req, res, "/predict/presleep", postPresleepPrediction)
);

module.exports = router;
