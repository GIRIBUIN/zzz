# ZZZ
[![Korean](https://img.shields.io/badge/🇰🇷_Korean-555555?style=for-the-badge)](./README.ko.md) [![English](https://img.shields.io/badge/🇺🇸_English-555555?style=for-the-badge)](./README.md)

<div align="center">

### Personalized Sleep Quality Prediction & Interpretation Service  
### based on Wearable Data, Environmental Sensing, and Smart Healthcare Logic

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

**ZZZ** is a smart healthcare service designed to predict sleep quality degradation **before sleep**, analyze actual sleep outcomes **after waking**, and gradually reflect the user’s own patterns over time.

Rather than simply displaying recorded health data, ZZZ focuses on a full cycle of:

- collecting biometric and environmental data,
- interpreting that data in context,
- providing actionable feedback,
- and refining future predictions through repeated use.

The service combines **Fitbit wearable data**, **environmental sensor data**, and **user feedback** to support a more practical and personalized sleep management experience.

---

## Why ZZZ?

Most existing sleep-related services mainly provide **post-sleep reports**.  
Users can check how they slept, but by then the sleep has already ended, which makes it difficult to actually change behavior for that night.

ZZZ starts from a different point.

It aims to:

- estimate possible sleep quality decline **before bedtime**
- provide interpretable reasons and simple behavioral suggestions
- compare objective results with subjective satisfaction after waking
- gradually adjust the interpretation based on accumulated user patterns

In other words, ZZZ is not just a sleep record viewer.  
It is designed as a **prevention-oriented and interpretation-oriented smart healthcare service**.

---

## Core Value

### 1. Pre-sleep intervention
ZZZ predicts the risk of sleep quality decline before the user goes to bed, using recent wearable data and environmental conditions.

### 2. Explainable interpretation
The service does not stop at a score or warning.  
It aims to explain **why** the result occurred and what factors may have contributed to it.

### 3. Gradual personalization
Objective sleep results and subjective user satisfaction are both considered.  
Over time, the system updates accumulated patterns and adjusts its interpretation to better fit the individual user.

---

## Main Features

### Pre-sleep Prediction
Before sleep, the system analyzes recent biometric and environmental data to estimate the possibility of lower sleep quality and provide a simple action suggestion.

### Post-sleep Analysis
After waking, the system calculates sleep-related results, compares them with user feedback, and generates an interpretation of major and secondary factors.

### Sleep Score Calculation
The service calculates a 100-point sleep score based on:

- **Time Asleep** — 50 points
- **Deep & REM** — 25 points
- **Restoration** — 25 points

### Pattern Update
Accumulated sleep patterns, user satisfaction trends, and gaps between objective score and subjective feeling are stored and reflected in later predictions.

---

## Data Sources

### Wearable Data
Collected through Fitbit Web API:

- heart rate
- activity / steps
- sleep logs
- sleep stages

### Environmental Data
Collected through on-device sensing:

- temperature
- humidity
- MQ-5 raw value
- normalized indoor gas change index

### User Input
Provided after waking:

- subjective sleep satisfaction score

---

## System Concept

ZZZ is designed with a hybrid structure that can operate across **on-device** and **cloud-based** components.

### On-device layer
- biometric/environmental data collection
- local storage
- feature extraction
- pre-sleep prediction
- post-sleep analysis

### Cloud layer
- long-term storage
- service extension
- scalable processing
- future dashboard / API integration

The project is currently centered around an **on-device implementation**, while keeping cloud expansion in mind from the start.

---

## Expected Flow

1. Collect Fitbit and environmental sensor data  
2. Store and organize data locally  
3. Predict possible sleep quality decline before bedtime  
4. Show simple reasons and behavior suggestions  
5. Collect actual sleep result and subjective satisfaction after waking  
6. Calculate Sleep Score and interpret causes  
7. Update accumulated user pattern data  
8. Reflect updated patterns in future predictions

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

This project is not intended to be a medical diagnosis system.  
Instead, it is designed as a **supportive smart healthcare service** that helps users better understand, manage, and gradually improve their sleep using repeated data-driven feedback.

The long-term direction of ZZZ is:

- stronger personalization
- clearer interpretation
- smoother on-device to cloud integration
- practical smart healthcare service design grounded in real implementation constraints

---

## Future Expansion

- dashboard integration
- AWS-based storage and processing pipeline
- explainable feedback generation layer
- automated scheduling and device monitoring
- more refined user-specific pattern adjustment logic

---

## Keywords

`Smart Healthcare` `Sleep Quality Prediction` `Wearable Data` `Fitbit API` `Raspberry Pi` `Environmental Sensing` `On-Device AI` `Explainable Feedback` `Personalized Health Service`