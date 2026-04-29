/**
 * 실행: node processing/demo.js
 * DB 불필요 — 순수 함수(scoring, prediction, analysis) 를 mock 데이터로 검증
 */

const { calcSleepScore }     = require("./scoring/sleep_score");
const { computePresleepRisk } = require("./prediction/prediction");
const { analyzePostSleep }    = require("./analysis/post_analysis");

// ─────────────────────────────────────────
// 공통 출력 헬퍼
// ─────────────────────────────────────────
function section(title) {
  console.log("\n" + "=".repeat(50));
  console.log(" " + title);
  console.log("=".repeat(50));
}

function show(label, value) {
  console.log(`  ${label}:`, typeof value === "object" ? JSON.stringify(value, null, 2).replace(/\n/g, "\n  ") : value);
}

// ─────────────────────────────────────────
// 1. Sleep Score
// ─────────────────────────────────────────
section("1. Sleep Score — 기본 케이스 (양호한 수면)");
{
  const sleepRow = {
    minutes_asleep: 390,  // 6.5시간
    minutes_awake:  20,
    deep_minutes:   70,
    rem_minutes:    90,
    light_minutes:  230
  };
  const result = calcSleepScore(sleepRow, null);
  show("입력", sleepRow);
  show("결과", result);
}

section("1-b. Sleep Score — 피드백 보정 적용 (score_gap_trend = +20)");
{
  const sleepRow = {
    minutes_asleep: 390,
    minutes_awake:  20,
    deep_minutes:   70,
    rem_minutes:    90,
    light_minutes:  230
  };
  // 사용자가 객관 점수보다 평균 20점 낮게 만족도를 입력해왔던 경우
  const patternProfile = { score_gap_trend: 20, avg_presleep_hr: 68 };
  const withoutPattern = calcSleepScore(sleepRow, null);
  const withPattern    = calcSleepScore(sleepRow, patternProfile);
  show("보정 전 total_score", withoutPattern.total_score);
  show("보정 후 total_score", withPattern.total_score);
  show("raw_total_score",    withPattern.raw_total_score);
  console.log("  → gap_trend 20 × 0.5 = 보정 -10pt 적용");
}

section("1-c. Sleep Score — 수면 부족 케이스");
{
  const sleepRow = {
    minutes_asleep: 220,  // 3.7시간
    minutes_awake:  45,
    deep_minutes:   15,
    rem_minutes:    20,
    light_minutes:  185
  };
  const result = calcSleepScore(sleepRow, null);
  show("결과", result);
}

// ─────────────────────────────────────────
// 2. Pre-sleep Prediction
// ─────────────────────────────────────────
section("2. Pre-sleep Prediction — 이력 없음 (기본 HR 기준선 72)");
{
  const features = { avg_hr_1h: 79, steps_sum_1h: 120, calories_sum_1h: null,
                     avg_temp_1h: 24.0, avg_humidity_1h: 55, avg_mq5_index_1h: 0.2 };
  const result = computePresleepRisk(features, null);
  show("결과", result);
}

section("2-b. Pre-sleep Prediction — 패턴 있음, HR 기준선 개인화 (avg_presleep_hr=65)");
{
  const features       = { avg_hr_1h: 79, steps_sum_1h: 350, calories_sum_1h: 180,
                            avg_temp_1h: 26.0, avg_humidity_1h: 70, avg_mq5_index_1h: 0.6,
                            recent_low_sat_high_risk: 0, sleep_irregularity: 30 };
  const patternProfile = { avg_presleep_hr: 65, score_gap_trend: 5 };
  // hrThreshold = 65+8 = 73 → avgHr(79) >= 73 이므로 HR 원인 감지됨
  const result = computePresleepRisk(features, patternProfile);
  show("hr_baseline", result.hr_baseline);
  show("risk_level", result.risk_level);
  show("risk_score", result.risk_score);
  show("reasons", result.reasons);
}

section("2-c. Pre-sleep Prediction — HIGH 위험 + 칼로리 + 패턴 신호");
{
  // calories_sum_1h=280: 칼로리 기준 초과, recent_low_sat_high_risk=3, sleep_irregularity=75
  const features = { avg_hr_1h: 95, steps_sum_1h: 500, calories_sum_1h: 280,
                     avg_temp_1h: 27.0, avg_humidity_1h: 72, avg_mq5_index_1h: 0.8,
                     recent_low_sat_high_risk: 3, sleep_irregularity: 75 };
  const patternProfile = { avg_presleep_hr: 68, score_gap_trend: 10 };
  const result = computePresleepRisk(features, patternProfile);
  show("risk_level", result.risk_level);
  show("risk_score", result.risk_score);
  show("action_text", result.action_text);
  show("reasons", result.reasons);
}

section("2-d. Pre-sleep Prediction — 패턴 신호만 있을 때 (센서는 정상, 반복 저만족만)");
{
  // 센서값은 정상이지만 최근 비슷한 조건에서 만족도가 낮았던 패턴 존재
  const features = { avg_hr_1h: 70, steps_sum_1h: 100, avg_temp_1h: 23.0, avg_humidity_1h: 55, avg_mq5_index_1h: 0.2,
                     recent_low_sat_high_risk: 2, sleep_irregularity: null };
  const patternProfile = { avg_presleep_hr: 68, score_gap_trend: 5 };
  const result = computePresleepRisk(features, patternProfile);
  show("risk_level", result.risk_level);
  show("risk_score", result.risk_score);
  show("reasons", result.reasons);
  console.log("  → 센서 정상이지만 패턴 신호로 MEDIUM 이상 기대");
}

