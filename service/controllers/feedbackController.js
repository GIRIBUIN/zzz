const { saveFeedback } = require("../services/feedbackService");

async function postFeedback(req, res) {
  try {
    const result = await saveFeedback(req.body);
    console.log("[feedbackController] feedback result:", {
      id: result.id,
      sleep_date: result.sleep_date,
      satisfaction_score: result.satisfaction_score,
      action: result.action,
      post_analysis_action: result.post_analysis?.action || null,
      post_analysis_id: result.post_analysis?.id || null,
      post_analysis_source: result.post_analysis?.source || null
    });

    return res.status(200).json({
      status: "ok",
      endpoint: "POST /feedback",
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: error.message
    });
  }
}

module.exports = {
  postFeedback
};
