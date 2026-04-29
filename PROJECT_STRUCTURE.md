[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](./README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](./rpi/README.md)

# Project Structure Guide (프로젝트 구조 가이드)

이 문서는 **ZZZ 프로젝트 구조를 어떻게 봐야 하는지** 정리한 문서입니다.

`README.md`가 프로젝트 소개 문서라면,  
이 문서는 **코드가 왜 이렇게 나뉘어 있는지**, 그리고 **각 폴더가 무슨 역할을 하는지** 설명하는 문서입니다.

즉, 아래 같은 질문에 답하려고 만든 문서입니다.

- 왜 폴더를 여러 개로 나눴는가?
- `rpi`, `storage`, `processing`, `service`는 각각 뭘 담당하는가?
- 지금은 On-Premise인데, 왜 나중 구조까지 생각해서 나눴는가?
- `processing`과 `service/services`는 뭐가 다른가?

---

## 1. 전체 구조를 어떻게 보면 되는가

ZZZ는 현재 **On-Premise 구현 단계** 기준으로 개발하고 있습니다.  
즉, 지금은 로컬 환경에서 전체 서비스를 직접 구현하고 실행하는 단계입니다.

다만 서비스 기획 자체는 Raspberry Pi가 수집 허브 역할을 맡고,  
저장·처리·서비스 제공 계층은 나중에 클라우드로도 확장할 수 있게 생각하고 있습니다.

그래서 지금 코드도 그냥 한 덩어리로 두지 않고,  
**최종적으로 역할이 어떻게 갈릴지**를 미리 반영해서 나눴습니다.

현재 기준으로는 전체 시스템을 아래 네 계층으로 봅니다.

- `rpi`
- `storage`
- `processing`
- `service`

지금은 한 프로젝트 안에 같이 있지만,  
역할이 다르기 때문에 처음부터 폴더를 나눠 두었습니다.

---

## 2. 왜 4계층으로 나눴는가

지금은 로컬에서 한꺼번에 실행할 수 있습니다.  
그래도 코드를 한 폴더에 다 섞어 두면 금방 복잡해집니다.

예를 들면 이런 문제가 생깁니다.

- 센서 코드와 서비스 로직이 섞임
- 계산 코드와 API 응답 코드가 섞임
- DB 저장 구조와 처리 로직이 강하게 묶임
- 나중에 AWS 구조로 옮길 때 어디를 떼야 하는지 헷갈림

그래서 이 프로젝트는  
**“지금은 로컬에서 돌리지만, 역할은 미리 분리한다”**는 기준으로 구조를 잡았습니다.

즉, 서버를 실제로 여러 개 띄우는 건 아니지만  
코드는 역할 기준으로 나눠서 관리합니다.

---

## 3. 전체 폴더 구조

```text
zzz/
├─ docs/
├─ rpi/
├─ storage/
├─ processing/
├─ service/
├─ assets/
├─ package-lock.json
├─ .env.example
├─ .gitignore
├─ package.json
├─ README.md
├─ README.en.md
├─ PROJECT_STRUCTURE.md
├─ HOW_TO_RUN.md
├─ DECISION_LOG.md
└─ API_PLAN.md
```

---

## 4. 각 계층의 역할

### 4-1. `rpi/`

`rpi`는 **현장 장치 계층**입니다.

여기서는 주로 이런 걸 맡습니다.

- 환경 센서 데이터 수집
- Fitbit API 호출
- 업로드 전 로컬 버퍼 관리
- OLED / 로컬 알림 출력

즉, `rpi`는 **데이터 수집 허브**이자 **장치 쪽 코드 모음**이라고 보면 됩니다.

하위 폴더는 대략 이렇게 봅니다.

- `sensors/`
  - DHT11, MQ-5 등 센서 읽기
  - 수집 주기 관리
- `fitbit/`
  - Fitbit API 호출
  - 샘플 응답 관리
- `buffer/`
  - 임시 버퍼
- `ui/`
  - OLED / 로컬 알림 출력

핵심은, **라즈베리파이 장치에 직접 붙는 책임은 여기서 처리한다**는 점입니다.

---

### 4-2. `storage/`

`storage`는 **데이터 저장 계층**입니다.

여기서 맡는 건 아래 정도입니다.

- SQLite DB 초기화
- DB 연결
- 스키마 관리
- 데이터 저장 / 조회
- raw 백업 저장소 관리

즉, `storage`는  
**어떤 데이터를 어디에 어떻게 저장할지**를 담당하는 폴더입니다.

주요 구성:

- `db/schema.sql`
- `db/init_db.js`
- `db/db.js`
- `raw/`

여기서는 저장 책임만 맡고,  
예측 계산이나 점수 계산은 직접 하지 않습니다.

---

### 4-3. `processing/`

`processing`은 **순수 계산 로직 계층**입니다.

여기서는 아래 같은 핵심 로직을 담당합니다.

- feature 생성
- 취침 전 예측
- Sleep Score 계산
- 기상 후 사후 분석
- A(누적 패턴 데이터) 갱신

주요 구성은 이렇게 생각하면 됩니다.

- `feature/feature_builder.js`
- `prediction/prediction.js`
- `scoring/sleep_score.js`
- `analysis/post_analysis.js`
- `pattern/pattern_update.js`
- `slm/`
- `demo.js`
- `validate_realdata.js`

핵심은, `processing`은 **계산만 한다**는 점입니다.

