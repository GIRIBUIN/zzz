const { saveFeedback } = require("../services/feedbackService");

function addIfPresent(target, key, value) {
  if (value !== null && value !== undefined) {
    target[key] = value;
  }
}

async function postFeedback(req, res) {
  try {
    const result = await saveFeedback(req.body);
    const logPayload = {
      id: result.id,
      sleep_date: result.sleep_date,
      satisfaction_score: result.satisfaction_score,
      action: result.action,
      sleep_score_action: result.sleep_score?.action,
      pattern_action: result.pattern?.action,
      post_analysis_action: result.post_analysis?.action
    };

    addIfPresent(logPayload, "sleep_score_collection", result.sleep_score?.collection?.action);
    addIfPresent(logPayload, "post_analysis_id", result.post_analysis?.id);
    addIfPresent(logPayload, "post_analysis_source", result.post_analysis?.source);

    console.log("[feedbackController] feedback result:", logPayload);

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
