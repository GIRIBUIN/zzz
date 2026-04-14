[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](./README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](./rpi/README.md)
# Project Structure Guide (프로젝트 구조 가이드)

이 문서는 **ZZZ 프로젝트의 전체 구조를 어떻게 이해해야 하는지** 설명하기 위한 문서입니다.

메인 `README.md`가 프로젝트 소개와 서비스 방향을 설명하는 문서라면,  
이 문서는 **코드 구조**, **계층 분리 이유**, **각 폴더의 책임**, **계층 간 연결 관계**를 정리하는 문서입니다.

즉, 이 문서는 다음 질문에 답하기 위해 존재합니다.

- 왜 프로젝트를 여러 폴더로 나누었는가?
- `rpi`, `storage`, `processing`, `service`는 각각 무엇을 담당하는가?
- 지금은 On-Premise인데, 왜 최종 서비스 구조까지 고려해서 나누었는가?
- `processing`과 `service/services`는 무엇이 다른가?

---

## 1. 전체 구조를 어떻게 봐야 하는가

ZZZ는 현재 **On-Premise 구현 단계**를 기준으로 개발하고 있습니다.  
즉, 지금은 로컬 환경(PC, 노트북, Raspberry Pi)에서 전체 서비스를 직접 구현하고 실행하는 단계입니다.

하지만 서비스 기획 단계에서는 Raspberry Pi가 데이터 수집 허브 역할을 맡고,  
이후에는 저장·처리·서비스 제공 계층이 클라우드로 확장될 수 있는 구조를 함께 고려했습니다.

이 때문에 현재 구현은 로컬에서 동작하더라도,  
프로젝트 구조는 **최종 서비스의 역할 분리**를 염두에 두고 정리하였습니다.

이 프로젝트는 전체 시스템을 다음 네 계층으로 나누어 이해합니다.

- `rpi`
- `storage`
- `processing`
- `service`

이 네 계층은 지금은 하나의 프로젝트 안에 함께 존재하지만,  
역할이 다르기 때문에 처음부터 폴더 수준에서 분리하여 관리합니다.

---

## 2. 왜 4계층으로 나누었는가

현재는 On-Premise 단계이므로, 실제 실행은 로컬 서버에서 한꺼번에 처리할 수 있습니다.  
하지만 모든 코드를 한 폴더에 섞어 두면 다음과 같은 문제가 생깁니다.

- 센서 코드와 서비스 로직이 섞여서 책임이 불분명해짐
- 예측 계산 코드와 API 응답 코드가 섞여서 수정이 어려워짐
- DB 저장 구조와 처리 로직이 강하게 결합되어 유지보수가 어려워짐
- 나중에 AWS 구조로 확장할 때 어떤 코드를 어디로 옮겨야 하는지 불명확해짐

따라서 이 프로젝트는 **“지금은 로컬에서 구현하지만, 역할은 미리 분리한다”**는 원칙으로 구조를 나누었습니다.

즉, 현재 단계에서는 물리적으로 서버를 여러 개 띄우지 않더라도,  
**코드는 역할 기준으로 분리**하여 이해하고 개발합니다.

---

## 3. 전체 폴더 구조

```text
zzz/
├─ docs/
├─ rpi/
├─ storage/
├─ processing/
├─ service/
├─ README.md
├─ README.en.md
├─ PROJECT_STRUCTURE.md
└─ HOW_TO_RUN.md
```

---

## 4. 각 계층의 역할

### 4-1. `rpi/`

`rpi`는 **현장 장치(Raspberry Pi) 계층**입니다.

이 계층은 주로 다음 역할을 담당합니다.

- 환경 센서 데이터 수집
- Fitbit API 호출
- 업로드 전 로컬 버퍼 관리
- OLED / 로컬 알림 출력

즉, `rpi`는 **데이터 수집 허브**이자 **장치 중심 계층**입니다.

이 폴더 아래에는 다음과 같은 하위 구성이 있습니다.