즉 여기서는:
- Express 요청/응답
- 어떤 URL인지
- 어떤 화면에 보여줄지

이런 걸 몰라도 되게 유지하는 게 중요합니다.

---

### 4-4. `service/`

`service`는 **REST API + 대시보드 계층**입니다.

즉, 사용자와 직접 맞닿는 부분입니다.

여기서는 주로:

- Express 서버 실행
- REST API 제공
- 요청/응답 처리
- `processing` 호출
- 결과 저장 연결
- 웹 화면 제공

을 담당합니다.

주요 구성은 아래와 같습니다.

- `server.js`
- `routes/`
- `controllers/`
- `services/`
- `public/`

참고로 실행 기준은 `service/package.json`이 아니라  
**루트 `package.json`**입니다.

즉 `service/`는 실제 Express 코드가 있는 위치고,  
의존성과 실행 스크립트는 프로젝트 루트 기준으로 관리합니다.

Raspberry Pi 전용 센서 의존성인 `i2c-bus`는 일반 로컬 실행 의존성에서 분리하고,  
센서 수집 기능을 개발할 때 해당 Raspberry Pi 환경에서 별도로 설치합니다.

---

## 5. `processing`과 `service/services`의 차이

둘이 처음엔 비슷해 보일 수 있는데, 역할이 다릅니다.

### `processing`
- 계산 자체 담당
- feature 생성
- 예측
- 점수 계산
- 사후 분석
- 패턴 갱신

### `service/services`
- API 흐름 담당
- DB 조회
- `processing` 호출
- 결과 저장
- 응답용 형태 정리

짧게 말하면:

```text
processing = 계산 엔진
service/services = 서버가 계산 엔진과 DB를 묶어 쓰는 계층
```

예를 들어 취침 전 예측 요청이 들어오면 보통 흐름은 이렇습니다.

```text
route
-> controller
-> service/services
-> processing
-> storage/db
```

즉 `service/services`는 계산 공식을 만드는 곳이 아니라,  
**서버 흐름 안에서 계산 로직을 연결하는 곳**입니다.

---

## 6. 계층 간 연결 관계

기본 연결은 아래처럼 보면 됩니다.

### 기본 흐름

- `rpi -> storage`
- `processing -> storage`
- `service -> processing`
- `service -> storage`

### 의미

- `rpi`는 수집한 데이터를 저장 계층으로 넘김
- `processing`은 저장된 데이터를 읽고 계산함
- `service`는 요청을 받아 `processing`을 호출함
- `service`는 필요하면 결과를 저장함

전체 흐름으로 보면 결국:

```text
데이터 수집 -> 저장 -> 계산 -> 서비스 제공
```

입니다.

---

## 7. 현재 구조와 미래 구조의 관계

이 프로젝트는 지금 **On-Premise 단계**입니다.  
즉 실제로는 하나의 로컬 환경 안에서 여러 역할이 같이 돌아갈 수 있습니다.

그래도 이렇게 구조를 나눈 이유는  
나중에 클라우드 확장을 염두에 두고 있기 때문입니다.

### 현재
- Raspberry Pi 또는 로컬 서버에서 전체 시스템 실행 가능
- 역할은 나뉘어 있지만 물리적으로는 같이 동작 가능

### 이후
- `rpi` → Raspberry Pi 수집 허브
- `storage` → 클라우드 저장 계층
- `processing` → Lambda 등 처리 계층
- `service` → EC2 / API Gateway / 대시보드 계층

즉 지금 구조는 단순한 폴더 정리가 아니라,  
**나중에 어디가 어디로 갈 수 있는지까지 생각한 구조**입니다.

---

## 8. 개발 시 기본 원칙

### `rpi`
- 장치/센서 관련 책임만 맡는다
- 예측 판단 로직은 직접 넣지 않는다

### `storage`
- 저장 책임만 맡는다
- 서비스 로직, 예측 로직은 넣지 않는다

### `processing`
- 계산 로직만 맡는다
- Express 요청/응답 객체를 알지 않는다

### `service`
- API와 대시보드 연결을 맡는다
- 계산은 직접 길게 쓰지 않고 `processing`을 호출한다

이 정도만 지켜도 구조가 꽤 덜 꼬입니다.

---

## 📚 관련 문서

[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](./README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](./rpi/README.md)

[![README](https://img.shields.io/badge/README-2563EB?style=for-the-badge)](./README.md)
[![How to Run](https://img.shields.io/badge/How_to_Run-2563EB?style=for-the-badge)](./HOW_TO_RUN.md)
[![Decision Log](https://img.shields.io/badge/Decision_Log-2563EB?style=for-the-badge)](./DECISION_LOG.md)
[![API Plan](https://img.shields.io/badge/API_Plan-2563EB?style=for-the-badge)](./API_PLAN.md)
[![RPi Layer](https://img.shields.io/badge/RPi_Layer-2563EB?style=for-the-badge)](./rpi/README.md)
[![Processing Layer](https://img.shields.io/badge/Processing_Layer-2563EB?style=for-the-badge)](./processing/README.md)
[![Service Layer](https://img.shields.io/badge/Service_Layer-2563EB?style=for-the-badge)](./service/README.md)
[![Storage Layer](https://img.shields.io/badge/Storage_Layer-2563EB?style=for-the-badge)](./storage/README.md)
[![English README](https://img.shields.io/badge/English_README-2563EB?style=for-the-badge)](./README.en.md)
