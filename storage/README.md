[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](../service/README.md)

# Storage Layer Guide (Storage 계층 문서)

이 문서는 **ZZZ 프로젝트에서 `storage/` 폴더가 어떤 역할을 맡는지** 설명하기 위한 문서입니다.

`storage/`는 ZZZ 프로젝트의 **데이터 저장 계층**입니다.  
즉, 수집된 데이터와 계산 결과를 어떤 구조로 저장할지 정하고,  
DB 연결과 초기화, 저장소 관리 책임을 맡는 쪽입니다.

단순히 파일을 보관하는 폴더라기보다,  
전체 프로젝트에서 **데이터 구조를 안정적으로 유지하는 기반 계층**이라고 보면 됩니다.

---

## 1. 왜 `storage/` 폴더를 따로 두는가

이 프로젝트는 수집, 예측, 점수 계산, 사후 분석, 패턴 갱신까지 여러 단계를 포함합니다.  
그러다 보니 다루는 데이터도 꽤 많습니다.

예를 들면 이런 것들입니다.

- 환경 센서 원본 데이터
- Fitbit 시계열 데이터
- 대표 수면 결과
- 사용자 만족도 입력
- 취침 전 예측 결과
- Sleep Score 계산 결과
- 기상 후 사후 분석 결과
- A(누적 패턴 데이터)

이 저장 구조를 계산 로직이나 API 서버 코드 안에 흩어 놓으면  
어떤 데이터가 어디에 저장되는지 파악하기도 어려워지고, 나중에 수정하기도 힘들어집니다.

그래서 `storage/`는 **저장 책임만 따로 분리**해서,  
DB 구조와 접근 방식을 한 곳에서 관리할 수 있게 정리한 계층입니다.

---

## 2. 이 계층의 핵심 역할

`storage/`는 아래 역할을 맡습니다.

- SQLite DB 스키마 정의
- DB 초기화
- DB 연결
- 데이터 저장/조회 기반 제공
- 필요하면 raw 파일 백업 공간 제공

즉, `storage/`는 전체 시스템에서  
**데이터를 안정적으로 보관하고 접근하는 기준 계층**입니다.

---

## 3. 하위 폴더 구성

```text
storage/
├─ db/
│  ├─ queries/
│  ├─ cleanup_demo_data.js
│  ├─ db.js
│  ├─ init_db.js
│  ├─ seed_demo_data.js
│  ├─ seed_week_data.js
│  ├─ zzz.dbml
│  └─ schema.sql
├─ raw/
│  ├─ fitbit_raw/
│  └─ sensor_raw/
└─ README.md
```

---

## 4. 각 하위 구성 설명

### 4-1. `db/`

`db/`는 SQLite 기반 데이터 저장 구조를 관리하는 핵심 폴더입니다.

여기서는 주로 아래 역할을 맡습니다.

- 전체 스키마 정의
- DB 초기화
- DB 연결
- 공통 쿼리 관리

주요 파일은 다음과 같습니다.

- `schema.sql`
  - 전체 테이블 구조 정의
- `init_db.js`
  - DB 생성 및 초기화
- `seed_demo_data.js`
  - UI 확인용 데모 데이터 적재
- `cleanup_demo_data.js`
  - 데모 데이터 정리
- `seed_week_data.js`
  - 주 단위 테스트 데이터 적재용 보조 스크립트
- `db.js`
  - DB 연결 및 공통 접근
- `zzz.dbml`
  - DB 구조 확인용 DBML 문서
- `queries/`
  - 자주 쓰는 쿼리 정리용 공간

즉, `db/`는 **DB 자체를 다루는 중심 공간**입니다.

---

### 4-2. `raw/`

`raw/`는 선택적인 원본 데이터 백업 공간입니다.

현재 구조의 핵심 저장소는 SQLite이지만,  
아래 같은 경우 raw 파일 보관이 필요할 수 있습니다.

- Fitbit 원본 응답 백업
- 센서 원본 값 백업
- 디버깅 / 재현용 데이터 보관
- DB 적재 전 임시 저장

주요 하위 폴더는 다음과 같습니다.

- `fitbit_raw/`
- `sensor_raw/`

즉, `raw/`는 **보조 저장소** 혹은 **원본 백업 공간** 정도로 이해하면 됩니다.

---

## 5. 이 계층이 저장하는 데이터

현재 구조에서 다루는 주요 데이터는 아래와 같습니다.

