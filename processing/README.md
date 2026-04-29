[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](../rpi/README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](../service/README.md)

# Processing Layer Guide (Processing 계층 문서)

이 문서는 **ZZZ 프로젝트에서 `processing/` 폴더가 어떤 역할을 담당하는지** 설명하기 위한 문서입니다.

`processing/`은 서비스의 **순수 계산 및 판단 로직 계층**입니다.  
즉, 이 계층은 취침 전 예측, Sleep Score 계산, 기상 후 사후 분석, 누적 패턴 데이터 갱신처럼 **서비스의 핵심 로직 자체**를 담당합니다.

이 계층을 따로 분리한 이유는, 센서 수집 코드나 API 서버 코드와 계산 로직이 섞이지 않도록 하기 위해서입니다.  
현재는 On-Premise 환경에서 전체 시스템을 함께 실행하더라도, 계산 로직은 별도의 책임으로 유지하는 것이 구조를 이해하고 확장하는 데 더 유리하다고 보았습니다.

---

## 1. 왜 `processing/` 폴더를 따로 두는가

이 프로젝트는 단순히 데이터를 저장하거나 보여주는 것이 아니라,  
수집된 데이터를 바탕으로 실제로 다음과 같은 판단을 수행해야 합니다.

- 취침 전 수면 질 저하 가능성 예측
- 기상 후 Sleep Score 계산
- 실제 수면 결과에 대한 원인 해석
- A(누적 패턴 데이터) 갱신

이 로직들이 `service/` 안에 섞여 들어가면, API 요청 처리 코드와 계산 코드가 뒤섞여서 구조가 복잡해집니다.  
또한 `rpi/`나 `storage/` 안에 들어가면 계층 책임이 모호해집니다.

그래서 `processing/`은 **“이 서비스가 실제로 무엇을 계산하는가”**만 담당하는 계층으로 따로 분리했습니다.

---

## 2. 이 계층의 핵심 역할

`processing/`은 다음 역할을 담당합니다.

- 원본 시계열 데이터에서 요약 feature 생성
- 취침 전 예측 수행
- Sleep Score 계산
- 기상 후 사후 분석 수행
- A(누적 패턴 데이터) 갱신

즉, 이 계층은 **수집된 데이터를 서비스 판단 결과로 바꾸는 계산 엔진**이라고 이해하면 됩니다.

---

## 3. 하위 폴더 구성

```text
processing/
├─ analysis/
├─ demo_data/
├─ feature/
├─ pattern/
├─ prediction/
├─ scoring/
├─ slm/
├─ demo.js
├─ validate_realdata.js
└─ README.md
```

---

## 4. 각 하위 폴더 설명

### 4-1. `feature/`

`feature/`는 원본 시계열 데이터에서 **예측과 분석에 자주 사용하는 요약값**을 만드는 폴더입니다.

예를 들면 다음과 같은 값이 여기에 해당합니다.

- 취침 전 1시간 평균 심박
- 취침 전 1시간 최대 심박
- 취침 전 1시간 steps 총합
- 취침 전 1시간 calories 총합
- 취침 전 1시간 평균 온도 / 습도
- 취침 전 1시간 평균 가스 지표값

이 폴더의 목적은 원본 데이터를 그대로 매번 다시 계산하지 않고,  
자주 쓰는 입력값을 구조적으로 정리하는 것입니다.

예상 파일:
- `feature_builder.js`

---

### 4-2. `prediction/`

`prediction/`은 **취침 전 수면 질 저하 위험 예측**을 담당하는 폴더입니다.

이 폴더에서는 다음을 처리할 수 있습니다.

- 현재 상태와 기준선 비교
- 위험도 계산
- 위험 수준 분류
- 위험 요인 후보 도출
- 행동 제안 생성에 필요한 판단 근거 제공

즉, `prediction/`은 취침 전에 사용자가 받을 결과의 핵심 계산부라고 볼 수 있습니다.

