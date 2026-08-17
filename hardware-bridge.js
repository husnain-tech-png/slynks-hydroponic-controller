/**
 * SLYNKS HYDROPONIC CONTROLLER - HARDWARE COMMUNICATION BRIDGE
 * Multi-protocol hardware interface supporting Web-Serial (USB), Local WiFi WebSocket/REST, and MQTT/Backend.
 * Strictly manages real physical hardware communication without fake/simulated telemetry.
 */

class SlynksHardwareBridge {
  constructor() {
    this.connectionType = 'none'; // 'serial', 'websocket', 'rest', 'none'
    this.status = 'DISCONNECTED'; // 'DISCONNECTED', 'CONNECTING', 'ONLINE', 'OFFLINE', 'ERROR'
    this.lastPacketTime = null;
    this.packetCount = 0;
    this.errorCount = 0;
    this.watchdogInterval = null;
    
    // Serial port handles (Web-Serial API)
    this.serialPort = null;
    this.serialReader = null;
    this.serialWriter = null;
    this.serialKeepReading = false;
    this.serialBaudRate = 115200;

    // Network handles
    this.socket = null;
    this.deviceIp = '192.168.4.1';
    this.pollInterval = null;

    // Event callbacks
    this.onTelemetryCallback = null;
    this.onStatusChangeCallback = null;
    this.onLogCallback = null;

    this.startWatchdog();
  }

  // Set callbacks
  onTelemetry(fn) { this.onTelemetryCallback = fn; }
  onStatusChange(fn) { this.onStatusChangeCallback = fn; }
  onLog(fn) { this.onLogCallback = fn; }

  log(msg, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    if (this.onLogCallback) {
      this.onLogCallback({ timestamp, msg, type });
    }
  }

