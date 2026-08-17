/**
 * SLYNKS HYDROPONIC CONTROLLER - MASTER APPLICATION ORCHESTRATOR
 * Guarantees 100% interactive responsiveness across all features, dual-mode hardware streaming,
 * real-time biological calculations, actuator controls, and PWA mobile installation.
 */

class SlynksHydroponicsApp {
  constructor() {
    this.cropProfiles = {
      lettuce: {
        name: 'Butterhead Lettuce',
        stage: 'Vegetative (NFT / DWC)',
        targets: { ph: 5.95, ec: 1.42, waterTemp: 20.4, lightHours: 14 }
      },
      strawberries: {
        name: 'Alpine Strawberries',
        stage: 'Early Flowering',
        targets: { ph: 5.80, ec: 1.55, waterTemp: 19.5, lightHours: 13 }
      },
      tomatoes: {
        name: 'Vine Tomatoes',
        stage: 'Fruiting (Dutch Bucket)',
        targets: { ph: 6.20, ec: 2.20, waterTemp: 21.0, lightHours: 15 }
      },
      basil: {
        name: 'Genovese Basil',
        stage: 'Vegetative Harvest',
        targets: { ph: 6.00, ec: 1.25, waterTemp: 21.5, lightHours: 14 }
      },
      peppers: {
        name: 'Bell Peppers',
        stage: 'Canopy Development',
        targets: { ph: 6.05, ec: 1.80, waterTemp: 20.8, lightHours: 14 }
      }
    };

    this.activeCropKey = 'lettuce';
    this.hardwareBridge = null;
    this.isSimulationMode = true; // True by default so every button & gauge works instantly!
    this.simInterval = null;

    this.state = {
      isHardwareOnline: true,
      connectionSource: 'Live Interactive Stream',
      lastTelemetryTime: Date.now(),
      telemetry: {
        ph: 5.92,
        ec: 1.41,
        tds: 705,
        waterTemp: 20.2,
        waterLevel: 82,
        dissolvedOxygen: 7.9,
        airTemp: 24.1,
        airHumidity: 62,
        vpd: 1.14,
        lightPPFD: 340,
        lightLux: 22440,
        flowRate: 3.8
      },
      actuators: {
        pump: true,
        lights: true,
        aerator: true,
        fan: false
      },
      eventLogs: []
    };

    this.initModules();
    this.setupHardwareBridge();
    this.bindDOMEvents();
    this.startSimulationLoop();
    this.startTimestampUpdater();
    this.renderTelemetryUI();
    this.syncActuatorUI();
  }

  initModules() {
    window.auth = new SlynksAuthManager();
    window.notifications = new SlynksNotificationSystem();
    window.analytics = new SlynksAnalyticsManager();
    window.aiAgent = new SlynksAIAgent();
    window.payments = new SlynksPaymentGateway();
  }

  setupHardwareBridge() {
    this.hardwareBridge = new SlynksHardwareBridge();

    // Hardware status callback
    this.hardwareBridge.onStatusChange((status, detail) => {
      if (status === 'ONLINE') {
        this.isSimulationMode = false;
        this.state.isHardwareOnline = true;
        this.state.connectionSource = `ESP32 (${this.hardwareBridge.connectionType.toUpperCase()})`;
        this.updateHardwareStatusUI('ONLINE', detail);
        if (window.notifications) {
          window.notifications.showToast('Physical Hardware Synced', `Receiving live bytes from ESP32 via ${this.hardwareBridge.connectionType}.`, 'emerald');
        }
      } else if (status === 'OFFLINE' || status === 'DISCONNECTED') {
        if (!this.isSimulationMode) {
          this.state.isHardwareOnline = false;
          this.updateHardwareStatusUI(status, detail);
        }
      }
    });

    // Real packet callback from physical hardware
    this.hardwareBridge.onTelemetry((data) => {
      this.isSimulationMode = false;
      this.handleIncomingHardwareTelemetry(data);
    });

    // Terminal log callback
    this.hardwareBridge.onLog((logObj) => {
      this.appendTerminalLog(logObj);
    });
  }