- `sensors/`
  - DHT11, MQ-5 등 센서 읽기
  - 수집 주기 관리
- `fitbit/`
  - Fitbit API 호출
  - 샘플 응답 관리
- `buffer/`
  - 업로드 전 임시 버퍼
- `ui/`
  - OLED 및 로컬 알림 출력

중요한 점은, `rpi` 계층은 **장치에 직접 붙는 코드**를 담당한다는 것입니다.  
즉, GPIO, 센서 모듈, OLED처럼 Raspberry Pi와 직접 연결되는 책임은 여기서 처리합니다.

---

### 4-2. `storage/`

`storage`는 **데이터 저장 계층**입니다.

이 계층은 다음 역할을 담당합니다.

- SQLite DB 초기화
- DB 연결
- 스키마 관리
- 데이터 저장 및 조회
- 필요 시 raw 백업 저장소 제공

즉, `storage`는 **어떤 데이터를 어디에 어떤 구조로 저장할지**를 담당하는 계층입니다.

주요 구성은 다음과 같습니다.

- `db/schema.sql`
  - 전체 DB 스키마 정의
- `db/init_db.js`
  - DB 초기화
- `db/db.js`
  - DB 연결 및 공통 접근
- `raw/`
  - 선택적 raw 파일 백업 공간

이 계층의 핵심은 **저장 책임만 맡는 것**입니다.  
즉, 예측 계산이나 점수 계산 로직은 여기서 직접 수행하지 않습니다.

---

### 4-3. `processing/`

`processing`은 **순수 계산 및 판단 로직 계층**입니다.

이 계층은 서비스의 핵심 로직을 담당합니다.

- 요약 feature 생성
- 취침 전 예측
- Sleep Score 계산
- 기상 후 사후 분석
- A(누적 패턴 데이터) 갱신

주요 구성은 다음과 같습니다.

- `feature/feature_builder.js`
- `prediction/prediction.js`
- `scoring/sleep_score.js`
- `analysis/post_analysis.js`
- `pattern/pattern_update.js`

중요한 점은, `processing`은 **계산만 담당하는 계층**이라는 것입니다.

즉 이 계층은 다음을 알 필요가 없습니다.

- Express의 `req`, `res`
- 어떤 URL로 요청이 들어왔는지
- 어떤 HTML 페이지에 보여줄지

이 계층은 오직 **입력을 받아 계산하고, 결과를 반환하는 것**에 집중합니다.

---

### 4-4. `service/`

`service`는 **REST API 및 대시보드 계층**입니다.

이 계층은 사용자와 직접 연결되는 부분을 담당합니다.

- Express 서버 실행
- REST API 제공
- 웹 대시보드 연결
- 요청/응답 처리
- `processing` 계층 호출
- 결과를 사용자 친화적 형태로 반환

주요 구성은 다음과 같습니다.

- `server.js`
  - Express 서버 시작점
- `routes/`
  - API URL 정의
- `controllers/`
  - 요청/응답 처리
- `services/`
  - API 서버 입장에서 필요한 처리 흐름 정리
- `public/`
  - 대시보드 HTML / JS 파일
- `package.json`
  - Node.js 서비스 계층 의존성 및 실행 설정

이 계층은 **서비스 인터페이스**를 담당합니다.  
즉, 사용자가 버튼을 누르거나 결과를 조회할 때 가장 먼저 만나는 계층입니다.

---

## 5. `processing`과 `service/services`의 차이

처음 구조를 보면 `processing`과 `service/services`가 비슷해 보일 수 있습니다.  
하지만 두 계층의 역할은 다릅니다.

### `processing`

- 계산 그 자체를 담당
- feature 생성
- 예측
- 점수 계산
- 사후 분석
- A 갱신

### `service/services`

- API 서버 입장에서 필요한 처리 흐름을 담당
- DB에서 필요한 데이터를 가져옴
- `processing` 계층을 호출
- 결과를 저장
- API 응답에 맞게 정리

