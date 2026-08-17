/*
 * ================================================================================================
 * SLYNKS HYDROPONIC CONTROLLER - ESP32 FIRMWARE v3.0 (PRODUCTION HARDWARE DRIVER)
 * ================================================================================================
 * 
 * Hardware Architecture:
 * - ESP-WROOM-32 / NodeMCU-32S Dual-Core 240MHz Microcontroller
 * - Analog pH Sensor Probe (0.00 - 14.00 pH) connected to GPIO 34 (ADC1_CH6)
 * - Analog EC / TDS Conductivity Probe (0 - 4.0 mS/cm) connected to GPIO 35 (ADC1_CH7)
 * - DS18B20 OneWire Digital Water Temperature Sensor connected to GPIO 4
 * - HC-SR04 Ultrasonic Distance Sensor for Tank Level (Trig: GPIO 14, Echo: GPIO 12)
 * - DHT22 / AM2302 Ambient Room Temperature & Humidity Sensor connected to GPIO 21
 * - Water Flow Hall Effect Sensor connected to GPIO 13
 * - 8-Channel Optocoupled Relay Board & MOSFETs:
 *   * Relay 1: Circulation Water Pump (GPIO 25)
 *   * Relay 2: Peristaltic pH Down Dosing Pump (GPIO 26)
 *   * Relay 3: Peristaltic pH Up Dosing Pump (GPIO 27)
 *   * Relay 4: Peristaltic Nutrient A Dosing Pump (GPIO 32)
 *   * Relay 5: Peristaltic Nutrient B Dosing Pump (GPIO 33)
 *   * Relay 6: Air Stone Oxygen Bubbler (GPIO 19)
 *   * Relay 7: Canopy Exhaust & Cooling Fan (GPIO 22)
 *   * MOSFET / PWM: Full Spectrum Grow LED Light (GPIO 18)
 *
 * Communication Modes:
 * 1. Direct USB Serial Protocol: 115200 Baud JSON Datastream
 * 2. WiFi WebServer & WebSocket Server: Broadcasts live JSON packets & receives commands
 * 3. Blynk Cloud IoT: Compatible with Blynk Virtual Pins V0 - V8
 * ================================================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <ArduinoJson.h> // Library: ArduinoJson by Benoit Blanchon (v6 or v7)

// ------------------------------------------------------------------------------------------------
// 1. PIN DEFINITIONS
// ------------------------------------------------------------------------------------------------
#define PIN_PH_SENSOR          34
#define PIN_EC_SENSOR          35
#define PIN_WATER_TEMP_ONEWIRE  4
#define PIN_ULTRASONIC_TRIG    14
#define PIN_ULTRASONIC_ECHO    12
#define PIN_DHT_SENSOR         21
#define PIN_FLOW_SENSOR        13

// Actuator & Relay Pins
#define PIN_RELAY_PUMP         25
#define PIN_RELAY_PH_DOWN      26
#define PIN_RELAY_PH_UP        27
#define PIN_RELAY_NUT_A        32
#define PIN_RELAY_NUT_B        33
#define PIN_RELAY_AERATOR      19
#define PIN_RELAY_FAN          22
#define PIN_PWM_GROW_LIGHT     18

// ------------------------------------------------------------------------------------------------
// 2. CONFIGURATION & CALIBRATION CONSTANTS
// ------------------------------------------------------------------------------------------------
const char* WIFI_SSID     = "Your_WiFi_Name";        // Change to your WiFi SSID
const char* WIFI_PASSWORD = "Your_WiFi_Password";    // Change to your WiFi Password
const int   TANK_HEIGHT_CM = 45;                     // Total internal reservoir depth in cm
const int   TANK_EMPTY_CM  = 40;                     // Distance from sensor to empty water line
const int   TANK_FULL_CM   = 8;                      // Distance from sensor to full water line

// Analog Calibration Offsets
float pH_Neutral_Voltage = 1.65; // Voltage at pH 7.00
float pH_Acid_Voltage    = 2.03; // Voltage at pH 4.01
float pH_Slope           = -3.5; // Calibrated slope
float EC_K_Factor        = 1.00; // Cell constant multiplier

// ------------------------------------------------------------------------------------------------
// 3. OBJECT INITIALIZATIONS
// ------------------------------------------------------------------------------------------------
OneWire oneWire(PIN_WATER_TEMP_ONEWIRE);
DallasTemperature waterTempSensor(&oneWire);
DHT dht(PIN_DHT_SENSOR, DHT22);
WebServer server(80);
WebSocketsServer webSocket(81);

// Telemetry State
struct TelemetryData {
  float ph;
  float ec;
  int tds;
  float waterTemp;
  float waterLevel;
  float dissolvedOxygen;
  float airTemp;
  float airHumidity;
  float flowRate;
  int lightPWM;
  bool pumpState;
  bool lightState;
  bool aeratorState;
  bool fanState;
} hydro;

volatile unsigned long flowPulseCount = 0;
unsigned long lastTelemetryMillis = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 1000; // Stream every 1 second

// Interrupt Service Routine for Flow Sensor
void IRAM_ATTR flowPulseCounter() {
  flowPulseCount++;
}

// ------------------------------------------------------------------------------------------------
// 4. SENSOR READING ROUTINES
// ------------------------------------------------------------------------------------------------

// Read calibrated pH from analog voltage (over 10 samples)
float readPHSensor() {
  long totalAnalog = 0;
  for (int i = 0; i < 10; i++) {
    totalAnalog += analogRead(PIN_PH_SENSOR);
    delay(5);
  }
  float avgRaw = totalAnalog / 10.0;
  float voltage = avgRaw * (3.3 / 4095.0);
  
  // Two-point calibration formula: pH = 7.0 + ((NeutralVoltage - Voltage) * Slope)
  float phValue = 7.0 + ((pH_Neutral_Voltage - voltage) * pH_Slope);
  if (phValue < 0.0) phValue = 0.0;
  if (phValue > 14.0) phValue = 14.0;
  return phValue;
}

// Read EC (Electrical Conductivity) in mS/cm with temperature compensation
float readECSensor(float waterTemperature) {
  long totalAnalog = 0;
  for (int i = 0; i < 10; i++) {
    totalAnalog += analogRead(PIN_EC_SENSOR);
    delay(5);
  }
  float avgRaw = totalAnalog / 10.0;
  float voltage = avgRaw * (3.3 / 4095.0);
  
  // Standard temperature compensation coefficient (2% per °C)
  float tempCoeff = 1.0 + 0.02 * (waterTemperature - 25.0);
  float compensatedVoltage = voltage / tempCoeff;
  
  // EC in mS/cm
  float ecValue = (compensatedVoltage * 1.85) * EC_K_Factor;
  if (ecValue < 0.0) ecValue = 0.0;
  return ecValue;
}

// Read DS18B20 Water Temperature
float readWaterTemperature() {
  waterTempSensor.requestTemperatures();
  float tempC = waterTempSensor.getTempCByIndex(0);
  if (tempC < -50.0 || tempC > 85.0) {
    return 20.0; // Fallback in case of probe disconnection
  }
  return tempC;
}

// Read HC-SR04 Ultrasonic Distance and Convert to Tank Level Percentage (0 - 100%)
float readWaterLevelPercent() {
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
  
  long duration = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, 30000); // 30ms timeout
  if (duration == 0) return hydro.waterLevel; // Retain previous if no echo
  
  float distanceCm = duration * 0.0343 / 2.0;
  
  // Map distance to percentage
  float waterDepth = TANK_EMPTY_CM - distanceCm;
  float totalWaterRange = TANK_EMPTY_CM - TANK_FULL_CM;
  float percent = (waterDepth / totalWaterRange) * 100.0;
  
  if (percent < 0.0) percent = 0.0;
  if (percent > 100.0) percent = 100.0;
  return percent;
}

// Calculate Dissolved Oxygen based on water temperature saturation & aeration
float calculateDissolvedOxygen(float waterTemp, bool aeratorActive) {
  // Fresh water DO saturation: DO (mg/L) = 14.652 - 0.41022*T + 0.007991*T^2 - 0.000077774*T^3
  float T = waterTemp;
  float saturationDO = 14.652 - (0.41022 * T) + (0.007991 * T * T) - (0.000077774 * T * T * T);
  float actualDO = aeratorActive ? (saturationDO * 0.92) : (saturationDO * 0.65);
  return actualDO;
}

// Read Water Flow Sensor (Liters per Minute)
float readFlowRate() {
  // Flow sensor calibration: pulses / 7.5 = Liters/min
  float flowLPM = (flowPulseCount / 7.5);
  flowPulseCount = 0; // Reset pulse count
  return flowLPM;
}

// ------------------------------------------------------------------------------------------------
// 5. COMMAND PROCESSING & ACTUATOR CONTROL
// ------------------------------------------------------------------------------------------------

void executeCommand(String jsonString) {
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, jsonString);
  if (error) {
    Serial.println("{\"error\":\"Invalid JSON\"}");
    return;
  }

  const char* cmd = doc["cmd"];
  
  // Command: SET_RELAY
  if (strcmp(cmd, "SET_RELAY") == 0) {
    const char* pin = doc["pin"];
    int state = doc["state"];
    
    if (strcmp(pin, "V1") == 0 || strcmp(pin, "RELAY_PUMP") == 0) {
      digitalWrite(PIN_RELAY_PUMP, state ? HIGH : LOW);
      hydro.pumpState = state;
    } else if (strcmp(pin, "V2") == 0 || strcmp(pin, "RELAY_LIGHT") == 0) {
      digitalWrite(PIN_PWM_GROW_LIGHT, state ? HIGH : LOW);
      hydro.lightState = state;
    } else if (strcmp(pin, "V3") == 0 || strcmp(pin, "RELAY_AERATOR") == 0) {
      digitalWrite(PIN_RELAY_AERATOR, state ? HIGH : LOW);
      hydro.aeratorState = state;
    } else if (strcmp(pin, "V4") == 0 || strcmp(pin, "RELAY_FAN") == 0) {
      digitalWrite(PIN_RELAY_FAN, state ? HIGH : LOW);
      hydro.fanState = state;
    }
    
    Serial.printf("ACK:RELAY_%s_%d\n", pin, state);
  }
  
  // Command: DOSE (Peristaltic Pump Timed Pulse)
  else if (strcmp(cmd, "DOSE") == 0) {
    const char* type = doc["type"];
    float ml = doc["ml"];
    if (ml <= 0) ml = 5;
    
    // Peristaltic doser flow rate: ~1.2 ml per second (12V 100RPM pump)
    unsigned long runTimeMs = (unsigned long)((ml / 1.2) * 1000);
    int targetPin = -1;
    
    if (strcmp(type, "PH_DOWN") == 0) targetPin = PIN_RELAY_PH_DOWN;
    else if (strcmp(type, "PH_UP") == 0) targetPin = PIN_RELAY_PH_UP;
    else if (strcmp(type, "NUT_A") == 0) targetPin = PIN_RELAY_NUT_A;
    else if (strcmp(type, "NUT_B") == 0) targetPin = PIN_RELAY_NUT_B;
    
    if (targetPin != -1) {
      digitalWrite(targetPin, HIGH);
      delay(runTimeMs);
      digitalWrite(targetPin, LOW);
      Serial.printf("ACK:DOSED_%s_%.1f_ML\n", type, ml);
    }
  }
}

// ------------------------------------------------------------------------------------------------
// 6. JSON TELEMETRY SERIAL & WEBSOCKET DISPATCHER
// ------------------------------------------------------------------------------------------------

void broadcastTelemetry() {
  StaticJsonDocument<384> doc;
  doc["ph"] = serialized(String(hydro.ph, 2));
  doc["ec"] = serialized(String(hydro.ec, 2));
  doc["tds"] = hydro.tds;
  doc["waterTemp"] = serialized(String(hydro.waterTemp, 1));
  doc["waterLevel"] = serialized(String(hydro.waterLevel, 1));
  doc["dissolvedOxygen"] = serialized(String(hydro.dissolvedOxygen, 1));
  doc["airTemp"] = serialized(String(hydro.airTemp, 1));
  doc["airHumidity"] = serialized(String(hydro.airHumidity, 0));
  doc["flowRate"] = serialized(String(hydro.flowRate, 1));
  doc["lightPPFD"] = hydro.lightState ? 340 : 0;
  
  JsonObject relays = doc.createNestedObject("relays");
  relays["pump"] = hydro.pumpState ? 1 : 0;
  relays["light"] = hydro.lightState ? 1 : 0;
  relays["aerator"] = hydro.aeratorState ? 1 : 0;
  relays["fan"] = hydro.fanState ? 1 : 0;

  String output;
  serializeJson(doc, output);
  
  // 1. Output to USB Serial (for Web-Serial API in browser)
  Serial.println(output);
  
  // 2. Broadcast to connected WebSockets clients (for WiFi LAN dashboard)
  webSocket.broadcastTXT(output);
}

// WebSocket Event Handler
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_TEXT) {
    String cmdStr = String((char*)payload);
    executeCommand(cmdStr);
  }
}

// ------------------------------------------------------------------------------------------------
// 7. SETUP & MAIN LOOP
// ------------------------------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 2000); // USB CDC stabilization
  
  // Configure Pins
  pinMode(PIN_PH_SENSOR, INPUT);
  pinMode(PIN_EC_SENSOR, INPUT);
  pinMode(PIN_ULTRASONIC_TRIG, OUTPUT);
  pinMode(PIN_ULTRASONIC_ECHO, INPUT);
  pinMode(PIN_FLOW_SENSOR, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW_SENSOR), flowPulseCounter, RISING);

  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_RELAY_PH_DOWN, OUTPUT);
  pinMode(PIN_RELAY_PH_UP, OUTPUT);
  pinMode(PIN_RELAY_NUT_A, OUTPUT);
  pinMode(PIN_RELAY_NUT_B, OUTPUT);
  pinMode(PIN_RELAY_AERATOR, OUTPUT);
  pinMode(PIN_RELAY_FAN, OUTPUT);
  pinMode(PIN_PWM_GROW_LIGHT, OUTPUT);

  // Initialize Default Relay States
  digitalWrite(PIN_RELAY_PUMP, HIGH); // Pump ON
  digitalWrite(PIN_RELAY_AERATOR, HIGH); // Aerator ON
  digitalWrite(PIN_PWM_GROW_LIGHT, HIGH); // Light ON
  hydro.pumpState = true;
  hydro.aeratorState = true;
  hydro.lightState = true;
  hydro.fanState = false;

  // Initialize Sensors
  waterTempSensor.begin();
  dht.begin();

  // Initialize WiFi & Web Services
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("SLYNKS-ESP32-HYDRO", "slynks1234"); // Broadcasts Access Point if no router
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  // REST API Route
  server.on("/api/telemetry", HTTP_GET, []() {
    StaticJsonDocument<384> doc;
    doc["ph"] = hydro.ph;
    doc["ec"] = hydro.ec;
    doc["tds"] = hydro.tds;
    doc["waterTemp"] = hydro.waterTemp;
    doc["waterLevel"] = hydro.waterLevel;
    doc["dissolvedOxygen"] = hydro.dissolvedOxygen;
    doc["airTemp"] = hydro.airTemp;
    doc["airHumidity"] = hydro.airHumidity;
    doc["flowRate"] = hydro.flowRate;
    String res;
    serializeJson(doc, res);
    server.send(200, "application/json", res);
  });
  
  server.begin();
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  Serial.println("{\"status\":\"READY\",\"firmware\":\"SLYNKS_ESP32_v3.0\"}");
}

void loop() {
  server.handleClient();
  webSocket.loop();
  
  // Process incoming USB Serial commands
  if (Serial.available() > 0) {
    String serialLine = Serial.readStringUntil('\n');
    serialLine.trim();
    if (serialLine.length() > 0) {
      executeCommand(serialLine);
    }
  }

  // Periodic Telemetry Acquisition & Broadcast
  unsigned long currentMillis = millis();
  if (currentMillis - lastTelemetryMillis >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMillis = currentMillis;

    // Collect real physical sensor readings
    hydro.waterTemp = readWaterTemperature();
    hydro.ph = readPHSensor();
    hydro.ec = readECSensor(hydro.waterTemp);
    hydro.tds = (int)(hydro.ec * 500);
    hydro.waterLevel = readWaterLevelPercent();
    hydro.dissolvedOxygen = calculateDissolvedOxygen(hydro.waterTemp, hydro.aeratorState);
    hydro.airTemp = dht.readTemperature();
    hydro.airHumidity = dht.readHumidity();
    hydro.flowRate = readFlowRate();

    // Fallbacks if DHT is still warming up
    if (isnan(hydro.airTemp)) hydro.airTemp = 24.0;
    if (isnan(hydro.airHumidity)) hydro.airHumidity = 60.0;

    // Broadcast live telemetry
    broadcastTelemetry();
  }
}
