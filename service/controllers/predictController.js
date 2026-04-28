const { executePresleepPrediction } = require("../services/predictionService");
const { collectPresleep } = require("../../rpi/fitbit/collect_fitbit");
const { buildPresleepFeatures } = require("../../processing/feature/feature_builder");

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function hasStoredPresleepData(snapshot) {
  return (
    snapshot?.avg_hr_1h !== null ||
    snapshot?.max_hr_1h !== null ||
    snapshot?.calories_sum_1h !== null ||
    Number(snapshot?.steps_sum_1h || 0) > 0
  );
}

async function postPresleepPrediction(req, res) {
  try {
    let collectionWarning = null;

    try {
      console.log("[predictController] Fitbit 데이터 수집 시작");
      await collectPresleep();
      console.log("[predictController] Fitbit 데이터 수집 완료");
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      collectionWarning = `Fitbit live sync skipped: ${error.message}`;
      console.warn("[predictController] Fitbit 수집 실패, 저장된 데이터로 계속 진행:", error.message);
    }

    const sinceIso = new Date(Date.now() + KST_OFFSET_MS - 60 * 60 * 1000)
      .toISOString()
      .replace("Z", "");
    const snapshot = await buildPresleepFeatures(sinceIso);
    console.log("[predictController] feature snapshot:", snapshot);

    if (!hasStoredPresleepData(snapshot)) {
      throw new Error(
        collectionWarning
          ? `${collectionWarning}. 최근 1시간 Fitbit 데이터가 DB에도 없습니다. seed-demo를 다시 실행하거나 Fitbit 토큰을 갱신하세요.`
          : "최근 1시간 Fitbit 데이터가 없습니다. seed-demo를 다시 실행하거나 Fitbit 동기화를 먼저 확인하세요."
      );
    }
 
    // 3. 예측 실행 + DB 저장
    const result = await executePresleepPrediction(snapshot);
 
    return res.status(200).json({
      status: "ok",
      endpoint: "POST /predict/presleep",
      warning: collectionWarning,
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