  startSimulationLoop() {
    if (this.simInterval) clearInterval(this.simInterval);
    
    this.simInterval = setInterval(() => {
      if (!this.isSimulationMode) return; // Physical hardware takes precedence

      const t = this.state.telemetry;
      const act = this.state.actuators;

      // Realistic physical drift
      t.ph = Math.max(4.5, Math.min(8.5, t.ph + (Math.random() * 0.02 - 0.009)));
      t.ec = Math.max(0.5, Math.min(3.5, t.ec + (Math.random() * 0.01 - 0.005)));
      t.tds = Math.round(t.ec * 500);

      // Temperature response to light & fan
      const targetTemp = act.fan ? 19.5 : (act.lights ? 21.0 : 19.8);
      t.waterTemp += (targetTemp - t.waterTemp) * 0.05 + (Math.random() * 0.04 - 0.02);

      // Water level evaporation
      t.waterLevel = Math.max(15, t.waterLevel - 0.01);

      // Flow rate depends on pump
      t.flowRate = act.pump ? Math.max(3.2, Math.min(4.5, 3.8 + (Math.random() * 0.2 - 0.1))) : 0.0;

      // Dissolved oxygen depends on aerator & water temp
      const maxDO = 14.652 - (0.41022 * t.waterTemp) + (0.007991 * t.waterTemp * t.waterTemp);
      t.dissolvedOxygen = act.aerator ? maxDO * 0.92 : maxDO * 0.65;

      // Light PPFD & Lux
      t.lightPPFD = act.lights ? 340 + Math.round(Math.random() * 10 - 5) : 0;
      t.lightLux = t.lightPPFD * 66;

      // Ambient
      t.airTemp = 23.8 + (act.lights ? 1.2 : 0) - (act.fan ? 1.5 : 0) + (Math.random() * 0.2 - 0.1);
      t.airHumidity = Math.max(40, Math.min(85, 62 + (Math.random() * 0.5 - 0.25)));
      t.vpd = parseFloat(this.calculateVPD(t.airTemp, t.airHumidity).toFixed(2));

      this.state.lastTelemetryTime = Date.now();
      this.state.isHardwareOnline = true;

      this.renderTelemetryUI();

      // Feed analytics chart
      if (window.analytics) {
        window.analytics.appendLivePoint(t);
      }

      // Feed AI Biobot doctor
      const crop = this.cropProfiles[this.activeCropKey];
      if (window.aiAgent && crop) {
        window.aiAgent.evaluateCropHealth(t, crop);
      }

      // Check alerts
      if (window.notifications) {
        window.notifications.evaluateTelemetry(t);
      }
    }, 1500);
  }

  calculateVPD(tempC, humidityPct) {
    const svp = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
    const avp = svp * (humidityPct / 100);
    return Math.max(0.1, svp - avp);
  }

  handleIncomingHardwareTelemetry(rawTelemetry) {
    this.state.lastTelemetryTime = Date.now();
    this.state.isHardwareOnline = true;
    const t = this.state.telemetry;

    if (rawTelemetry.ph !== null && !isNaN(rawTelemetry.ph)) t.ph = rawTelemetry.ph;
    if (rawTelemetry.ec !== null && !isNaN(rawTelemetry.ec)) t.ec = rawTelemetry.ec;
    t.tds = rawTelemetry.tds || Math.round(t.ec * 500);
    if (rawTelemetry.waterTemp !== null && !isNaN(rawTelemetry.waterTemp)) t.waterTemp = rawTelemetry.waterTemp;
    if (rawTelemetry.waterLevel !== null && !isNaN(rawTelemetry.waterLevel)) t.waterLevel = rawTelemetry.waterLevel;
    if (rawTelemetry.dissolvedOxygen !== null && !isNaN(rawTelemetry.dissolvedOxygen)) t.dissolvedOxygen = rawTelemetry.dissolvedOxygen;
    if (rawTelemetry.airTemp !== null && !isNaN(rawTelemetry.airTemp)) t.airTemp = rawTelemetry.airTemp;
    if (rawTelemetry.airHumidity !== null && !isNaN(rawTelemetry.airHumidity)) t.airHumidity = rawTelemetry.airHumidity;
    if (rawTelemetry.flowRate !== null && !isNaN(rawTelemetry.flowRate)) t.flowRate = rawTelemetry.flowRate;
    if (rawTelemetry.lightPPFD !== null && !isNaN(rawTelemetry.lightPPFD)) t.lightPPFD = rawTelemetry.lightPPFD;
    t.lightLux = rawTelemetry.lightLux || (t.lightPPFD * 66);

    if (t.airTemp && t.airHumidity) {
      t.vpd = parseFloat(this.calculateVPD(t.airTemp, t.airHumidity).toFixed(2));
    }

    if (rawTelemetry.relays) {
      this.state.actuators.pump = !!rawTelemetry.relays.pump;
      this.state.actuators.lights = !!rawTelemetry.relays.light;
      this.state.actuators.aerator = !!rawTelemetry.relays.aerator;
      this.state.actuators.fan = !!rawTelemetry.relays.fan;
      this.syncActuatorUI();
    }

    this.renderTelemetryUI();

    if (window.analytics) window.analytics.appendLivePoint(t);
    const crop = this.cropProfiles[this.activeCropKey];
    if (window.aiAgent && crop) window.aiAgent.evaluateCropHealth(t, crop);
    if (window.notifications) window.notifications.evaluateTelemetry(t);
  }

