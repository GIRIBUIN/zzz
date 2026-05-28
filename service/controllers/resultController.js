const resultService = require("../services/resultService");
const { requireUserIdFromRequest } = require("../utils/userContext");

async function getLatestResult(req, res) {
  try {
    const userId = await requireUserIdFromRequest(req);
    const data = await resultService.getLatestResult(userId);

    res.json({
      status: "ok",
      endpoint: "GET /result/latest",
      data: {
        message: "latest result fetched",
        ...data
      }
    });
  } catch (error) {
    const statusCode = error.message === "user not found" || error.message.includes("user_id")
      ? 400
      : 500;
    res.status(statusCode).json({
      status: "error",
      endpoint: "GET /result/latest",
      message: error.message
    });
  }
}

async function getSleepScoreHistory(req, res) {
  try {
    const userId = await requireUserIdFromRequest(req);
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 30)
      : 7;
    const history = await resultService.getSleepScoreHistory(userId, limit);

    res.json({
      status: "ok",
      endpoint: "GET /result/sleep-score-history",
      data: {
        message: "sleep score history fetched",
        history
      }
    });
  } catch (error) {
    const statusCode = error.message === "user not found" || error.message.includes("user_id")
      ? 400
      : 500;
    res.status(statusCode).json({
      status: "error",
      endpoint: "GET /result/sleep-score-history",
      message: error.message
    });
  }
}

module.exports = {
  getLatestResult,
  getSleepScoreHistory
};
