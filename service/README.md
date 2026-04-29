[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](../processing/README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](../storage/README.md)

# Service Layer Guide (Service 계층 문서)

이 문서는 **ZZZ 프로젝트에서 `service/` 폴더가 어떤 역할을 맡는지** 설명하기 위한 문서입니다.

`service/`는 ZZZ 프로젝트의 **REST API 및 대시보드 계층**입니다.  
즉, 사용자의 요청을 받고, 필요한 계산 로직을 호출하고, 결과를 다시 사용자에게 전달하는 쪽입니다.

여기는 단순히 Express 서버를 띄우는 폴더가 아니라,  
전체 시스템에서 **사용자와 가장 먼저 만나는 계층**이라고 보면 됩니다.

---

## 1. 왜 `service/` 폴더를 따로 두는가

이 프로젝트는 On-Premise 방식으로 개발 중이라  
실제로는 하나의 로컬 서버에서 API와 대시보드를 같이 띄울 수 있습니다.

그래도 아래 같은 코드가 한 군데에 다 섞이면 금방 복잡해집니다.

- API URL 정의
- 요청/응답 처리
- 계산 로직 호출
- DB 조회 및 저장 연결
- 정적 화면 파일 관리

특히 예측 계산 로직과 API 응답 로직이 섞이면  
수정할 때 어디를 건드려야 하는지 헷갈리기 쉽습니다.

그래서 `service/`는  
**“사용자 요청을 받아 서비스 흐름으로 연결하는 책임”**만 따로 모아 둔 폴더입니다.

즉, 계산을 직접 길게 하는 곳이라기보다  
**계산 계층과 저장 계층을 사용자 요청 흐름 안에 연결하는 곳**입니다.

---

## 2. 이 계층의 핵심 역할

`service/`는 아래 역할을 담당합니다.

- Express 서버 실행
- REST API 제공
- 요청/응답 처리
- `processing/` 호출
- 결과 저장 연결
- 웹 대시보드 제공

즉, `service/`는 **사용자 요청을 서비스 흐름으로 바꾸는 계층**입니다.

---

## 3. 하위 폴더 구성

```text
service/
├─ controllers/
├─ public/
├─ routes/
├─ services/
├─ README.md
└─ server.js
```

---

## 4. 각 하위 구성 설명

### 4-1. `server.js`

`server.js`는 Express 서버 시작점입니다.

보통 여기서 하는 일은 아래 정도입니다.

- Express 앱 생성
- 미들웨어 등록
- 라우트 연결
- 정적 파일 연결
- 포트 열기

즉, 서비스 계층의 진입점입니다.

---

### 4-2. `routes/`

`routes/`는 API URL을 정의하는 폴더입니다.

예를 들면 이런 요청 경로를 관리합니다.

- 예측 요청
- 결과 조회
- 만족도 입력
- 상태 확인

즉, **어떤 요청이 어디로 들어오는지**를 정리하는 곳입니다.

현재 기준 파일은 아래처럼 보고 있습니다.

- `predict.js`
- `result.js`
- `feedback.js`
- `health.js`

#### 현재 기준 API 뼈대

지금은 최소 실행 가능한 API 구조를 우선 씁니다.

- `GET /health`
- `POST /predict/presleep`
- `GET /result/latest`
- `POST /feedback`

이 구조는 지금 서비스 흐름에서 가장 먼저 필요한 것만 잡아 둔 상태입니다.

#### 확장 방향

지금 API는 시작점에 가깝습니다.  
기능이 늘어나면 아래처럼 나눌 수 있습니다.

- 날짜 기준 결과 조회
  - `GET /result?sleep_date=YYYY-MM-DD`
- 결과 종류 분리
  - `GET /sleep-score/latest`
  - `GET /analysis/latest`
- 예측 종류 확장
  - `POST /predict/postsleep`
- 사용자/세션 기준 확장

즉 지금은 최소 구조로 열어두고,  
나중에 결과 종류나 조회 조건이 늘어나면 그때 세분화합니다.

---

### 4-3. `controllers/`

`controllers/`는 요청과 응답을 실제로 처리하는 폴더입니다.

역할은 아래 정도입니다.

- 요청 파라미터 확인
- 필요한 service 호출
- 응답 형식 정리
- 에러 처리

즉, HTTP 요청/응답 처리 책임을 맡습니다.

현재 기준 파일은 아래처럼 봅니다.

- `predictController.js`
- `resultController.js`
- `feedbackController.js`

여기에는 계산 로직을 길게 넣지 않는 게 중요합니다.  
계산은 `processing/`이 맡고, controller는 흐름 연결에 집중합니다.

---

### 4-4. `services/`

`services/`는 API 서버 입장에서 필요한 **처리 흐름 정리용 계층**입니다.

처음 보면 `processing/`과 비슷해 보일 수 있지만 다릅니다.

여기서는 보통:

- DB에서 데이터 조회
- `processing/` 호출
- 결과 저장
- API 응답용 구조 정리

같은 일을 합니다.

즉, **서버가 계산 계층과 저장 계층을 묶어 쓰는 계층**입니다.

현재 구현 기준 파일은 아래와 같습니다.

- `predictionService.js`
- `resultService.js`
- `feedbackService.js`
- `sleepScoreService.js`
- `postAnalysisService.js`
- `analysisService.js`
- `dashboardService.js`

즉 지금은 엔드포인트 대응형 최소 구조로 시작하고,  
필요해지면 기능 단위로 더 나눕니다.

---

### 4-5. `public/`

