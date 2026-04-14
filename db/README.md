# DB Structure

이 폴더는 ZZZ 프로젝트의 SQLite 데이터베이스 구조를 관리한다.  
이 문서는 **각 테이블이 왜 필요한지**, **언제 데이터가 들어가는지**, **무슨 역할을 하는지**를 한눈에 이해할 수 있도록 정리한 문서이다.

---

## Files

### `schema.sql`
전체 SQLite 테이블 구조를 정의하는 파일

### `db.py`
SQLite 연결 및 공통 쿼리 실행 함수

### `init_db.py`
`schema.sql`을 실행하여 DB를 초기 생성하는 파일

---

## 전체 구조 한눈에 보기

DB는 크게 다음 4가지 종류의 데이터를 저장한다.

### 1. 원본 수집 데이터
외부에서 그대로 들어오는 데이터

- `sensor_raw`
- `fitbit_heart`
- `fitbit_steps`
- `fitbit_sleep`

### 2. 사용자 입력 데이터
사용자가 직접 입력하는 데이터

- `user_feedback`

### 3. 시스템 계산 결과
서비스가 계산해서 만든 결과

- `prediction_result`
- `sleep_score_result`
- `post_analysis_result`

### 4. 누적 패턴 데이터
사용자 기준이 누적된 프로필 데이터(A)

- `pattern_profile`

---

## 서비스 흐름과 DB 관계

서비스 흐름은 다음과 같다.

```text
원본 수집
→ 취침 전 예측
→ 기상 후 수면 결과 확보
→ Sleep Score 계산
→ 기상 후 분석
→ 사용자 만족도 반영
→ A(누적 패턴 데이터) 갱신
```

이에 따라 DB도 다음 흐름으로 사용된다.
```text
sensor_raw / fitbit_*
→ prediction_result
→ fitbit_sleep / user_feedback / sleep_score_result / post_analysis_result
→ pattern_profile
```
---
## Table Details

### 1. `sensor_raw`

환경 센서 원본 데이터를 저장한다.

#### 저장 데이터
- `temperature`
- `humidity`
- `mq5_raw`
- `mq5_index`
- `ts`

#### 언제 생성되는가
센서를 읽을 때마다 1 row 생성

#### 역할
취침 전 예측과 기상 후 분석에 필요한 환경 원본 데이터를 저장한다.

#### 예시
- 23:00 온도 24.1 / 습도 58 / mq5_raw 312
- 23:01 온도 24.0 / 습도 58 / mq5_raw 315

---

### 2. `fitbit_heart`

Fitbit 심박 시계열 데이터를 저장한다.

#### 저장 데이터
- `bpm`
- `ts`

#### 언제 생성되는가
Fitbit heart intraday 수집 시

#### 역할
취침 전 1시간 평균 심박, 최근 심박 변화 등을 계산하는 원본 데이터로 사용한다.

---

### 3. `fitbit_steps`

Fitbit 걸음 수 시계열 데이터를 저장한다.

#### 저장 데이터
- `steps`
- `ts`

#### 언제 생성되는가
Fitbit steps intraday 수집 시

#### 역할
취침 전 활동량, 최근 움직임 등을 계산하는 원본 데이터로 사용한다.

---

### 4. `fitbit_sleep`

Fitbit의 대표 수면(main sleep) 결과를 저장한다.

#### 저장 데이터
- `sleep_date`
- `start_time`
- `end_time`
- `minutes_asleep`
- `minutes_awake`
- `deep_minutes`
- `light_minutes`
- `rem_minutes`
- `is_main_sleep`
- `raw_json`

#### 언제 생성되는가
기상 후 대표 수면(main sleep) 확인 시

#### 대표 수면 기준
- `isMainSleep == true` 를 우선 사용
- 예외 시 가장 긴 sleep log 사용 가능

#### 역할
Sleep Score 계산과 기상 후 분석의 핵심 원본 데이터를 저장한다.

