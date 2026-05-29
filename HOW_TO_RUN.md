[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](./storage/README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](./README.en.md)

# How to Run (실행 방법)

이 문서는 현재 ZZZ 프로젝트를 로컬에서 실행하고 확인하는 절차를 정리합니다.

현재 데이터 수집 기준은 **Google Health API**입니다. Fitbit Web API 경로와 `fitbit_*` 테이블은 제거되었고, demo seed도 Google Health 원천 데이터 기준으로 동작합니다.

---

## 1. 실행 전 준비물

필수:

- Node.js
- npm
- Git

선택:

- SQLite 확인 도구(DB 브라우저 등)
- Ollama
- Raspberry Pi
- DHT11 센서
- MQ-5 + ADC 모듈
- Google Cloud OAuth Client
- Google Health API 접근 권한이 있는 테스트 Google 계정

기본 시연은 `npm run seed-demo`로 넣는 시드 데이터를 사용합니다. 따라서 Quick Start만 확인할 때는 Google Health 연결, Raspberry Pi, 센서 장비, Ollama가 없어도 됩니다.

---

## 2. 프로젝트 받기

```bash
git clone <repository-url>
cd zzz
```

---

## 3. 환경 변수 설정

루트의 `.env.example` 파일을 참고해서 `.env`를 만듭니다.

```bash
GOOGLE_HEALTH_CLIENT_ID=
GOOGLE_HEALTH_CLIENT_SECRET=
GOOGLE_HEALTH_REDIRECT_URI=http://localhost:3000/google-health/callback
GOOGLE_HEALTH_SCOPES=https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly https://www.googleapis.com/auth/googlehealth.sleep.readonly https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly https://www.googleapis.com/auth/googlehealth.profile.readonly

DB_PATH=./storage/db/zzz.db
TIMEZONE=Asia/Seoul
SENSOR_INTERVAL_SECONDS=60
PRESLEEP_WINDOW_MINUTES=60
PATTERN_WINDOW_DAYS=7
PORT=3000

SLM_ENDPOINT=http://localhost:11434
SLM_MODEL=gemma4:e4b
SLM_TIMEOUT_MS=30000
```

Google OAuth를 실제로 연결하려면 Google Cloud OAuth Client의 redirect URI에 아래 주소가 등록되어 있어야 합니다.

```text
http://localhost:3000/google-health/callback
```

---

## 4. 의존성 설치

```bash
npm install
```

Raspberry Pi 센서 수집 기능을 실제 장비에서 개발할 때만 해당 환경에서 아래 의존성을 별도로 설치합니다.

```bash
npm install i2c-bus
```

---

## 5. DB 초기화

```bash
npm run init-db
```

현재 fresh DB에서 생성되어야 하는 테이블은 다음과 같습니다.

```text
devices, google_health_accounts, google_health_calories,
google_health_heart, google_health_sleep, google_health_steps,
pattern_profile, post_analysis_result, prediction_result,
sensor_raw, sleep_score_result, user_feedback, users
```

기존 DB를 재사용하면 과거 `fitbit_*` 테이블이 남아 있을 수 있습니다. Google Health only 상태를 확인하려면 새 DB 파일로 초기화하거나 기존 DB를 백업 후 재생성합니다.

---

## 6. UI 테스트용 시드 데이터 넣기

```bash
npm run seed-demo
```

`seed-demo`는 다음 데이터를 생성합니다.

- 기본 사용자 `u001`
- 기본 비밀번호 `demo1234`
- 기본 장치 `rpi001`
- OAuth account 없음
- D-6 ~ D-1의 `google_health_heart`, `google_health_steps`, `google_health_calories`, `google_health_sleep`
- D0의 최근 1시간 `google_health_heart`, `google_health_steps`, `google_health_calories`
- prediction, sleep score, feedback, post analysis, pattern row

즉, seed 직후에도 사용자가 직접 Google Health를 연결하는 흐름은 유지됩니다. Demo 원천 row의 `google_health_account_id`는 `NULL`입니다.