  setStatus(newStatus, detail = '') {
    this.status = newStatus;
    this.log(`Hardware status: ${newStatus} ${detail ? `(${detail})` : ''}`, newStatus === 'ONLINE' ? 'success' : newStatus === 'ERROR' ? 'error' : 'info');
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(newStatus, detail);
    }
  }

  startWatchdog() {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    this.watchdogInterval = setInterval(() => {
      if (this.status === 'ONLINE' && this.lastPacketTime) {
        const elapsed = (Date.now() - this.lastPacketTime) / 1000;
        if (elapsed > 12) { // 12 seconds without telemetry packet
          this.setStatus('OFFLINE', `No heartbeat received for ${Math.round(elapsed)}s`);
        }
      }
    }, 2000);
  }

  // =========================================================================
  // PROTOCOL 1: WEB-SERIAL API (Direct USB connection to ESP32/Arduino)
  // =========================================================================

  isWebSerialSupported() {
    return 'serial' in navigator;
  }

  async connectSerial(baudRate = 115200) {
    if (!this.isWebSerialSupported()) {
      this.log('Web-Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.', 'error');
      throw new Error('Web-Serial API not supported');
    }

    try {
      this.setStatus('CONNECTING', 'Requesting serial port permission...');
      this.serialBaudRate = parseInt(baudRate) || 115200;
      
      // Prompt user to select USB Serial port
      this.serialPort = await navigator.serial.requestPort();
      await this.serialPort.open({ baudRate: this.serialBaudRate });
      
      this.connectionType = 'serial';
      this.serialKeepReading = true;
      this.setStatus('ONLINE', `USB Serial connected @ ${this.serialBaudRate} baud`);
      this.log('USB Serial connection established successfully.', 'success');

      // Start asynchronous read loop
      this.readSerialStream();
      return true;
    } catch (err) {
      this.setStatus('ERROR', err.message || 'Failed to open serial port');
      this.log(`Serial connection error: ${err.message}`, 'error');
      throw err;
    }
  }

  async readSerialStream() {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.serialPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    this.serialReader = reader;

    let buffer = '';

    try {
      while (this.serialKeepReading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          // Keep incomplete line in buffer
          buffer = lines.pop();

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine) {
              this.handleRawPacket(cleanLine);
            }
          }
        }
      }
    } catch (err) {
      this.log(`Serial read stream error: ${err.message}`, 'error');
      this.setStatus('ERROR', 'Serial stream read error');
    } finally {
      reader.releaseLock();
    }
  }

  async disconnectSerial() {
    this.serialKeepReading = false;
    if (this.serialReader) {
      try { await this.serialReader.cancel(); } catch (e) {}
      this.serialReader = null;
    }
    if (this.serialPort) {
      try { await this.serialPort.close(); } catch (e) {}
      this.serialPort = null;
    }
    this.connectionType = 'none';
    this.setStatus('DISCONNECTED', 'USB Serial disconnected by user');
  }

  // =========================================================================
  // PROTOCOL 2: LOCAL WIFI WEBSOCKET / REST API (ESP32 on LAN)
  // =========================================================================

  connectWebSocket(ip = '192.168.4.1', port = 81) {
    this.disconnect();
    this.deviceIp = ip.trim();
    const wsUrl = `ws://${this.deviceIp}:${port}/ws`;
    
    this.setStatus('CONNECTING', `Connecting to WebSocket at ${wsUrl}...`);
    try {
      this.socket = new WebSocket(wsUrl);
      this.connectionType = 'websocket';

      this.socket.onopen = () => {
        this.setStatus('ONLINE', `WebSocket connected to ESP32 at ${this.deviceIp}`);
        this.log(`Connected to WiFi hardware WebSocket: ${wsUrl}`, 'success');
        // Send initial handshake
        this.sendCommand({ cmd: 'GET_TELEMETRY' });
      };

      this.socket.onmessage = (event) => {
        this.handleRawPacket(event.data);
      };

      this.socket.onerror = (err) => {
        this.log(`WebSocket error connecting to ${wsUrl}`, 'error');
        this.setStatus('ERROR', 'WebSocket connection failed');
      };

      this.socket.onclose = () => {
        this.log('WebSocket connection closed.', 'warn');
        if (this.status !== 'DISCONNECTED') {
          this.setStatus('OFFLINE', 'Hardware connection closed');
        }
      };
    } catch (err) {
      this.setStatus('ERROR', err.message);
    }
  }

  connectRestPolling(ip = '192.168.4.1', intervalMs = 2000) {
    this.disconnect();
    this.deviceIp = ip.trim();
    this.connectionType = 'rest';
    this.setStatus('CONNECTING', `Polling ESP32 REST endpoint at http://${this.deviceIp}/api/telemetry...`);

    const poll = async () => {
      try {
        const resp = await fetch(`http://${this.deviceIp}/api/telemetry`, { signal: AbortSignal.timeout(3000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        this.processTelemetryPacket(data);
        if (this.status !== 'ONLINE') {
          this.setStatus('ONLINE', `REST API Active (${this.deviceIp})`);
        }
      } catch (err) {
        this.errorCount++;
        this.log(`REST poll error: ${err.message}`, 'warn');
        if (this.errorCount > 3) {
          this.setStatus('OFFLINE', 'ESP32 not responding on LAN');
        }
      }
    };

    poll();
    this.pollInterval = setInterval(poll, intervalMs);
  }

  // =========================================================================
  // PROTOCOL 3: BACKEND API INGESTION
  // =========================================================================

  connectBackendGateway(endpointUrl = '/api/hardware/telemetry', intervalMs = 2000) {
    this.disconnect();
    this.connectionType = 'backend';
    this.setStatus('CONNECTING', 'Connecting to Slynks Backend Gateway...');

    const poll = async () => {
      try {
        const resp = await fetch(endpointUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (data && data.online && data.telemetry) {
          this.processTelemetryPacket(data.telemetry);
          if (this.status !== 'ONLINE') {
            this.setStatus('ONLINE', `Backend Gateway Active (Device: ${data.deviceId || 'ESP32'})`);
          }
        } else {
          this.setStatus('OFFLINE', 'Hardware node reported offline by backend');
        }
      } catch (err) {
        this.log(`Backend hardware poll error: ${err.message}`, 'warn');
        this.setStatus('ERROR', 'Cannot reach backend hardware gateway');
      }
    };

    poll();
    this.pollInterval = setInterval(poll, intervalMs);
  }

  // =========================================================================
  // PACKET PARSING & TELEMETRY DISPATCHER
  // =========================================================================

  handleRawPacket(rawString) {
    rawString = rawString.trim();
    if (!rawString) return;

    this.log(`RAW RX: ${rawString}`, 'packet');

    // Try parsing JSON format: e.g. {"ph": 5.92, "ec": 1.41, "temp": 20.2, "level": 78, "do": 8.1, "humidity": 62, "air_temp": 24.1, "flow": 3.8}
    try {
      if (rawString.startsWith('{') && rawString.endsWith('}')) {
        const parsed = JSON.parse(rawString);
        this.processTelemetryPacket(parsed);
        return;
      }
    } catch (e) {
      // Not JSON, check CSV format
    }

    // Try parsing CSV format: "SLYNKS,PH,5.92,EC,1.41,TEMP,20.2,LEVEL,78,DO,8.1"
    if (rawString.startsWith('SLYNKS,') || rawString.includes(',')) {
      const parts = rawString.split(',');
      const obj = {};
      for (let i = 0; i < parts.length; i += 2) {
        const key = parts[i].trim().toLowerCase();
        const val = parseFloat(parts[i + 1]);
        if (!isNaN(val)) obj[key] = val;
      }
      if (Object.keys(obj).length > 0) {
        this.processTelemetryPacket(obj);
        return;
      }
    }

    // Handle ACK or status response
    if (rawString.startsWith('ACK:')) {
      this.log(`Command ACK from hardware: ${rawString.substring(4)}`, 'success');
    }
  }

  processTelemetryPacket(data) {
    this.lastPacketTime = Date.now();
    this.packetCount++;

    if (this.status !== 'ONLINE') {
      this.setStatus('ONLINE', 'Receiving live sensor stream');
    }

    // Standardize field names from various firmware formats
    const standardized = {
      ph: data.ph !== undefined ? parseFloat(data.ph) : (data.pH !== undefined ? parseFloat(data.pH) : null),
      ec: data.ec !== undefined ? parseFloat(data.ec) : (data.EC !== undefined ? parseFloat(data.EC) : null),
      tds: data.tds !== undefined ? parseInt(data.tds) : (data.ec ? Math.round(data.ec * 500) : null),
      waterTemp: data.waterTemp !== undefined ? parseFloat(data.waterTemp) : (data.temp !== undefined ? parseFloat(data.temp) : (data.water_temp !== undefined ? parseFloat(data.water_temp) : null)),
      waterLevel: data.waterLevel !== undefined ? parseFloat(data.waterLevel) : (data.level !== undefined ? parseFloat(data.level) : (data.water_level !== undefined ? parseFloat(data.water_level) : null)),
      dissolvedOxygen: data.dissolvedOxygen !== undefined ? parseFloat(data.dissolvedOxygen) : (data.do !== undefined ? parseFloat(data.do) : (data.DO !== undefined ? parseFloat(data.DO) : null)),
      airTemp: data.airTemp !== undefined ? parseFloat(data.airTemp) : (data.air_temp !== undefined ? parseFloat(data.air_temp) : (data.roomTemp !== undefined ? parseFloat(data.roomTemp) : null)),
      airHumidity: data.airHumidity !== undefined ? parseFloat(data.airHumidity) : (data.humidity !== undefined ? parseFloat(data.humidity) : (data.air_humidity !== undefined ? parseFloat(data.air_humidity) : null)),
      lightPPFD: data.lightPPFD !== undefined ? parseFloat(data.lightPPFD) : (data.ppfd !== undefined ? parseFloat(data.ppfd) : (data.light !== undefined ? parseFloat(data.light) : null)),
      lightLux: data.lightLux !== undefined ? parseFloat(data.lightLux) : (data.lux !== undefined ? parseFloat(data.lux) : null),
      flowRate: data.flowRate !== undefined ? parseFloat(data.flowRate) : (data.flow !== undefined ? parseFloat(data.flow) : null),
      relays: data.relays || data.actuators || null,
      timestamp: new Date()
    };

    if (this.onTelemetryCallback) {
      this.onTelemetryCallback(standardized);
    }
  }

  // =========================================================================
  // HARDWARE COMMAND TRANSMISSION
  // =========================================================================

  async sendCommand(cmdPayload) {
    const payloadString = typeof cmdPayload === 'string' ? cmdPayload : JSON.stringify(cmdPayload);
    this.log(`TX Command: ${payloadString}`, 'command');

    if (this.connectionType === 'serial' && this.serialPort && this.serialPort.writable) {
      try {
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(this.serialPort.writable);
        const writer = textEncoder.writable.getWriter();
        await writer.write(payloadString + '\n');
        writer.releaseLock();
        return true;
      } catch (err) {
        this.log(`Failed to write to Serial port: ${err.message}`, 'error');
        throw err;
      }
    } else if (this.connectionType === 'websocket' && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(payloadString);
      return true;
    } else if (this.connectionType === 'rest') {
      try {
        const resp = await fetch(`http://${this.deviceIp}/api/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadString
        });
        return resp.ok;
      } catch (err) {
        this.log(`REST command error: ${err.message}`, 'error');
        throw err;
      }
    } else if (this.connectionType === 'backend') {
      try {
        const resp = await fetch('/api/hardware/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadString
        });
        return resp.ok;
      } catch (err) {
        this.log(`Backend control error: ${err.message}`, 'error');
        throw err;
      }
    } else {
      this.log('Cannot send command: No hardware communication channel is active.', 'warn');
      throw new Error('Hardware not connected');
    }
  }

  // Convenience methods for actuators
  async setRelay(relayPin, state) {
    return this.sendCommand({
      cmd: 'SET_RELAY',
      pin: relayPin, // 'V1' - 'V8' or 'RELAY_PUMP', etc.
      state: state ? 1 : 0
    });
  }

  async triggerDose(dosingType, amountMl) {
    return this.sendCommand({
      cmd: 'DOSE',
      type: dosingType, // 'PH_DOWN', 'PH_UP', 'NUT_A', 'NUT_B'
      ml: parseFloat(amountMl) || 5
    });
  }

  disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.socket) {
      try { this.socket.close(); } catch (e) {}
      this.socket = null;
    }
    if (this.connectionType === 'serial') {
      this.disconnectSerial();
    }
    this.connectionType = 'none';
    this.setStatus('DISCONNECTED', 'Hardware connection stopped');
  }
}

window.SlynksHardwareBridge = SlynksHardwareBridge;
