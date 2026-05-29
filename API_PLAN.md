# API_PLAN

이 문서는 ZZZ 프로젝트의 현재 API 구조를 정리합니다.

현재 wearable 데이터 수집 기준은 **Google Health API**입니다. Fitbit API endpoint와 `fitbit_*` 저장 경로는 제거되었습니다.

---

## 1. Current API Endpoints

### Health Check

- `GET /health`

서버 실행 상태를 확인합니다.

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/users`

현재 구현은 로컬 demo용 최소 auth입니다. 로그인 성공 후 UI는 `user_id`, `login_id`를 저장하고 이후 API 호출에 `user_id`를 전달합니다.

### Google Health

- `GET /google-health/connect?user_id=1`
- `GET /google-health/callback`
- `GET /google-health/status?user_id=1`
- `POST /google-health/disconnect`

용도:

- Google OAuth 연결
- access token / refresh token 저장
- 연결 상태 확인
- 연결 해제

Token 원문은 status 응답에 포함하지 않습니다.

### Pre-Sleep Prediction

- `POST /predict/presleep`
- `POST /predict/presleep?skip_collect=true`

용도:

- 취침 전 Google Health presleep live sync 시도
- 최근 1시간 Google Health heart/steps/calories 및 sensor 데이터 기반 feature 생성
- 취침 전 위험도, 위험 요인, 행동 제안 저장 및 반환

참고:

- `skip_collect=true`는 live sync를 생략하고 DB에 저장된 데이터만 사용합니다.
- live sync가 실패해도 DB에 최근 wearable 데이터가 있으면 예측은 계속 진행합니다.
- 최근 1시간 wearable 데이터가 전혀 없으면 예측은 실패합니다.

### Latest Result

- `GET /result/latest?user_id=1`

최신 feedback, prediction, sleep score, post analysis, environment 결과를 종합 조회합니다.

### Sleep Score History

- `GET /result/sleep-score-history?user_id=1&limit=7`

최근 Sleep Score 추이를 조회합니다. `limit`은 1~30 사이로 제한되며 기본값은 7입니다.

### Feedback Input

- `POST /feedback`

용도:

- 기상 후 수면 만족도 입력
- 같은 수면 날짜에 재입력 시 수정
- feedback 저장 후 Sleep Score, post analysis, pattern profile 후속 갱신

참고:

- 요청의 `sleep_date` 값은 UI 입력 기준의 기상일입니다.
- 서버 내부에서는 해당 기상일의 전날을 실제 `sleep_date`로 매핑합니다.
- 미래 기상일은 입력할 수 없습니다.

---

## 2. Request / Response Examples

### `GET /health`

```json
{
  "status": "ok",
  "service": "zzz-service",
  "time": "2026-05-29T10:59:03.000Z"
}
```

### `POST /auth/login`

Request:

```json
{
  "login_id": "u001",
  "password": "demo1234"
}
```

Response:

```json
{
  "status": "ok",
  "endpoint": "POST /auth/login",
  "data": {
    "user_id": 1,
    "login_id": "u001"
  }
}
```

### `GET /google-health/status?user_id=1`

Response:

```json
{
  "status": "ok",
  "endpoint": "GET /google-health/status",
  "data": {
    "connected": true,
    "user_id": 1,
    "google_health_account_id": 1,
    "refresh_available": true,
    "token_expires_at": "2026-05-29T10:59:42.026Z",
    "token_expired": false,
    "scopes": [
      "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
      "https://www.googleapis.com/auth/googlehealth.sleep.readonly"
    ],
    "created_at": "2026-05-29T09:59:43.026Z",
    "updated_at": "2026-05-29T09:59:43.026Z"
  }
}
```

### `POST /predict/presleep?skip_collect=true`

Request:

```json
{
  "user_id": 1
}
```

Response example:

```json
{
  "status": "ok",
  "endpoint": "POST /predict/presleep",
  "warning": null,
  "data": {
    "id": 15,
    "prediction_ts": "2026-05-29T22:10:00",
    "target_sleep_date": "2026-05-29",
    "risk_level": "HIGH",
    "risk_score": 75,
    "reasons": [
      "취침 전 활동량이 다소 높은 편입니다.",
      "취침 전 칼로리 소모가 높은 편입니다.",
      "실내 온도가 약간 높은 편입니다.",
      "실내 공기 상태가 불리할 수 있습니다."
    ],
    "action_text": "취침 전에 심박을 안정시키고, 환기나 온습도 조절을 먼저 해보는 것이 좋겠습니다."
  }
}
```

### `GET /result/latest?user_id=1`

Response example:

```json
{
  "status": "ok",
  "endpoint": "GET /result/latest",
  "data": {
    "message": "latest result fetched",
    "latest_feedback": {
      "sleep_date": "2026-05-28",
      "satisfaction_score": 68
    },
    "latest_prediction": {
      "target_sleep_date": "2026-05-29",
      "risk_level": "HIGH",
      "risk_score": 75,
      "reasons": []
    },
    "latest_sleep_score": {
      "sleep_date": "2026-05-28",
      "total_score": 82.2
    },
    "latest_analysis": {
      "sleep_date": "2026-05-28",
      "causes": []
    },
    "latest_environment": {
      "temperature": 25.9,
      "humidity": 19,
      "mq5_index": 0.552
    }
  }
}
```

### `GET /result/sleep-score-history?user_id=1&limit=7`

Response example:

```json
{
  "status": "ok",
  "endpoint": "GET /result/sleep-score-history",
  "data": {
    "message": "sleep score history fetched",
    "history": [
      {
        "sleep_date": "2026-05-27",
        "total_score": 75.7
      },
      {
        "sleep_date": "2026-05-28",
        "total_score": 82.2
      }
    ]
  }
}
```

### `POST /feedback`

Request:

```json
{
  "user_id": 1,
  "sleep_date": "2026-05-29",
  "satisfaction_score": 82
}
```

Response example:

```json
{
  "status": "ok",
  "endpoint": "POST /feedback",
  "data": {
    "message": "feedback saved",
    "action": "insert",
    "wake_date": "2026-05-29",
    "sleep_date": "2026-05-28",
    "satisfaction_score": 82,
    "sleep_score": {
      "action": "exists"
    },
    "pattern": {
      "action": "upsert"
    },
    "post_analysis": {
      "action": "upsert"
    }
  }
}
```

Error response example:

```json
{
  "status": "error",
  "message": "future wake_date is not allowed"
}
```

---

## 3. Screen Mapping

- `/`
  - overview, health 상태, summary, environment, sleep score trend
- `/presleep.html`
  - 취침 전 예측 실행 및 결과 확인
- `/postsleep.html`
  - feedback 입력, 저장, 수정
- `/result.html`
  - 최신 feedback, prediction, sleep score, analysis 결과 조회

---

## 4. Verification Notes

Fresh DB 기준 테이블 목록:

```text
devices, google_health_accounts, google_health_calories, google_health_heart,
google_health_sleep, google_health_steps, pattern_profile,
post_analysis_result, prediction_result, sensor_raw, sleep_score_result,
user_feedback, users
```

현재 팀원 live 수집 테스트에서 확인해야 할 항목:

- Google Health OAuth 연결 후 `google_health_accounts` row 생성
- presleep 수집 후 `google_health_heart`, `google_health_steps`, `google_health_calories` row 생성
- postsleep 수집 후 `google_health_sleep` row 생성
- 수집 데이터가 없을 때는 seed-demo 또는 Google Health 재연결이 필요하다는 에러가 표시되는지 확인
