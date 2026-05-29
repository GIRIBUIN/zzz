-- ZZZ MySQL/MariaDB schema for AWS RDS
-- Source: storage/db/schema.sql

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS pattern_profile;
DROP TABLE IF EXISTS post_analysis_result;
DROP TABLE IF EXISTS sleep_score_result;
DROP TABLE IF EXISTS prediction_result;
DROP TABLE IF EXISTS user_feedback;
DROP TABLE IF EXISTS sensor_raw;
DROP TABLE IF EXISTS google_health_sleep;
DROP TABLE IF EXISTS google_health_calories;
DROP TABLE IF EXISTS google_health_steps;
DROP TABLE IF EXISTS google_health_heart;
DROP TABLE IF EXISTS google_health_accounts;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    login_id VARCHAR(191) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_login_id (login_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    iot_thing_name VARCHAR(191) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_devices_iot_thing_name (iot_thing_name),
    KEY idx_devices_user_id (user_id),
    CONSTRAINT fk_devices_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE google_health_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at DATETIME,
    scopes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_google_health_accounts_user (user_id),
    CONSTRAINT fk_google_health_accounts_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE google_health_heart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    google_health_account_id INT,
    ts DATETIME NOT NULL,
    bpm INT NOT NULL,
    raw_json LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_google_health_heart_user_ts (user_id, ts),
    KEY idx_google_health_heart_account_id (google_health_account_id),
    CONSTRAINT fk_google_health_heart_user_id FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_google_health_heart_account_id FOREIGN KEY (google_health_account_id) REFERENCES google_health_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE google_health_steps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    google_health_account_id INT,
    ts DATETIME NOT NULL,
    steps INT NOT NULL,
    raw_json LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_google_health_steps_user_ts (user_id, ts),
    KEY idx_google_health_steps_account_id (google_health_account_id),
    CONSTRAINT fk_google_health_steps_user_id FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_google_health_steps_account_id FOREIGN KEY (google_health_account_id) REFERENCES google_health_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE google_health_calories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    google_health_account_id INT,
    ts DATETIME NOT NULL,
    calories DOUBLE NOT NULL,
    raw_json LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_google_health_calories_user_ts (user_id, ts),
    KEY idx_google_health_calories_account_id (google_health_account_id),
    CONSTRAINT fk_google_health_calories_user_id FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_google_health_calories_account_id FOREIGN KEY (google_health_account_id) REFERENCES google_health_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE google_health_sleep (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    google_health_account_id INT,
    sleep_date DATE NOT NULL,
    start_time DATETIME,
    end_time DATETIME,
    minutes_asleep INT,
    minutes_awake INT,
    deep_minutes INT,
    light_minutes INT,
    rem_minutes INT,
    is_main_sleep TINYINT,
    raw_json LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_google_health_sleep_user_date (user_id, sleep_date),
    KEY idx_google_health_sleep_account_id (google_health_account_id),
    CONSTRAINT fk_google_health_sleep_user_id FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_google_health_sleep_account_id FOREIGN KEY (google_health_account_id) REFERENCES google_health_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sensor_raw (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    device_id INT NOT NULL,
    ts DATETIME NOT NULL,
    temperature DOUBLE,
    humidity DOUBLE,
    mq5_raw DOUBLE,
    mq5_index DOUBLE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_sensor_raw_user_ts (user_id, ts),
    KEY idx_sensor_raw_device_id (device_id),
    CONSTRAINT fk_sensor_raw_user_id FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_sensor_raw_device_id FOREIGN KEY (device_id) REFERENCES devices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sleep_date DATE NOT NULL,
    satisfaction_score DOUBLE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_feedback_user_date (user_id, sleep_date),
    CONSTRAINT fk_user_feedback_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE prediction_result (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    prediction_ts DATETIME NOT NULL,
    target_sleep_date DATE,
    risk_level VARCHAR(16) NOT NULL,
    risk_score DOUBLE,
    reasons_json LONGTEXT,
    action_text TEXT,
    feature_snapshot_json LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_prediction_result_user_ts (user_id, prediction_ts),
    KEY idx_prediction_result_user_target_date (user_id, target_sleep_date),
    CONSTRAINT fk_prediction_result_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sleep_score_result (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sleep_date DATE NOT NULL,
    time_asleep_score DOUBLE,
    deep_rem_score DOUBLE,
    restoration_score DOUBLE,
    total_score DOUBLE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sleep_score_result_user_date (user_id, sleep_date),
    CONSTRAINT fk_sleep_score_result_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_analysis_result (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sleep_score_result_id INT,
    sleep_date DATE NOT NULL,
    causes_json LONGTEXT,
    analysis_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_post_analysis_result_user_date (user_id, sleep_date),
    KEY idx_post_analysis_result_score_id (sleep_score_result_id),
    CONSTRAINT fk_post_analysis_result_user_id FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_post_analysis_result_score_id FOREIGN KEY (sleep_score_result_id) REFERENCES sleep_score_result(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pattern_profile (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sleep_date DATE,
    stage VARCHAR(32),
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    avg_sleep_minutes DOUBLE,
    avg_satisfaction DOUBLE,
    avg_presleep_hr DOUBLE,
    score_gap_trend DOUBLE,
    env_sensitivity_json LONGTEXT,
    pattern_snapshot_json LONGTEXT,
    KEY idx_pattern_profile_user_updated_at (user_id, updated_at),
    UNIQUE KEY uq_pattern_profile_user_sleep_date_stage (user_id, sleep_date, stage),
    CONSTRAINT fk_pattern_profile_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
