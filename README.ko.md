# ZZZ
[![Korean](https://img.shields.io/badge/🇰🇷_Korean-555555?style=for-the-badge)](./README.ko.md) [![English](https://img.shields.io/badge/🇺🇸_English-555555?style=for-the-badge)](./README.md)

<div align="center">

### 웨어러블 데이터, 환경 센서, 스마트 헬스케어 로직 기반  
### 개인화 수면 질 예측 및 해석 서비스

<br>

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-A22846?style=for-the-badge&logo=raspberrypi&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Fitbit](https://img.shields.io/badge/Fitbit-00B0B9?style=for-the-badge&logo=fitbit&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazonaws&logoColor=white)

![Status](https://img.shields.io/badge/Status-In%20Progress-6DB33F?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-On--Device%20%2B%20Cloud-6A5ACD?style=for-the-badge)
![Domain](https://img.shields.io/badge/Domain-Smart%20Healthcare-0A66C2?style=for-the-badge)

</div>

---

## Overview

**ZZZ**는 취침 전 수면 질 저하 가능성을 예측하고, 기상 후 실제 수면 결과를 해석하며, 반복 사용을 통해 사용자 고유의 패턴을 점진적으로 반영하는 **스마트 헬스케어 서비스**이다.

단순히 기록된 건강 데이터를 보여주는 데서 끝나는 것이 아니라, 다음과 같은 순환 구조를 지향한다.

- 생체 데이터와 환경 데이터 수집
- 데이터 맥락 해석
- 행동 가능한 피드백 제공
- 반복 사용을 통한 이후 예측 기준 보정

ZZZ는 **Fitbit 웨어러블 데이터**, **환경 센서 데이터**, **사용자 피드백**을 함께 활용하여 더 실용적이고 개인화된 수면 관리 경험을 제공하는 것을 목표로 한다.

---

## Why ZZZ?

기존의 많은 수면 관련 서비스는 주로 **사후 리포트**를 제공한다.  
사용자는 “어젯밤에 어떻게 잤는지”는 확인할 수 있지만, 이미 수면이 끝난 뒤이기 때문에 그날 밤의 행동을 바꾸기에는 늦은 경우가 많다.

ZZZ는 여기서 다른 출발점을 가진다.

ZZZ가 해결하고자 하는 문제는 다음과 같다.

- 취침 전에 수면 질 저하 가능성을 예측
- 결과를 단순 점수로 끝내지 않고, 해석 가능한 이유와 간단한 행동 제안 제공
- 기상 후 객관적 결과와 주관적 만족도를 함께 비교
- 누적된 사용자 패턴을 바탕으로 이후 해석을 점진적으로 보정

즉, ZZZ는 단순한 수면 기록 뷰어가 아니라  
**예방 중심**, **해석 중심**의 스마트 헬스케어 서비스로 설계되었다.

---

## Core Value

### 1. 취침 전 개입
최근 웨어러블 데이터와 환경 데이터를 바탕으로, 사용자가 잠들기 전에 수면 질 저하 위험을 예측한다.

### 2. 설명 가능한 해석
점수나 경고만 제시하는 것이 아니라, 왜 그런 결과가 나왔는지와 어떤 요인이 영향을 주었는지를 함께 설명하는 방향을 지향한다.

### 3. 점진적 개인화
객관적인 수면 결과와 사용자의 주관적 만족도를 함께 반영하여, 시간이 지날수록 사용자에게 더 맞는 해석 기준으로 조정된다.

---

## Main Features

### 취침 전 예측
취침 전 최근 생체 데이터와 환경 데이터를 분석하여 수면 질 저하 가능성을 예측하고, 간단한 행동 제안을 제공한다.

### 기상 후 분석
기상 후 실제 수면 결과와 사용자 만족도를 함께 반영하여 주요 원인과 보조 원인을 해석한다.

### Sleep Score 계산
서비스는 다음 기준을 바탕으로 100점 만점의 Sleep Score를 계산한다.

- **Time Asleep** — 50점
- **Deep & REM** — 25점
- **Restoration** — 25점

### 패턴 갱신
누적된 수면 패턴, 만족도 경향, 객관적 점수와 체감의 차이를 저장하고 이후 예측에 반영한다.

---

## Data Sources

### 웨어러블 데이터
Fitbit Web API를 통해 수집

- heart rate
- activity / steps
- sleep logs
- sleep stages

### 환경 센서 데이터
on-device 센싱을 통해 수집

- temperature
- humidity
- MQ-5 raw value
- normalized indoor gas change index

### 사용자 입력
기상 후 입력

- subjective sleep satisfaction score

---

## System Concept

ZZZ는 **on-device**와 **cloud-based** 환경을 함께 고려하는 하이브리드 구조로 설계된다.

### On-device layer
- 생체 / 환경 데이터 수집
- 로컬 저장
- feature 추출
- 취침 전 예측
- 기상 후 분석

### Cloud layer
- 장기 저장
- 서비스 확장
- 확장 가능한 처리 구조
- 향후 대시보드 / API 연동

현재 프로젝트는 **on-device 구현**을 중심으로 진행하되, 처음부터 클라우드 확장 구조까지 고려하는 방향으로 설계되었다.

---

## Expected Flow

1. Fitbit 및 환경 센서 데이터 수집  
2. 로컬에 데이터 저장 및 정리  
3. 취침 전 수면 질 저하 가능성 예측  
4. 간단한 원인과 행동 제안 제공  
5. 기상 후 실제 수면 결과와 주관적 만족도 수집  
6. Sleep Score 계산 및 원인 해석  
7. 누적 사용자 패턴 데이터 갱신  
8. 이후 예측에 갱신된 기준 반영  

---

## Tech Stack

- **Python**
- **Raspberry Pi**
- **SQLite**
- **Fitbit Web API**
- **DHT11**
- **MQ-5 + ADC module**
- **AWS**

---

## Project Direction

이 프로젝트는 의료 진단 시스템을 목표로 하지 않는다.  
대신, 반복적인 데이터 기반 피드백을 통해 사용자가 자신의 수면을 더 잘 이해하고, 관리하고, 점진적으로 개선할 수 있도록 돕는 **보조적 스마트 헬스케어 서비스**를 목표로 한다.

ZZZ의 장기적인 방향은 다음과 같다.

- 더 강한 개인화
- 더 명확한 해석
- on-device와 cloud의 자연스러운 연결
- 실제 구현 제약을 반영한 현실적인 스마트 헬스케어 서비스 설계

---

## Future Expansion

- dashboard integration
- AWS 기반 저장 및 처리 파이프라인 확장
- 설명형 피드백 생성 계층 추가
- 자동 실행 스케줄링 및 장치 상태 모니터링
- 사용자별 패턴 보정 로직 고도화

---

## Keywords

`Smart Healthcare` `Sleep Quality Prediction` `Wearable Data` `Fitbit API` `Raspberry Pi` `Environmental Sensing` `On-Device AI` `Explainable Feedback` `Personalized Health Service`