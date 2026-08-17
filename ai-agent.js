/**
 * SLYNKS HYDROPONIC CONTROLLER - SLYNKS HYDRO-AI BIOBOT AGENT
 * Embedded Autonomous Hydroponic Agronomist & IoT Doctor
 * Driven strictly by verified real hardware readings.
 */

class SlynksAIAgent {
  constructor() {
    this.vitalityScore = 0;
    this.isEvaluated = false;
    this.currentPrescription = {
      action: 'connect_hardware',
      phDownAmount: 0,
      phUpAmount: 0,
      nutAAmount: 0,
      nutBAmount: 0,
      waterRefill: 0,
      text: 'Connect physical ESP32 sensors to generate auto-tune dosing prescriptions.'
    };

    this.chatHistory = [];
    this.knowledgeBase = this.initKnowledgeBase();
    this.bindEvents();
  }

  evaluateCropHealth(telemetry, cropProfile) {
    const { ph, ec, waterTemp, dissolvedOxygen, airTemp, airHumidity, vpd } = telemetry;
    
    // Guard: If essential hardware readings are not yet available
    if (ph === null || ec === null || waterTemp === null) {
      this.vitalityScore = 0;
      this.isEvaluated = false;
      this.updateDiagnosticsUI({
        vitalityScore: '--',
        phStatus: 'status-warn', phDesc: 'Awaiting real pH probe data (GPIO 34).',
        ecStatus: 'status-warn', ecDesc: 'Awaiting real EC probe data (GPIO 35).',
        tempStatus: 'status-warn', tempDesc: 'Awaiting real water temp data (GPIO 4).',
        vpdStatus: 'status-warn', vpdDesc: 'Awaiting DHT22 climate data (GPIO 21).'
      });
      const presEl = document.getElementById('ai-prescription-text');
      if (presEl) presEl.textContent = 'Hardware stream offline. Connect ESP32 to compute dosing prescriptions.';
      return;
    }

    let score = 100;
    const target = cropProfile.targets;

    // 1. pH Evaluation
    const phDiff = Math.abs(ph - target.ph);
    let phStatus = 'status-pass';
    let phDesc = `Optimal uptake buffer at ${ph.toFixed(2)} pH for ${cropProfile.name}.`;
    if (phDiff > 0.6) {
      score -= 25;
      phStatus = 'status-danger';
      phDesc = `Severe pH drift (${ph.toFixed(2)} pH). Nutrient lockout risk!`;
    } else if (phDiff > 0.3) {
      score -= 10;
      phStatus = 'status-warn';
      phDesc = `Moderate pH drift (${ph.toFixed(2)} pH). Uptake efficiency decreased.`;
    }

    // 2. EC Evaluation
    const ecDiff = Math.abs(ec - target.ec);
    let ecStatus = 'status-pass';
    let ecDesc = `Salinity index ${ec.toFixed(2)} mS/cm matches demand.`;
    if (ecDiff > 0.6) {
      score -= 25;
      ecStatus = 'status-danger';
      ecDesc = ec > target.ec ? `Toxic salt concentration (EC ${ec.toFixed(2)}). Salt burn risk.` : `Nutrient starvation (EC ${ec.toFixed(2)}).`;
    } else if (ecDiff > 0.25) {
      score -= 8;
      ecStatus = 'status-warn';
      ecDesc = ec > target.ec ? `Slightly elevated nutrient concentration.` : `Nutrient concentration depleted.`;
    }

    // 3. Water Temp Evaluation
    let tempStatus = 'status-pass';
    let tempDesc = `Water at ${waterTemp.toFixed(1)}°C suppresses pathogenic fungi.`;
    if (waterTemp > 24.5) {
      score -= 20;
      tempStatus = 'status-danger';
      tempDesc = `Dangerous thermal spike (${waterTemp.toFixed(1)}°C). High root rot hazard!`;
    } else if (waterTemp > 22.5) {
      score -= 8;
      tempStatus = 'status-warn';
      tempDesc = `Elevated temperature (${waterTemp.toFixed(1)}°C). Lowers oxygen solubility.`;
    }

    // 4. VPD Evaluation
    let vpdStatus = 'status-pass';
    let vpdDesc = vpd !== null ? `VPD at ${vpd.toFixed(2)} kPa encourages transpiration.` : 'VPD calculating...';
    if (vpd !== null && (vpd < 0.6 || vpd > 1.6)) {
      score -= 10;
      vpdStatus = 'status-warn';
      vpdDesc = vpd > 1.6 ? `Dry air (${vpd.toFixed(2)} kPa) causes high water loss.` : `High humidity (${vpd.toFixed(2)} kPa) stalls mineral uptake.`;
    }

    if (dissolvedOxygen !== null && dissolvedOxygen < 5.5) {
      score -= 15;
    }

    this.vitalityScore = Math.max(10, Math.min(100, Math.round(score)));
    this.isEvaluated = true;

    // Update Diagnostics UI
    this.updateDiagnosticsUI({
      vitalityScore: `${this.vitalityScore}%`,
      phStatus, phDesc,
      ecStatus, ecDesc,
      tempStatus, tempDesc,
      vpdStatus, vpdDesc
    });

    // Compute Real Actionable Prescription
    this.computePrescription(telemetry, cropProfile);
  }

