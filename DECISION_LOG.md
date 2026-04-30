# DECISION_LOG

이 문서는 ZZZ 프로젝트를 구현하면서 정한 **현재 기준의 설계 결정**을 기록하는 문서입니다.

README나 구조 문서가 프로젝트 소개와 폴더 역할 설명을 담당한다면,  
이 문서는 **왜 지금 이렇게 구현했는지**와 **현재 실행 기준에서 어떤 정책을 사용하는지**를 적어두는 용도로 씁니다.

---

## 1. Runtime / package structure

- 실행 기준은 **루트 `package.json`**으로 통일한다.
- `service/`는 Express 서버와 API 코드가 위치한 폴더로 사용한다.
- 의존성 설치와 실행 스크립트는 루트 기준으로 관리한다.
- 현재 사용 스크립트:
  - `npm run dev`
  - `npm run init-db`
  - `npm run seed-demo`
  - `npm run cleanup-demo`

### 왜 이렇게 했는가

초기에는 `service/`만 따로 Node 프로젝트처럼 둘 수도 있었지만,  
지금은 `storage/db/init_db.js`, `storage/db/db.js`, `service/server.js` 등  
여러 위치에서 공통으로 Node.js와 패키지를 사용하고 있습니다.

그래서 프로젝트 전체를 하나의 루트 실행 기준으로 두는 쪽이 더 자연스럽다고 판단했습니다.

---

## 2. API design policy

현재 API는 **최소 실행 가능한 구조**를 우선 사용합니다.

현재 기준 endpoint:

- `GET /health`
- `POST /predict/presleep`
- `GET /result/latest`
- `GET /result/sleep-score-history`
- `POST /feedback`

### 왜 이렇게 시작했는가

지금 단계 목표는 팀원들이 바로 구현을 시작할 수 있는 **최소 skeleton**을 만드는 것이기 때문입니다.

처음부터 지나치게 잘게 나눈 REST 구조를 가져가기보다,  
서비스의 핵심 흐름을 기준으로 단순하고 분명한 endpoint를 먼저 열어 두는 쪽이 낫다고 봤습니다.

## 3. Feedback handling policy

`user_feedback`는 **한 날짜당 하나의 대표 만족도 점수만 저장**합니다.

현재 정책은 아래와 같습니다.

- API 요청의 `sleep_date`는 UI 입력 기준의 기상일로 받음
- 서버 내부에서는 기상일의 전날을 실제 수면 날짜로 매핑함
- 내부 `sleep_date` 기준으로 하루에 하나의 feedback만 유지
- 같은 날짜를 다시 입력하면 새 row를 추가하지 않고 기존 row 수정
- 같은 날짜에 같은 점수를 다시 입력하면 DB 수정 없이 `no_change`
- 기상일은 오늘과 과거만 허용, 미래 날짜는 허용하지 않음

### 왜 이렇게 했는가

현재 단계에서는 만족도를 “그날 수면에 대한 대표 주관 평가”로 보는 게 자연스럽다고 판단했습니다.

즉 feedback 이력을 여러 row로 쌓기보다,  
하루당 하나의 대표 점수만 유지하는 쪽이 현재 구조와 개인화 방향에 더 잘 맞습니다.

---

## 4. Feedback timestamp policy

현재 `user_feedback`에는 `created_at`만 사용합니다.

정책은 다음과 같습니다.

- 새 feedback 저장 시 `created_at` 기록
- 기존 feedback 수정 시에도 `created_at`을 최신 시각으로 갱신
- 별도의 `updated_at` 컬럼은 현재 단계에서 두지 않음

### 왜 이렇게 했는가

지금 단계에서는 “최초 생성 시각”보다  
“현재 DB에 저장된 값이 마지막으로 반영된 시각”이 더 중요하다고 판단했습니다.

그래서 스키마를 단순하게 유지하기 위해  
`updated_at`을 추가하지 않고 `created_at`을 최종 반영 시각처럼 사용합니다.

---

## 5. Feedback and pattern update separation

`POST /feedback`는 feedback 저장/수정 후 후속 계산 흐름을 연결합니다.

즉:

- feedback API는 feedback 저장/수정을 먼저 처리함
- 이후 Sleep Score, post analysis, pattern update는 service 흐름에서 후속 처리함
- pattern update 계산 자체는 processing 계층 로직을 통해 수행함

### 왜 이렇게 했는가

feedback 저장 로직 안에 pattern 계산 공식을 직접 넣으면  
API 책임이 커지고 구조도 금방 복잡해집니다.

그래서 현재는 **입력 저장**과 **후속 계산 로직**의 책임을 분리해 두는 쪽을 선택했습니다.

---

## 6. Current scope

현재 실제로 확인된 범위는 아래와 같습니다.

- localhost 실행
- health check 응답
- DB 초기화
- 시드 데이터 적재 / 정리
- feedback 입력
- 같은 날짜 재입력 시 수정
- 같은 값 재입력 시 no change
- postsleep 화면을 통한 feedback 입력/저장/수정 확인
- presleep prediction의 실제 계산 및 DB 저장
- `result/latest`의 실제 DB 조회
- Sleep Score 계산 결과 연결
- post analysis 연결
- pattern update 후속 반영

## 7. 문서화 원칙

현재 문서들은 아래 기준으로 나눠서 관리합니다.

- `README.md` / `README.en.md`
  - 프로젝트 소개와 서비스 방향
- `PROJECT_STRUCTURE.md`
  - 계층 구조와 책임
- `HOW_TO_RUN.md`
  - 실제 실행 가능한 절차
- `DECISION_LOG.md`
  - 구현 중 정한 정책
- `API_PLAN.md`
  - 현재 endpoint와 API 구조

즉 소개 / 구조 / 실행 / 결정 / API 계획을 역할별로 나눠 둡니다.
