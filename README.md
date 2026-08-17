# 🌿 Slynks Hydroponic Controller v3.0

> **Production IoT Hydroponics Automation Platform & AI Agronomist**  
> Direct Physical Hardware Integration (Web-Serial API, WiFi WebSocket/REST, ESP32 Microcontrollers) & Verified Pakistani Payment System (₨50 / month).

---

## 🌐 Official Permanent Website
👉 **[https://husnain-tech-png.github.io/slynks-hydroponic-controller/](https://husnain-tech-png.github.io/slynks-hydroponic-controller/)**

---

## ⚡ Key Highlights & Capabilities

1. **🔌 Real Hardware Integration (Zero Simulated/Fabricated Data)**:
   - **Web-Serial API**: Direct browser-to-ESP32 USB connection at 115200 baud without installing drivers or native software.
   - **Local WiFi LAN (WebSocket & REST)**: Connect wirelessly to the ESP32 on your local network (`ws://192.168.4.1:81/ws` or `http://192.168.4.1/api/telemetry`).
   - **Zero Fake Data**: When physical hardware is disconnected, gauges and charts clearly state `OFFLINE` / `--` and wait for real sensor packets.
   - **Actuator Hardware Command Pipeline**: Direct actuation commands (`SET_RELAY`, `DOSE`) sent to physical relays and pumps with ACK confirmations.

2. **🧠 Slynks Hydro-AI Biobot**:
   - Evaluates real biological parameters in real time.
   - Diagnoses nutrient burn, iron lockout, root rot risk, and VPD stress.
   - Computes auto-tune peristaltic dosing prescriptions based on incoming probe data.

3. **💳 Accurate Pakistani Payment System (₨ 50 / month)**:
   - **Designated Official Receiver Number**: **`03154483615`** (Title: *Slynks Hydroponics / Official Receiver*).
   - Direct support for **Easypaisa**, **JazzCash**, **Raast (SBP)**, and **1Link Local Pakistani Banks** (Meezan, HBL, UBL, NayaPay, SadaPay).
   - **Strict Verification Lifecycle**: Submitted payments enter **`PENDING`** status.
   - **Admin Verification Portal**: Administrators can inspect submitted Transaction IDs (TRX IDs) against bank statements and click **"Approve & Verify"** or **"Reject"**.

---

## 🛠️ ESP32 Hardware Wiring Pinout

| Component / Sensor | Type | ESP32 GPIO Pin | Description |
| :--- | :--- | :--- | :--- |
| **pH Sensor Probe** | Analog ADC | `GPIO 34` (ADC1_CH6) | 0.00 - 14.00 pH range with 2-point buffer calibration |
| **EC / TDS Probe** | Analog ADC | `GPIO 35` (ADC1_CH7) | 0.0 - 4.0 mS/cm with temperature compensation |
| **Water Temp Sensor** | Digital OneWire | `GPIO 4` | DS18B20 waterproof submerged probe |
| **Tank Level Sensor** | Ultrasonic | `Trig: GPIO 14, Echo: GPIO 12` | HC-SR04 ultrasonic distance sensor |
| **Ambient Climate** | Digital | `GPIO 21` | DHT22 / AM2302 (Air Temp & Humidity) |
| **Water Flow Meter** | Interrupt Pulse | `GPIO 13` | Hall Effect flow sensor (L/min) |
| **Circulation Pump** | Optocoupled Relay | `GPIO 25` (Relay 1) | Submersible water pump |
| **Grow LED Light** | MOSFET / PWM | `GPIO 18` | Full-spectrum LED array |
| **Air Stone Aerator** | Optocoupled Relay | `GPIO 19` (Relay 6) | Oxygen bubbler |
| **Climate Fan** | Optocoupled Relay | `GPIO 22` (Relay 7) | Canopy exhaust fan |
| **pH Down Doser** | Peristaltic Pump | `GPIO 26` (Relay 2) | 12V 1.2ml/sec dosing motor |
| **pH Up Doser** | Peristaltic Pump | `GPIO 27` (Relay 3) | 12V 1.2ml/sec dosing motor |
| **Nutrient A Doser** | Peristaltic Pump | `GPIO 32` (Relay 4) | 12V 1.2ml/sec dosing motor |
| **Nutrient B Doser** | Peristaltic Pump | `GPIO 33` (Relay 5) | 12V 1.2ml/sec dosing motor |

---

## 🚀 Quick Start Guide

### 1. Flash the ESP32 Firmware
1. Open Arduino IDE.
2. Open [`firmware/slynks_esp32_firmware.ino`](firmware/slynks_esp32_firmware.ino).
3. Install required libraries: `OneWire`, `DallasTemperature`, `DHT sensor library`, `ArduinoJson`, `WebSockets`.
4. Upload to your ESP32 board.

### 2. Connect to the Slynks Web App
- Open **[Official Website](https://husnain-tech-png.github.io/slynks-hydroponic-controller/)** or run `python server.py` locally on `http://localhost:8080`.
- Go to the **Device Pairing & Setup** tab.
- Click **"Connect USB Port (Web-Serial)"** and select your ESP32's COM port.
- Watch live sensor data populate the dashboard instantly!

---

## 🔒 Security & Admin Verification

- **Admin Passcode**: `admin123` (Default).
- Transaction ledger is saved with timestamp, sender number, and TRX ID.
- Status is strictly tracked across `PENDING`, `VERIFIED`, and `REJECTED`.
