PRAGMA foreign_keys = ON;

-- =========================================================
-- 1. Sensor raw data
-- 환경 센서 원본 데이터 저장
-- 수집 시점마다 1 row 생성
-- =========================================================
CREATE TABLE IF NOT EXISTS sensor_raw (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,                     -- ISO 8601 timestamp
    temperature REAL,
    humidity REAL,
    mq5_raw REAL,
    mq5_index REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sensor_raw_ts
ON sensor_raw(ts);

-- =========================================================
-- 2. Fitbit heart intraday
-- Fitbit 심박 시계열 저장
-- =========================================================
CREATE TABLE IF NOT EXISTS fitbit_heart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,                     -- ISO 8601 timestamp
    bpm INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fitbit_heart_ts
ON fitbit_heart(ts);

-- =========================================================
-- 3. Fitbit steps intraday
-- Fitbit 걸음 수 시계열 저장
-- =========================================================
CREATE TABLE IF NOT EXISTS fitbit_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,                     -- ISO 8601 timestamp
    steps INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fitbit_steps_ts
ON fitbit_steps(ts);

-- =========================================================
-- 4. Fitbit calories intraday
-- Fitbit 칼로리 시계열 저장
-- =========================================================
CREATE TABLE IF NOT EXISTS fitbit_calories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,                     -- ISO 8601 timestamp
    calories REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fitbit_calories_ts
ON fitbit_calories(ts);

-- =========================================================
-- 5. Fitbit main sleep result
-- 하루 대표 수면(main sleep) 1개 저장
-- isMainSleep == true 를 우선 사용(밤 샌날, 낮잠만 잔 날 있을 수 있음)
-- 예외 시 가장 긴 sleep log 사용 가능
-- =========================================================
CREATE TABLE IF NOT EXISTS fitbit_sleep (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sleep_date TEXT NOT NULL,             -- YYYY-MM-DD
    start_time TEXT,
    end_time TEXT,
    minutes_asleep INTEGER,
    minutes_awake INTEGER,
    deep_minutes INTEGER,
    light_minutes INTEGER,
    rem_minutes INTEGER,
    is_main_sleep INTEGER,                -- 1=true, 0=false
    raw_json TEXT,                        -- original response snapshot
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fitbit_sleep_date
ON fitbit_sleep(sleep_date);

-- =========================================================
-- 6. User feedback
-- 사용자 주관 만족도 입력
-- 현재는 점수만 필수
-- =========================================================
CREATE TABLE IF NOT EXISTS user_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sleep_date TEXT NOT NULL,
    satisfaction_score REAL NOT NULL,     -- 0~100
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_date
ON user_feedback(sleep_date);

-- =========================================================
-- 7. Pre-sleep prediction result
-- 취침 전 예측 결과 저장
-- 하루 여러 번 실행될 수 있으므로 prediction_ts 기준으로 기록
-- =========================================================
CREATE TABLE IF NOT EXISTS prediction_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_ts TEXT NOT NULL,          -- execution time
    target_sleep_date TEXT,               -- intended sleep date
    risk_level TEXT NOT NULL,             -- LOW / MEDIUM / HIGH
    risk_score REAL,
    reasons_json TEXT,                    -- JSON array of reasons
    action_text TEXT,
    feature_snapshot_json TEXT,           -- features used at prediction time
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prediction_result_ts
ON prediction_result(prediction_ts);

CREATE INDEX IF NOT EXISTS idx_prediction_result_target_date
ON prediction_result(target_sleep_date);

-- =========================================================
-- 8. Sleep score result
-- 기상 후 계산한 Sleep Score 저장
-- 하루 대표 수면 기준
-- =========================================================
CREATE TABLE IF NOT EXISTS sleep_score_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sleep_date TEXT NOT NULL,
    time_asleep_score REAL,
    deep_rem_score REAL,
    restoration_score REAL,
    total_score REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sleep_score_result_date
ON sleep_score_result(sleep_date);

-- =========================================================
-- 9. Post-sleep analysis result
-- 기상 후 원인 분석 결과 저장
-- 원인은 JSON 형태로 확장 가능하게 저장
-- =========================================================
CREATE TABLE IF NOT EXISTS post_analysis_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sleep_date TEXT NOT NULL,
    causes_json TEXT,                     -- JSON array of causes
    analysis_text TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_post_analysis_result_date
ON post_analysis_result(sleep_date);

-- =========================================================
-- 10. Pattern profile (A)
-- 누적 패턴 데이터 저장
-- 최신값만 덮어쓰지 않고, 갱신 시마다 이력을 남김
-- =========================================================
CREATE TABLE IF NOT EXISTS pattern_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sleep_date TEXT,                         -- YYYY-MM-DD, source sleep date for this pattern update
    stage TEXT,                              -- stage1 / stage2
    updated_at TEXT NOT NULL,
    avg_sleep_minutes REAL,
    avg_satisfaction REAL,
    avg_presleep_hr REAL,
    score_gap_trend REAL,                 -- objective vs subjective trend
    env_sensitivity_json TEXT,
    pattern_snapshot_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_pattern_profile_updated_at
ON pattern_profile(updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pattern_profile_sleep_date_stage
ON pattern_profile(sleep_date, stage);
