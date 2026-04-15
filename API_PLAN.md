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
- 현재는 skeleton endpoint
- 이후 실제 feature 기반 예측 로직 연결 예정

현재 상태:
- skeleton 연결 완료
- 실제 계산 로직은 아직 없음

---

### Latest result
- `GET /result/latest`

용도:
- 최신 결과 조회
- 현재는 skeleton endpoint
- 이후 DB 조회 및 종합 결과 반환으로 확장 예정

현재 상태:
- skeleton 연결 완료
- 실제 DB 조회는 아직 없음

---

### Feedback input
- `POST /feedback`

용도:
- 기상 후 수면 만족도 입력
- 같은 날짜 재입력 시 수정

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
  "data": {
    "message": "presleep prediction endpoint ready",
    "received": {
      "user_id": "user-01"
    }
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
    "message": "latest result endpoint ready",
    "result": null
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
- `/postsleep.html`
  - feedback 입력 / 저장 / 수정 화면

추후 아래 화면을 확장할 수 있습니다.

- `/presleep.html`
- 결과 조회 화면
- 통합 대시보드 화면

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
3. `result/latest`를 실제 DB 조회로 연결
4. `predict/presleep`에 실제 예측 로직 연결
5. 결과 조회 화면 추가
6. presleep 화면 추가

즉 현재는 **입력과 최소 API skeleton을 확보한 상태**에서  
조회와 예측 로직을 차례대로 붙여 가는 방향입니다.

---

## 6. Notes

- 현재 API는 팀원들이 바로 구현을 시작할 수 있도록 최소 단위로 열어 둔 상태입니다.
- 현재 endpoint 이름은 이후 기능이 구체화되면 더 세분화될 수 있습니다.
- feedback API는 현재 입력 저장/수정만 담당하며, pattern update는 직접 수행하지 않습니다.
- pattern update는 이후 processing 계층 또는 별도 흐름에서 최신 feedback를 읽어 반영하는 방향으로 확장합니다.