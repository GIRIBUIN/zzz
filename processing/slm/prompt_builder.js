// patternProfile.avg_presleep_hr 가 null이면 아직 7일치 데이터가 쌓이지 않은 cold start
function isColdStart(patternProfile) {
  return !patternProfile || patternProfile.avg_presleep_hr == null;
}

// ─────────────────────────────────────────
// Pre-sleep prompt
// ─────────────────────────────────────────

// Cold start: rule-based 판단을 보조 참고로만 쓰고, raw feature 값을 SLM에 직접 전달
// → SLM이 수치 해석 + 위험 평가 + 조언을 스스로 수행 (3~4문장)
function _presleepColdStart(riskResult, featureSnapshot) {
  const f = featureSnapshot || {};
  const round = (v, d = 1) => v != null ? Number(v).toFixed(d) : null;

  const lines = [
    "당신은 수면 건강 코치입니다. 사용자의 수면 패턴 데이터가 아직 충분히 쌓이지 않아 개인화 기준선이 없는 상태입니다.",
    "아래 오늘의 취침 전 측정값을 직접 해석하여, 수면에 영향을 줄 수 있는 요인을 평가하고 3~4문장의 구체적인 조언을 작성하세요.",
    "번호나 목록 없이 문장으로만 작성하세요.",
    ""
  ];

  if (f.avg_hr_1h        != null) lines.push(`심박수: ${round(f.avg_hr_1h, 0)}bpm`);
  if (f.avg_temp_1h      != null) lines.push(`실내 온도: ${round(f.avg_temp_1h)}°C`);
  if (f.avg_humidity_1h  != null) lines.push(`실내 습도: ${round(f.avg_humidity_1h, 0)}%`);
  if (f.avg_mq5_index_1h != null) lines.push(`공기질 지수: ${round(f.avg_mq5_index_1h, 2)}`);
  if (f.steps_sum_1h     != null && f.steps_sum_1h > 0)    lines.push(`취침 전 1시간 활동량: ${Math.round(f.steps_sum_1h)}걸음`);
  if (f.calories_sum_1h  != null && f.calories_sum_1h > 0) lines.push(`취침 전 1시간 칼로리 소모: ${Math.round(f.calories_sum_1h)}kcal`);

  const levelLabel =
    riskResult.risk_level === "HIGH"   ? "높음" :
    riskResult.risk_level === "MEDIUM" ? "보통" : "낮음";
  lines.push(`규칙 기반 초기 판정: ${levelLabel} (점수 ${riskResult.risk_score}/100)`);
  lines.push("", "조언:");
  return lines.join("\n");
}

// Stable: rule-based 판단 + 실제 센서 수치를 함께 전달해 맥락 있는 조언 생성 (2~3문장)
function _presleepStable(riskResult, featureSnapshot) {
  const f = featureSnapshot || {};
  const round = (v, d = 1) => v != null ? Number(v).toFixed(d) : null;

  const levelLabel =
    riskResult.risk_level === "HIGH"   ? "높음" :
    riskResult.risk_level === "MEDIUM" ? "보통" : "낮음";

  const reasonText =
    riskResult.reasons.length > 0
      ? `감지된 요인: ${riskResult.reasons.join(", ")}`
      : "특별한 수면 방해 요인 없음";

  const lines = [
    "당신은 수면 건강 코치입니다. 아래 취침 전 분석 결과와 실제 측정값을 바탕으로 2~3문장의 자연스러운 한국어 조언을 작성하세요.",
    "조언은 따뜻하고 구체적이며 실행 가능해야 합니다. 번호나 목록 없이 문장으로만 작성하세요.",
    "",
    `수면 위험도: ${levelLabel} (점수: ${riskResult.risk_score}/100)`,
    reasonText
  ];

  const sensorLines = [];
  if (f.avg_hr_1h        != null) sensorLines.push(`심박수 ${round(f.avg_hr_1h, 0)}bpm`);
  if (f.avg_temp_1h      != null) sensorLines.push(`실내 온도 ${round(f.avg_temp_1h)}°C`);
  if (f.avg_humidity_1h  != null) sensorLines.push(`습도 ${round(f.avg_humidity_1h, 0)}%`);
  if (f.avg_mq5_index_1h != null) sensorLines.push(`공기질 ${round(f.avg_mq5_index_1h, 2)}`);
  if (f.steps_sum_1h     != null) sensorLines.push(`활동량 ${Math.round(f.steps_sum_1h)}걸음`);
  if (f.calories_sum_1h  != null && f.calories_sum_1h > 0) sensorLines.push(`칼로리 ${Math.round(f.calories_sum_1h)}kcal`);
  if (sensorLines.length > 0) lines.push(`측정값: ${sensorLines.join(", ")}`);

  lines.push("", "조언:");
  return lines.join("\n");
}

// featureSnapshot: buildPresleepFeatures() 반환값 (cold start 시 raw 수치 전달용)
// patternProfile:  pattern_profile 최신 row (null이면 cold start)
function buildPresleepPrompt(riskResult, featureSnapshot, patternProfile) {
  return isColdStart(patternProfile)
    ? _presleepColdStart(riskResult, featureSnapshot)
    : _presleepStable(riskResult, featureSnapshot);
}