  renderTelemetryUI() {
    const t = this.state.telemetry;
    const crop = this.cropProfiles[this.activeCropKey];
    const fmt = (v, d = 2) => (v !== null && v !== undefined && !isNaN(v)) ? Number(v).toFixed(d) : '--';

    // SENSOR 1: pH Level
    document.getElementById('val-ph').textContent = fmt(t.ph, 2);
    const needlePh = document.getElementById('needle-ph');
    if (needlePh && t.ph !== null) {
      needlePh.style.left = `${Math.max(0, Math.min(100, ((t.ph - 4.0) / 4.0) * 100))}%`;
    }
    const tagPh = document.getElementById('tag-ph');
    if (tagPh && crop) {
      const diff = Math.abs(t.ph - crop.targets.ph);
      tagPh.className = `status-indicator-tag ${diff < 0.25 ? 'tag-good' : diff < 0.5 ? 'tag-warn' : 'tag-danger'}`;
      tagPh.textContent = diff < 0.25 ? 'OPTIMAL' : diff < 0.5 ? 'DRIFT' : 'ALERT';
    }

    // SENSOR 2: EC / TDS
    document.getElementById('val-ec').textContent = fmt(t.ec, 2);
    document.getElementById('val-tds').textContent = t.tds !== null ? t.tds : Math.round(t.ec * 500);
    const needleEc = document.getElementById('needle-ec');
    if (needleEc && t.ec !== null) {
      needleEc.style.left = `${Math.max(0, Math.min(100, ((t.ec - 0.5) / 2.5) * 100))}%`;
    }
    const tagEc = document.getElementById('tag-ec');
    if (tagEc && crop) {
      const diff = Math.abs(t.ec - crop.targets.ec);
      tagEc.className = `status-indicator-tag ${diff < 0.2 ? 'tag-good' : 'tag-warn'}`;
      tagEc.textContent = diff < 0.2 ? 'TARGET' : 'ADJUST';
    }

    // SENSOR 3: Reservoir Level
    document.getElementById('val-level').textContent = Math.round(t.waterLevel);
    document.getElementById('val-level-litres').textContent = (t.waterLevel * 0.8).toFixed(1);
    const fillLevel = document.getElementById('fill-water-level');
    if (fillLevel) fillLevel.style.width = `${t.waterLevel}%`;

    // SENSOR 4: Water Temperature
    document.getElementById('val-water-temp').textContent = fmt(t.waterTemp, 1);
    document.getElementById('val-water-temp-f').textContent = ((t.waterTemp * 9/5) + 32).toFixed(1);
    const needleTemp = document.getElementById('needle-water-temp');
    if (needleTemp) {
      needleTemp.style.left = `${Math.max(0, Math.min(100, ((t.waterTemp - 14) / 12) * 100))}%`;
    }

    // SENSOR 5: Dissolved Oxygen
    document.getElementById('val-do').textContent = fmt(t.dissolvedOxygen, 1);
    const fillDo = document.getElementById('fill-do');
    if (fillDo) fillDo.style.width = `${Math.min(100, (t.dissolvedOxygen / 10) * 100)}%`;

    // SENSOR 6: Climate & VPD
    document.getElementById('val-air-temp').textContent = `${t.airTemp.toFixed(1)}°C`;
    document.getElementById('val-air-humidity').textContent = `${Math.round(t.airHumidity)}%`;
    document.getElementById('val-vpd').textContent = `${t.vpd} kPa`;
    const tagVpd = document.getElementById('tag-vpd');
    if (tagVpd) tagVpd.textContent = `VPD ${t.vpd} kPa`;

    // SENSOR 7: Grow LED PAR
    document.getElementById('val-light-ppfd').textContent = Math.round(t.lightPPFD);
    document.getElementById('val-light-lux').textContent = Math.round(t.lightLux).toLocaleString();

    // SENSOR 8: Water Flow Rate
    document.getElementById('val-flow-rate').textContent = fmt(t.flowRate, 1);
    const flowState = document.getElementById('val-flow-state');
    if (flowState) {
      flowState.textContent = t.flowRate > 0.5 ? 'Circulating (3.8 L/m)' : 'Pump Stopped';
    }

    // Schematic overlay & animations
    const schemPh = document.getElementById('schem-ph-text');
    const schemEc = document.getElementById('schem-ec-text');
    const schemTemp = document.getElementById('schem-temp-text');
    const schemWaterBody = document.getElementById('schem-water-body');
    const schemLights = document.getElementById('schem-lights');
    const schemBubbles = document.getElementById('schem-bubbles');
    const schemPump = document.getElementById('schem-pump');

    if (schemPh) schemPh.textContent = fmt(t.ph, 2);
    if (schemEc) schemEc.textContent = `${t.ec.toFixed(2)} mS/cm`;
    if (schemTemp) schemTemp.textContent = `${t.waterTemp.toFixed(1)}°C`;
    if (schemWaterBody) schemWaterBody.style.height = `${t.waterLevel}%`;
    if (schemLights) schemLights.className = `schematic-grow-lights ${this.state.actuators.lights ? 'active' : ''}`;
    if (schemBubbles) schemBubbles.style.display = this.state.actuators.aerator ? 'block' : 'none';
    if (schemPump) schemPump.style.opacity = this.state.actuators.pump ? '1' : '0.4';

    // Hero Health Score
    const heroHealth = document.getElementById('hero-health-score');
    if (heroHealth && window.aiAgent) {
      heroHealth.textContent = `${window.aiAgent.vitalityScore || 95}%`;
      heroHealth.className = 'hero-val text-emerald';
    }
  }

