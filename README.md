# 💤 ZZZ
[![한국어](https://img.shields.io/badge/🇰🇷_Korean-555555?style=for-the-badge)](./README.md)
[![English](https://img.shields.io/badge/🇺🇸_English-555555?style=for-the-badge)](./README.en.md)
[![구조 가이드](https://img.shields.io/badge/📘_Project_Structure-555555?style=for-the-badge)](./PROJECT_STRUCTURE.md)
[![실행 방법](https://img.shields.io/badge/⚙️_How_to_Run-555555?style=for-the-badge)](./HOW_TO_RUN.md)

<div align="center">

### 웨어러블 데이터와 환경 센서를 함께 활용하여  
### 취침 전 수면 질을 예측하고, 기상 후 결과를 해석하는 개인 맞춤형 수면 관리 서비스

<br>

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-A22846?style=for-the-badge&logo=raspberrypi&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Fitbit](https://img.shields.io/badge/Fitbit-00B0B9?style=for-the-badge&logo=fitbit&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazonaws&logoColor=white)

![Status](https://img.shields.io/badge/Status-In%20Progress-6DB33F?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-On--Premise%20%2B%20Cloud%20Ready-6A5ACD?style=for-the-badge)
![Domain](https://img.shields.io/badge/Domain-Smart%20Healthcare-0A66C2?style=for-the-badge)

</div>

---

## 🔍 Overview

**ZZZ**는 취침 전에 오늘 밤의 수면 질 저하 가능성을 예측하고, 기상 후에는 실제 수면 결과와 사용자 체감을 함께 해석하며, 반복 사용을 통해 점진적으로 개인화되는 스마트 헬스케어 서비스입니다.

이 프로젝트는 단순히 “어젯밤 어떻게 잤는지”를 보여주는 데서 끝나는 것이 아니라, 다음과 같은 순환 구조를 지향합니다.

- 웨어러블 및 환경 데이터 수집
- 현재 상태와 수면 결과 해석
- 행동 가능한 피드백 제공
- 누적 패턴을 반영한 이후 예측 기준 갱신

즉, ZZZ는 단순한 수면 기록 서비스가 아니라 **사전 개입**, **설명 가능한 해석**, **점진적 개인화**를 핵심으로 두는 서비스입니다.

---

## 🤔 Why ZZZ?

기존의 많은 수면 관련 서비스는 주로 **기상 후 결과 확인**에 머무릅니다.  
사용자는 수면 시간, 수면 단계, 점수와 같은 결과를 볼 수는 있지만, 이미 수면이 끝난 뒤이기 때문에 그날 밤의 행동을 바꾸기에는 늦은 경우가 많습니다.

또한 같은 수면 데이터가 기록되더라도 사용자가 실제로 느끼는 만족도는 다를 수 있으며, 단순한 점수만으로는 왜 그런 결과가 나왔는지 이해하기 어려운 경우도 많습니다.

ZZZ는 이러한 한계를 보완하기 위해 다음과 같은 방향을 목표로 합니다.

- 취침 전에 수면 질 저하 가능성을 예측
- 결과를 단순 점수로 끝내지 않고 해석 가능한 이유와 행동 제안 제공
- 기상 후 실제 수면 결과와 주관적 만족도를 함께 반영
- 누적된 사용자 패턴을 바탕으로 이후 예측과 해석을 점진적으로 보정

---

## ✨ Core Value

### 1. 사전 개입
취침 전 시점에 현재 상태와 환경을 바탕으로 수면 질 저하 가능성을 미리 예측하고, 사용자가 실제로 행동을 바꿀 수 있는 기회를 제공합니다.

### 2. 설명 가능한 해석
단순히 결과를 보여주는 것이 아니라, 왜 그런 결과가 나왔는지와 어떤 요인이 영향을 주었는지를 함께 설명하는 방향을 지향합니다.

### 3. 점진적 개인화
자동 계산 결과와 사용자의 주관적 만족도를 함께 반영하여, 시간이 지날수록 사용자에게 더 맞는 예측 기준과 해석 기준으로 조정됩니다.

---

## 🛠 Main Features

### 취침 전 수면 질 저하 위험 예측
취침 전 1시간의 웨어러블 데이터와 환경 데이터를 바탕으로 오늘 밤 수면 질 저하 가능성을 예측합니다.

### 현재 위험 요인 및 행동 제안 제공
예측 결과와 함께 현재 위험 요인 1~2개를 제시하고, 바로 실천할 수 있는 행동 제안 1개를 제공합니다.

### 기상 후 원인 분석
기상 후 실제 수면 결과와 사용자 만족도를 함께 반영하여 주요 원인, 보조 원인, 설명형 피드백을 생성합니다.

### Sleep Score 계산
서비스는 다음 기준을 바탕으로 100점 만점의 Sleep Score를 계산합니다.

- **Time Asleep** — 50점
- **Deep & REM** — 25점
- **Restoration** — 25점

### 누적 패턴 데이터 갱신
수면 결과, 사용자 만족도, 자동 점수와 체감의 차이를 누적하여 이후 예측과 해석의 기준으로 반영합니다.

---

## 🏗 System Concept

ZZZ는 **On-Premise 구현을 중심으로 설계된 스마트 헬스케어 시스템**이며, 이후 클라우드 확장까지 고려한 구조를 갖습니다.

### On-Premise Layer
- Raspberry Pi 기반 환경 센서 수집
- Fitbit API 호출
- 로컬 버퍼 및 저장
- feature 생성
- 취침 전 예측
- 기상 후 사후 분석
- REST API 및 대시보드 서비스 제공

### Cloud-Ready Layer
- 장기 저장
- 확장 가능한 처리 파이프라인
- 설명형 피드백 계층 강화
- 서비스 구조 확장

현재 프로젝트는 **On-Premise 구현을 우선**으로 진행하되, 이후 클라우드 전환 시에도 구조적으로 자연스럽게 이어질 수 있도록 설계하고 있습니다.

---

## 💻 Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite
- **Hardware**: Raspberry Pi, DHT11, MQ-5 + ADC module
- **External API**: Fitbit Web API
- **Infra**: AWS *(future extension architecture)*

---

## 🎯 Project Direction

이 프로젝트는 의료 진단 시스템을 목표로 하지 않습니다.

대신 사용자가 자신의 수면을 더 잘 이해하고, 취침 전에 행동을 조정하며, 기상 후 결과를 해석하고, 반복 사용을 통해 점진적으로 더 맞는 기준을 형성할 수 있도록 돕는 **보조적 스마트 헬스케어 서비스**를 목표로 합니다.

장기적으로는 다음과 같은 방향을 지향합니다.

- 더 강한 개인화
- 더 명확한 해석
- On-Premise와 Cloud의 자연스러운 연결
- 실제 구현 제약을 반영한 현실적인 스마트 헬스케어 서비스 설계

---

## 🚀 Future Expansion

- [ ] 대시보드 UI/UX 고도화
- [ ] AWS 기반 저장 및 처리 파이프라인 확장
- [ ] 설명형 피드백 계층 강화
- [ ] 자동 실행 스케줄링 및 장치 상태 모니터링
- [ ] 사용자별 패턴 보정 로직 고도화

---

## 📚 문서 안내

프로젝트 구조와 실행 흐름, 각 계층의 역할은 아래 문서에서 확인할 수 있습니다.

[![README](https://img.shields.io/badge/README-2563EB?style=for-the-badge)](./README.md)
[![How to Run](https://img.shields.io/badge/How_to_Run-2563EB?style=for-the-badge)](./HOW_TO_RUN.md)
[![RPi Layer](https://img.shields.io/badge/RPi_Layer-2563EB?style=for-the-badge)](./rpi/README.md)
[![Processing Layer](https://img.shields.io/badge/Processing_Layer-2563EB?style=for-the-badge)](./processing/README.md)
[![Service Layer](https://img.shields.io/badge/Service_Layer-2563EB?style=for-the-badge)](./service/README.md)
[![Storage Layer](https://img.shields.io/badge/Storage_Layer-2563EB?style=for-the-badge)](./storage/README.md)
[![English README](https://img.shields.io/badge/English_README-2563EB?style=for-the-badge)](./README.en.md)
---

**Keywords**: `Smart Healthcare` `Sleep Quality Prediction` `Wearable Data` `Fitbit API` `Raspberry Pi` `Environmental Sensing` `Explainable Feedback` `Personalized Health Service` `On-Premise System`