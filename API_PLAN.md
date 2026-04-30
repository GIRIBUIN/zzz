# API_PLAN

이 문서는 ZZZ 프로젝트의 **현재 구현된 API 구조**를 정리합니다.

---

## 1. Current API Endpoints

현재 서비스 서버(`service/server.js`)에서 연결하는 endpoint는 아래와 같습니다.

### Health Check
- `GET /health`

용도:
- 서버 실행 상태 확인
- 최소 backend 동작 확인

### Pre-Sleep Prediction
- `POST /predict/presleep`
- `POST /predict/presleep?skip_collect=true`

용도:
- 취침 전 예측 요청
- Fitbit 수집 또는 저장된 최근 데이터 기반 feature 생성
- 취침 전 위험도, 위험 요인, 행동 제안 반환

참고:
- `skip_collect=true`를 사용하면 Fitbit live sync를 생략하고 DB에 저장된 데이터만 사용합니다.
- 시드 데이터 데모에서는 `skip_collect=true`로도 예측 흐름을 확인할 수 있습니다.

### Latest Result
- `GET /result/latest`

용도:
- 최신 feedback, prediction, sleep score, post analysis, environment 결과 종합 조회

### Sleep Score History
- `GET /result/sleep-score-history?limit=7`

용도:
- 최근 Sleep Score 추이 조회
- Overview 화면의 점수 그래프 표시

참고:
- `limit`은 1~30 사이로 제한됩니다.
- 값을 생략하면 기본값은 7입니다.

### Feedback Input
- `POST /feedback`

용도:
- 기상 후 수면 만족도 입력
- 같은 수면 날짜에 재입력 시 수정
- feedback 저장 후 Sleep Score, post analysis, pattern profile 후속 갱신

참고:
- 요청의 `sleep_date` 값은 UI 입력 기준의 **기상일**입니다.
- 서버 내부에서는 해당 기상일의 전날을 실제 `sleep_date`로 매핑합니다.
- 미래 기상일은 입력할 수 없습니다.

---

## 2. Request / Response Examples

### `GET /health`

Response:

```json
{
  "status": "ok",
  "service": "zzz-service",
  "time": "2026-04-30T10:59:03.000Z"
}
```

### `POST /predict/presleep?skip_collect=true`

Request:

```json
{}
```

Response example:

```json
{
  "status": "ok",
  "endpoint": "POST /predict/presleep",
  "warning": null,
  "data": {
    "id": 15,
    "prediction_ts": "2026-04-30T19:54:00",
    "target_sleep_date": "2026-04-30",
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

### `GET /result/latest`

Response example:

```json
{
  "status": "ok",
  "endpoint": "GET /result/latest",
  "data": {
    "message": "latest result fetched",
    "latest_feedback": {
      "sleep_date": "2026-04-29",
      "satisfaction_score": 68
    },
    "latest_prediction": {
      "target_sleep_date": "2026-04-30",
      "risk_level": "HIGH",
      "risk_score": 75,
      "reasons": []
    },
    "latest_sleep_score": {
      "sleep_date": "2026-04-29",
      "total_score": 82.3
    },
    "latest_analysis": {
      "sleep_date": "2026-04-29",
      "causes": []
    },
    "latest_environment": {
      "temperature": 26.1,
      "humidity": 19,
      "mq5_index": 0.553
    }
  }
}
```

### `GET /result/sleep-score-history?limit=7`

Response example:

```json
{
  "status": "ok",
  "endpoint": "GET /result/sleep-score-history",
  "data": {
    "message": "sleep score history fetched",
    "history": [
      {
        "sleep_date": "2026-04-28",
        "total_score": 75.9
      },
      {
        "sleep_date": "2026-04-29",
        "total_score": 82.3
      }
    ]
  }
}
```

### `POST /feedback`

Request:

```json
{
  "sleep_date": "2026-04-30",
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
    "wake_date": "2026-04-30",
    "sleep_date": "2026-04-29",
    "satisfaction_score": 82,
    "sleep_score": {},
    "pattern": {},
    "post_analysis": {}
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

현재 endpoint와 연결되는 화면은 아래와 같습니다.

- `/`
  - index 허브 화면
  - health 상태 확인
  - summary / environment / sleep score trend 확인
- `/presleep.html`
  - 취침 전 예측 실행 및 결과 확인
- `/postsleep.html`
  - feedback 입력 / 저장 / 수정
- `/result.html`
  - 최신 feedback / prediction / sleep score / analysis 결과 조회

---

## 4. Notes

- API 응답은 공통적으로 `status`, `endpoint`, `data`를 중심으로 구성합니다.
- `POST /feedback`는 입력 저장/수정 이후 Sleep Score, post analysis, pattern update 흐름을 호출합니다.
- pattern update 로직은 `processing/pattern/pattern_update.js`에서 최신 feedback과 계산 결과를 반영합니다.
