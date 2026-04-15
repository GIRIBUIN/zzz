[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](./storage/README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](./README.en.md)

# How to Run (실행 방법)

이 문서는 **현재 기준에서 ZZZ 프로젝트를 어떻게 실행하고 확인할 수 있는지** 정리한 문서입니다.

ZZZ는 On-Premise 방식의 스마트 헬스케어 시스템으로 개발 중이며,  
현재는 전체 구조와 실행 흐름을 정리한 상태에서 서비스 계층 중심으로 실행 환경을 맞추는 단계입니다.

여기서는 **지금 바로 실행 가능한 절차**만 기준으로 적습니다.

---

## 1. 실행 전 준비물

필수:
- Node.js
- npm
- Git

선택:
- SQLite 확인 도구(DB 브라우저 등)
- Raspberry Pi
- DHT11 센서
- MQ-5 + ADC 모듈
- Fitbit 계정 및 API 연동 정보

---

## 2. 프로젝트 받기

저장소를 클론한 뒤 프로젝트 루트로 이동합니다.

```bash
git clone <repository-url>
cd zzz
```

---

## 3. 환경 변수 설정

루트의 `.env.example` 파일을 참고해서 환경 변수를 설정합니다.

현재 기준 예시는 아래와 같습니다.

```bash
FITBIT_ACCESS_TOKEN=
FITBIT_USER_ID=-
DB_PATH=./storage/db/zzz.db
TIMEZONE=Asia/Seoul
SENSOR_INTERVAL_SECONDS=60
PRESLEEP_WINDOW_MINUTES=60
PATTERN_WINDOW_DAYS=7
PORT=3000
```

최신 값은 `.env.example` 기준으로 확인하면 됩니다.

---

## 4. 의존성 설치

현재는 루트 `package.json`을 기준으로 의존성을 관리합니다.

프로젝트 루트에서 아래 명령을 실행합니다.

```bash
npm install
```

---

## 5. DB 구조 확인

DB 스키마는 아래 파일에 정의되어 있습니다.

```text
storage/db/schema.sql
```

현재 DB 구조를 먼저 보고 싶으면 이 파일을 열어보면 됩니다.

주요 저장 대상은 다음과 같습니다.

- 환경 센서 원본 데이터
- Fitbit 시계열 데이터
- 대표 수면 결과
- 사용자 만족도 입력
- 취침 전 예측 결과
- Sleep Score 계산 결과
- 사후 분석 결과
- 누적 패턴 데이터

---

## 6. DB 초기화

DB 초기화는 `storage/db/init_db.js`를 기준으로 수행합니다.

루트 기준 실행 예시는 다음과 같습니다.

```bash
npm run init-db
```

정상 실행되면 `storage/db/` 아래에 DB 파일이 생성됩니다.

---

## 7. 서비스 실행

서비스 계층은 `service/server.js`를 기준으로 실행되고,  
실행 스크립트는 루트 `package.json`에서 관리합니다.

루트 기준 실행 예시는 다음과 같습니다.

```bash
npm run dev
```

---

## 8. 서비스 접속 확인

서비스가 정상적으로 실행되면 브라우저에서 로컬 서버에 접속할 수 있어야 합니다.

기본 주소:

```text
http://localhost:3000
```

현재 기준으로 확인 가능한 페이지:

- `/`
- `/postsleep.html`

추후 구현이 진행되면 아래 페이지도 추가될 수 있습니다.

- `/presleep.html`

---

## 9. 현재 기준 확인 가능한 항목

현재 기준으로는 아래 정도까지 확인할 수 있습니다.

- 프로젝트 구조 확인
- 환경 변수 설정
- 프로젝트 의존성 설치
- DB 스키마 확인
- DB 초기화 실행
- Express 서버 실행
- 로컬 접속 확인
- Health check 응답 확인
- Post-sleep feedback 화면 확인
- feedback 입력 / 저장 / 수정 동작 확인

---

## 10. 추후 추가 예정

아래 항목은 구현이 진행되면 이 문서에 추가합니다.

- Raspberry Pi 센서 수집 실행 절차
- Fitbit API 실제 연동 절차
- API 테스트 예시 확장
- Presleep 화면 사용 절차
- 결과 조회 화면 사용 절차

---

## 📚 관련 문서

[![README](https://img.shields.io/badge/README-2563EB?style=for-the-badge)](./README.md)
[![Project Structure](https://img.shields.io/badge/Project_Structure-2563EB?style=for-the-badge)](./PROJECT_STRUCTURE.md)
[![Decision Log](https://img.shields.io/badge/Decision_Log-2563EB?style=for-the-badge)](./DECISION_LOG.md)
[![API Plan](https://img.shields.io/badge/API_Plan-2563EB?style=for-the-badge)](./API_PLAN.md)
[![RPi Layer](https://img.shields.io/badge/RPi_Layer-2563EB?style=for-the-badge)](./rpi/README.md)
[![Processing Layer](https://img.shields.io/badge/Processing_Layer-2563EB?style=for-the-badge)](./processing/README.md)
[![Service Layer](https://img.shields.io/badge/Service_Layer-2563EB?style=for-the-badge)](./service/README.md)
[![Storage Layer](https://img.shields.io/badge/Storage_Layer-2563EB?style=for-the-badge)](./storage/README.md)
[![English README](https://img.shields.io/badge/English_README-2563EB?style=for-the-badge)](./README.en.md)