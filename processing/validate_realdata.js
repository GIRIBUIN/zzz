/**
 * 실행: node processing/validate_realdata.js
 * 실제 DB 데이터(seed 후) 기준으로 feature_builder → prediction 파이프라인 검증
 * 결과를 processing/demo_data/snapshot.json 에 저장 — 회귀 테스트 기준선으로 사용
 */

const path = require("path");
const fs   = require("fs");

const { buildPresleepFeatures }  = require("./feature/feature_builder");
const { computePresleepRisk }    = require("./prediction/prediction");

const SNAPSHOT_PATH = path.join(__dirname, "demo_data", "snapshot.json");
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function section(title) {
  console.log("\n" + "=".repeat(52));
  console.log(" " + title);
  console.log("=".repeat(52));
}

function pass(label) { console.log(`  [PASS] ${label}`); }
function fail(label) { console.log(`  [FAIL] ${label}`); }
function info(label, value) {
  const v = typeof value === "object" ? JSON.stringify(value, null, 2).replace(/\n/g, "\n         ") : value;
  console.log(`  ${label}: ${v}`);
}

async function main() {
  // 1시간 전 KST 기준 ISO (sensor / fitbit 쿼리용)
  const sinceIso = new Date(Date.now() + KST_OFFSET_MS - 60 * 60 * 1000)
    .toISOString()
    .replace("Z", "");

  section("A. Feature Extraction — 실 DB 데이터 기준");
  info("1h window since (KST)", sinceIso);

  const features = await buildPresleepFeatures(sinceIso);
  info("avg_hr_1h",          features.avg_hr_1h);
  info("max_hr_1h",          features.max_hr_1h);
  info("steps_sum_1h",       features.steps_sum_1h);
  info("calories_sum_1h",    features.calories_sum_1h);
  info("avg_temp_1h",        features.avg_temp_1h);
  info("avg_humidity_1h",    features.avg_humidity_1h);
  info("avg_mq5_index_1h",   features.avg_mq5_index_1h);
  info("recent_n_sleep_avg", features.recent_n_sleep_avg);
  info("sleep_irregularity", features.sleep_irregularity);
  info("recent_low_sat_high_risk", features.recent_low_sat_high_risk);
  info("pattern",            features.pattern);

  // 기본 검증 — null이 아니어야 할 피처들 (seed 정상 완료 시)
  if (features.avg_hr_1h != null)        pass("fitbit_heart seeded — avg_hr_1h present");
  else                                    fail("fitbit_heart missing — run npm run seed-demo");
  if (features.avg_temp_1h != null)      pass("sensor_raw seeded — avg_temp_1h present");
  else                                    fail("sensor_raw missing — run npm run seed-demo");

  section("B. Pre-sleep Prediction — Cold start (패턴 없음)");
  const riskCold = computePresleepRisk(features, null);
  info("risk_level",  riskCold.risk_level);
  info("risk_score",  riskCold.risk_score);
  info("hr_baseline", riskCold.hr_baseline);
  info("reasons",     riskCold.reasons);
  info("action_text", riskCold.action_text);

  // mq5_index ≈ 0.52 ≥ 0.5 → gas 원인 감지 기대
  const gasDetected = riskCold.reasons.some(r => r.includes("공기"));
  if (gasDetected)  pass("mq5 ≥ 0.5 → gas reason fired as expected");
  else              fail("mq5 ≥ 0.5 but gas reason not detected — check threshold");

  section("C. Pre-sleep Prediction — Stable (패턴 있음, avg_presleep_hr=70)");
  const mockPattern = { avg_presleep_hr: 70, score_gap_trend: 0 };
  const riskStable  = computePresleepRisk(features, mockPattern);
  info("risk_level",  riskStable.risk_level);
  info("risk_score",  riskStable.risk_score);
  info("hr_baseline", riskStable.hr_baseline);
  info("reasons",     riskStable.reasons);

  // ─────────────────────────────────────────
  // 스냅샷 저장
  // ─────────────────────────────────────────
  const snapshot = {
    captured_at: new Date().toISOString(),
    since_iso:   sinceIso,
    features: {
      avg_hr_1h:               features.avg_hr_1h,
      max_hr_1h:               features.max_hr_1h,
      steps_sum_1h:            features.steps_sum_1h,
      calories_sum_1h:         features.calories_sum_1h,
      avg_temp_1h:             features.avg_temp_1h,
      avg_humidity_1h:         features.avg_humidity_1h,
      avg_mq5_index_1h:        features.avg_mq5_index_1h,
      recent_n_sleep_avg:      features.recent_n_sleep_avg,
      sleep_irregularity:      features.sleep_irregularity,
      recent_low_sat_high_risk: features.recent_low_sat_high_risk
    },
    cold_start: {
      risk_level:  riskCold.risk_level,
      risk_score:  riskCold.risk_score,
      hr_baseline: riskCold.hr_baseline,
      reasons:     riskCold.reasons
    },
    stable_mock_pattern_70: {
      risk_level:  riskStable.risk_level,
      risk_score:  riskStable.risk_score,
      hr_baseline: riskStable.hr_baseline,
      reasons:     riskStable.reasons
    }
  };

  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
  section("스냅샷 저장 완료");
  console.log(`  → ${SNAPSHOT_PATH}`);
  console.log("  이 파일을 기준선으로 사용해 코드 변경 후 회귀 테스트 가능");
}

main()
  .catch(err => { console.error("ERROR:", err.message); process.exitCode = 1; })
  .finally(() => setTimeout(() => process.exit(), 500));
