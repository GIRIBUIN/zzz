# 💤 ZZZ
[![Korean](https://img.shields.io/badge/🇰🇷_Korean-555555?style=for-the-badge)](./README.md)
[![English](https://img.shields.io/badge/🇺🇸_English-555555?style=for-the-badge)](./README.en.md)
[![Project Structure](https://img.shields.io/badge/📘_Project_Structure-555555?style=for-the-badge)](./PROJECT_STRUCTURE.md)
[![How to Run](https://img.shields.io/badge/⚙️_How_to_Run-555555?style=for-the-badge)](./HOW_TO_RUN.md)

<div align="center">

### A personalized sleep management service  
### that predicts sleep quality before bedtime and interprets results after waking up using wearable and environmental data

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

**ZZZ** is a smart healthcare service that predicts possible sleep quality decline **before bedtime**, interprets actual sleep results **after waking up**, and gradually becomes more personalized through repeated use.

This project is not designed as a simple “sleep record viewer.” Instead, it is built around a continuous loop:

- collecting wearable and environmental data
- interpreting both current condition and sleep results
- providing actionable feedback
- updating later prediction criteria based on accumulated user patterns

In short, ZZZ focuses on **pre-sleep intervention**, **explainable interpretation**, and **progressive personalization**.

---

## 🤔 Why ZZZ?

Many existing sleep-related services mainly focus on **post-sleep reporting**.  
Users can check sleep duration, sleep stages, or scores, but once they wake up, it is already too late to change what happened the night before.

Also, even when the recorded sleep data looks similar, the user’s actual satisfaction can still be very different. A score alone is often not enough to explain *why* the sleep result turned out that way.

ZZZ is designed to address these limitations by aiming for the following:

- predicting possible sleep quality decline before sleep
- providing interpretable reasons and action suggestions, not just scores
- reflecting both objective sleep results and subjective user satisfaction
- gradually adjusting later predictions and interpretations based on accumulated patterns

---

## ✨ Core Value

### 1. Pre-sleep intervention
Before the user goes to bed, ZZZ predicts possible sleep quality decline based on current condition and environment, giving the user a chance to change behavior in advance.

### 2. Explainable interpretation
Instead of only presenting scores or warnings, ZZZ aims to explain why a result was produced and which factors may have influenced it.

### 3. Progressive personalization
By reflecting both automatically calculated results and subjective user satisfaction, the system gradually adjusts prediction and interpretation criteria to better fit the individual user.

---

## 🛠 Main Features

### Pre-sleep sleep quality risk prediction
ZZZ predicts possible sleep quality decline for the upcoming night using wearable data and environmental data from the hour before sleep.

### Current risk factors and action suggestion
Along with the prediction, the system presents one or two current risk factors and one action suggestion that the user can immediately follow.

### Post-sleep cause analysis
After waking up, the system combines actual sleep results and user satisfaction to generate a main factor, a secondary factor, and explanation-oriented feedback.

### Sleep Score calculation
The service calculates a 100-point Sleep Score based on the following criteria:

- **Time Asleep** — 50
- **Deep & REM** — 25
- **Restoration** — 25

### Accumulated pattern update
Sleep results, user satisfaction, and the gap between objective scores and subjective experience are accumulated and reflected in later prediction and interpretation criteria.

---

## 🏗 System Concept

ZZZ is designed as a **smart healthcare system centered on On-Premise implementation**, while also keeping future cloud expansion in mind.

### On-Premise Layer
- environmental sensing through Raspberry Pi
- Fitbit API collection
- local buffering and storage
- feature generation
- pre-sleep prediction
- post-sleep analysis
- REST API and dashboard service

### Cloud-Ready Layer
- long-term storage
- scalable processing pipeline
- stronger explanation-oriented feedback layer
- extended service architecture

The current project focuses on **On-Premise implementation first**, while keeping the system structure understandable for later cloud transition.

---

## 💻 Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite
- **Hardware**: Raspberry Pi, DHT11, MQ-5 + ADC module
- **External API**: Fitbit Web API
- **Infra**: AWS *(future extension architecture)*

---

## 🎯 Project Direction

This project is **not** intended to be a medical diagnosis system.

Instead, it aims to be a **supportive smart healthcare service** that helps users better understand their sleep, adjust their behavior before sleep, interpret their results after waking up, and gradually build more personalized criteria through repeated use.

In the long term, the project aims for:

- stronger personalization
- clearer interpretation
- a natural connection between On-Premise and Cloud
- practical smart healthcare service design grounded in real implementation constraints

---

## 🚀 Future Expansion

- [ ] Improved dashboard UI/UX
- [ ] AWS-based storage and processing pipeline expansion
- [ ] Stronger explanation-oriented feedback layer
- [ ] Automatic scheduling and device-state monitoring
- [ ] More advanced user-specific pattern adjustment logic

---

## 📚 Documentation

More details about the project structure, execution flow, and layer responsibilities are available in the documents below.

- [Project Structure Guide](./PROJECT_STRUCTURE.md)
- [How to Run](./HOW_TO_RUN.md)
- [RPi Layer Guide](./rpi/README.md)
- [Processing Layer Guide](./processing/README.md)
- [Service Layer Guide](./service/README.md)
- [Storage Layer Guide](./storage/README.md)
- [Korean README](./README.md)

---

**Keywords**: `Smart Healthcare` `Sleep Quality Prediction` `Wearable Data` `Fitbit API` `Raspberry Pi` `Environmental Sensing` `Explainable Feedback` `Personalized Health Service` `On-Premise System`