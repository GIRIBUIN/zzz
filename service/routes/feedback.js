const express = require("express");
const { postFeedback } = require("../controllers/feedbackController");
const { collectPostsleep } = require("../../rpi/google_health/collect_google_health");
const { proxyOrFallback } = require("../utils/gatewayProxy");
const { requireUserIdFromRequest } = require("../utils/userContext");
const { previousDateString } = require("../../utils/time");

const router = express.Router();

async function collectPostsleepBeforeFeedback(req, res, next) {
  try {
    const userId = await requireUserIdFromRequest(req);
    const wakeDate = req.body?.sleep_date;
    const sleepDate = previousDateString(wakeDate);
    console.log("[feedbackRoute] Google Health postsleep sync start");
    await collectPostsleep({ user_id: userId, wake_date: wakeDate, sleep_date: sleepDate });
    console.log("[feedbackRoute] Google Health postsleep sync complete");
  } catch (error) {
    console.warn("[feedbackRoute] Google Health postsleep sync skipped:", error.message);
  }

  next();
}

router.post("/", collectPostsleepBeforeFeedback, (req, res) =>
  proxyOrFallback(req, res, "/feedback", postFeedback)
);

module.exports = router;
