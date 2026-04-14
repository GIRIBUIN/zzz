[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](../PROJECT_STRUCTURE.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](../processing/README.md)

# RPi Layer Guide (RPi 계층 문서)

이 문서는 **ZZZ 프로젝트에서 `rpi/` 폴더가 어떤 역할을 담당하는지** 설명하기 위한 문서입니다.

`rpi/`는 Raspberry Pi를 중심으로 동작하는 **현장 장치 계층**입니다.  
이 계층은 센서와 직접 연결되어 데이터를 수집하고, Fitbit API를 호출하며, 필요하면 로컬 출력 장치(OLED 등)를 통해 간단한 결과를 바로 보여주는 역할을 맡습니다.

즉, `rpi/`는 전체 프로젝트 안에서 **데이터 수집 허브**이자 **장치 중심 계층**으로 이해하면 됩니다.

---

## 1. 왜 `rpi/` 폴더를 따로 두는가

이 프로젝트는 현재 On-Premise 방식으로 구현되므로,  
실제로는 하나의 로컬 환경에서 여러 역할을 함께 실행할 수도 있습니다.

하지만 장치와 직접 연결되는 코드는 성격이 다릅니다.

예를 들면 다음과 같습니다.

- GPIO를 통한 센서 접근
- Raspberry Pi 환경에서의 장치 제어
- OLED 같은 로컬 출력 장치 연결
- 업로드 전 임시 버퍼 관리
- Fitbit API 호출을 수집 허브 역할 안에서 정리

이런 코드는 예측 계산 로직이나 API 서버 로직과 섞이면 구조가 복잡해지고,  
나중에 수정하거나 Raspberry Pi 환경에서 다시 점검할 때도 불편해집니다.

그래서 `rpi/`는 **“장치에 직접 붙는 책임”**만 모아 둔 별도 계층으로 분리했습니다.

---

## 2. 이 계층의 핵심 역할

`rpi/`는 주로 아래 역할을 담당합니다.

- 환경 센서 데이터 수집
- Fitbit API 호출
- 수집 데이터의 로컬 버퍼링
- 간단한 로컬 알림 또는 OLED 출력

즉, 이 계층은 **데이터를 만들어내고 모으는 시작점**입니다.

여기서 중요한 점은, `rpi/`는 데이터를 직접 수집하고 전달하는 역할을 맡지만,  
수면 질 예측이나 Sleep Score 계산 같은 핵심 판단 로직은 여기서 수행하지 않는다는 것입니다.

---

## 3. 하위 폴더 구성

현재 `rpi/`는 아래와 같은 하위 폴더로 나뉩니다.

```text
rpi/
├─ buffer/
├─ fitbit/
├─ sensors/
├─ ui/
└─ README.md
```

---

## 4. 각 하위 폴더 설명

### 4-1. `sensors/`

`sensors/`는 Raspberry Pi에 연결된 환경 센서를 읽는 코드가 들어가는 폴더입니다.

현재 기준으로는 다음 역할을 가집니다.

- DHT11 센서를 통한 온도/습도 측정
- MQ-5 센서를 통한 실내 가스 변화 지표 수집
- 센서 수집 주기 관리
- 센서 데이터를 저장 계층으로 넘길 준비

예상 파일 예시는 다음과 같습니다.

- `dht11_reader.js`
- `mq5_reader.js`
- `collect_sensors.js`

즉, `sensors/`는 **환경 데이터 수집 책임**을 맡습니다.

---

### 4-2. `fitbit/`

`fitbit/`는 Fitbit API 호출 관련 코드를 관리하는 폴더입니다.

현재 구조에서는 Fitbit API 호출 역시 Raspberry Pi 수집 허브의 역할 안에 포함하여 정리합니다.

이 폴더는 다음 역할을 담당합니다.

- Fitbit API 클라이언트 구성
- 심박/수면/활동량 데이터 호출
- 샘플 응답 저장 및 테스트
- 수집 데이터를 이후 계층에서 사용할 수 있게 정리

예상 파일 예시는 다음과 같습니다.

- `fitbit_client.js`
- `collect_fitbit.js`
- `sample_response/`

즉, `fitbit/`는 **웨어러블 데이터 수집 책임**을 맡습니다.

---

### 4-3. `buffer/`

`buffer/`는 업로드 전 또는 저장 전 데이터를 잠시 보관하는 로컬 버퍼 공간입니다.

이 폴더는 다음 상황에 대비하는 용도로 생각하면 됩니다.