  updateDiagnosticsUI(data) {
    const vitalityVal = document.getElementById('ai-vitality-score');
    const vitalityBar = document.getElementById('ai-vitality-bar');

    if (vitalityVal) vitalityVal.textContent = data.vitalityScore;
    if (vitalityBar) vitalityBar.style.width = typeof data.vitalityScore === 'string' && data.vitalityScore.includes('%') ? data.vitalityScore : '0%';

    const updateDiagItem = (id, status, desc) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = `diag-item ${status}`;
      const descEl = el.querySelector('span');
      if (descEl) descEl.textContent = desc;
    };

    updateDiagItem('diag-ph-status', data.phStatus, data.phDesc);
    updateDiagItem('diag-ec-status', data.ecStatus, data.ecDesc);
    updateDiagItem('diag-temp-status', data.tempStatus, data.tempDesc);
    updateDiagItem('diag-vpd-status', data.vpdStatus, data.vpdDesc);
  }

  computePrescription(telemetry, cropProfile) {
    const { ph, ec, waterTemp } = telemetry;
    if (ph === null || ec === null) return;

    const target = cropProfile.targets;
    const actions = [];
    const p = { phDownAmount: 0, phUpAmount: 0, nutAAmount: 0, nutBAmount: 0, waterRefill: 0, text: '' };

    if (ph > target.ph + 0.25) {
      const ml = Math.max(5, Math.round((ph - target.ph) * 18));
      p.phDownAmount = ml;
      actions.push(`Dose ${ml}ml pH Down (Phosphoric Acid)`);
    } else if (ph < target.ph - 0.25) {
      const ml = Math.max(5, Math.round((target.ph - ph) * 18));
      p.phUpAmount = ml;
      actions.push(`Dose ${ml}ml pH Up (Potassium Hydroxide)`);
    }

    if (ec < target.ec - 0.15) {
      const ml = Math.max(10, Math.round((target.ec - ec) * 50));
      p.nutAAmount = ml;
      p.nutBAmount = ml;
      actions.push(`Inject ${ml}ml Nutrient A & ${ml}ml Nutrient B`);
    }

    if (waterTemp !== null && waterTemp > 23.5) {
      actions.push(`Activate Exhaust Fan & Aeration 100%`);
    }

    p.text = actions.length === 0 
      ? `System chemistry in equilibrium for ${cropProfile.name}. Vitality is ${this.vitalityScore}%.`
      : `Real Hardware Action: ${actions.join(' + ')}.`;

    this.currentPrescription = p;
    const presTextEl = document.getElementById('ai-prescription-text');
    if (presTextEl) presTextEl.textContent = p.text;
  }

  initKnowledgeBase() {
    return [
      {
        keywords: ['pakistan', 'lahore', 'karachi', 'summer', 'heat', '40', 'temperature'],
        response: `🌡️ **Pakistan Summer Hydroponic Management Protocol:**\n\nDuring Pakistani summers (ambient 42°C-46°C):\n1. **Insulate the Reservoir:** Wrap tank in reflective foil to keep solution below 22°C.\n2. **Run Continuous Aeration:** Warmer water dissolves less oxygen. Keep air stones bubbling 24/7.\n3. **Lower EC Target by 15%:** Prevent nutrient burn as transpiration triples in dry heat.\n4. **Freeze-Bottle Cooling:** Float frozen 2L bottles during peak afternoon hours.`
      },
      {
        keywords: ['strawberry', 'strawberries', 'ec', 'ph'],
        response: `🍓 **Strawberry Hydroponic Guide:**\n- **Target pH:** 5.8 - 6.2\n- **Target EC:** 1.2 - 1.6 mS/cm\n- **Light:** 12 to 14 hours PPFD 350-450.\n- Keep crowns strictly above the water level to prevent crown rot.`
      },
      {
        keywords: ['lettuce', 'greens'],
        response: `🥬 **Butterhead Lettuce Recipe:**\n- **Target pH:** 5.8 - 6.2\n- **Target EC:** 1.2 - 1.5 mS/cm\n- **Water Temp:** 18°C - 21°C\n- Maintain gentle air circulation to drive calcium transpiration and prevent tip burn.`
      }
    ];
  }

  handleUserMessage(userText) {
    const query = userText.toLowerCase().trim();
    if (!query) return;

    this.appendChatMessage('user', 'You', userText);

    setTimeout(() => {
      let matched = this.knowledgeBase.find(item => item.keywords.some(k => query.includes(k)));
      let responseText = '';
      
      if (matched) {
        responseText = matched.response;
      } else if (query.includes('hardware') || query.includes('status') || query.includes('telemetry')) {
        const appState = window.app ? window.app.state : null;
        if (appState && appState.isHardwareOnline) {
          const t = appState.telemetry;
          responseText = `📊 **Real Hardware Telemetry Stream:**\n\n` +
            `• **pH:** ${t.ph !== null ? t.ph.toFixed(2) : '--'} (Probe GPIO 34)\n` +
            `• **EC:** ${t.ec !== null ? t.ec.toFixed(2) : '--'} mS/cm (Probe GPIO 35)\n` +
            `• **Solution Temp:** ${t.waterTemp !== null ? t.waterTemp.toFixed(1) + '°C' : '--'}\n` +
            `• **Flow Rate:** ${t.flowRate !== null ? t.flowRate.toFixed(1) + ' L/min' : '--'}\n\n` +
            `**Agronomist Verdict:** Hardware streaming live packets. All biological metrics synced.`;
        } else {
          responseText = `⚠️ **No Physical Hardware Connected:**\n\nPlease connect your ESP32 controller in the **Device Pairing & Setup** tab (via USB cable or WiFi LAN) to stream real sensor data.`;
        }
      } else {
        responseText = `🌿 **Slynks Agronomist Advice:**\n\nFor "${userText}": In modern closed-loop hydroponics, maintaining target pH between 5.8-6.2 and keeping root temperatures below 22°C prevents 95% of crop failures.\n\nConnect your physical sensors to see real-time biological diagnostics!`;
      }

      this.appendChatMessage('ai', 'Slynks Hydro-AI', responseText);
      if (window.notifications) window.notifications.playChime('info');
    }, 350);
  }

  appendChatMessage(sender, name, content) {
    const stream = document.getElementById('chat-messages-stream');
    if (!stream) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg msg-${sender}`;

    let formattedContent = content
      .replace(/\n\n/g, '<p></p>')
      .replace(/\n• /g, '<li>')
      .replace(/\n- /g, '<li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    msgDiv.innerHTML = `
      <div class="msg-avatar"><i data-lucide="${sender === 'ai' ? 'bot' : 'user'}"></i></div>
      <div class="msg-bubble">
        <div class="msg-sender">${name}</div>
        <div class="msg-content">${formattedContent}</div>
        <span class="msg-timestamp">Just now</span>
      </div>
    `;

    stream.appendChild(msgDiv);
    if (window.lucide) window.lucide.createIcons({ root: msgDiv });
    stream.scrollTop = stream.scrollHeight;
  }

  diagnoseSymptom(symptomKey) {
    const symptomMap = {
      yellow_veins: "🟡 **Interveinal Chlorosis:** New upper leaves yellowing while veins stay green indicates **Iron Lockout**. Usually caused by pH rising above 6.4. Check your analog pH probe reading.",
      burnt_tips: "🔥 **Leaf Tip Burn:** High electrical conductivity (EC) causes salt accumulation at leaf tips. Check your EC conductivity sensor reading.",
      slimy_roots: "🪵 **Pythium Root Rot:** Brown slimy roots occur when water temp exceeds 24°C and dissolved oxygen drops. Verify your DS18B20 water temperature."
    };

    const diagnosis = symptomMap[symptomKey] || "Symptom recorded. Monitoring real sensor telemetry.";
    this.appendChatMessage('ai', 'Slynks Biobot Doctor', diagnosis);
  }

  bindEvents() {
    const form = document.getElementById('chat-input-form');
    const input = document.getElementById('chat-input-text');
    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
          this.handleUserMessage(text);
          input.value = '';
        }
      });
    }

    const symptomChips = document.querySelectorAll('.symptom-chip');
    symptomChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const symptom = e.currentTarget.dataset.symptom;
        if (symptom) this.diagnoseSymptom(symptom);
      });
    });
  }
}

window.SlynksAIAgent = SlynksAIAgent;
