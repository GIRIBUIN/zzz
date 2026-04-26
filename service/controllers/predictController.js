const { executePresleepPrediction } = require("../services/predictionService");

async function postPresleepPrediction(req, res) {
  try {
    const result = await executePresleepPrediction(req.body);

    return res.status(200).json({
      status: "ok",
      endpoint: "POST /predict/presleep",
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
}

module.exports = {
  postPresleepPrediction
};
