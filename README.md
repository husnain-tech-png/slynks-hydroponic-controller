# 🥬 Slynks Hydroponic Controller

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![IoT: ESP32](https://img.shields.io/badge/IoT-ESP32%20%2F%20Blynk-0ea5e9.svg)](https://blynk.io)
[![AI: Biobot Agronomist](https://img.shields.io/badge/AI-Slynks%20Hydro--AI-10b981.svg)]()
[![Payments: Pakistan ₨50](https://img.shields.io/badge/Payments-Easypaisa%20%7C%20JazzCash%20%7C%20Raast-f59e0b.svg)]()
[![Deployment: GitHub Pages](https://img.shields.io/badge/Website-GitHub%20Pages-blue.svg)]()

> **Next-generation IoT Hydroponics Automation & Monitoring platform with Slynks Hydro-AI Biobot, real-time telemetry, smart alert engine, historical analytics, and Pakistani local payment checkout (₨50/month).**

---

## 📸 Live Official Website

Deploy and access your controller directly via GitHub Pages:
🔗 **`https://<your-username>.github.io/slynks-hydroponic-controller/`**

---

## 🌟 Key Features

### 1. 🎛️ Blynk-Style IoT Telemetry Dashboard
- **Real-Time Sensor Monitoring**:
  - **Water pH Level**: 5.50 - 6.50 target range with calibrated needle gauge.
  - **Electrical Conductivity (EC / TDS PPM)**: Salinity and nutrient strength indicators.
  - **Water Solution Temperature**: Root zone thermal monitor (°C / °F).
  - **Dissolved Oxygen (DO)**: Aeration and root respiration tracking (mg/L).
  - **Reservoir Water Level**: Real-time volume gauge with liquid level animation.
  - **Grow Room Climate & VPD**: Temperature, Relative Humidity %, and Vapor Pressure Deficit (kPa).
  - **Grow LED Lighting**: Full-spectrum PAR (PPFD) and LUX photoperiod tracker.
  - **Nutrient Circulation**: Real-time flow rate (L/min).
- **Interactive Hydroponic Reservoir Schematic**:
  - Dynamic visual cross-section showing solution flow, air stone bubbling, pump rotation, and dosing injectors.
- **Relays & Actuators Control (Blynk Virtual Pins)**:
  - `V1`: Submersible Circulation Water Pump
  - `V2`: Full-Spectrum LED Grow Lights
  - `V3`: Oxygen Air Bubbler
  - `V4`: Canopy Exhaust & Climate Fan
  - `V6-V7`: Peristaltic Dosing Injectors (pH Down, pH Up, Nutrient A, Nutrient B)
- **Crop Botanical Presets**:
  - *Butterhead Lettuce (NFT / DWC)*
  - *Alpine Strawberries (Ebb & Flow)*
  - *Vine Tomatoes (Dutch Bucket)*
  - *Genovese Basil (Deep Water)*
  - *Bell Peppers / Chillies*

---

### 2. 🤖 Slynks Hydro-AI Biobot Agronomist Agent
- **Hydroponic Vitality Score (0-100%)**: Continuously monitors environmental stress and biological safety.
- **Auto-Tune Smart Prescription**: Computes exact chemical dosages and allows 1-click execution.
- **Visual Symptom Checker**: Instant diagnosis for Iron chlorosis, Magnesium deficiency, salt tip burn, Pythium root rot, and algae blooms.
- **Pakistani Climate Knowledge Base**: Summer heat mitigation protocols for 42°C+ ambient temperatures in Lahore, Karachi, and Multan.

---

### 3. 🔔 Smart Alerts & Needs Center
- **Proactive Needs Engine**: Instant warnings for low water, pH drift, and high nutrient temperatures.
- **Threshold Rule Editor**: Configurable alarm boundaries for all sensors.
- **Audio Synthesizer**: In-browser real-time audio chimes via the Web Audio API.

---

### 4. 📈 Historical Analytics & Data Export
- Multi-series time-series charts (**1 Hour**, **24 Hours**, **7 Days**, **30 Days**).
- **CSV Data Exporter** & printable **Agronomic Health Audit Reports**.

---

### 5. 💳 ₨50 Pakistani Payment Gateways
- **Easypaisa**: Mobile Account number input & USSD/Push OTP simulation.
- **JazzCash**: Mobile Wallet & MPIN authorization flow.
- **Raast Instant Pay (State Bank of Pakistan)**: 0% fee instant QR code & Raast ID.
- **1Link Pakistani Banks**: Meezan Bank (Islamic), HBL, UBL, Bank Alfalah, NayaPay, SadaPay, MCB, and Allied Bank.
- **Digital Invoice Receipts**: Generates verified `TXN-PK-XXXXXXX` tax receipts with license badge unlock.

---

## 🔌 Hardware Architecture & Pinout (ESP32)

```
        +-----------------------------------+
        |       ESP32 NodeMCU Controller    |
        +-----------------------------------+
          | GPIO 34 (ADC)  --> pH Sensor
          | GPIO 35 (ADC)  --> EC / TDS Sensor
          | GPIO 4 (OneWire)--> DS18B20 Water Temp Sensor
          | GPIO 14 / 12   --> HC-SR04 Ultrasonic Level Sensor
          | GPIO 21 / 22   --> DHT22 Temp / Humidity Sensor
          | GPIO 25 (Relay)--> Water Circulation Pump (220V)
          | GPIO 18 (MOSFET)--> Grow LED Lights (PWM Dimmer)
          | GPIO 26 (Relay)--> pH Down Peristaltic Pump
          | GPIO 27 (Relay)--> Nutrient A Dosing Pump
        +-----------------------------------+
```

---

## 🚀 Quick Start (Local Setup)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/<your-username>/slynks-hydroponic-controller.git
   cd slynks-hydroponic-controller
   ```
2. Open `index.html` directly in any web browser, or launch a local server:
   ```bash
   python -m http.server 8080
   ```
3. Navigate to `http://localhost:8080`.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