`public/`은 웹 화면에 필요한 정적 파일을 두는 폴더입니다.

예를 들면:

- 메인 허브 페이지
- 취침 전 예측 화면
- 기상 후 만족도 입력 화면
- 최신 결과 조회 화면
- 페이지별 JS 파일

현재 기준 파일은 아래처럼 보고 있습니다.

- `index.html`
- `presleep.html`
- `postsleep.html`
- `result.html`
- `css/common.css`
- `css/overview.css`
- `css/presleep.css`
- `css/postsleep.css`
- `css/result.css`
- `js/common.js`
- `js/overview.js`
- `js/presleep.js`
- `js/postsleep.js`
- `js/result.js`

즉 지금은 `index`를 허브처럼 두고,  
`presleep`, `postsleep`, `result` 화면을 분리해서 기능별로 붙여 가는 방식으로 시작한 상태입니다.

---

### 4-6. `package.json`

Node.js 실행 기준은 현재 **루트 `package.json`**입니다.

즉, `service/`는 Express 서버와 API 코드가 들어 있는 폴더이고,  
의존성 설치와 실행 스크립트는 루트 기준으로 관리합니다.

---

## 5. 이 계층이 하지 않는 일

`service/`는 서비스 요청 흐름을 담당하지만, 모든 걸 직접 하지는 않습니다.

여기서는 아래 작업을 직접 길게 하지 않습니다.

- 센서 데이터 수집
- Fitbit API 직접 수집
- Sleep Score 계산 공식 구현
- 취침 전 예측 계산 공식 구현
- A(누적 패턴 데이터) 갱신 계산 공식 구현

즉, `service/`는 **계산을 직접 수행하는 곳이 아니라**  
계산 계층을 호출하고 흐름을 연결하는 곳입니다.

---

## 6. `processing/`과의 차이

처음 구조를 보면 `service/services/`와 `processing/`이 비슷해 보일 수 있습니다.  
하지만 역할은 분명히 다릅니다.

### `processing/`
- 계산 자체 담당
- feature 생성
- 예측
- Sleep Score 계산
- 사후 분석
- A 갱신

### `service/services/`
- 서버 요청 흐름 담당
- DB 조회
- `processing/` 호출
- 결과 저장
- API 응답에 맞게 정리

짧게 말하면:

```text
processing = 계산 엔진
service/services = 서버가 계산 엔진과 DB를 묶어 쓰는 계층
```

---

## 7. 다른 계층과의 연결 관계

`service/`는 보통 아래처럼 연결됩니다.

```text
service -> processing
service -> storage
```

조금 더 풀면:

```text
사용자 요청
-> route
-> controller
-> service/services
-> processing
-> storage/db
-> 응답 반환
```

즉 `service/`는 전체 시스템에서  
**요청의 진입점**이자 **서비스 제공 계층**입니다.

---

## 8. 미래 구조와의 관계

현재는 On-Premise 단계라  
`service/`는 로컬 환경에서 실행되는 Express 서버 계층입니다.

나중에는 이 계층이 더 분명하게 나뉠 수 있습니다.

예를 들면:

- API 서버는 EC2 기반 서비스 계층으로 확장
- 대시보드는 별도 프론트 구조와 연결
- 설명형 피드백 계층 강화

즉 지금은 로컬 서버지만,  
나중에는 **클라우드 서비스/API 계층으로 자연스럽게 커질 수 있는 구조**를 생각하고 있습니다.

---

## 9. 개발 시 기본 원칙

`service/`에서는 아래 원칙을 지키는 게 좋습니다.

- 요청/응답 처리 책임만 맡는다
- 계산 공식을 직접 길게 넣지 않는다
- `processing/` 호출 중심으로 간다
- DB 조회/저장은 service 흐름 안에서 명확하게 연결한다
- 응답 형식은 되도록 일관되게 유지한다

즉, 여기서는 **흐름 연결 역할**에 집중하는 게 중요합니다.

---

## 10. API 설계 메모

현재 `service/` 계층 API는  
최소 실행 가능한 구조를 먼저 열어 두는 쪽으로 가고 있습니다.

그래서 지금은 단순하고 명확한 endpoint를 우선 쓰고,  
기능이 늘어나면 결과 종류와 조회 조건에 따라 쪼개는 방향을 따릅니다.

---

## 11. 관련 문서

[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](../processing/README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](../storage/README.md)

[![README](https://img.shields.io/badge/README-2563EB?style=for-the-badge)](../README.md)
[![Project Structure](https://img.shields.io/badge/Project_Structure-2563EB?style=for-the-badge)](../PROJECT_STRUCTURE.md)
[![Decision Log](https://img.shields.io/badge/Decision_Log-2563EB?style=for-the-badge)](../DECISION_LOG.md)
[![API Plan](https://img.shields.io/badge/API_Plan-2563EB?style=for-the-badge)](../API_PLAN.md)
[![RPi Layer](https://img.shields.io/badge/RPi_Layer-2563EB?style=for-the-badge)](../rpi/README.md)
[![Processing Layer](https://img.shields.io/badge/Processing_Layer-2563EB?style=for-the-badge)](../processing/README.md)
[![Storage Layer](https://img.shields.io/badge/Storage_Layer-2563EB?style=for-the-badge)](../storage/README.md)
[![How to Run](https://img.shields.io/badge/How_to_Run-2563EB?style=for-the-badge)](../HOW_TO_RUN.md)
[![English README](https://img.shields.io/badge/English_README-2563EB?style=for-the-badge)](../README.en.md)
