PRAGMA foreign_keys = ON;

-- =========================================================
-- 1. Users
-- 서비스 사용자 계정
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login_id TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_login_id
ON users(login_id);

-- =========================================================
-- 2. Devices
-- 사용자별 RPi/IoT 장치
-- =========================================================
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    iot_thing_name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_devices_iot_thing_name
ON devices(iot_thing_name);

CREATE INDEX IF NOT EXISTS idx_devices_user_id
ON devices(user_id);

-- =========================================================
-- 3. Google Health accounts
-- 사용자별 Google Health OAuth 연결 정보
-- =========================================================
CREATE TABLE IF NOT EXISTS google_health_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TEXT,
    scopes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_google_health_accounts_user
ON google_health_accounts(user_id);

-- =========================================================
-- 4. Google Health heart samples
-- Google Health 심박 시계열 저장
-- =========================================================
CREATE TABLE IF NOT EXISTS google_health_heart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    google_health_account_id INTEGER,
    ts TEXT NOT NULL,
    bpm INTEGER NOT NULL,
    raw_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (google_health_account_id) REFERENCES google_health_accounts(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_google_health_heart_user_ts
ON google_health_heart(user_id, ts);

CREATE INDEX IF NOT EXISTS idx_google_health_heart_account_id
ON google_health_heart(google_health_account_id);

-- =========================================================
-- 5. Google Health steps intervals
-- Google Health 걸음 수 시계열 저장
-- =========================================================
CREATE TABLE IF NOT EXISTS google_health_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    google_health_account_id INTEGER,
    ts TEXT NOT NULL,
    steps INTEGER NOT NULL,
    raw_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (google_health_account_id) REFERENCES google_health_accounts(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_google_health_steps_user_ts
ON google_health_steps(user_id, ts);

CREATE INDEX IF NOT EXISTS idx_google_health_steps_account_id
ON google_health_steps(google_health_account_id);

-- =========================================================
-- 6. Google Health calories rollups
-- Google Health total-calories rollup 저장
-- =========================================================
CREATE TABLE IF NOT EXISTS google_health_calories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    google_health_account_id INTEGER,
    ts TEXT NOT NULL,
    calories REAL NOT NULL,
    raw_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (google_health_account_id) REFERENCES google_health_accounts(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_google_health_calories_user_ts
ON google_health_calories(user_id, ts);

CREATE INDEX IF NOT EXISTS idx_google_health_calories_account_id
ON google_health_calories(google_health_account_id);

-- =========================================================
-- 7. Google Health sleep sessions
-- Google Health 수면 세션 저장
-- =========================================================
CREATE TABLE IF NOT EXISTS google_health_sleep (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    google_health_account_id INTEGER,
    sleep_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    minutes_asleep INTEGER,
    minutes_awake INTEGER,
    deep_minutes INTEGER,
    light_minutes INTEGER,
    rem_minutes INTEGER,
    is_main_sleep INTEGER,
    raw_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (google_health_account_id) REFERENCES google_health_accounts(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_google_health_sleep_user_date
ON google_health_sleep(user_id, sleep_date);

CREATE INDEX IF NOT EXISTS idx_google_health_sleep_account_id
ON google_health_sleep(google_health_account_id);

-- =========================================================
-- 8. Sensor raw data
-- 환경 센서 원본 데이터 저장
-- 수집 시점마다 1 row 생성
-- =========================================================
CREATE TABLE IF NOT EXISTS sensor_raw (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    ts TEXT NOT NULL,                     -- ISO 8601 timestamp
    temperature REAL,
    humidity REAL,
    mq5_raw REAL,
    mq5_index REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE INDEX IF NOT EXISTS idx_sensor_raw_user_ts
ON sensor_raw(user_id, ts);

CREATE INDEX IF NOT EXISTS idx_sensor_raw_device_id
ON sensor_raw(device_id);

-- =========================================================
-- 9. User feedback
-- 사용자 주관 만족도 입력
-- 현재는 점수만 필수
-- =========================================================
CREATE TABLE IF NOT EXISTS user_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sleep_date TEXT NOT NULL,
    satisfaction_score REAL NOT NULL,     -- 0~100
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_feedback_user_date
ON user_feedback(user_id, sleep_date);

-- =========================================================
-- 10. Pre-sleep prediction result
-- 취침 전 예측 결과 저장
-- 하루 여러 번 실행될 수 있으므로 prediction_ts 기준으로 기록
-- =========================================================
CREATE TABLE IF NOT EXISTS prediction_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    prediction_ts TEXT NOT NULL,          -- execution time
    target_sleep_date TEXT,               -- intended sleep date
    risk_level TEXT NOT NULL,             -- LOW / MEDIUM / HIGH
    risk_score REAL,
    reasons_json TEXT,                    -- JSON array of reasons
    action_text TEXT,
    feature_snapshot_json TEXT,           -- features used at prediction time
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_prediction_result_user_ts
ON prediction_result(user_id, prediction_ts);

CREATE INDEX IF NOT EXISTS idx_prediction_result_user_target_date
ON prediction_result(user_id, target_sleep_date);

-- =========================================================
-- 11. Sleep score result
-- 기상 후 계산한 Sleep Score 저장
-- 하루 대표 수면 기준
-- =========================================================
CREATE TABLE IF NOT EXISTS sleep_score_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sleep_date TEXT NOT NULL,
    time_asleep_score REAL,
    deep_rem_score REAL,
    restoration_score REAL,
    total_score REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sleep_score_result_user_date
ON sleep_score_result(user_id, sleep_date);

-- =========================================================
-- 12. Post-sleep analysis result
-- 기상 후 원인 분석 결과 저장
-- 원인은 JSON 형태로 확장 가능하게 저장
-- =========================================================
CREATE TABLE IF NOT EXISTS post_analysis_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sleep_score_result_id INTEGER,
    sleep_date TEXT NOT NULL,
    causes_json TEXT,                     -- JSON array of causes
    analysis_text TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (sleep_score_result_id) REFERENCES sleep_score_result(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_post_analysis_result_user_date
ON post_analysis_result(user_id, sleep_date);

CREATE INDEX IF NOT EXISTS idx_post_analysis_result_score_id
ON post_analysis_result(sleep_score_result_id);

-- =========================================================
-- 13. Pattern profile (A)
-- 누적 패턴 데이터 저장
-- 최신값만 덮어쓰지 않고, 갱신 시마다 이력을 남김
-- =========================================================
CREATE TABLE IF NOT EXISTS pattern_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sleep_date TEXT,                      -- YYYY-MM-DD, source sleep date for this pattern update
    stage TEXT,                           -- stage1 / stage2
    updated_at TEXT NOT NULL,
    avg_sleep_minutes REAL,
    avg_satisfaction REAL,
    avg_presleep_hr REAL,
    score_gap_trend REAL,                 -- objective vs subjective trend
    env_sensitivity_json TEXT,
    pattern_snapshot_json TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pattern_profile_user_updated_at
ON pattern_profile(user_id, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pattern_profile_user_sleep_date_stage
ON pattern_profile(user_id, sleep_date, stage);