// ─────────────────────────────────────────
// Post-sleep analysis prompt
// ─────────────────────────────────────────

// Cold start: 수면 원시 데이터 + 측정값을 SLM에 직접 전달, 종합 해석 요청 (3~4문장)
function _analysisColdStart(analysisResult, scoreResult, satisfactionScore, sleepRow) {
  const s = sleepRow || {};
  const lines = [
    "당신은 수면 건강 코치입니다. 사용자의 수면 패턴 데이터가 아직 충분히 쌓이지 않은 상태입니다.",
    "아래 오늘의 수면 데이터를 직접 해석하여, 수면의 질을 평가하고 개선 방향을 3~4문장으로 작성하세요.",
    "주관 만족도 숫자를 반대로 해석하지 말고, 낮은 점수는 낮은 만족도로 명확히 반영하세요.",
    "번호나 목록 없이 문장으로만 작성하세요.",
    ""
  ];

  if (s.minutes_asleep != null) lines.push(`총 수면 시간: ${Math.round(s.minutes_asleep)}분`);
  if (s.minutes_awake  != null) lines.push(`중간 각성 시간: ${Math.round(s.minutes_awake)}분`);
  if (s.deep_minutes   != null) lines.push(`깊은 수면: ${Math.round(s.deep_minutes)}분`);
  if (s.rem_minutes    != null) lines.push(`REM 수면: ${Math.round(s.rem_minutes)}분`);
  if (scoreResult?.total_score != null) lines.push(`수면 점수: ${scoreResult.total_score}점`);
  if (satisfactionScore != null)        lines.push(`주관 만족도: ${satisfactionScore}점`);

  const causes = (() => {
    try { return JSON.parse(analysisResult.causes_json); } catch (_) { return []; }
  })();
  if (causes.length > 0) lines.push(`감지된 요인: ${causes.map(c => c.label).join(", ")}`);
  if (analysisResult.analysis_text) lines.push(`규칙 기반 분석: ${analysisResult.analysis_text}`);
  if (analysisResult.score_gap_note) lines.push(`점수-만족도 해석: ${analysisResult.score_gap_note}`);

  lines.push("", "피드백:");
  return lines.join("\n");
}

// Stable: rule-based 원인 분류 + 실제 수면 수치를 함께 전달해 맥락 있는 피드백 생성 (2~3문장)
function _analysisStable(analysisResult, scoreResult, satisfactionScore, sleepRow) {
  const s = sleepRow || {};
  const causes = (() => {
    try { return JSON.parse(analysisResult.causes_json); } catch (_) { return []; }
  })();

  const lines = [
    "당신은 수면 건강 코치입니다. 아래 기상 후 수면 분석 결과와 실제 수면 데이터를 바탕으로 2~3문장의 자연스러운 한국어 피드백을 작성하세요.",
    "피드백은 원인을 설명하고 다음 밤을 위한 실용적인 개선 방향을 포함해야 합니다. 번호나 목록 없이 문장으로만 작성하세요.",
    "주관 만족도 숫자를 반대로 해석하지 말고, 낮은 점수는 낮은 만족도로 명확히 반영하세요.",
    "",
    causes.length > 0
      ? `주요 원인: ${causes.map(c => c.label).join(", ")}`
      : "특별한 수면 방해 요인 없음"
  ];

  if (scoreResult?.total_score != null) lines.push(`수면 점수: ${scoreResult.total_score}점`);
  if (satisfactionScore != null)        lines.push(`주관 만족도: ${satisfactionScore}점`);
  if (analysisResult.analysis_text)     lines.push(`규칙 기반 분석: ${analysisResult.analysis_text}`);
  if (analysisResult.score_gap_note)    lines.push(`점수-만족도 해석: ${analysisResult.score_gap_note}`);

  const sleepLines = [];
  if (s.minutes_asleep != null) sleepLines.push(`총 수면 ${Math.round(s.minutes_asleep)}분`);
  if (s.minutes_awake  != null) sleepLines.push(`각성 ${Math.round(s.minutes_awake)}분`);
  if (s.deep_minutes   != null) sleepLines.push(`깊은 수면 ${Math.round(s.deep_minutes)}분`);
  if (s.rem_minutes    != null) sleepLines.push(`REM ${Math.round(s.rem_minutes)}분`);
  if (sleepLines.length > 0) lines.push(`수면 구조: ${sleepLines.join(", ")}`);

  lines.push("", "피드백:");
  return lines.join("\n");
}

// sleepRow:       fitbit_sleep row (cold start 시 원시 수면 데이터 전달용)
// patternProfile: pattern_profile 최신 row (null이면 cold start)
function buildAnalysisPrompt(analysisResult, scoreResult, satisfactionScore, patternProfile, sleepRow) {
  return isColdStart(patternProfile)
    ? _analysisColdStart(analysisResult, scoreResult, satisfactionScore, sleepRow)
    : _analysisStable(analysisResult, scoreResult, satisfactionScore, sleepRow);
}

module.exports = { buildPresleepPrompt, buildAnalysisPrompt };
