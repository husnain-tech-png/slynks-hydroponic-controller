/**
 * SLYNKS HYDROPONIC CONTROLLER - MAIN CORE APPLICATION
 * Orchestrator for Blynk-style IoT telemetry, relays, AI Biobot agent, and Pakistani payment system
 */

class SlynksHydroponicsApp {
  constructor() {
    this.cropProfiles = {
      lettuce: {
        name: 'Butterhead Lettuce',
        stage: 'Vegetative (Week 3)',
        targets: { ph: 5.95, ec: 1.42, waterTemp: 20.4, lightHours: 14 }
      },
      strawberries: {
        name: 'Alpine Strawberries',
        stage: 'Early Flowering',
        targets: { ph: 5.80, ec: 1.55, waterTemp: 19.5, lightHours: 13 }
      },
      tomatoes: {
        name: 'Vine Tomatoes',
        stage: 'Fruiting Stage',
        targets: { ph: 6.20, ec: 2.20, waterTemp: 21.0, lightHours: 15 }
      },
      basil: {
        name: 'Genovese Basil',
        stage: 'Continuous Harvest',
        targets: { ph: 6.00, ec: 1.25, waterTemp: 21.5, lightHours: 14 }
      },
      peppers: {
        name: 'Bell Peppers',
        stage: 'Canopy Development',
        targets: { ph: 6.05, ec: 1.80, waterTemp: 20.8, lightHours: 14 }
      },
      custom: {
        name: 'Custom Hydroponic Recipe',
        stage: 'Custom Tuned',
        targets: { ph: 6.00, ec: 1.50, waterTemp: 20.0, lightHours: 14 }
      }
    };

    this.activeCropKey = 'lettuce';

    this.state = {
      aiAutonomous: true,
      telemetry: {
        ph: 5.95,
        ec: 1.42,
        tds: 710,
        waterTemp: 20.4,
        waterLevel: 78,
        dissolvedOxygen: 8.1,
        airTemp: 24.2,
        airHumidity: 62,
        vpd: 1.08,
        lightPPFD: 340,
        lightLux: 22500,
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
    this.bindDOMEvents();
    this.startHardwareSimulator();
    this.logInitialEvents();
  }

  initModules() {
    window.notifications = new SlynksNotificationSystem();
    window.analytics = new SlynksAnalyticsManager();
    window.aiAgent = new SlynksAIAgent();
    window.payments = new SlynksPaymentGateway();
  }

  calculateVPD(tempC, humidityPct) {
    // Saturation vapor pressure using Tetens equation
    const svp = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
    const avp = svp * (humidityPct / 100);
    return Math.max(0.1, svp - avp);
  }

  startHardwareSimulator() {
    // Continuous IoT Hardware Telemetry Simulation (Tick every 1500ms)
    setInterval(() => {
      this.simulatePhysicsTick();
      this.renderTelemetryUI();
      this.evaluateAutomation();
    }, 1500);
  }

  simulatePhysicsTick() {
    const tel = this.state.telemetry;
    const crop = this.cropProfiles[this.activeCropKey];

    // 1. Natural slow pH drift (+0.004 naturally due to nitrate uptake)
    tel.ph += 0.003 + (Math.random() * 0.002);

    // 2. Slow natural EC depletion (-0.002 as plants consume ions)
    tel.ec = Math.max(0.4, tel.ec - 0.001);
    tel.tds = Math.round(tel.ec * 500);

    // 3. Slow water evaporation (-0.01% per tick)
    tel.waterLevel = Math.max(5, tel.waterLevel - 0.008);

    // 4. Oxygen dynamics based on Aerator relay
    if (this.state.actuators.aerator) {
      tel.dissolvedOxygen = Math.min(8.6, tel.dissolvedOxygen + 0.02 + (Math.random() * 0.01));
    } else {
      tel.dissolvedOxygen = Math.max(3.8, tel.dissolvedOxygen - 0.04);
    }

    // 5. Flow rate based on Pump relay
    if (this.state.actuators.pump) {
      tel.flowRate = parseFloat((3.8 + (Math.random() * 0.2 - 0.1)).toFixed(1));
    } else {
      tel.flowRate = 0.0;
    }

    // 6. Water Temp micro-fluctuations
    tel.waterTemp = parseFloat((20.3 + Math.sin(Date.now() / 60000) * 0.4).toFixed(1));

    // 7. Ambient Climate & VPD
    tel.airTemp = parseFloat((24.2 + (Math.random() * 0.2 - 0.1)).toFixed(1));
    tel.airHumidity = Math.round(62 + Math.sin(Date.now() / 45000) * 3);
    tel.vpd = parseFloat(this.calculateVPD(tel.airTemp, tel.airHumidity).toFixed(2));

    // 8. Light levels based on Light relay
    if (this.state.actuators.lights) {
      tel.lightPPFD = Math.round(340 + (Math.random() * 10 - 5));
      tel.lightLux = tel.lightPPFD * 66;
    } else {
      tel.lightPPFD = 0;
      tel.lightLux = 0;
    }

    // Send to live chart streamer
    if (window.analytics) {
      window.analytics.appendLivePoint(tel);
    }
  }

  evaluateAutomation() {
    const tel = this.state.telemetry;
    const crop = this.cropProfiles[this.activeCropKey];

    // If AI Auto-Pilot is enabled, automatically trigger micro-dosing when thresholds are breached
    if (this.state.aiAutonomous) {
      if (tel.ph > crop.targets.ph + 0.35) {
        this.dosePhDown(6, true);
      } else if (tel.ph < crop.targets.ph - 0.35) {
        this.dosePhUp(6, true);
      }

      if (tel.ec < crop.targets.ec - 0.25) {
        this.doseNutrientA(12, true);
        this.doseNutrientB(12, true);
      }
    }

    // Notify Smart Alert System & AI Agent
    if (window.notifications) {
      window.notifications.evaluateTelemetry(tel);
    }
    if (window.aiAgent) {
      window.aiAgent.evaluateCropHealth(tel, crop);
    }
  }

  renderTelemetryUI() {
    const tel = this.state.telemetry;

    // SENSOR 1: pH
    document.getElementById('val-ph').textContent = tel.ph.toFixed(2);
    const needlePh = document.getElementById('needle-ph');
    const pctPh = Math.max(0, Math.min(100, ((tel.ph - 4.0) / 4.0) * 100));
    if (needlePh) needlePh.style.left = `${pctPh}%`;
    const tagPh = document.getElementById('tag-ph');
    if (tagPh) {
      tagPh.className = `status-indicator-tag ${Math.abs(tel.ph - 6.0) < 0.3 ? 'tag-good' : Math.abs(tel.ph - 6.0) < 0.6 ? 'tag-warn' : 'tag-danger'}`;
      tagPh.textContent = Math.abs(tel.ph - 6.0) < 0.3 ? 'TARGET' : Math.abs(tel.ph - 6.0) < 0.6 ? 'DRIFT' : 'ALERT';
    }

    // SENSOR 2: EC
    document.getElementById('val-ec').textContent = tel.ec.toFixed(2);
    document.getElementById('val-tds').textContent = tel.tds;
    const needleEc = document.getElementById('needle-ec');
    const pctEc = Math.max(0, Math.min(100, ((tel.ec - 0.5) / 2.5) * 100));
    if (needleEc) needleEc.style.left = `${pctEc}%`;

    // SENSOR 3: Water Level
    document.getElementById('val-level').textContent = Math.round(tel.waterLevel);
    document.getElementById('val-level-litres').textContent = tel.waterLevel.toFixed(1);
    const fillLevel = document.getElementById('fill-water-level');
    if (fillLevel) fillLevel.style.width = `${tel.waterLevel}%`;

    // SENSOR 4: Water Temp
    document.getElementById('val-water-temp').textContent = tel.waterTemp.toFixed(1);
    document.getElementById('val-water-temp-f').textContent = ((tel.waterTemp * 9/5) + 32).toFixed(1);
    const needleTemp = document.getElementById('needle-water-temp');
    const pctTemp = Math.max(0, Math.min(100, ((tel.waterTemp - 14) / 12) * 100));
    if (needleTemp) needleTemp.style.left = `${pctTemp}%`;

    // SENSOR 5: Dissolved Oxygen
    document.getElementById('val-do').textContent = tel.dissolvedOxygen.toFixed(1);
    const fillDo = document.getElementById('fill-do');
    if (fillDo) fillDo.style.width = `${Math.min(100, (tel.dissolvedOxygen / 10) * 100)}%`;

    // SENSOR 6: Climate & VPD
    document.getElementById('val-air-temp').textContent = `${tel.airTemp}°C`;
    document.getElementById('val-air-humidity').textContent = `${tel.airHumidity}%`;
    document.getElementById('val-vpd').textContent = `${tel.vpd} kPa`;
    const tagVpd = document.getElementById('tag-vpd');
    if (tagVpd) tagVpd.textContent = `VPD ${tel.vpd} kPa`;

    // SENSOR 7: Grow Light
    document.getElementById('val-light-ppfd').textContent = tel.lightPPFD;
    document.getElementById('val-light-lux').textContent = tel.lightLux.toLocaleString();
    const fillLight = document.getElementById('fill-light');
    if (fillLight) fillLight.style.width = `${Math.min(100, (tel.lightPPFD / 450) * 100)}%`;

    // SENSOR 8: Flow Rate
    document.getElementById('val-flow-rate').textContent = tel.flowRate.toFixed(1);
    const fillFlow = document.getElementById('fill-flow');
    if (fillFlow) fillFlow.style.width = `${Math.min(100, (tel.flowRate / 6.0) * 100)}%`;

    // Schematic overlay updates
    const schemPh = document.getElementById('schem-ph-text');
    const schemEc = document.getElementById('schem-ec-text');
    const schemTemp = document.getElementById('schem-temp-text');
    const schemWaterBody = document.getElementById('schem-water-body');

    if (schemPh) schemPh.textContent = tel.ph.toFixed(2);
    if (schemEc) schemEc.textContent = `${tel.ec.toFixed(2)} mS/cm`;
    if (schemTemp) schemTemp.textContent = `${tel.waterTemp}°C`;
    if (schemWaterBody) schemWaterBody.style.height = `${Math.max(20, Math.min(95, tel.waterLevel))}%`;

    // Hardware V-Pin table
    const v0 = document.getElementById('vpin-val-0');
    const v3 = document.getElementById('vpin-val-3');
    if (v0) v0.textContent = tel.ph.toFixed(2);
    if (v3) v3.textContent = tel.ec.toFixed(2);
  }

  // Actuator Dosing & Action Triggers
  dosePhDown(amount = 5, isAuto = false) {
    this.state.telemetry.ph = Math.max(4.2, this.state.telemetry.ph - (amount * 0.04));
    this.addEventLog('Actuation', 'pH Down Doser (V6)', `${amount}ml (H₃PO₄)`, isAuto ? 'AI Auto-Dosed' : 'Manual Trigger', 'Success');
    
    if (window.notifications) {
      window.notifications.showToast('pH Down Dosed', `${amount}ml injected. pH decreased to ${this.state.telemetry.ph.toFixed(2)}`, 'emerald');
      window.notifications.playChime('info');
    }
  }

  dosePhUp(amount = 5, isAuto = false) {
    this.state.telemetry.ph = Math.min(8.5, this.state.telemetry.ph + (amount * 0.04));
    this.addEventLog('Actuation', 'pH Up Doser (V7)', `${amount}ml (KOH)`, isAuto ? 'AI Auto-Dosed' : 'Manual Trigger', 'Success');
    
    if (window.notifications) {
      window.notifications.showToast('pH Up Dosed', `${amount}ml injected. pH rose to ${this.state.telemetry.ph.toFixed(2)}`, 'emerald');
      window.notifications.playChime('info');
    }
  }

  doseNutrientA(amount = 10, isAuto = false) {
    this.state.telemetry.ec = Math.min(3.5, this.state.telemetry.ec + (amount * 0.02));
    this.state.telemetry.tds = Math.round(this.state.telemetry.ec * 500);
    this.addEventLog('Actuation', 'Nutrient A Pump', `${amount}ml Grow Stock`, isAuto ? 'AI Auto-Dosed' : 'Manual Trigger', 'Success');
    
    if (window.notifications) {
      window.notifications.showToast('Nutrient A Dosed', `${amount}ml injected. EC increased to ${this.state.telemetry.ec.toFixed(2)}`, 'emerald');
      window.notifications.playChime('info');
    }
  }

  doseNutrientB(amount = 10, isAuto = false) {
    this.state.telemetry.ec = Math.min(3.5, this.state.telemetry.ec + (amount * 0.02));
    this.state.telemetry.tds = Math.round(this.state.telemetry.ec * 500);
    this.addEventLog('Actuation', 'Nutrient B Pump', `${amount}ml Micro Stock`, isAuto ? 'AI Auto-Dosed' : 'Manual Trigger', 'Success');
    
    if (window.notifications) {
      window.notifications.showToast('Nutrient B Dosed', `${amount}ml injected. EC increased to ${this.state.telemetry.ec.toFixed(2)}`, 'emerald');
      window.notifications.playChime('info');
    }
  }

  refillWater(amountLitres = 10) {
    this.state.telemetry.waterLevel = Math.min(100, this.state.telemetry.waterLevel + (amountLitres / 100 * 100));
    // Dilute EC slightly
    this.state.telemetry.ec = Math.max(0.6, this.state.telemetry.ec * 0.92);
    this.state.telemetry.tds = Math.round(this.state.telemetry.ec * 500);
    this.addEventLog('Maintenance', 'Reservoir Water Top-Up', `+${amountLitres}L RO Water`, 'Manual Refill', 'Completed');
    
    if (window.notifications) {
      window.notifications.showToast('Water Reservoir Refilled', `Added ${amountLitres}L RO water. Tank now at ${Math.round(this.state.telemetry.waterLevel)}%`, 'emerald');
      window.notifications.playChime('success');
    }
  }

  boostOxygen() {
    this.state.telemetry.dissolvedOxygen = 8.8;
    this.addEventLog('Actuation', 'Aerator Booster', '100% Oxygen Pulse', 'Manual Trigger', 'Active');
    if (window.notifications) {
      window.notifications.showToast('Oxygen Boosted', 'Aeration bubbler running at maximum capacity.', 'emerald');
      window.notifications.playChime('info');
    }
  }

  handleNeedAction(actionType, amount) {
    if (actionType === 'dose-ph-down') this.dosePhDown(amount || 8);
    else if (actionType === 'dose-ph-up') this.dosePhUp(amount || 8);
    else if (actionType === 'dose-nutrients') {
      this.doseNutrientA(amount || 15);
      this.doseNutrientB(amount || 15);
    }
    else if (actionType === 'refill-water') this.refillWater(amount || 10);
    else if (actionType === 'boost-aerator' || actionType === 'boost-cooling') {
      this.boostOxygen();
      this.setRelayState('fan', true);
    }
  }

  setRelayState(relayKey, state) {
    this.state.actuators[relayKey] = state;
    
    // UI elements update
    if (relayKey === 'pump') {
      const toggle = document.getElementById('toggle-relay-pump');
      const label = document.getElementById('lbl-relay-pump');
      const schemPump = document.getElementById('schem-pump');
      if (toggle) toggle.checked = state;
      if (label) {
        label.textContent = state ? 'RUNNING' : 'STOPPED';
        label.className = `relay-state-label ${state ? 'active' : 'inactive'}`;
      }
      if (schemPump) schemPump.classList.toggle('active', state);
    } else if (relayKey === 'lights') {
      const toggle = document.getElementById('toggle-relay-light');
      const label = document.getElementById('lbl-relay-light');
      const schemLights = document.getElementById('schem-lights');
      if (toggle) toggle.checked = state;
      if (label) {
        label.textContent = state ? 'ACTIVE (80%)' : 'OFF (NIGHT)';
        label.className = `relay-state-label ${state ? 'active' : 'inactive'}`;
      }
      if (schemLights) schemLights.classList.toggle('active', state);
    } else if (relayKey === 'aerator') {
      const toggle = document.getElementById('toggle-relay-aerator');
      const label = document.getElementById('lbl-relay-aerator');
      const schemBubbles = document.getElementById('schem-bubbles');
      if (toggle) toggle.checked = state;
      if (label) {
        label.textContent = state ? 'ON' : 'OFF';
        label.className = `relay-state-label ${state ? 'active' : 'inactive'}`;
      }
      if (schemBubbles) schemBubbles.style.display = state ? 'block' : 'none';
    } else if (relayKey === 'fan') {
      const toggle = document.getElementById('toggle-relay-fan');
      const label = document.getElementById('lbl-relay-fan');
      if (toggle) toggle.checked = state;
      if (label) {
        label.textContent = state ? 'ACTIVE' : 'STANDBY';
        label.className = `relay-state-label ${state ? 'active' : 'inactive'}`;
      }
    }

    this.addEventLog('Relay', `Relay: ${relayKey.toUpperCase()}`, state ? 'ON' : 'OFF', 'User Switch', 'Synced');
  }

  emergencyStop() {
    this.setRelayState('pump', false);
    this.setRelayState('lights', false);
    this.setRelayState('aerator', false);
    this.setRelayState('fan', false);
    this.state.aiAutonomous = false;
    const aiToggle = document.getElementById('ai-autonomous-toggle');
    if (aiToggle) aiToggle.checked = false;

    if (window.notifications) {
      window.notifications.showToast('EMERGENCY SAFE STOP', 'All relays and dosing pumps halted.', 'ruby');
      window.notifications.playChime('critical');
    }
  }

  switchTab(tabId) {
    const tabs = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    panes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  switchCropProfile(cropKey) {
    if (!this.cropProfiles[cropKey]) return;
    this.activeCropKey = cropKey;
    const crop = this.cropProfiles[cropKey];

    document.getElementById('hero-crop-name').textContent = crop.name;
    document.getElementById('hero-crop-stage').textContent = crop.stage;

    // Update target zones in hints
    document.getElementById('hint-ph').textContent = `Target: ${crop.targets.ph} pH (Optimal)`;
    document.getElementById('hint-ec').textContent = `Target: ${crop.targets.ec} mS/cm`;

    if (window.notifications) {
      window.notifications.showToast('Crop Profile Loaded', `Active profile switched to ${crop.name}`, 'emerald');
      window.notifications.playChime('info');
    }

    // Force re-evaluation
    if (window.aiAgent) {
      window.aiAgent.evaluateCropHealth(this.state.telemetry, crop);
    }
  }

  addEventLog(type, device, value, action, status) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const logItem = { timestamp, type, device, value, action, status };
    this.state.eventLogs.unshift(logItem);

    if (this.state.eventLogs.length > 50) this.state.eventLogs.pop();
    this.renderLogTable();
  }

  renderLogTable() {
    const tbody = document.getElementById('telemetry-log-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.state.eventLogs.slice(0, 12).map(log => `
      <tr>
        <td><code>${log.timestamp}</code></td>
        <td><span class="badge-green">${log.type}</span></td>
        <td><strong>${log.device}</strong></td>
        <td>${log.value}</td>
        <td>${log.action}</td>
        <td><span class="text-emerald">● ${log.status}</span></td>
      </tr>
    `).join('');
  }

  logInitialEvents() {
    this.addEventLog('Boot', 'ESP32 NodeMCU', 'Firmware v2.4.1', 'WiFi Connected (22ms)', 'Online');
    this.addEventLog('Telemetry', 'pH Sensor Analog (V0)', '5.95 pH', 'ADC Calibrated', 'Optimal');
    this.addEventLog('Telemetry', 'EC Sensor (V3)', '1.42 mS/cm', 'TDS Synced (710 PPM)', 'Optimal');
    this.addEventLog('Relay', 'Water Pump Relay (V1)', 'ON (3.8 L/min)', 'Blynk Sync', 'Active');
    this.addEventLog('AI Biobot', 'Slynks Hydro-AI', 'Vitality 94/100', 'Continuous Telemetry Scan', 'Monitoring');
  }

  bindDOMEvents() {
    // Navigation Tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabId = e.currentTarget.dataset.tab;
        this.switchTab(tabId);
      });
    });

    // Crop Selector Dropdown
    const cropSelector = document.getElementById('crop-selector');
    if (cropSelector) {
      cropSelector.addEventListener('change', (e) => {
        this.switchCropProfile(e.target.value);
      });
    }

    // AI Autonomous Auto-Pilot Switch
    const aiToggle = document.getElementById('ai-autonomous-toggle');
    if (aiToggle) {
      aiToggle.addEventListener('change', (e) => {
        this.state.aiAutonomous = e.target.checked;
        if (window.notifications) {
          window.notifications.showToast(
            'AI Auto-Pilot',
            e.target.checked ? 'Slynks Hydro-AI autonomous dosing ACTIVE' : 'Manual control mode engaged',
            e.target.checked ? 'emerald' : 'amber'
          );
          window.notifications.playChime('info');
        }
      });
    }

    // Relay Toggle Switches
    const pumpToggle = document.getElementById('toggle-relay-pump');
    if (pumpToggle) pumpToggle.addEventListener('change', (e) => this.setRelayState('pump', e.target.checked));

    const lightToggle = document.getElementById('toggle-relay-light');
    if (lightToggle) lightToggle.addEventListener('change', (e) => this.setRelayState('lights', e.target.checked));

    const aeratorToggle = document.getElementById('toggle-relay-aerator');
    if (aeratorToggle) aeratorToggle.addEventListener('change', (e) => this.setRelayState('aerator', e.target.checked));

    const fanToggle = document.getElementById('toggle-relay-fan');
    if (fanToggle) fanToggle.addEventListener('change', (e) => this.setRelayState('fan', e.target.checked));

    // Emergency Stop
    const eStopBtn = document.getElementById('btn-emergency-stop');
    if (eStopBtn) eStopBtn.addEventListener('click', () => this.emergencyStop());

    // Quick Sensor Card Buttons
    const btnDosePhDown = document.getElementById('btn-dose-ph-down');
    if (btnDosePhDown) btnDosePhDown.addEventListener('click', () => this.dosePhDown(5));

    const btnDosePhUp = document.getElementById('btn-dose-ph-up');
    if (btnDosePhUp) btnDosePhUp.addEventListener('click', () => this.dosePhUp(5));

    const btnDoseNutA = document.getElementById('btn-dose-nutrient-a');
    if (btnDoseNutA) btnDoseNutA.addEventListener('click', () => this.doseNutrientA(10));

    const btnDoseNutB = document.getElementById('btn-dose-nutrient-b');
    if (btnDoseNutB) btnDoseNutB.addEventListener('click', () => this.doseNutrientB(10));

    const btnRefillWater = document.getElementById('btn-refill-water');
    if (btnRefillWater) btnRefillWater.addEventListener('click', () => this.refillWater(10));

    const btnBoostAerator = document.getElementById('btn-boost-aerator');
    if (btnBoostAerator) btnBoostAerator.addEventListener('click', () => this.boostOxygen());

    // Dosing Suite Buttons
    const doserPhDown = document.getElementById('doser-ph-down-trigger');
    if (doserPhDown) doserPhDown.addEventListener('click', () => this.dosePhDown(5));

    const doserPhUp = document.getElementById('doser-ph-up-trigger');
    if (doserPhUp) doserPhUp.addEventListener('click', () => this.dosePhUp(5));

    const doserNutA = document.getElementById('doser-nut-a-trigger');
    if (doserNutA) doserNutA.addEventListener('click', () => this.doseNutrientA(10));

    const doserNutB = document.getElementById('doser-nut-b-trigger');
    if (doserNutB) doserNutB.addEventListener('click', () => this.doseNutrientB(10));

    // Header Notification Button opens alerts tab
    const headerNotifBtn = document.getElementById('header-notif-btn');
    if (headerNotifBtn) headerNotifBtn.addEventListener('click', () => this.switchTab('alerts'));

    // Copy Arduino Code
    const copyCodeBtn = document.getElementById('btn-copy-code');
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', () => {
        const codeEl = document.querySelector('.code-snippet-box code');
        if (codeEl) {
          navigator.clipboard.writeText(codeEl.textContent);
          if (window.notifications) {
            window.notifications.showToast('Firmware Copied', 'ESP32 C++ firmware snippet copied to clipboard!', 'emerald');
            window.notifications.playChime('success');
          }
        }
      });
    }

    // Search filter for logs
    const logSearchInput = document.getElementById('log-search-input');
    if (logSearchInput) {
      logSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#telemetry-log-tbody tr');
        rows.forEach(r => {
          r.style.display = r.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
      });
    }
  }
}

// Instantiate on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SlynksHydroponicsApp();
  if (window.lucide) {
    window.lucide.createIcons();
  }
});
