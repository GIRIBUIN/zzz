const DEFAULT_BASE_HR = 72; // used until enough history accumulates

// Pure rule-based pre-sleep risk computation
// features: { avg_hr_1h, steps_sum_1h, avg_temp_1h, avg_humidity_1h, avg_mq5_index_1h }
// patternProfile: latest row from pattern_profile table (optional)
function computePresleepRisk(features, patternProfile) {
  const avgHr = Number(features?.avg_hr_1h ?? 0);
  const steps = Number(features?.steps_sum_1h ?? 0);
  const calories = features?.calories_sum_1h != null ? Number(features.calories_sum_1h) : null;
  const temp = Number(features?.avg_temp_1h ?? 0);
  const humidity = Number(features?.avg_humidity_1h ?? 0);
  const mq5 = Number(features?.avg_mq5_index_1h ?? 0);
  const recentLowSat = Number(features?.recent_low_sat_high_risk ?? 0);
  const sleepIrregularity = features?.sleep_irregularity ?? null;

  // Sliding-window HR baseline: pattern avg over last N days, default until history exists
  const baseHr = Number(patternProfile?.avg_presleep_hr ?? DEFAULT_BASE_HR);
  const hrThreshold = baseHr + 8;

  const reasons = [];
  if (avgHr >= hrThreshold) reasons.push("취침 전 심박이 평소보다 높은 편입니다.");
  if (steps >= 300) reasons.push("취침 전 활동량이 다소 높은 편입니다.");
  if (calories !== null && calories >= 200) reasons.push("취침 전 칼로리 소모가 높은 편입니다.");
  if (temp >= 25.5) reasons.push("실내 온도가 약간 높은 편입니다.");
  if (humidity >= 65) reasons.push("실내 습도가 높은 편입니다.");
  if (mq5 >= 0.5) reasons.push("실내 공기 상태가 불리할 수 있습니다.");
  // Pattern-based signals: require data history (patternProfile present)
  if (patternProfile && recentLowSat >= 2)
    reasons.push("최근 비슷한 환경에서 수면 만족도가 낮은 날이 반복되었습니다.");
  if (patternProfile && sleepIrregularity !== null && sleepIrregularity >= 60)
    reasons.push("최근 수면 시간이 불규칙한 편입니다.");

  let risk_score = 35;
  if (avgHr >= hrThreshold) risk_score += 15;
  if (steps >= 300) risk_score += 10;
  if (calories !== null && calories >= 200) risk_score += 10;
  if (temp >= 25.5) risk_score += 10;
  if (humidity >= 65) risk_score += 10;
  if (mq5 >= 0.5) risk_score += 10;
  if (patternProfile && recentLowSat >= 2)    risk_score += 15;
  if (patternProfile && sleepIrregularity !== null && sleepIrregularity >= 60) risk_score += 5;
  if (risk_score > 100) risk_score = 100;

  let risk_level = "LOW";
  if (risk_score >= 70) risk_level = "HIGH";
  else if (risk_score >= 50) risk_level = "MEDIUM";

  let action_text = "현재 상태를 유지해도 괜찮습니다.";
  if (risk_level === "MEDIUM") {
    action_text = "취침 전 활동을 조금 줄이고 실내 환경을 점검해보세요.";
  } else if (risk_level === "HIGH") {
    action_text = "취침 전에 심박을 안정시키고, 환기나 온습도 조절을 먼저 해보는 것이 좋겠습니다.";
  }

  return { risk_level, risk_score, reasons, action_text, hr_baseline: baseHr };
}

// 서비스 predictor 호환 래퍼
// executePresleepPrediction(payload, presleepPredictor) 형태로 사용
// payload.pattern 이 있으면 patternProfile 로 자동 추출 (buildPresleepFeatures 반환값 그대로 전달 가능)
function presleepPredictor(payload) {
  return computePresleepRisk(payload, payload?.pattern ?? null);
}

module.exports = { computePresleepRisk, presleepPredictor };
