/**
 * SLYNKS HYDROPONIC CONTROLLER - SLYNKS HYDRO-AI BIOBOT AGENT
 * Autonomous Hydroponic Agronomist & Biological Doctor
 */

class SlynksAIAgent {
  constructor() {
    this.vitalityScore = 95;
    this.currentPrescription = {
      action: 'balance',
      phDownAmount: 0,
      phUpAmount: 0,
      nutAAmount: 0,
      nutBAmount: 0,
      waterRefill: 0,
      text: 'All hydroponic parameters in optimal balance. Vitality index is 95%.'
    };

    this.chatHistory = [];
    this.knowledgeBase = this.initKnowledgeBase();
    this.bindEvents();
  }

  evaluateCropHealth(telemetry, cropProfile) {
    if (!telemetry || !cropProfile) return;
    const { ph, ec, waterTemp, dissolvedOxygen, airTemp, airHumidity, vpd } = telemetry;

    let score = 100;
    const target = cropProfile.targets;

    // 1. pH Evaluation
    const phDiff = Math.abs(ph - target.ph);
    let phStatus = 'status-pass';
    let phDesc = `Optimal root uptake at ${ph.toFixed(2)} pH for ${cropProfile.name}.`;
    if (phDiff > 0.6) {
      score -= 25;
      phStatus = 'status-danger';
      phDesc = `Severe pH drift (${ph.toFixed(2)} pH). Nutrient lockout risk!`;
    } else if (phDiff > 0.3) {
      score -= 10;
      phStatus = 'status-warn';
      phDesc = `Moderate pH drift (${ph.toFixed(2)} pH). Uptake buffer drifting.`;
    }

    // 2. EC Evaluation
    const ecDiff = Math.abs(ec - target.ec);
    let ecStatus = 'status-pass';
    let ecDesc = `Salinity index ${ec.toFixed(2)} mS/cm matches demand.`;
    if (ecDiff > 0.6) {
      score -= 25;
      ecStatus = 'status-danger';
      ecDesc = ec > target.ec ? `Toxic salt concentration (EC ${ec.toFixed(2)}).` : `Nutrient starvation (EC ${ec.toFixed(2)}).`;
    } else if (ecDiff > 0.25) {
      score -= 8;
      ecStatus = 'status-warn';
      ecDesc = ec > target.ec ? `Elevated nutrient salinity.` : `Nutrients mildly depleted.`;
    }

    // 3. Water Temp Evaluation
    let tempStatus = 'status-pass';
    let tempDesc = `Water at ${waterTemp.toFixed(1)}°C prevents Pythium root rot.`;
    if (waterTemp > 24.0) {
      score -= 20;
      tempStatus = 'status-danger';
      tempDesc = `Thermal stress (${waterTemp.toFixed(1)}°C). Pathogen risk!`;
    } else if (waterTemp > 22.0) {
      score -= 8;
      tempStatus = 'status-warn';
      tempDesc = `Warm solution (${waterTemp.toFixed(1)}°C). Lowers oxygen solubility.`;
    }

    // 4. VPD Evaluation
    let vpdStatus = 'status-pass';
    let vpdDesc = vpd ? `VPD at ${vpd.toFixed(2)} kPa optimizes calcium transpiration.` : 'VPD active';

    this.vitalityScore = Math.max(10, Math.min(100, Math.round(score)));

    // Update Diagnostics UI
    this.updateDiagnosticsUI({
      vitalityScore: `${this.vitalityScore}%`,
      phStatus, phDesc,
      ecStatus, ecDesc,
      tempStatus, tempDesc,
      vpdStatus, vpdDesc
    });

    this.computePrescription(telemetry, cropProfile);
  }

  updateDiagnosticsUI(data) {
    const vitalityVal = document.getElementById('ai-vitality-score');
    const vitalityBar = document.getElementById('ai-vitality-bar');

    if (vitalityVal) vitalityVal.textContent = data.vitalityScore;
    if (vitalityBar) vitalityBar.style.width = data.vitalityScore;

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
    const target = cropProfile.targets;
    const actions = [];
    const p = { phDownAmount: 0, phUpAmount: 0, nutAAmount: 0, nutBAmount: 0, text: '' };

    if (ph > target.ph + 0.25) {
      const ml = Math.max(5, Math.round((ph - target.ph) * 18));
      p.phDownAmount = ml;
      actions.push(`Dose ${ml}ml pH Down`);
    } else if (ph < target.ph - 0.25) {
      const ml = Math.max(5, Math.round((target.ph - ph) * 18));
      p.phUpAmount = ml;
      actions.push(`Dose ${ml}ml pH Up`);
    }

    if (ec < target.ec - 0.15) {
      const ml = Math.max(10, Math.round((target.ec - ec) * 50));
      p.nutAAmount = ml;
      p.nutBAmount = ml;
      actions.push(`Inject ${ml}ml Nutrient A & ${ml}ml Nutrient B`);
    }

    p.text = actions.length === 0 
      ? `System chemistry in equilibrium for ${cropProfile.name}. Vitality score is ${this.vitalityScore}%.`
      : `Recommended Action: ${actions.join(' + ')}.`;

    this.currentPrescription = p;
    const presTextEl = document.getElementById('ai-prescription-text');
    if (presTextEl) presTextEl.textContent = p.text;
  }