예상 파일:
- `prediction.js`

---

### 4-3. `scoring/`

`scoring/`은 **기상 후 Sleep Score 계산**을 담당하는 폴더입니다.

현재 구조에서는 100점 만점 Sleep Score를 아래 기준으로 계산합니다.

- Time Asleep
- Deep & REM
- Restoration

이 폴더의 목적은 실제 수면 결과를 하나의 대표 점수로 정리하여,  
이후 사후 분석 및 개인화 보정의 기준점으로 사용하는 것입니다.

예상 파일:
- `sleep_score.js`

---

### 4-4. `analysis/`

`analysis/`는 **기상 후 사후 분석**을 담당하는 폴더입니다.

이 폴더에서는 다음과 같은 작업을 수행할 수 있습니다.

- 주요 원인 도출
- 보조 원인 도출
- 설명형 피드백 생성에 필요한 구조화 결과 반환
- 자동 점수와 사용자 체감 차이 해석 보조

즉, `analysis/`는 실제 수면 결과를 다시 해석하여  
“왜 이런 결과가 나왔는가”를 설명하는 계산 계층입니다.

예상 파일:
- `post_analysis.js`

---

### 4-5. `pattern/`

`pattern/`은 **A(누적 패턴 데이터) 갱신**을 담당하는 폴더입니다.

이 폴더에서는 다음과 같은 누적 기준을 갱신할 수 있습니다.

- 최근 평균 수면 시간
- 최근 평균 만족도
- 평균 취침 전 심박
- 자동 점수와 체감의 차이 경향
- 환경 민감도 정보
- 최근 예측 적중 경향

즉, `pattern/`은 서비스가 시간이 지날수록 사용자에게 맞게 조정되도록 만드는 계층입니다.

예상 파일:
- `pattern_update.js`

---

### 4-6. `slm/`

`slm/`은 rule-based 판단 결과를 **사용자가 이해하기 쉬운 자연어 피드백으로 변환**합니다.

현재 구조에서는 로컬 Ollama를 SLM 서버로 사용하며, 서버가 없을 경우 rule-based 결과 문자열로 자동 fallback합니다.

데이터가 충분히 쌓이지 않은 초기(cold start)에는 SLM이 원시 센서값을 직접 해석하고, 7일 이상 데이터가 누적되면 rule-based 판단 결과를 다듬는 역할로 전환합니다.

예상 파일:
- `slm_client.js` — Ollama HTTP 클라이언트, 타임아웃 및 fallback 처리
- `prompt_builder.js` — rule-based 결과를 한국어 프롬프트로 변환 (순수 함수)

### 4-7. 데모 및 검증 파일

현재 processing 계층에는 계산 흐름을 빠르게 확인하기 위한 보조 파일도 함께 둡니다.

- `demo.js` — processing 계산 흐름 확인용 데모 실행 파일
- `validate_realdata.js` — 실제 적재 데이터 기준 검증용 파일
- `demo_data/` — 데모와 검증에 사용하는 샘플 입력 데이터

---

## 5. 이 계층이 하지 않는 일

`processing/`은 중요하지만, 모든 일을 다 맡지는 않습니다.

이 계층에서는 다음과 같은 일을 직접 하지 않습니다.

- 센서 데이터 수집
- Fitbit API 호출
- SQLite 연결 관리
- Express의 `req`, `res` 처리
- REST API 응답 전송
- HTML 페이지 렌더링

즉, `processing/`은 **계산만 담당**합니다.

이 계층은 다음을 알지 않아야 합니다.

- 어떤 URL로 요청이 들어왔는가
- 어떤 화면에서 이 결과를 보여줄 것인가
- Express에서 어떤 응답 형식을 요구하는가

이런 정보는 `service/` 계층에서 다루고,  
`processing/`은 오직 **입력 → 계산 → 결과 반환**에 집중합니다.

---

## 6. `service/services`와의 차이