테스트가 끝난 뒤 시드 데이터를 지우려면 아래 명령을 사용합니다.

```bash
npm run cleanup-demo
```

---

## 7. 서비스 실행

```bash
npm run dev
```

브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:3000
```

기본 로그인:

```text
u001 / demo1234
```

---

## 8. Google Health 연결 확인

브라우저에서 로그인한 뒤 화면의 Google Health 연결 버튼을 사용합니다.

직접 API로 확인할 수도 있습니다.

```text
GET /google-health/status?user_id=1
GET /google-health/connect?user_id=1
POST /google-health/disconnect
```

연결 상태 응답에서 확인할 핵심 값:

- `connected`
- `google_health_account_id`
- `refresh_available`
- `token_expires_at`
- `token_expired`
- `scopes`

---

## 9. 주요 API 확인

```text
GET /health
GET /auth/users
GET /result/latest?user_id=1
GET /result/sleep-score-history?user_id=1&limit=7
POST /predict/presleep?skip_collect=true
POST /predict/presleep
POST /feedback
```

`POST /predict/presleep`는 기본적으로 Google Health presleep live sync를 먼저 시도합니다. 수집이 실패해도 DB에 최근 1시간 Google Health 데이터가 있으면 저장된 데이터로 예측을 계속 진행합니다.

Seed 데이터만으로 확인할 때는 아래처럼 수집을 생략할 수 있습니다.

```bash
curl -X POST "http://localhost:3000/predict/presleep?skip_collect=true" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":1}"
```

Feedback 예시:

```bash
curl -X POST "http://localhost:3000/feedback" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":1,\"sleep_date\":\"2026-05-29\",\"satisfaction_score\":71}"
```

`sleep_date`는 UI 입력 기준으로는 기상일입니다. 서버 내부에서는 해당 기상일의 전날을 실제 수면일로 매핑합니다.

---

## 10. DB 확인용 명령어

### 10-1. 테이블 목록 확인

```powershell
@'
const db = require('./storage/db/db');
db.all(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`, [], (err, rows) => {
  if (err) console.error(err.message);
  else console.log(rows.map((row) => row.name).join(', '));
  db.close();
});
'@ | node -
```

### 10-2. Google Health row 수 확인

```powershell
@'
const db = require('./storage/db/db');
const tables = [
  'google_health_accounts',
  'google_health_heart',
  'google_health_steps',
  'google_health_calories',
  'google_health_sleep'
];
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

### 10-3. 최신 결과 확인

```powershell
@'
const db = require('./storage/db/db');
db.get(`
  SELECT id, target_sleep_date, risk_level, risk_score, created_at
  FROM prediction_result
  ORDER BY created_at DESC
  LIMIT 1
`, [], (err, row) => {
  if (err) console.error(err.message);
  else console.log(row);
  db.close();
});
'@ | node -
```

---

## 11. 현재 확인 상태

현재 fresh DB 기준 생성 테이블은 아래로 확인되었습니다.

```text
devices, google_health_accounts, google_health_calories, google_health_heart,
google_health_sleep, google_health_steps, pattern_profile,
post_analysis_result, prediction_result, sensor_raw, sleep_score_result,
user_feedback, users
```

아직 실제 계정에서 새로 수집된 live 데이터가 없는 경우, `google_health_*` 결과는 seed 데이터 또는 빈 상태로 보일 수 있습니다. 팀원 테스트에서 확인해야 할 항목은 다음입니다.

- Google Health OAuth 연결 완료 여부
- `POST /predict/presleep` 실행 후 `google_health_heart`, `google_health_steps`, `google_health_calories` 저장 여부
- `POST /feedback` 또는 postsleep 수집 후 `google_health_sleep` 저장 여부
- 수집된 데이터 기준 예측, feedback, result 화면 정상 표시 여부

## 관련 문서

[README](./README.md)  
[Project Structure](./PROJECT_STRUCTURE.md)  
[Decision Log](./DECISION_LOG.md)  
[API Plan](./API_PLAN.md)  
[Google Health Transition](./agent/GOOGLE_HEALTH_TRANSITION.md)
