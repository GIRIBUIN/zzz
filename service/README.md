[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](../processing/README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](../storage/README.md)

# Service Layer Guide (Service 계층 문서)

이 문서는 **ZZZ 프로젝트에서 `service/` 폴더가 어떤 역할을 담당하는지** 설명하기 위한 문서입니다.

`service/`는 ZZZ 프로젝트의 **REST API 및 대시보드 계층**입니다.  
즉, 사용자의 요청을 받고, 필요한 계산 로직을 호출하고, 결과를 사용자에게 전달하는 **서비스 인터페이스 계층**입니다.

이 계층은 단순히 Express 서버를 실행하는 곳이 아니라,  
전체 시스템 안에서 **사용자와 가장 직접적으로 맞닿는 계층**으로 이해하면 됩니다.

---

## 1. 왜 `service/` 폴더를 따로 두는가

이 프로젝트는 On-Premise 방식으로 개발 중이기 때문에,  
실제로는 하나의 로컬 서버에서 API와 대시보드를 함께 실행할 수 있습니다.

하지만 다음과 같은 코드가 모두 한 곳에 섞이면 구조가 빠르게 복잡해집니다.

- API URL 정의
- 요청/응답 처리
- 계산 로직 호출
- DB 조회 및 저장 연결
- 대시보드 정적 파일 관리

특히 예측 계산 로직과 API 응답 로직이 섞이면,  
수정할 때 책임이 흐려지고 테스트도 어려워집니다.

그래서 `service/`는 **“사용자 요청을 받아 서비스 형태로 연결하는 책임”**만 담당하는 별도 계층으로 분리했습니다.

즉, `service/`는 계산을 직접 수행하는 곳이 아니라,  
**계산 계층과 저장 계층을 사용자 요청 흐름 안에 연결하는 계층**입니다.

---

## 2. 이 계층의 핵심 역할

`service/`는 다음 역할을 담당합니다.

- Express 서버 실행
- REST API 제공
- 요청/응답 처리
- `processing/` 계층 호출
- 결과를 저장 계층과 연결
- 웹 대시보드 제공

즉, `service/`는 **사용자의 요청을 서비스 흐름으로 바꾸는 계층**입니다.

이 계층은 계산 엔진이 아니라,  
계산 엔진과 DB, 사용자 인터페이스를 이어주는 **서비스 오케스트레이션 계층**입니다.

---

## 3. 하위 폴더 구성

```text
service/
├─ controllers/
├─ public/
├─ routes/
├─ services/
├─ package.json
├─ README.md
└─ server.js
```

---

## 4. 각 하위 구성 설명

### 4-1. `server.js`

`server.js`는 Express 서버의 시작점입니다.

이 파일은 보통 다음 역할을 담당합니다.

- Express 앱 생성
- 미들웨어 등록
- 라우트 연결
- 정적 파일 경로 연결
- 포트 열기

즉, `server.js`는 **서비스 계층의 실행 시작점**입니다.

---

### 4-2. `routes/`

`routes/`는 API URL을 정의하는 폴더입니다.

예를 들면 다음과 같은 요청 경로를 관리할 수 있습니다.

- 예측 요청
- 결과 조회
- 만족도 입력
- 상태 확인

즉, `routes/`는 **어떤 요청이 어디로 들어오는지**를 정의하는 계층입니다.

예상 파일 예시는 다음과 같습니다.

- `predict.js`
- `result.js`
- `feedback.js`
- `health.js`

---

### 4-3. `controllers/`

`controllers/`는 요청과 응답을 실제로 처리하는 폴더입니다.

이 계층의 역할은 다음과 같습니다.

- 요청 파라미터 확인
- 필요한 service 호출
- 응답 형식 정리
- 에러 처리

즉, `controllers/`는 **HTTP 요청/응답 처리 책임**을 맡습니다.

중요한 점은, 이 계층에는 계산 로직을 길게 넣지 않는다는 것입니다.  
계산은 `processing/`이 담당하고, controller는 서비스 흐름 연결에 집중합니다.

예상 파일 예시는 다음과 같습니다.

- `predictController.js`
- `resultController.js`
- `feedbackController.js`

---

### 4-4. `services/`

`services/`는 API 서버 입장에서 필요한 **처리 흐름을 정리하는 중간 계층**입니다.

이 폴더는 처음 보면 `processing/`과 비슷해 보일 수 있지만, 역할이 다릅니다.

이 계층은 보통 다음과 같은 일을 합니다.

- DB에서 필요한 데이터 조회
- `processing/`의 계산 함수 호출
- 계산 결과 저장
- API 응답에 맞는 형태로 반환

즉, `services/`는 **서버가 계산 계층과 저장 계층을 묶어 사용하는 계층**입니다.

예상 파일 예시는 다음과 같습니다.

- `predictionService.js`
- `sleepScoreService.js`
- `analysisService.js`
- `dashboardService.js`

---

### 4-5. `public/`

`public/`은 웹 대시보드에 필요한 정적 파일을 두는 폴더입니다.

