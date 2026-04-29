[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](./storage/README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](./README.en.md)

# How to Run (실행 방법)

이 문서는 **현재 기준에서 ZZZ 프로젝트를 어떻게 실행하고 확인할 수 있는지** 정리한 문서입니다.

ZZZ는 On-Premise 방식의 스마트 헬스케어 시스템으로 개발 중이며,  
현재는 전체 구조와 실행 흐름을 정리한 상태에서 서비스 계층 중심으로 실행 환경을 맞추는 단계입니다.

여기서는 **지금 바로 실행 가능한 절차**만 기준으로 적습니다.

---

## 1. 실행 전 준비물

필수:
- Node.js
- npm
- Git

선택:
- SQLite 확인 도구(DB 브라우저 등)
- Raspberry Pi
- DHT11 센서
- MQ-5 + ADC 모듈
- Fitbit 계정 및 API 연동 정보

---

## 2. 프로젝트 받기

저장소를 클론한 뒤 프로젝트 루트로 이동합니다.

```bash
git clone <repository-url>
cd zzz
```

---

## 3. 환경 변수 설정

루트의 `.env.example` 파일을 참고해서 환경 변수를 설정합니다.

현재 기준 예시는 아래와 같습니다.

```bash
FITBIT_ACCESS_TOKEN=
FITBIT_REFRESH_TOKEN=
FITBIT_USER_ID=D4S4M2
DB_PATH=./storage/db/zzz.db
TIMEZONE=Asia/Seoul
SENSOR_INTERVAL_SECONDS=60
PRESLEEP_WINDOW_MINUTES=60
PATTERN_WINDOW_DAYS=7
PORT=3000

# SLM (Ollama) — 주석 해제 시 활성화 / ollama pull gemma4:e4b && ollama serve
# SLM_ENDPOINT=http://localhost:11434
# SLM_MODEL=gemma4:e4b
# SLM_TIMEOUT_MS=30000
```

최신 값은 `.env.example` 기준으로 확인하면 됩니다.

---

## 4. 의존성 설치

현재는 루트 `package.json`을 기준으로 의존성을 관리합니다.

프로젝트 루트에서 아래 명령을 실행합니다.

```bash
npm install
```

Raspberry Pi 센서 수집 기능을 개발할 때만 해당 환경에서 아래 의존성을 별도로 설치합니다.

```bash
npm install i2c-bus
```

---

## 5. DB 구조 확인

DB 스키마는 아래 파일에 정의되어 있습니다.

```text
storage/db/schema.sql
```

현재 DB 구조를 먼저 보고 싶으면 이 파일을 열어보면 됩니다.

주요 저장 대상은 다음과 같습니다.

- 환경 센서 원본 데이터
- Fitbit 시계열 데이터
- 대표 수면 결과
- 사용자 만족도 입력
- 취침 전 예측 결과
- Sleep Score 계산 결과
- 사후 분석 결과
- 누적 패턴 데이터

---

## 6. DB 초기화

DB 초기화는 `storage/db/init_db.js`를 기준으로 수행합니다.

루트 기준 실행 예시는 다음과 같습니다.

```bash
npm run init-db
```

정상 실행되면 `storage/db/` 아래에 DB 파일이 생성됩니다.

---

## 7. 서비스 실행

서비스 계층은 `service/server.js`를 기준으로 실행되고,  
실행 스크립트는 루트 `package.json`에서 관리합니다.

루트 기준 실행 예시는 다음과 같습니다.

```bash
npm run dev
```

---

## 8. UI 테스트용 더미 데이터 넣기

프론트 화면을 빠르게 확인하려면 더미 데이터를 먼저 넣는 것이 편합니다.

이 단계는 **현재 개발 및 UI 확인용 임시 절차**입니다.  
즉, 지금은 화면 확인을 위해 `seed-demo`를 사용하지만,  
이후 실제 센서 수집 / Fitbit 연동 / 예측 및 분석 파이프라인이 연결되면  
운영 흐름에서는 더미 데이터를 넣지 않고 실제 적재 데이터로 화면을 확인하게 됩니다.

아래 명령은 7일치 시연 흐름을 기준으로 테스트용 데이터를 넣습니다.

- `fitbit_heart`
- `fitbit_steps`
- `fitbit_calories`
- `fitbit_sleep`
- `sensor_raw`
- `prediction_result`
- `sleep_score_result`
- `user_feedback`
- `post_analysis_result`
- `pattern_profile`

```bash
npm run seed-demo
```

오늘 데이터는 취침 전 예측 시연을 위해 최근 1시간 기준으로 들어갑니다.
오늘 수면 결과는 아직 없는 상태로 둡니다.

테스트가 끝난 뒤 더미 데이터를 지우고 싶으면 아래 명령을 사용합니다.

```bash
npm run cleanup-demo
```

## 9. 서비스 접속 확인

서비스가 정상적으로 실행되면 브라우저에서 로컬 서버에 접속할 수 있어야 합니다.

기본 주소:

```text
http://localhost:3000
```

현재 기준으로 확인 가능한 페이지:

- `/`
- `/presleep.html`
- `/postsleep.html`
- `/result.html`
- `/result/latest`

---

## 10. DB 확인용 명령어

아래 명령들은 프로젝트 루트에서 실행합니다.

### 10-1. 주요 테스트 테이블 row 수 확인

```powershell
@'
const db = require('./storage/db/db');
const tables = ['prediction_result', 'sleep_score_result', 'sensor_raw', 'post_analysis_result'];
let pending = tables.length;
for (const table of tables) {
  db.get(`SELECT COUNT(*) AS count FROM ${table}`, [], (err, row) => {
    if (err) console.error(table, err.message);
    else console.log(`${table}: ${row.count}`);
    pending -= 1;
    if (pending === 0) db.close();
  });
}
'@ | node -
```

### 10-2. 최신 prediction 확인

```powershell
@'
const db = require('./storage/db/db');
db.get(`
  SELECT id, prediction_ts, target_sleep_date, risk_level, risk_score, reasons_json, action_text, feature_snapshot_json, created_at
  FROM prediction_result
  ORDER BY created_at DESC
  LIMIT 1
`, [], (err, row) => {
  if (err) console.error(err);
  else console.log(row);
  db.close();
});
'@ | node -
```

### 10-3. 최근 7일 sleep score 확인

```powershell
@'
const db = require('./storage/db/db');
db.all(`
  SELECT sleep_date, time_asleep_score, deep_rem_score, restoration_score, total_score, created_at
  FROM sleep_score_result
  ORDER BY sleep_date DESC
  LIMIT 7
`, [], (err, rows) => {
  if (err) console.error(err);
  else console.table(rows);
  db.close();
});
'@ | node -
```

### 10-4. 최신 sensor_raw 확인

```powershell
@'
const db = require('./storage/db/db');
db.get(`
  SELECT id, ts, temperature, humidity, mq5_raw, mq5_index, created_at
  FROM sensor_raw
  ORDER BY ts DESC
  LIMIT 1
`, [], (err, row) => {
  if (err) console.error(err);
  else console.log(row);
  db.close();
});
'@ | node -
```

### 10-5. 최신 post analysis 확인

```powershell
@'
const db = require('./storage/db/db');
db.get(`
  SELECT id, sleep_date, causes_json, analysis_text, created_at
  FROM post_analysis_result
  ORDER BY created_at DESC
  LIMIT 1
`, [], (err, row) => {
  if (err) console.error(err);
  else console.log(row);
  db.close();
});
'@ | node -
```

### 10-6. 최신 user feedback 확인

```powershell
@'
const db = require('./storage/db/db');
db.get(`
  SELECT id, sleep_date, satisfaction_score, created_at
  FROM user_feedback
  ORDER BY created_at DESC
  LIMIT 1
`, [], (err, row) => {
  if (err) console.error(err);
  else console.log(row);
  db.close();
});
'@ | node -
```

## 11. 현재 기준 확인 가능한 항목

현재 기준으로는 아래 정도까지 확인할 수 있습니다.

- 프로젝트 구조 확인
- 환경 변수 설정
- 프로젝트 의존성 설치
- DB 스키마 확인
- DB 초기화 실행
- Express 서버 실행
- 더미 데이터 적재 / 정리
- 로컬 접속 확인
- Health check 응답 확인
- Overview 화면의 summary / environment / sleep score trend 확인
- Pre-sleep prediction 화면의 input / result 확인
- Post-sleep feedback 화면 확인
- feedback 입력 / 저장 / 수정 동작 확인
- latest result 조회 확인
- Result 화면의 feedback / prediction / sleep score / analysis 확인

## 12. 추후 추가 예정

아래 항목은 구현이 진행되면 이 문서에 추가합니다.

- Raspberry Pi 센서 수집 실행 절차
- Fitbit API 실제 연동 절차
- API 테스트 예시 확장
- Presleep 화면 사용 절차
- 결과 조회 화면 사용 절차

---

## 📚 관련 문서

[![README](https://img.shields.io/badge/README-2563EB?style=for-the-badge)](./README.md)
[![Project Structure](https://img.shields.io/badge/Project_Structure-2563EB?style=for-the-badge)](./PROJECT_STRUCTURE.md)
[![Decision Log](https://img.shields.io/badge/Decision_Log-2563EB?style=for-the-badge)](./DECISION_LOG.md)
[![API Plan](https://img.shields.io/badge/API_Plan-2563EB?style=for-the-badge)](./API_PLAN.md)
[![RPi Layer](https://img.shields.io/badge/RPi_Layer-2563EB?style=for-the-badge)](./rpi/README.md)
[![Processing Layer](https://img.shields.io/badge/Processing_Layer-2563EB?style=for-the-badge)](./processing/README.md)
[![Service Layer](https://img.shields.io/badge/Service_Layer-2563EB?style=for-the-badge)](./service/README.md)
[![Storage Layer](https://img.shields.io/badge/Storage_Layer-2563EB?style=for-the-badge)](./storage/README.md)
[![English README](https://img.shields.io/badge/English_README-2563EB?style=for-the-badge)](./README.en.md)