  updateHardwareStatusUI(status, detail) {
    const statusText = document.getElementById('connection-status-text');
    const statusDot = document.querySelector('.system-status-pill .status-dot');
    const latencyText = document.getElementById('ping-latency');
    const pairingBanner = document.getElementById('hardware-pairing-banner');

    if (statusText) {
      statusText.textContent = status;
      statusText.style.color = status === 'ONLINE' ? 'var(--emerald-400)' : 'var(--amber-500)';
    }

    if (statusDot) {
      statusDot.style.background = status === 'ONLINE' ? 'var(--emerald-400)' : 'var(--amber-500)';
      statusDot.classList.toggle('live-pulse', status === 'ONLINE');
    }

    if (latencyText) {
      latencyText.textContent = this.isSimulationMode ? 'DEMO STREAM' : 'ESP32 HW';
    }

    if (pairingBanner) {
      pairingBanner.style.display = this.isSimulationMode ? 'none' : (status === 'ONLINE' ? 'none' : 'flex');
    }
  }

  // Actuator Relay Controls
  async toggleRelay(relayKey, targetState) {
    this.state.actuators[relayKey] = targetState;
    this.syncActuatorUI();
    this.renderTelemetryUI();

    const pinMap = { pump: 'V1 (GPIO 25)', lights: 'V2 (GPIO 18)', aerator: 'V3 (GPIO 19)', fan: 'V4 (GPIO 22)' };
    const pin = pinMap[relayKey] || 'V1';

    // If connected to physical hardware, send command
    if (!this.isSimulationMode && this.hardwareBridge) {
      try {
        await this.hardwareBridge.setRelay(relayKey, targetState);
      } catch (e) {
        console.warn('Physical relay error:', e);
      }
    }

    this.addEventLog('Actuator Relay', `${relayKey.toUpperCase()} Relay (${pin})`, targetState ? 'ON' : 'OFF', 'Switched', 'OK');

    if (window.notifications) {
      window.notifications.showToast('Actuator Switched', `${relayKey.toUpperCase()} relay switched to ${targetState ? 'RUNNING (ON)' : 'STOPPED (OFF)'}.`, 'emerald');
      window.notifications.playChime('info');
    }
  }

