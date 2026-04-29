# API_PLAN

이 문서는 ZZZ 프로젝트의 **현재 API 구조**와 **향후 확장 방향**을 정리하기 위한 문서입니다.

현재 단계에서는 팀원들이 바로 구현을 시작할 수 있도록  
최소 실행 가능한 API 구조를 먼저 쓰고 있습니다.

여기서는 지금 열어 둔 endpoint와,  
나중에 어떤 방향으로 늘릴 수 있는지를 정리합니다.

---

## 1. Current API endpoints

현재 기준 endpoint는 아래와 같습니다.

### Health check
- `GET /health`

용도:
- 서버 실행 상태 확인
- 최소 backend 동작 확인

---

### Pre-sleep prediction
- `POST /predict/presleep`

용도:
- 취침 전 예측 요청
- Fitbit 수집 또는 저장된 최근 데이터 기반 feature 생성
- 취침 전 위험도, 위험 요인, 행동 제안 반환

현재 상태:
- 실제 feature 기반 예측 및 DB 저장 연결 완료
- `skip_collect=true` 쿼리로 Fitbit 수집 단계를 생략하고 저장된 데이터만 사용할 수 있음

---

### Latest result
- `GET /result/latest`

용도:
- 최신 결과 조회
- 최신 feedback, prediction, sleep score, post analysis 종합 조회

현재 상태:
- 실제 DB 조회 연결 완료

---

### Sleep score history
- `GET /result/sleep-score-history?limit=7`

용도:
- 최근 Sleep Score 추이 조회
- Overview 화면의 점수 그래프 표시

현재 상태:
- 실제 DB 조회 연결 완료
- `limit`은 1~30 사이로 제한

---

### Feedback input
- `POST /feedback`

용도:
- 기상 후 수면 만족도 입력
- 같은 날짜 재입력 시 수정
- feedback 저장 후 Sleep Score, post analysis, pattern profile 후속 갱신 연결

현재 상태:
- DB 저장/수정 연결 완료
- 동일 값 재입력 시 `no_change`
- 미래 날짜 입력 불가

---

## 2. Current request / response examples

### `GET /health`

Response:
```json
{
  "status": "ok",
  "service": "zzz-service",
  "time": "2026-04-15T00:00:00.000Z"
}
```

---

### `POST /predict/presleep`

Request:
```json
{
  "user_id": "user-01"
}
```

Current response example:
```json
{
  "status": "ok",
  "endpoint": "POST /predict/presleep",
  "warning": null,
  "data": {
    "id": 1,
    "risk_level": "medium",
    "risk_score": 64,
    "reasons": [],
    "action_text": "오늘은 취침 전 자극을 줄이는 것이 좋습니다."
  }
}
```

---

### `GET /result/latest`

Current response example:
```json
{
  "status": "ok",
  "endpoint": "GET /result/latest",
  "data": {
    "message": "latest result fetched",
    "feedback": null,
    "prediction": null,
    "sleep_score": null,
    "post_analysis": null
  }
}
```

---

### `GET /result/sleep-score-history?limit=7`

Current response example:
```json
{
  "status": "ok",
  "endpoint": "GET /result/sleep-score-history",
  "data": {
    "message": "sleep score history fetched",
    "history": []
  }
}
```

---

### `POST /feedback`

Request:
```json
{
  "sleep_date": "2026-04-15",
  "satisfaction_score": 82
}
```

Insert response example:
```json
{
  "status": "ok",
  "endpoint": "POST /feedback",
  "data": {
    "message": "feedback saved",
    "action": "insert",
    "id": 1,
    "sleep_date": "2026-04-15",
    "satisfaction_score": 82,
    "created_at": "2026-04-15T06:17:40.852Z"
  }
}
```

Update response example:
```json
{
  "status": "ok",
  "endpoint": "POST /feedback",
  "data": {
    "message": "feedback updated",
    "action": "update",
    "id": 1,
    "sleep_date": "2026-04-15",
    "satisfaction_score": 90,
    "created_at": "2026-04-15T06:17:54.314Z"
  }
}
```

No change response example:
```json
{
  "status": "ok",
  "endpoint": "POST /feedback",
  "data": {
    "message": "feedback unchanged",
    "action": "no_change",
    "id": 1,
    "sleep_date": "2026-04-15",
    "satisfaction_score": 90
  }
}
```

Error response example:
```json
{
  "status": "error",
  "message": "future sleep_date is not allowed"
}
```

---

## 3. Current screen mapping

현재 endpoint와 연결되는 화면은 아래와 같습니다.

- `/`
  - index 허브 화면
  - health 상태 확인 가능
  - summary / environment / sleep score trend 확인 가능
- `/presleep.html`
  - 취침 전 예측 실행 및 결과 확인 화면
- `/postsleep.html`
  - feedback 입력 / 저장 / 수정 화면
- `/result.html`
  - 최신 feedback / prediction / sleep score / analysis 결과 조회 화면

---

## 4. Expansion direction

현재 API는 최소 실행 가능한 구조를 먼저 쓰고 있습니다.  
이후 기능이 늘어나면 아래 방향으로 세분화할 수 있습니다.

### 4-1. 결과 조회 확장
- `GET /result?sleep_date=YYYY-MM-DD`
- `GET /sleep-score/latest`
- `GET /analysis/latest`

### 4-2. 예측 확장
- `POST /predict/postsleep`
- `POST /predict/recalculate`

### 4-3. 사용자/세션 기준 확장
- 사용자 식별 기준 추가
- 사용자별 최근 결과 조회
- 세션/실험 기준 결과 구분

즉 현재 API는 시작점이고,  
결과 종류와 조회 조건이 늘어나면 점진적으로 분리합니다.

---

## 5. Current implementation priority

현재 구현 우선순위는 아래와 같습니다.

1. Health check 유지
2. Feedback 입력/저장/수정 안정화
3. `result/latest` 실제 DB 조회 유지
4. `predict/presleep` 실제 예측 로직 유지
5. Sleep Score / post analysis / pattern update 흐름 고도화
6. Fitbit 및 센서 실제 수집 안정화

즉 현재는 **서비스 화면과 주요 API 흐름을 연결한 상태**에서  
실제 수집 안정성과 개인화 로직을 고도화하는 방향입니다.

---

## 6. Notes

- 현재 API는 팀원들이 바로 구현을 시작할 수 있도록 최소 단위로 열어 둔 상태입니다.
- 현재 endpoint 이름은 이후 기능이 구체화되면 더 세분화될 수 있습니다.
- feedback API는 입력 저장/수정 이후 Sleep Score, post analysis, pattern update 흐름을 호출합니다.
- pattern update 로직은 processing 계층을 통해 최신 feedback와 계산 결과를 반영하는 방향으로 유지합니다.