- 네트워크 연결이 잠시 불안정할 때
- 즉시 저장 또는 전송하지 못할 때
- 로컬 환경에서 임시로 데이터를 모아둘 때

예상 파일 예시는 다음과 같습니다.

- `local_buffer.js`

즉, `buffer/`는 **수집과 저장 사이의 완충 계층**입니다.

---

### 4-4. `ui/`

`ui/`는 Raspberry Pi 쪽 로컬 출력 장치를 위한 폴더입니다.

현재 구조에서는 다음과 같은 역할을 생각할 수 있습니다.

- OLED를 통한 간단한 예측 결과 표시
- 로컬 알림 출력
- 최소한의 현장 피드백 제공

예상 파일 예시는 다음과 같습니다.

- `oled_view.js`
- `local_alert.js`

즉, `ui/`는 **장치 가까이에서 빠르게 보여줄 수 있는 최소 출력 계층**입니다.

---

## 5. 이 계층이 하지 않는 일

`rpi/`는 중요하지만, 모든 일을 다 맡지는 않습니다.

이 계층에서는 아래와 같은 일을 직접 하지 않습니다.

- Sleep Score 계산
- 취침 전 예측 계산
- 기상 후 사후 분석
- A(누적 패턴 데이터) 갱신
- REST API 응답 생성
- 대시보드 요청 처리

이런 작업은 각각 `processing/` 또는 `service/` 계층에서 담당합니다.

즉, `rpi/`는 **수집과 장치 제어에 집중**하고,  
핵심 비즈니스 로직은 다른 계층으로 넘기는 구조를 유지합니다.

---

## 6. 다른 계층과의 연결 관계

`rpi/`는 전체 구조에서 보통 아래처럼 연결됩니다.

```text
rpi -> storage
```

또는 조금 더 풀어서 보면,

```text
센서 / Fitbit 데이터 수집
-> 로컬 버퍼
-> 저장 계층으로 전달
```

필요한 경우 일부 간단한 출력은 로컬에서 바로 수행할 수 있지만,  
핵심 판단과 해석은 `processing/`과 `service/` 계층으로 이어집니다.

즉, `rpi/`는 전체 시스템 안에서 **입력의 시작점**이라고 볼 수 있습니다.

---

## 7. 미래 구조와의 관계

현재는 On-Premise 구현 단계이므로,  
Raspberry Pi와 로컬 서버가 같은 프로젝트 안에서 함께 관리됩니다.

하지만 이후 클라우드 확장 단계에서는 `rpi/` 계층의 역할이 더 분명해질 수 있습니다.

예를 들면:

- Raspberry Pi는 계속 센서 수집 허브 역할을 맡고
- 저장/처리/API는 클라우드 계층으로 이동할 수 있습니다

즉, `rpi/`는 지금도 독립적인 역할을 가지지만,  
나중에는 전체 구조 안에서 **현장 수집 장치 계층**으로 더 명확하게 분리될 수 있습니다.

---

## 8. 개발 시 기본 원칙

`rpi/` 계층에서는 아래 원칙을 지키는 것이 좋습니다.

- 장치/센서 관련 책임만 맡는다
- 계산 로직을 길게 넣지 않는다
- DB 스키마 지식을 최소화한다
- 로컬 출력은 간단하게 유지한다
- 수집된 데이터는 이후 계층이 사용하기 쉽게 넘긴다

즉, 이 계층은 **수집 허브답게 단순하고 안정적으로 유지하는 것**이 중요합니다.

---

## 9. 관련 문서

[![Previous](https://img.shields.io/badge/Previous-6B7280?style=for-the-badge)](../PROJECT_STRUCTURE.md)
[![Next](https://img.shields.io/badge/Next-16A34A?style=for-the-badge)](../processing/README.md)

[![README](https://img.shields.io/badge/README-2563EB?style=for-the-badge)](../README.md)
[![Project Structure](https://img.shields.io/badge/Project_Structure-2563EB?style=for-the-badge)](../PROJECT_STRUCTURE.md)
[![Processing Layer](https://img.shields.io/badge/Processing_Layer-2563EB?style=for-the-badge)](../processing/README.md)
[![Service Layer](https://img.shields.io/badge/Service_Layer-2563EB?style=for-the-badge)](../service/README.md)
[![Storage Layer](https://img.shields.io/badge/Storage_Layer-2563EB?style=for-the-badge)](../storage/README.md)
[![How to Run](https://img.shields.io/badge/How_to_Run-2563EB?style=for-the-badge)](../HOW_TO_RUN.md)
[![English README](https://img.shields.io/badge/English_README-2563EB?style=for-the-badge)](../README.en.md)