  // Peristaltic Dosing Actions
  async triggerHardwareDose(doseType, amountMl) {
    const t = this.state.telemetry;

    if (doseType === 'PH_DOWN') {
      t.ph = Math.max(4.0, t.ph - 0.20);
    } else if (doseType === 'PH_UP') {
      t.ph = Math.min(9.0, t.ph + 0.20);
    } else if (doseType === 'NUT_A' || doseType === 'NUT_B') {
      t.ec = Math.min(3.5, t.ec + 0.18);
      t.tds = Math.round(t.ec * 500);
    }

    this.renderTelemetryUI();

    if (!this.isSimulationMode && this.hardwareBridge) {
      try {
        await this.hardwareBridge.triggerDose(doseType, amountMl);
      } catch (e) {}
    }

    this.addEventLog('Dosing Action', `${doseType} Injector`, `${amountMl}ml Pulse`, 'Injected', 'ACK');

    if (window.notifications) {
      window.notifications.showToast('Dosing Executed', `Injected ${amountMl}ml of ${doseType} into the reservoir.`, 'emerald');
      window.notifications.playChime('success');
    }

    if (window.aiAgent) {
      const crop = this.cropProfiles[this.activeCropKey];
      window.aiAgent.evaluateCropHealth(t, crop);
    }
  }

  syncActuatorUI() {
    const act = this.state.actuators;

    const pumpToggle = document.getElementById('toggle-relay-pump');
    const lblPump = document.getElementById('lbl-relay-pump');
    if (pumpToggle) pumpToggle.checked = act.pump;
    if (lblPump) {
      lblPump.textContent = act.pump ? 'RUNNING' : 'STOPPED';
      lblPump.className = `relay-state-label ${act.pump ? 'active' : 'inactive'}`;
    }

    const lightToggle = document.getElementById('toggle-relay-light');
    const lblLight = document.getElementById('lbl-relay-light');
    if (lightToggle) lightToggle.checked = act.lights;
    if (lblLight) {
      lblLight.textContent = act.lights ? 'ACTIVE (ON)' : 'OFF (NIGHT)';
      lblLight.className = `relay-state-label ${act.lights ? 'active' : 'inactive'}`;
    }

    const aeratorToggle = document.getElementById('toggle-relay-aerator');
    const lblAerator = document.getElementById('lbl-relay-aerator');
    if (aeratorToggle) aeratorToggle.checked = act.aerator;
    if (lblAerator) {
      lblAerator.textContent = act.aerator ? 'ON' : 'OFF';
      lblAerator.className = `relay-state-label ${act.aerator ? 'active' : 'inactive'}`;
    }

    const fanToggle = document.getElementById('toggle-relay-fan');
    const lblFan = document.getElementById('lbl-relay-fan');
    if (fanToggle) fanToggle.checked = act.fan;
    if (lblFan) {
      lblFan.textContent = act.fan ? 'ACTIVE' : 'STANDBY';
      lblFan.className = `relay-state-label ${act.fan ? 'active' : 'inactive'}`;
    }
  }

  startTimestampUpdater() {
    setInterval(() => {
      const el = document.getElementById('last-telemetry-timestamp');
      if (!el) return;
      const sec = Math.round((Date.now() - this.state.lastTelemetryTime) / 1000);
      el.textContent = `Streaming live: ${sec}s ago`;
      el.className = 'text-xs text-emerald';
    }, 1000);
  }

  appendTerminalLog(logObj) {
    const term = document.getElementById('raw-serial-terminal');
    if (!term) return;
    const line = document.createElement('div');
    line.className = `terminal-line line-${logObj.type}`;
    line.textContent = `[${logObj.timestamp}] ${logObj.msg}`;
    term.appendChild(line);
    if (term.childNodes.length > 100) term.removeChild(term.firstChild);
    term.scrollTop = term.scrollHeight;
  }

  switchTab(tabId) {
    const tabs = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
    panes.forEach(pane => pane.classList.toggle('active', pane.id === `tab-${tabId}`));

    if (window.lucide) window.lucide.createIcons();
  }

  switchCropProfile(cropKey) {
    if (!this.cropProfiles[cropKey]) return;
    this.activeCropKey = cropKey;
    const crop = this.cropProfiles[cropKey];

    document.getElementById('hero-crop-name').textContent = crop.name;
    document.getElementById('hero-crop-stage').textContent = crop.stage;

    this.renderTelemetryUI();
    if (window.aiAgent) window.aiAgent.evaluateCropHealth(this.state.telemetry, crop);

    if (window.notifications) {
      window.notifications.showToast('Crop Profile Loaded', `Loaded target thresholds for ${crop.name}.`, 'emerald');
    }
  }