// ─────────────────────────────────────────
// 3. Post-sleep Analysis
// ─────────────────────────────────────────
section("3. Post-sleep Analysis — 정상 케이스 (만족도 있음)");
{
  const sleepRow      = { minutes_asleep: 380, minutes_awake: 30, deep_minutes: 60, rem_minutes: 80 };
  const scoreResult   = { total_score: 72, raw_total_score: 72 };
  const featureSnap   = { avg_mq5_index_1h: 0.6, avg_hr_1h: 78, avg_temp_1h: 24.0, avg_humidity_1h: 60, steps_sum_1h: 100 };
  const patternProfile = { avg_presleep_hr: 68 };

  const result = analyzePostSleep({
    sleepRow, scoreResult, featureSnapshot: featureSnap,
    satisfactionScore: 55, patternProfile
  });
  show("causes_json", JSON.parse(result.causes_json));
  show("analysis_text", result.analysis_text);
  show("score_gap_note", result.score_gap_note);
}

section("3-b. Post-sleep Analysis — 만족도 없음 (피드백 미입력)");
{
  const sleepRow      = { minutes_asleep: 380, minutes_awake: 30, deep_minutes: 60, rem_minutes: 80 };
  const scoreResult   = { total_score: 72 };
  const featureSnap   = { avg_mq5_index_1h: 0.3, avg_hr_1h: 70, avg_temp_1h: 23.0, avg_humidity_1h: 55, steps_sum_1h: 80 };

  const result = analyzePostSleep({
    sleepRow, scoreResult, featureSnapshot: featureSnap,
    satisfactionScore: null, patternProfile: null
  });
  show("analysis_text", result.analysis_text);
  show("score_gap_note", result.score_gap_note);  // null 기대
}

section("3-c. Post-sleep Analysis — featureSnapshot 없음 (예측 미실행)");
{
  const result = analyzePostSleep({
    sleepRow: {}, scoreResult: {}, featureSnapshot: null,
    satisfactionScore: null, patternProfile: null
  });
  show("analysis_text", result.analysis_text);  // "데이터 없음" 메시지 기대
}

console.log("\n" + "=".repeat(50));
console.log(" 동기 데모 완료");
console.log("=".repeat(50) + "\n");

// ─────────────────────────────────────────
// 4. SLM Integration (optional — Ollama 필요)
//    ollama pull gemma4:e4b && ollama serve
// ─────────────────────────────────────────
(async () => {
  const { callSlm }                              = require("./slm/slm_client");
  const { buildPresleepPrompt, buildAnalysisPrompt } = require("./slm/prompt_builder");

  const mockRisk = {
    risk_level: "HIGH", risk_score: 80,
    reasons: ["취침 전 심박이 평소보다 높은 편입니다.", "실내 온도가 약간 높은 편입니다."],
    action_text: "취침 전에 심박을 안정시키고, 환기나 온습도 조절을 먼저 해보는 것이 좋겠습니다."
  };
  const mockFeature = {
    avg_hr_1h: 88, avg_temp_1h: 26.2, avg_humidity_1h: 62,
    avg_mq5_index_1h: 0.3, steps_sum_1h: 420
  };
  const mockAnalysis = {
    causes_json: JSON.stringify([
      { key: "gas", label: "실내 가스(공기질) 불량" },
      { key: "hr",  label: "취침 전 심박 상승" }
    ]),
    analysis_text: "주요 원인: 실내 가스(공기질) 불량. 보조 원인: 취침 전 심박 상승.",
    score_gap_note: null
  };
  const mockSleepRow = {
    minutes_asleep: 340, minutes_awake: 45, deep_minutes: 30, rem_minutes: 50
  };

  // ── Cold start (패턴 없음) ──
  section("4-a. SLM presleep — Cold start (패턴 데이터 없음, raw feature 전달)");
  {
    const prompt = buildPresleepPrompt(mockRisk, mockFeature, null);
    show("prompt", prompt);
    show("결과", (await callSlm(prompt)) ?? "[fallback] " + mockRisk.action_text);
  }

  section("4-b. SLM analysis — Cold start (수면 원시 데이터 전달)");
  {
    const prompt = buildAnalysisPrompt(mockAnalysis, { total_score: 58 }, 45, null, mockSleepRow);
    show("prompt", prompt);
    show("결과", (await callSlm(prompt)) ?? "[fallback] " + mockAnalysis.analysis_text);
  }

  // ── Stable (7일치 패턴 있음) ──
  const mockPattern = { avg_presleep_hr: 68, score_gap_trend: 5, avg_satisfaction: 70 };

  section("4-c. SLM presleep — Stable (개인화 기준선 있음, rule-based 결과 다듬기)");
  {
    const prompt = buildPresleepPrompt(mockRisk, mockFeature, mockPattern);
    show("prompt", prompt);
    show("결과", (await callSlm(prompt)) ?? "[fallback] " + mockRisk.action_text);
  }

  section("4-d. SLM analysis — Stable (원인 분류 결과 다듬기)");
  {
    const prompt = buildAnalysisPrompt(mockAnalysis, { total_score: 72 }, 55, mockPattern, mockSleepRow);
    show("prompt", prompt);
    show("결과", (await callSlm(prompt)) ?? "[fallback] " + mockAnalysis.analysis_text);
  }

  console.log("\n" + "=".repeat(50));
  console.log(" SLM 데모 완료");
  console.log("=".repeat(50) + "\n");
})();