### 원본 수집 데이터
- 환경 센서 원본 데이터
- Fitbit 심박 시계열
- Fitbit 활동량 / 걸음 수 시계열
- Fitbit 대표 수면 결과

### 사용자 입력 데이터
- 기상 후 주관적 수면 만족도 점수

### 내부 생성 데이터
- 취침 전 예측 결과
- 위험도 / 행동 제안
- prediction feature snapshot
- Sleep Score 계산 결과
- 기상 후 사후 분석 결과

### 누적 패턴 데이터
- 평균 수면 시간
- 평균 만족도
- 평균 취침 전 심박
- score gap trend
- 환경 민감도 정보
- A(누적 패턴 데이터) snapshot

즉, `storage/`는 raw 데이터만 다루는 게 아니라  
**서비스 전체 흐름에서 만들어지는 거의 모든 데이터의 기준 저장소**입니다.

---

## 6. 이 계층이 하지 않는 일

`storage/`는 중요하지만, 계산과 서비스 제공을 직접 담당하지는 않습니다.

여기서는 아래 같은 일을 직접 하지 않습니다.

- 센서 수집
- Fitbit API 호출
- 취침 전 예측 계산
- Sleep Score 계산
- 사후 분석 계산
- 대시보드 요청 처리
- API 응답 생성

즉, `storage/`는 **저장 책임에 집중**합니다.

계산은 `processing/`,  
요청/응답 흐름은 `service/`,  
수집은 `rpi/`에서 담당합니다.

---

## 7. 다른 계층과의 연결 관계

`storage/`는 전체 구조에서 거의 모든 계층과 연결됩니다.

```text
rpi -> storage
processing -> storage
service -> storage
```

의미는 아래와 같습니다.

- `rpi`는 수집한 데이터를 저장함
- `processing`은 저장된 데이터를 읽고 계산한 뒤, 필요하면 결과를 다시 저장함
- `service`는 요청 흐름 안에서 필요한 데이터를 조회하거나 결과를 저장함

즉, `storage/`는 전체 시스템 안에서  
**공통 데이터 기반 계층**입니다.

---

## 8. 미래 구조와의 관계

현재는 On-Premise 단계이므로,  
`storage/`는 SQLite 중심의 로컬 저장 구조를 사용합니다.

하지만 이후 클라우드 확장 단계에서는 이 계층도 더 확장될 수 있습니다.

예를 들면:

- 로컬 SQLite 외에 클라우드 DB 사용
- raw 백업을 S3 같은 저장소로 이전
- 로컬/클라우드 이중 저장 구조

즉, `storage/`는 지금은 로컬 저장소지만  
이후에는 **더 확장된 저장 계층**으로 자연스럽게 이어질 수 있습니다.

---

## 9. 개발 시 기본 원칙

`storage/` 계층에서는 아래 원칙을 지키는 게 좋습니다.

- 저장 책임만 맡는다
- 계산 로직을 넣지 않는다
- API 응답 형식을 여기서 결정하지 않는다
- 스키마 구조를 되도록 일관되게 유지한다
- raw 저장소와 DB 저장소의 역할을 섞지 않는다

즉, 여기서는 **안정성과 일관성**이 가장 중요합니다.

---

## 10. 관련 문서

[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](../service/README.md)

[![README](https://img.shields.io/badge/README-2563EB?style=for-the-badge)](../README.md)
[![Project Structure](https://img.shields.io/badge/Project_Structure-2563EB?style=for-the-badge)](../PROJECT_STRUCTURE.md)
[![Decision Log](https://img.shields.io/badge/Decision_Log-2563EB?style=for-the-badge)](../DECISION_LOG.md)
[![API Plan](https://img.shields.io/badge/API_Plan-2563EB?style=for-the-badge)](../API_PLAN.md)
[![RPi Layer](https://img.shields.io/badge/RPi_Layer-2563EB?style=for-the-badge)](../rpi/README.md)
[![Processing Layer](https://img.shields.io/badge/Processing_Layer-2563EB?style=for-the-badge)](../processing/README.md)
[![Service Layer](https://img.shields.io/badge/Service_Layer-2563EB?style=for-the-badge)](../service/README.md)
[![How to Run](https://img.shields.io/badge/How_to_Run-2563EB?style=for-the-badge)](../HOW_TO_RUN.md)
[![English README](https://img.shields.io/badge/English_README-2563EB?style=for-the-badge)](../README.en.md)