즉, 이렇게 이해하면 됩니다.

```text
processing = 계산 엔진
service/services = 서버가 계산 엔진과 DB를 묶어 사용하는 중간 계층
```

예를 들어 취침 전 예측 요청이 들어오면, 흐름은 보통 아래처럼 됩니다.

```text
route
-> controller
-> service/services
-> processing
-> storage/db
```

즉 `service/services`는 계산 로직을 새로 만드는 곳이 아니라,  
**서버가 계산 로직을 호출하고 저장/응답까지 연결하는 계층**입니다.

---

## 6. 계층 간 연결 관계

이 프로젝트의 기본 연결 관계는 아래처럼 이해하면 됩니다.

### 기본 흐름

- `rpi -> storage`
- `processing -> storage`
- `service -> processing`
- `service -> storage`

### 의미

- `rpi`는 수집한 데이터를 저장 계층으로 넘김
- `processing`은 저장된 데이터를 읽고 계산함
- `service`는 요청을 받아 `processing`을 호출함
- `service`는 필요하면 결과를 `storage`에 저장함

즉, 전체적으로 보면

```text
데이터 수집 -> 저장 -> 계산 -> 서비스 제공
```

구조로 연결됩니다.

---

## 7. 현재 구조와 미래 구조의 관계

이 프로젝트는 현재 **On-Premise 단계**이므로,  
실제로는 하나의 로컬 환경에서 여러 역할을 함께 실행할 수 있습니다.

하지만 구조를 분리한 이유는, 이후 클라우드 확장을 고려했기 때문입니다.

### 현재 (On-Premise)

- Raspberry Pi 또는 로컬 서버에서 전체 시스템 실행 가능
- 역할은 분리하지만, 물리적으로는 함께 동작 가능

### 이후 (Cloud 확장 시)

- `rpi`
  - Raspberry Pi 수집 허브
- `storage`
  - 클라우드 저장 계층
- `processing`
  - Lambda 등 처리 계층으로 확장 가능
- `service`
  - EC2 / API Gateway / 대시보드 계층으로 확장 가능

즉, 지금 구조는 단순한 폴더 정리가 아니라  
**나중에 어떤 계층이 어디로 갈 수 있는지까지 고려한 구조**입니다.

---

## 8. 개발 시 기본 원칙

이 구조를 유지하기 위해 다음 원칙을 지킵니다.

### `rpi`

- 장치/센서 관련 책임만 맡는다
- 예측 판단 로직을 직접 넣지 않는다

### `storage`

- 저장 책임만 맡는다
- 서비스 로직이나 예측 로직을 넣지 않는다

### `processing`

- 계산 로직만 맡는다
- Express 요청/응답 객체를 알지 않는다

### `service`

- API와 대시보드 연결을 맡는다
- 계산 공식을 직접 길게 쓰지 않고 `processing`을 호출한다

이 원칙을 지키면 구조가 단순해지고, 수정과 확장도 쉬워집니다.

---

## 📚 관련 문서

[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](./README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](./rpi/README.md)

[![README](https://img.shields.io/badge/README-2563EB?style=for-the-badge)](./README.md)
[![How to Run](https://img.shields.io/badge/How_to_Run-2563EB?style=for-the-badge)](./HOW_TO_RUN.md)
[![RPi Layer](https://img.shields.io/badge/RPi_Layer-2563EB?style=for-the-badge)](./rpi/README.md)
[![Processing Layer](https://img.shields.io/badge/Processing_Layer-2563EB?style=for-the-badge)](./processing/README.md)
[![Service Layer](https://img.shields.io/badge/Service_Layer-2563EB?style=for-the-badge)](./service/README.md)
[![Storage Layer](https://img.shields.io/badge/Storage_Layer-2563EB?style=for-the-badge)](./storage/README.md)
[![English README](https://img.shields.io/badge/English_README-2563EB?style=for-the-badge)](./README.en.md)