처음 구조를 보면 `processing/`과 `service/services/`가 비슷해 보일 수 있습니다.  
하지만 두 계층의 역할은 분명히 다릅니다.

### `processing/`
- 계산 그 자체를 담당
- 순수 비즈니스 로직 보관
- feature 생성, 예측, 점수 계산, 분석, 패턴 갱신 수행

### `service/services/`
- API 서버 입장에서 필요한 처리 흐름을 담당
- DB에서 필요한 데이터를 가져옴
- `processing/` 로직을 호출함
- 결과를 저장하고 API 응답용으로 정리함

즉, 이렇게 이해하면 됩니다.

```text
processing = 계산 엔진
service/services = 서버가 계산 엔진과 DB를 묶어 사용하는 계층
```

예를 들어 취침 전 예측 요청이 들어오면 흐름은 보통 아래처럼 됩니다.

```text
route
-> controller
-> service/services
-> processing
-> storage/db
```

즉 `processing/`은 계산을 하고,  
`service/services/`는 그 계산을 **서버 요청 흐름 안에 연결하는 역할**을 합니다.

---

## 7. 다른 계층과의 연결 관계

`processing/`은 전체 구조에서 보통 아래처럼 연결됩니다.

```text
processing -> storage
service -> processing
```

의미는 다음과 같습니다.

- `processing`은 저장된 데이터를 읽어서 계산함
- 계산 결과는 필요하면 다시 저장 계층으로 전달됨
- `service`는 사용자의 요청을 받아 `processing`을 호출함

즉, `processing/`은 전체 시스템 안에서  
**저장된 데이터를 서비스 판단 결과로 바꾸는 중심 계층**입니다.

---

## 8. 미래 구조와의 관계

현재는 On-Premise 단계이므로,  
`processing/` 로직 역시 로컬 환경 안에서 함께 실행됩니다.

하지만 이후 클라우드 확장 단계에서는 이 계층이 더 분명하게 분리될 수 있습니다.

예를 들면:

- 일부 계산 로직은 Lambda 같은 처리 계층으로 이동 가능
- 일부 배치성 갱신 로직은 별도 작업 흐름으로 분리 가능

즉, `processing/`은 지금은 로컬 서버의 일부이지만,  
나중에는 **독립적인 처리 계층**으로 확장될 가능성을 염두에 두고 설계한 구조입니다.

---

## 9. 개발 시 기본 원칙

`processing/` 계층에서는 아래 원칙을 지키는 것이 좋습니다.

- 계산 로직만 맡는다
- Express 요청/응답 객체를 알지 않는다
- 가능한 한 입력과 출력이 명확한 함수 형태로 유지한다
- DB 저장 책임을 직접 크게 갖지 않는다
- 화면 표현 방식을 직접 결정하지 않는다

즉, 이 계층은 **순수 계산 로직 계층답게 단순하고 예측 가능하게 유지하는 것**이 중요합니다.

---

## 10. 관련 문서

[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](../rpi/README.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](../service/README.md)

[![README](https://img.shields.io/badge/README-2563EB?style=for-the-badge)](../README.md)
[![Project Structure](https://img.shields.io/badge/Project_Structure-2563EB?style=for-the-badge)](../PROJECT_STRUCTURE.md)
[![RPi Layer](https://img.shields.io/badge/RPi_Layer-2563EB?style=for-the-badge)](../rpi/README.md)
[![Service Layer](https://img.shields.io/badge/Service_Layer-2563EB?style=for-the-badge)](../service/README.md)
[![Storage Layer](https://img.shields.io/badge/Storage_Layer-2563EB?style=for-the-badge)](../storage/README.md)
[![How to Run](https://img.shields.io/badge/How_to_Run-2563EB?style=for-the-badge)](../HOW_TO_RUN.md)
[![English README](https://img.shields.io/badge/English_README-2563EB?style=for-the-badge)](../README.en.md)