  executeAutoTune() {
    const p = this.currentPrescription;
    let didDose = false;

    if (p.phDownAmount > 0 && window.app) {
      window.app.triggerHardwareDose('PH_DOWN', p.phDownAmount);
      didDose = true;
    } else if (p.phUpAmount > 0 && window.app) {
      window.app.triggerHardwareDose('PH_UP', p.phUpAmount);
      didDose = true;
    }

    if (p.nutAAmount > 0 && window.app) {
      window.app.triggerHardwareDose('NUT_A', p.nutAAmount);
      window.app.triggerHardwareDose('NUT_B', p.nutBAmount);
      didDose = true;
    }

    if (!didDose) {
      if (window.notifications) {
        window.notifications.showToast('System in Equilibrium', 'Current pH and EC levels are already optimal. No dosing required.', 'emerald');
        window.notifications.playChime('success');
      }
    }
  }

  initKnowledgeBase() {
    return [
      {
        keywords: ['pakistan', 'lahore', 'karachi', 'summer', 'heat', '40', 'temperature'],
        response: `🌡️ **Pakistan Summer Hydroponic Management Protocol:**\n\nDuring Pakistani summers (ambient 42°C-46°C):\n1. **Insulate the Reservoir:** Wrap tank in reflective insulation to keep solution below 22°C.\n2. **Run Continuous Aeration:** Warmer water holds less oxygen. Keep air stone bubbling 24/7.\n3. **Lower EC Target by 15%:** Prevent nutrient tip burn as plant transpiration triples in dry heat.\n4. **Freeze-Bottle Cooling:** Float frozen 2L water bottles during peak afternoon hours.`
      },
      {
        keywords: ['strawberry', 'strawberries', 'ec', 'ph'],
        response: `🍓 **Strawberry Hydroponic Protocol:**\n- **Target pH:** 5.8 - 6.2\n- **Target EC:** 1.2 - 1.6 mS/cm\n- **Light:** 12 to 14 hours PPFD 350-450.\n- Keep strawberry crowns strictly dry above net cups to prevent crown rot.`
      },
      {
        keywords: ['lettuce', 'greens'],
        response: `🥬 **Butterhead Lettuce Protocol:**\n- **Target pH:** 5.8 - 6.2\n- **Target EC:** 1.2 - 1.5 mS/cm\n- **Water Temp:** 18°C - 21°C\n- Maintain gentle canopy breeze to prevent calcium tip burn.`
      },
      {
        keywords: ['tomato', 'tomatoes'],
        response: `🍅 **Vine Tomato Hydroponic Protocol:**\n- **Target pH:** 6.0 - 6.5\n- **Target EC:** 2.0 - 2.5 mS/cm\n- High potassium and calcium demand during fruit swell stage.`
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
      } else if (query.includes('status') || query.includes('telemetry') || query.includes('vitality')) {
        const t = window.app ? window.app.state.telemetry : null;
        if (t) {
          responseText = `📊 **Current Hydroponic State:**\n\n` +
            `• **Water pH:** ${t.ph.toFixed(2)} pH (Target: 5.8 - 6.2)\n` +
            `• **EC Salinity:** ${t.ec.toFixed(2)} mS/cm (${t.tds} PPM)\n` +
            `• **Solution Temp:** ${t.waterTemp.toFixed(1)}°C\n` +
            `• **Dissolved Oxygen:** ${t.dissolvedOxygen.toFixed(1)} mg/L\n` +
            `• **Vitality Index:** ${this.vitalityScore}%\n\n` +
            `All biological parameters are actively regulated.`;
        }
      } else {
        responseText = `🌿 **Slynks Biobot Agronomist:**\n\nRegarding "${userText}": In recirculating hydroponics, maintaining solution temperature between 18°C-21°C and pH between 5.8-6.2 ensures 100% nutrient bioavailability and healthy white root mass.\n\nUse the **Auto-Tune** button to execute precise pH and EC adjustments.`;
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
      yellow_veins: "🟡 **Interveinal Chlorosis:** Yellowing between upper leaf veins indicates **Iron (Fe) Lockout**. Usually triggered when pH drifts above 6.4. Slynks Auto-Tune can dose 5ml pH Down to recover absorption.",
      burnt_tips: "🔥 **Leaf Tip Burn:** Brown crispy edges indicate **Excess EC / Salt Stress**. Dilute reservoir by adding 10-15% fresh RO water.",
      slimy_roots: "🪵 **Pythium Root Rot:** Brown mushy roots occur when water temp exceeds 24°C with low oxygen. Turn ON the oxygen aerator and cool water to 20°C."
    };

    const diagnosis = symptomMap[symptomKey] || "Symptom recorded. Monitoring real sensor chemistry.";
    this.appendChatMessage('ai', 'Slynks Biobot Doctor', diagnosis);
  }

  bindEvents() {
    // Chat Form Submit
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

    // Auto-Tune Prescription Button
    const btnAutoTune = document.getElementById('btn-execute-auto-tune');
    if (btnAutoTune) {
      btnAutoTune.addEventListener('click', () => this.executeAutoTune());
    }

    // Symptom Chips
    const symptomChips = document.querySelectorAll('.symptom-chip');
    symptomChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const symptom = e.currentTarget.dataset.symptom;
        if (symptom) this.diagnoseSymptom(symptom);
      });
    });

    // Quick Prompt Chips
    const promptChips = document.querySelectorAll('.prompt-chip');
    promptChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const promptText = e.currentTarget.textContent.trim();
        this.handleUserMessage(promptText);
      });
    });
  }
}

window.SlynksAIAgent = SlynksAIAgent;