예를 들면:

- 메인 페이지
- 취침 전 예측 화면
- 기상 후 결과 확인 화면
- 공통 JS 파일

즉, `public/`은 **사용자가 직접 보는 화면 자원**을 담당합니다.

예상 파일 예시는 다음과 같습니다.

- `index.html`
- `presleep.html`
- `postsleep.html`
- `app.js`

---

### 4-6. `package.json`

`package.json`은 `service/` 계층을 Node.js 프로젝트로 실행하기 위한 설정 파일입니다.

이 파일은 다음 역할을 가집니다.

- 의존성 패키지 관리
- 실행 스크립트 정의
- 서비스 계층의 Node.js 앱 설정

현재 구조에서는 `service/`를 **실행 중심 계층**으로 보기 때문에,  
`package.json`을 이 폴더 안에 두는 방식으로 관리합니다.

즉, 현재 구조에서는 `service/`가 Node.js 실행 기준점입니다.

---

## 5. 이 계층이 하지 않는 일

`service/`는 서비스 요청 흐름을 담당하지만, 모든 일을 직접 하지는 않습니다.

이 계층에서는 다음 작업을 직접 길게 수행하지 않습니다.

- 센서 데이터 수집
- Fitbit API 직접 수집 로직 관리
- Sleep Score 계산 공식 구현
- 취침 전 예측 계산 공식 구현
- A(누적 패턴 데이터) 갱신 계산 공식 구현

즉, `service/`는 **계산을 직접 수행하는 계층이 아니라**,  
계산 계층을 호출하고 사용자 요청 흐름 안에서 연결하는 계층입니다.

---

## 6. `processing/`과의 차이

처음 구조를 보면 `service/services/`와 `processing/`이 비슷해 보일 수 있습니다.  
하지만 둘은 역할이 다릅니다.

### `processing/`
- 순수 계산 로직 담당
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

즉, 이렇게 이해하면 됩니다.

```text
processing = 계산 엔진
service/services = 서버가 계산 엔진과 DB를 묶어 사용하는 계층
```

`processing/`은 “무엇을 계산하는가”를 담당하고,  
`service/`는 “그 계산을 사용자 요청 흐름 안에서 어떻게 연결하는가”를 담당합니다.

---

## 7. 다른 계층과의 연결 관계

`service/`는 전체 구조에서 보통 아래처럼 연결됩니다.

```text
service -> processing
service -> storage
```

조금 더 풀어서 보면,

```text
사용자 요청
-> route
-> controller
-> service/services
-> processing
-> storage/db
-> 응답 반환
```

즉, `service/`는 전체 시스템 안에서 **사용자 요청의 진입점**이자 **서비스 제공 계층**입니다.

---

## 8. 미래 구조와의 관계

현재는 On-Premise 단계이므로,  
`service/`는 로컬 환경에서 실행되는 Express 서버 계층입니다.

하지만 이후 클라우드 확장 단계에서는 이 계층이 더 명확하게 분리될 수 있습니다.

예를 들면:

- API 서버는 EC2 기반 서비스 계층으로 확장 가능
- 대시보드는 API Gateway 또는 별도 프론트 구조와 연동 가능
- 설명형 피드백 계층과 더 강하게 결합될 수 있음

즉, `service/`는 지금은 로컬 서버이지만,  
이후에는 **클라우드 서비스/API 계층으로 자연스럽게 확장될 수 있는 구조**를 염두에 두고 설계한 폴더입니다.

---

## 9. 개발 시 기본 원칙

`service/` 계층에서는 아래 원칙을 지키는 것이 좋습니다.

- 요청/응답 처리 책임만 맡는다
- 계산 공식을 직접 길게 넣지 않는다
- `processing/` 호출을 중심으로 구성한다
- DB 조회/저장은 service 흐름 안에서 명확하게 연결한다
- 사용자 응답 형식을 일관되게 유지한다

즉, 이 계층은 **서비스 인터페이스 계층답게 흐름을 연결하는 역할**에 집중해야 합니다.

---

## 10. 관련 문서

[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](../processing/README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](../storage/README.md)

[![README](https://img.shields.io/badge/README-2563EB?style=for-the-badge)](../README.md)
[![Project Structure](https://img.shields.io/badge/Project_Structure-2563EB?style=for-the-badge)](../PROJECT_STRUCTURE.md)
[![RPi Layer](https://img.shields.io/badge/RPi_Layer-2563EB?style=for-the-badge)](../rpi/README.md)
[![Processing Layer](https://img.shields.io/badge/Processing_Layer-2563EB?style=for-the-badge)](../processing/README.md)
[![Storage Layer](https://img.shields.io/badge/Storage_Layer-2563EB?style=for-the-badge)](../storage/README.md)
[![How to Run](https://img.shields.io/badge/How_to_Run-2563EB?style=for-the-badge)](../HOW_TO_RUN.md)
[![English README](https://img.shields.io/badge/English_README-2563EB?style=for-the-badge)](../README.en.md)