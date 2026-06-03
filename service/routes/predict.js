const express = require("express");
const { postPresleepPrediction } = require("../controllers/predictController");
const { collectPresleep } = require("../../rpi/google_health/collect_google_health");
const { proxyOrFallback } = require("../utils/gatewayProxy");
const { requireUserIdFromRequest } = require("../utils/userContext");

const router = express.Router();

function parseDebugRange(req) {
  const startIso = req.query.debug_start || req.query.start;
  const endIso = req.query.debug_end || req.query.end;

  if (!startIso && !endIso) return {};
  if (!startIso || !endIso) {
    throw new Error("debug_start and debug_end must be provided together");
  }

  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error("invalid debug prediction range");
  }

  return { start_iso: startIso, end_iso: endIso };
}

async function collectPresleepBeforePrediction(req, res, next) {
  if (req.query.skip_collect === "true") {
    return next();
  }

  try {
    const userId = await requireUserIdFromRequest(req);
    const debugRange = parseDebugRange(req);
    console.log("[predictRoute] Google Health presleep sync start");
    await collectPresleep({ user_id: userId, ...debugRange });
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