#### 주의
낮잠(nap)은 현재 서비스 로직의 핵심 대상이 아니므로,  
현재는 대표 수면 1개만 분석 기준으로 사용한다.

---

### 5. `user_feedback`

사용자의 주관적 만족도 점수를 저장한다.

#### 저장 데이터
- `sleep_date`
- `satisfaction_score`

#### 언제 생성되는가
기상 후 사용자가 만족도 점수를 입력할 때

#### 역할
객관적 결과와 사용자 체감 차이를 확인하는 개인화 입력값으로 사용한다.

---

### 6. `prediction_result`

취침 전 예측 결과를 저장한다.

#### 저장 데이터
- `prediction_ts`
- `target_sleep_date`
- `risk_level`
- `risk_score`
- `reasons_json`
- `action_text`
- `feature_snapshot_json`

#### 언제 생성되는가
취침 전 예측 실행 시마다 생성

#### 역할
- 예측 결과 기록
- 예측 근거 저장
- 행동 제안 저장
- 나중에 실제 결과와 비교 가능

#### 왜 `reasons_json`인가
원인 개수는 고정되지 않을 수 있으므로,  
`reason_1`, `reason_2`처럼 나누지 않고 JSON으로 확장 가능하게 저장한다.

---

### 7. `sleep_score_result`

기상 후 계산된 Sleep Score를 저장한다.

#### 저장 데이터
- `sleep_date`
- `time_asleep_score`
- `deep_rem_score`
- `restoration_score`
- `total_score`

#### 언제 생성되는가
기상 후 대표 수면 결과가 있을 때

#### 역할
서비스가 계산한 수면 점수를 저장하는 결과 테이블이다.

#### 주의
이 테이블은 Fitbit 원본 수면 데이터가 아니라,  
서비스가 계산한 해석 결과이다.

---

### 8. `post_analysis_result`

기상 후 원인 분석 결과를 저장한다.

#### 저장 데이터
- `sleep_date`
- `causes_json`
- `analysis_text`

#### 언제 생성되는가
기상 후 분석 수행 시

#### 역할
- 주요 원인 / 보조 원인 저장
- 설명형 피드백 저장

#### 왜 `causes_json`인가
원인 수가 달라질 수 있으므로 JSON 형태로 저장한다.

---

### 9. `pattern_profile`

A(누적 패턴 데이터)를 저장한다.

#### 저장 데이터
- `updated_at`
- `avg_sleep_minutes`
- `avg_satisfaction`
- `avg_presleep_hr`
- `score_gap_trend`
- `env_sensitivity_json`
- `pattern_snapshot_json`

#### 언제 생성되는가
기상 후 분석 및 사용자 만족도 반영 이후,  
A 갱신 시마다 새 row 생성

#### 역할
사용자의 현재 기준 프로필을 저장한다.

#### 예시
- 최근 평균 수면시간
- 최근 평균 만족도
- 평균 취침 전 심박
- 자동 점수와 체감의 차이 경향
- 환경 민감도

#### 왜 이력을 남기는가
최신값만 덮어쓰지 않고 이력을 남기면,
- 기준이 어떻게 바뀌었는지 확인 가능
- 개인화가 실제로 진행됐는지 추적 가능
- 디버깅이 쉬움

---

## 핵심 이해 포인트

### 원본 데이터 vs 계산 결과

다음 구분이 가장 중요하다.

#### 원본 데이터
- `sensor_raw`
- `fitbit_heart`
- `fitbit_steps`
- `fitbit_sleep`

#### 사용자 입력
- `user_feedback`

#### 시스템 계산 결과
- `prediction_result`
- `sleep_score_result`
- `post_analysis_result`

#### 누적 기준
- `pattern_profile`

즉, 이 DB는 단순히 센서값만 모으는 구조가 아니라,  
**원본 수집 → 결과 계산 → 누적 기준 갱신** 흐름을 그대로 반영한 구조이다.