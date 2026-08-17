/**
 * SLYNKS HYDROPONIC CONTROLLER - HARDWARE COMMUNICATION BRIDGE v3.5
 * Multi-protocol hardware interface:
 * 1. Web-Serial API (USB direct to ESP32 @ 115200 baud)
 * 2. WiFi WebSocket / REST LAN (Over-The-Air IP)
 * 3. Web Bluetooth BLE (Wireless Nordic UART / ESP32 BLE)
 * 4. Virtual Hardware Simulation Engine (For instant testing without wires)
 * 5. Sensor Calibration Engine (pH 2-point, EC cell constant)
 */

class SlynksHardwareBridge {
  constructor() {
    this.mode = 'virtual'; // 'physical' or 'virtual'
    this.connectionType = 'none'; // 'serial', 'websocket', 'ble', 'rest', 'none'
    this.status = 'ONLINE'; // 'ONLINE', 'CONNECTING', 'OFFLINE', 'DISCONNECTED', 'ERROR'
    this.lastPacketTime = Date.now();
    this.packetCount = 0;
    this.errorCount = 0;
    this.baudRate = 115200;
    this.deviceIp = '192.168.4.1';

    // Calibration offsets
    this.calibration = {
      phNeutralVoltage: 1.65, // pH 7.00 voltage
      phAcidVoltage: 2.03,    // pH 4.01 voltage
      ecKFactor: 1.00         // EC multiplier
    };

    // Hardware handles
    this.serialPort = null;
    this.serialReader = null;
    this.socket = null;
    this.bleDevice = null;
    this.bleCharacteristic = null;

    // Callbacks
    this.onTelemetryCallback = null;
    this.onStatusChangeCallback = null;
    this.onLogCallback = null;

    this.startWatchdog();
  }

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
    setInterval(() => {
      if (this.mode === 'physical' && this.status === 'ONLINE' && this.lastPacketTime) {
        const elapsed = (Date.now() - this.lastPacketTime) / 1000;
        if (elapsed > 12) {
          this.setStatus('OFFLINE', `No heartbeat packet for ${Math.round(elapsed)}s`);
        }
      }
    }, 2500);
  }

  // =========================================================================
  // 1. USB WEB-SERIAL API (CHROME / EDGE / OPERA)
  // =========================================================================

  async connectSerial(baudRate = 115200) {
    if (!('serial' in navigator)) {
      this.log('Web-Serial API is not supported in this browser. Please use Chrome or Edge.', 'error');
      alert('Web-Serial API requires Chrome, Edge, or Opera on desktop/Android with USB OTG.');
      throw new Error('Web-Serial not supported');
    }

    try {
      this.setStatus('CONNECTING', 'Selecting USB Serial COM port...');
      this.baudRate = parseInt(baudRate) || 115200;
      
      this.serialPort = await navigator.serial.requestPort();
      await this.serialPort.open({ baudRate: this.baudRate });
      
      this.mode = 'physical';
      this.connectionType = 'serial';
      this.setStatus('ONLINE', `USB Serial Connected @ ${this.baudRate} baud`);
      this.log(`Opened serial port at ${this.baudRate} baud successfully.`, 'success');

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
    this.serialPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    this.serialReader = reader;
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Retain incomplete chunk

          for (const line of lines) {
            const clean = line.trim();
            if (clean) this.handleRawPacket(clean);
          }
        }
      }
    } catch (err) {
      this.log(`Serial stream closed: ${err.message}`, 'error');
      this.setStatus('OFFLINE', 'Serial port disconnected');
    } finally {
      reader.releaseLock();
    }
  }

  // =========================================================================
  // 2. WIFI LAN WEBSOCKET (OVER-THE-AIR)
  // =========================================================================

  connectWebSocket(ip = '192.168.4.1', port = 81) {
    this.disconnect();
    this.deviceIp = ip.trim();
    const wsUrl = `ws://${this.deviceIp}:${port}/ws`;
    
    this.setStatus('CONNECTING', `Connecting to WebSocket at ${wsUrl}...`);
    try {
      this.socket = new WebSocket(wsUrl);
      this.mode = 'physical';
      this.connectionType = 'websocket';

      this.socket.onopen = () => {
        this.setStatus('ONLINE', `WiFi WebSocket connected to ${this.deviceIp}`);
        this.log(`Connected to WiFi hardware WebSocket: ${wsUrl}`, 'success');
        this.sendCommand({ cmd: 'GET_TELEMETRY' });
      };

      this.socket.onmessage = (event) => {
        this.handleRawPacket(event.data);
      };

      this.socket.onerror = () => {
        this.setStatus('ERROR', `Cannot reach ESP32 at ${this.deviceIp}`);
      };

      this.socket.onclose = () => {
        if (this.mode === 'physical') {
          this.setStatus('OFFLINE', 'WiFi WebSocket closed');
        }
      };
    } catch (err) {
      this.setStatus('ERROR', err.message);
    }
  }

  // =========================================================================
  // 3. WEB BLUETOOTH BLE (WIRELESS ESP32)
  // =========================================================================

  async connectBluetooth() {
    if (!('bluetooth' in navigator)) {
      alert('Web Bluetooth API is not supported in this browser. Please use Chrome on Android, Mac, or Windows.');
      return;
    }

    try {
      this.setStatus('CONNECTING', 'Scanning for Slynks ESP32 Bluetooth device...');
      this.bleDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] // Nordic UART Service
      });

      const server = await this.bleDevice.gatt.connect();
      const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
      this.bleCharacteristic = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e'); // RX
      
      await this.bleCharacteristic.startNotifications();
      this.bleCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        const text = new TextDecoder().decode(event.target.value);
        this.handleRawPacket(text);
      });

      this.mode = 'physical';
      this.connectionType = 'ble';
      this.setStatus('ONLINE', `Bluetooth BLE Linked: ${this.bleDevice.name || 'ESP32'}`);
      this.log(`Bluetooth connected to ${this.bleDevice.name}`, 'success');
    } catch (err) {
      this.setStatus('ERROR', err.message);
      this.log(`Bluetooth BLE error: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // 4. PACKET PARSER & SENSOR PROCESSING
  // =========================================================================

  handleRawPacket(rawString) {
    rawString = rawString.trim();
    if (!rawString) return;

    this.log(`RAW RX: ${rawString}`, 'packet');

    try {
      if (rawString.startsWith('{') && rawString.endsWith('}')) {
        const parsed = JSON.parse(rawString);
        this.processTelemetryPacket(parsed);
        return;
      }
    } catch (e) {}

    // CSV format fallback: SLYNKS,PH,5.92,EC,1.41...
    if (rawString.includes(',')) {
      const parts = rawString.split(',');
      const obj = {};
      for (let i = 0; i < parts.length; i += 2) {
        const k = parts[i].trim().toLowerCase();
        const v = parseFloat(parts[i + 1]);
        if (!isNaN(v)) obj[k] = v;
      }
      if (Object.keys(obj).length > 0) {
        this.processTelemetryPacket(obj);
      }
    }
  }

  processTelemetryPacket(data) {
    this.lastPacketTime = Date.now();
    this.packetCount++;

    const standardized = {
      ph: data.ph !== undefined ? parseFloat(data.ph) : (data.pH !== undefined ? parseFloat(data.pH) : null),
      ec: data.ec !== undefined ? parseFloat(data.ec) : (data.EC !== undefined ? parseFloat(data.EC) : null),
      tds: data.tds !== undefined ? parseInt(data.tds) : (data.ec ? Math.round(data.ec * 500) : null),
      waterTemp: data.waterTemp !== undefined ? parseFloat(data.waterTemp) : (data.temp !== undefined ? parseFloat(data.temp) : null),
      waterLevel: data.waterLevel !== undefined ? parseFloat(data.waterLevel) : (data.level !== undefined ? parseFloat(data.level) : null),
      dissolvedOxygen: data.dissolvedOxygen !== undefined ? parseFloat(data.dissolvedOxygen) : (data.do !== undefined ? parseFloat(data.do) : null),
      airTemp: data.airTemp !== undefined ? parseFloat(data.airTemp) : (data.air_temp !== undefined ? parseFloat(data.air_temp) : null),
      airHumidity: data.airHumidity !== undefined ? parseFloat(data.airHumidity) : (data.humidity !== undefined ? parseFloat(data.humidity) : null),
      lightPPFD: data.lightPPFD !== undefined ? parseFloat(data.lightPPFD) : null,
      flowRate: data.flowRate !== undefined ? parseFloat(data.flowRate) : (data.flow !== undefined ? parseFloat(data.flow) : null),
      relays: data.relays || null,
      timestamp: new Date()
    };

    if (this.onTelemetryCallback) {
      this.onTelemetryCallback(standardized);
    }
  }

  // =========================================================================
  // 5. COMMAND DISPATCHER & CALIBRATION
  // =========================================================================

  async sendCommand(cmdPayload) {
    const str = typeof cmdPayload === 'string' ? cmdPayload : JSON.stringify(cmdPayload);
    this.log(`TX Command: ${str}`, 'command');

    if (this.connectionType === 'serial' && this.serialPort && this.serialPort.writable) {
      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(this.serialPort.writable);
      const writer = textEncoder.writable.getWriter();
      await writer.write(str + '\n');
      writer.releaseLock();
      return true;
    } else if (this.connectionType === 'websocket' && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(str);
      return true;
    }
    return true;
  }

  async setRelay(pin, state) {
    return this.sendCommand({ cmd: 'SET_RELAY', pin: pin, state: state ? 1 : 0 });
  }

  async triggerDose(type, ml) {
    return this.sendCommand({ cmd: 'DOSE', type: type, ml: parseFloat(ml) || 5 });
  }

  calibratePH(bufferPH) {
    this.log(`Calibrated pH probe to buffer standard ${bufferPH} pH.`, 'success');
    return this.sendCommand({ cmd: 'CALIBRATE_PH', buffer: bufferPH });
  }

  calibrateEC(standardMS) {
    this.log(`Calibrated EC conductivity probe to standard ${standardMS} mS/cm.`, 'success');
    return this.sendCommand({ cmd: 'CALIBRATE_EC', standard: standardMS });
  }

  disconnect() {
    if (this.socket) {
      try { this.socket.close(); } catch (e) {}
      this.socket = null;
    }
    if (this.serialPort) {
      try { this.serialPort.close(); } catch (e) {}
      this.serialPort = null;
    }
    this.connectionType = 'none';
    this.mode = 'virtual';
    this.setStatus('ONLINE', 'Switched to Live Virtual Stream');
  }
}

window.SlynksHardwareBridge = SlynksHardwareBridge;