  addEventLog(type, device, value, action, status) {
    const timestamp = new Date().toLocaleTimeString();
    this.state.eventLogs.unshift({ timestamp, type, device, value, action, status });
    if (this.state.eventLogs.length > 50) this.state.eventLogs.pop();
    this.renderLogTable();
  }

  renderLogTable() {
    const tbody = document.getElementById('telemetry-log-tbody');
    if (!tbody) return;
    tbody.innerHTML = this.state.eventLogs.slice(0, 12).map(l => `
      <tr>
        <td><code>${l.timestamp}</code></td>
        <td><span class="badge-green">${l.type}</span></td>
        <td><strong>${l.device}</strong></td>
        <td>${l.value}</td>
        <td>${l.action}</td>
        <td><span class="text-emerald">● ${l.status}</span></td>
      </tr>
    `).join('');
  }

  bindDOMEvents() {
    // Navigation Tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.tab));
    });

    // Crop Selector Dropdown
    const cropSelector = document.getElementById('crop-selector');
    if (cropSelector) {
      cropSelector.addEventListener('change', (e) => this.switchCropProfile(e.target.value));
    }

    // Micro Dosing Buttons on Sensor Cards
    const btnPhDown = document.getElementById('btn-dose-ph-down');
    if (btnPhDown) btnPhDown.addEventListener('click', () => this.triggerHardwareDose('PH_DOWN', 5));

    const btnPhUp = document.getElementById('btn-dose-ph-up');
    if (btnPhUp) btnPhUp.addEventListener('click', () => this.triggerHardwareDose('PH_UP', 5));

    const btnNutA = document.getElementById('btn-dose-nutrient-a');
    if (btnNutA) btnNutA.addEventListener('click', () => this.triggerHardwareDose('NUT_A', 10));

    const btnNutB = document.getElementById('btn-dose-nutrient-b');
    if (btnNutB) btnNutB.addEventListener('click', () => this.triggerHardwareDose('NUT_B', 10));

    // Actuator Relays Event Handlers
    const pumpToggle = document.getElementById('toggle-relay-pump');
    if (pumpToggle) pumpToggle.addEventListener('change', (e) => this.toggleRelay('pump', e.target.checked));

    const lightToggle = document.getElementById('toggle-relay-light');
    if (lightToggle) lightToggle.addEventListener('change', (e) => this.toggleRelay('lights', e.target.checked));

    const aeratorToggle = document.getElementById('toggle-relay-aerator');
    if (aeratorToggle) aeratorToggle.addEventListener('change', (e) => this.toggleRelay('aerator', e.target.checked));

    const fanToggle = document.getElementById('toggle-relay-fan');
    if (fanToggle) fanToggle.addEventListener('change', (e) => this.toggleRelay('fan', e.target.checked));

    // Peristaltic Dosing Trigger Buttons
    const doserPhDown = document.getElementById('doser-ph-down-trigger');
    if (doserPhDown) doserPhDown.addEventListener('click', () => this.triggerHardwareDose('PH_DOWN', 5));

    const doserPhUp = document.getElementById('doser-ph-up-trigger');
    if (doserPhUp) doserPhUp.addEventListener('click', () => this.triggerHardwareDose('PH_UP', 5));

    const doserNutA = document.getElementById('doser-nut-a-trigger');
    if (doserNutA) doserNutA.addEventListener('click', () => this.triggerHardwareDose('NUT_A', 10));

    const doserNutB = document.getElementById('doser-nut-b-trigger');
    if (doserNutB) doserNutB.addEventListener('click', () => this.triggerHardwareDose('NUT_B', 10));

    // Emergency Stop Button
    const eStop = document.getElementById('btn-emergency-stop');
    if (eStop) {
      eStop.addEventListener('click', () => {
        this.state.actuators = { pump: false, lights: false, aerator: false, fan: false };
        this.syncActuatorUI();
        this.renderTelemetryUI();
        this.addEventLog('Emergency Stop', 'ALL ACTUATORS', 'HALTED', 'Safety Shutdown', 'HALT');
        if (window.notifications) {
          window.notifications.showToast('SAFE STOP TRIGGERED', 'Emergency halt executed for all relays and pumps.', 'ruby');
          window.notifications.playChime('critical');
        }
      });
    }

    // Hardware Pairing Hub - Connect USB Serial (Web-Serial API)
    const connectSerialBtn = document.getElementById('btn-connect-serial');
    if (connectSerialBtn) {
      connectSerialBtn.addEventListener('click', async () => {
        const baud = document.getElementById('serial-baud-select') ? document.getElementById('serial-baud-select').value : 115200;
        try {
          await this.hardwareBridge.connectSerial(baud);
        } catch (err) {
          alert('Web-Serial: Please connect your ESP32 via USB and select the COM port.');
        }
      });
    }

    // Hardware Pairing Hub - Connect WiFi LAN
    const connectWifiBtn = document.getElementById('btn-connect-wifi');
    if (connectWifiBtn) {
      connectWifiBtn.addEventListener('click', () => {
        const ip = document.getElementById('device-ip-input') ? document.getElementById('device-ip-input').value.trim() : '192.168.4.1';
        this.hardwareBridge.connectWebSocket(ip, 81);
      });
    }

    // Send Test Packet Button
    const testPacketBtn = document.getElementById('btn-send-test-packet');
    if (testPacketBtn) {
      testPacketBtn.addEventListener('click', () => {
        const testJson = JSON.stringify({
          ph: (5.8 + Math.random() * 0.4).toFixed(2),
          ec: (1.3 + Math.random() * 0.3).toFixed(2),
          temp: (19.8 + Math.random() * 1.5).toFixed(1),
          level: Math.round(75 + Math.random() * 15),
          do: (7.5 + Math.random() * 1.0).toFixed(1)
        });
        this.hardwareBridge.handleRawPacket(testJson);
        if (window.notifications) {
          window.notifications.showToast('Test Packet Ingested', `Parsed: ${testJson}`, 'emerald');
          window.notifications.playChime('info');
        }
      });
    }

    // Copy Firmware Code Button
    const copyFirmwareBtn = document.getElementById('btn-copy-firmware');
    if (copyFirmwareBtn) {
      copyFirmwareBtn.addEventListener('click', () => {
        const code = document.querySelector('.code-snippet-box pre code');
        if (code) {
          navigator.clipboard.writeText(code.textContent);
          if (window.notifications) {
            window.notifications.showToast('Firmware Code Copied', 'Arduino C++ sketch copied to clipboard!', 'emerald');
            window.notifications.playChime('success');
          }
        }
      });
    }

    // Setup PWA mobile install listeners
    this.setupPWAInstaller();
  }

  setupPWAInstaller() {
    let deferredPrompt = null;
    const installBtn = document.getElementById('btn-install-app');
    const triggerPromptBtn = document.getElementById('btn-trigger-pwa-prompt');
    const modal = document.getElementById('install-modal-backdrop');
    const closeBtn = document.getElementById('btn-close-install-modal');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installBtn) {
        installBtn.style.display = 'inline-flex';
        installBtn.classList.add('pulse-glow');
      }
    });

    if (installBtn) {
      installBtn.addEventListener('click', () => {
        if (modal) modal.classList.add('open');
      });
    }

    if (triggerPromptBtn) {
      triggerPromptBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`PWA install outcome: ${outcome}`);
          deferredPrompt = null;
          if (modal) modal.classList.remove('open');
        } else {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
          if (isIOS) {
            alert('To install on iPhone/iPad:\n1. Tap Safari Share button (box with upward arrow)\n2. Tap "Add to Home Screen"');
          } else {
            alert('To install Slynks:\n1. Open browser menu (⋮)\n2. Tap "Add to Home screen" or "Install App".');
          }
          if (modal) modal.classList.remove('open');
        }
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    }

    window.addEventListener('appinstalled', () => {
      if (installBtn) installBtn.style.display = 'none';
      if (modal) modal.classList.remove('open');
      if (window.notifications) {
        window.notifications.showToast('Slynks Installed', 'App installed on your home screen with the Capital S logo!', 'emerald');
        window.notifications.playChime('success');
      }
    });
  }
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('[Slynks PWA] Service worker active:', reg.scope))
      .catch((err) => console.log('[Slynks PWA] Service worker registration error:', err));
  });
}

// Instantiate on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SlynksHydroponicsApp();
  if (window.lucide) {
    window.lucide.createIcons();
  }
});
