const express = require("express");
const { postFeedback } = require("../controllers/feedbackController");
const { collectPostsleep } = require("../../rpi/google_health/collect_google_health");
const { proxyOrFallback } = require("../utils/gatewayProxy");
const { requireUserIdFromRequest } = require("../utils/userContext");

const router = express.Router();

async function collectPostsleepBeforeFeedback(req, res, next) {
  try {
    const userId = await requireUserIdFromRequest(req);
    console.log("[feedbackRoute] Google Health postsleep sync start");
    await collectPostsleep({ user_id: userId });
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
