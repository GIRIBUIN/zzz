const resultService = require("../services/resultService");

async function getLatestResult(req, res) {
  try {
    const data = await resultService.getLatestResult();

    res.json({
      status: "ok",
      endpoint: "GET /result/latest",
      data: {
        message: "latest result fetched",
        ...data
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      endpoint: "GET /result/latest",
      message: error.message
    });
  }
}

async function getSleepScoreHistory(req, res) {
  try {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 30)
      : 7;
    const history = await resultService.getSleepScoreHistory(limit);

    res.json({
      status: "ok",
      endpoint: "GET /result/sleep-score-history",
      data: {
        message: "sleep score history fetched",
        history
      }
    });
  } catch (error) {
    res.status(500).json({
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
