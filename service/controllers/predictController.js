const { executePresleepPrediction } = require("../services/predictionService");
const { collectPresleep } = require("../../rpi/fitbit/collect_fitbit");
const { buildPresleepFeatures } = require("../../processing/feature/feature_builder");

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

async function postPresleepPrediction(req, res) {
  try {
    console.log("[predictController] Fitbit 데이터 수집 시작");
    await collectPresleep();
    console.log("[predictController] Fitbit 데이터 수집 완료");
    await new Promise(resolve => setTimeout(resolve, 500));

    const sinceIso = new Date(Date.now() + KST_OFFSET_MS - 60 * 60 * 1000)
      .toISOString()
      .replace("Z", "");
    const snapshot = await buildPresleepFeatures(sinceIso);
    console.log("[predictController] feature snapshot:", snapshot);
 
    // 3. 예측 실행 + DB 저장
    const result = await executePresleepPrediction(snapshot);
 
    return res.status(200).json({
      status: "ok",
      endpoint: "POST /predict/presleep",
      data: result
    });
  } catch (error) {
    console.error("[predictController] 오류:", error.message);
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
}
 
module.exports = {
  postPresleepPrediction
};
