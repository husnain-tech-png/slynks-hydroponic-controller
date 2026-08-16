/**
 * SLYNKS HYDROPONIC CONTROLLER - SLYNKS HYDRO-AI BIOBOT AGENT
 * Embedded Autonomous Hydroponic Agronomist & IoT Doctor
 */

class SlynksAIAgent {
  constructor() {
    this.vitalityScore = 94;
    this.currentPrescription = {
      action: 'maintain',
      phDownAmount: 0,
      phUpAmount: 0,
      nutAAmount: 0,
      nutBAmount: 0,
      waterRefill: 0,
      text: 'All hydroponic parameters are balanced. Recommended action: Maintain photoperiod and inspect reservoir in 48 hours.'
    };

    this.chatHistory = [];
    this.knowledgeBase = this.initKnowledgeBase();
    this.bindEvents();
  }

  evaluateCropHealth(telemetry, cropProfile) {
    let score = 100;
    const { ph, ec, waterTemp, dissolvedOxygen, airTemp, airHumidity, vpd } = telemetry;
    const target = cropProfile.targets;

    // 1. pH Evaluation
    const phDiff = Math.abs(ph - target.ph);
    let phStatus = 'status-pass';
    let phDesc = `Optimal uptake buffer at ${ph.toFixed(2)} pH for ${cropProfile.name}.`;
    if (phDiff > 0.6) {
      score -= 25;
      phStatus = 'status-danger';
      phDesc = `Severe pH drift (${ph.toFixed(2)} pH). Nutrient lockout imminent.`;
    } else if (phDiff > 0.3) {
      score -= 10;
      phStatus = 'status-warn';
      phDesc = `Moderate pH drift (${ph.toFixed(2)} pH). Uptake efficiency decreased.`;
    }

    // 2. EC Evaluation
    const ecDiff = Math.abs(ec - target.ec);
    let ecStatus = 'status-pass';
    let ecDesc = `Salinity index ${ec.toFixed(2)} mS/cm matches vegetative demand.`;
    if (ecDiff > 0.6) {
      score -= 25;
      ecStatus = 'status-danger';
      ecDesc = ec > target.ec ? `Toxic salt concentration (EC ${ec.toFixed(2)}). Tip burn risk.` : `Nutrient starvation (EC ${ec.toFixed(2)}).`;
    } else if (ecDiff > 0.25) {
      score -= 8;
      ecStatus = 'status-warn';
      ecDesc = ec > target.ec ? `Slightly elevated nutrient concentration.` : `Nutrient concentration mildly depleted.`;
    }

    // 3. Water Temp Evaluation
    let tempStatus = 'status-pass';
    let tempDesc = `Water at ${waterTemp.toFixed(1)}°C suppresses pathogenic Pythium fungi.`;
    if (waterTemp > 24.5) {
      score -= 20;
      tempStatus = 'status-danger';
      tempDesc = `Dangerous thermal spike (${waterTemp.toFixed(1)}°C). High root rot hazard!`;
    } else if (waterTemp > 22.5) {
      score -= 8;
      tempStatus = 'status-warn';
      tempDesc = `Elevated temperature (${waterTemp.toFixed(1)}°C). Lowers oxygen solubility.`;
    }

    // 4. DO & VPD Evaluation
    let vpdStatus = 'status-pass';
    let vpdDesc = `VPD at ${vpd.toFixed(2)} kPa encourages gentle transpiration.`;
    if (vpd < 0.6 || vpd > 1.6) {
      score -= 10;
      vpdStatus = 'status-warn';
      vpdDesc = vpd > 1.6 ? `Dry air (${vpd.toFixed(2)} kPa) causes high water loss.` : `High humidity (${vpd.toFixed(2)} kPa) stalls mineral uptake.`;
    }

    if (dissolvedOxygen < 5.5) {
      score -= 15;
    }

    this.vitalityScore = Math.max(10, Math.min(100, Math.round(score)));

    // Update Diagnostics UI
    this.updateDiagnosticsUI({
      vitalityScore: this.vitalityScore,
      phStatus, phDesc,
      ecStatus, ecDesc,
      tempStatus, tempDesc,
      vpdStatus, vpdDesc
    });

    // Compute Dynamic AI Prescription
    this.computePrescription(telemetry, cropProfile);
  }

  updateDiagnosticsUI(data) {
    const vitalityVal = document.getElementById('ai-vitality-score');
    const vitalityBar = document.getElementById('ai-vitality-bar');
    const heroScore = document.getElementById('hero-health-score');

    if (vitalityVal) vitalityVal.textContent = `${data.vitalityScore} / 100`;
    if (vitalityBar) vitalityBar.style.width = `${data.vitalityScore}%`;
    if (heroScore) heroScore.textContent = `${data.vitalityScore}%`;

    const updateDiagItem = (id, status, title, desc) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = `diag-item ${status}`;
      const descEl = el.querySelector('span');
      if (descEl) descEl.textContent = desc;
      const icon = el.querySelector('.diag-icon');
      if (icon) {
        icon.style.color = status === 'status-pass' ? 'var(--emerald-400)' : status === 'status-warn' ? 'var(--amber-500)' : 'var(--ruby-500)';
      }
    };

    updateDiagItem('diag-ph-status', data.phStatus, 'pH Stability', data.phDesc);
    updateDiagItem('diag-ec-status', data.ecStatus, 'EC Salinity Index', data.ecDesc);
    updateDiagItem('diag-temp-status', data.tempStatus, 'Root Zone Thermal Safety', data.tempDesc);
    updateDiagItem('diag-vpd-status', data.vpdStatus, 'Vapor Pressure Deficit (VPD)', data.vpdDesc);
  }

  computePrescription(telemetry, cropProfile) {
    const { ph, ec, waterTemp } = telemetry;
    const target = cropProfile.targets;
    const p = {
      phDownAmount: 0,
      phUpAmount: 0,
      nutAAmount: 0,
      nutBAmount: 0,
      waterRefill: 0,
      text: ''
    };

    const actions = [];

    if (ph > target.ph + 0.25) {
      const ml = Math.max(5, Math.round((ph - target.ph) * 18));
      p.phDownAmount = ml;
      actions.push(`Dose ${ml}ml pH Down (Phosphoric Buffer)`);
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
    } else if (ec > target.ec + 0.3) {
      p.waterRefill = 10;
      actions.push(`Add 10L RO Water to dilute nutrient salinity`);
    }

    if (waterTemp > 23.5) {
      actions.push(`Run Exhaust Fan & Oxygen aeration at 100%`);
    }

    if (actions.length === 0) {
      p.text = `System in equilibrium for ${cropProfile.name}. Vitality is ${this.vitalityScore}%. Continue 14-hour photoperiod.`;
    } else {
      p.text = `AI Optimization Action: ${actions.join(' + ')}.`;
    }

    this.currentPrescription = p;

    const presTextEl = document.getElementById('ai-prescription-text');
    if (presTextEl) presTextEl.textContent = p.text;
  }

  applyPrescription() {
    if (!window.app) return;
    const p = this.currentPrescription;

    if (p.phDownAmount > 0) window.app.dosePhDown(p.phDownAmount);
    if (p.phUpAmount > 0) window.app.dosePhUp(p.phUpAmount);
    if (p.nutAAmount > 0) {
      window.app.doseNutrientA(p.nutAAmount);
      window.app.doseNutrientB(p.nutBAmount);
    }
    if (p.waterRefill > 0) window.app.refillWater(p.waterRefill);

    if (window.notifications) {
      window.notifications.showToast('Auto-Tune Executed', 'Slynks Hydro-AI autonomous prescription applied!', 'emerald');
      window.notifications.playChime('success');
    }
  }

  initKnowledgeBase() {
    return [
      {
        keywords: ['pakistan', 'lahore', 'karachi', 'summer', 'heat', '40', 'temperature'],
        response: `🌡️ **Pakistan Summer Hydroponic Management Protocol:**\n\nHydroponics during Pakistani summers (May-August in Punjab & Sindh where ambient reaches 42°C-46°C) requires active thermal control:\n1. **Insulate the Reservoir:** Wrap the tank in reflective bubble foil or bury it partially underground in shaded greenhouse areas.\n2. **Dissolved Oxygen Preservation:** Warm water holds significantly less oxygen (6.5 mg/L at 26°C vs 9.2 mg/L at 19°C). Run dual air stones continuously.\n3. **Dilute Nutrient Concentration (Lower EC):** Plants transpire water faster during hot dry Pakistani days. Reduce EC by 15-20% (e.g. from 1.6 to 1.25 mS/cm) to prevent salt burn.\n4. **Freeze-Bottle Cooling:** Float frozen 2L water bottles into the reservoir during peak afternoon hours (12 PM - 4 PM) as a zero-cost water chiller alternative.`
      },
      {
        keywords: ['strawberry', 'strawberries', 'nutrient', 'ec', 'ph'],
        response: `🍓 **Alpine & Dutch Strawberry Hydroponic Guide:**\n- **Target pH:** 5.5 - 6.2\n- **Target EC (Veg):** 1.0 - 1.2 mS/cm\n- **Target EC (Flowering/Fruiting):** 1.4 - 1.8 mS/cm with elevated Potassium (K) and Calcium (Ca).\n- **Photoperiod:** 12 to 14 hours of high PAR light (PPFD 350-450).\n- **Caution:** Strawberries are sensitive to high EC root burn and crown rot. Ensure net cups sit above standing water in Ebb & Flow or NFT gutters.`
      },
      {
        keywords: ['lettuce', 'butterhead', 'greens', 'salad'],
        response: `🥬 **Butterhead & Romaine Lettuce Recipe:**\n- **Target pH:** 5.8 - 6.2\n- **Target EC:** 1.2 - 1.6 mS/cm (600 - 800 PPM)\n- **Water Temp:** 18°C - 21°C\n- **Photoperiod:** 14 - 16 hours daily.\n- **Tip:** Prevent tip burn by maintaining continuous air movement across the inner leaves with gentle oscillating fans to drive calcium transpiration.`
      },
      {
        keywords: ['tomato', 'tomatoes', 'dutch bucket', 'calcium'],
        response: `🍅 **Vine Tomato Master Recipe (Dutch Bucket / Perlite):**\n- **Target pH:** 5.8 - 6.5\n- **Target EC (Veg):** 1.8 - 2.2 mS/cm\n- **Target EC (Heavy Fruiting):** 2.4 - 3.2 mS/cm\n- **Nutrient Ratio:** High Nitrogen (N) during early canopy growth, transitioning to High Potassium (K) and Calcium Nitrate during fruit swell to prevent Blossom End Rot.`
      },
      {
        keywords: ['ph drift', 'ph rising', 'ph up', 'why ph'],
        response: `🧪 **Why Does Hydroponic pH Drift Upward?**\n1. **Nitrate (NO₃⁻) Anion Uptake:** As plant roots absorb negatively charged nitrate ions, they release hydroxide (OH⁻) or bicarbonate (HCO₃⁻) back into the water, driving pH UP.\n2. **Algae Photosynthesis:** Green algae consumes dissolved CO₂ (carbonic acid), causing rapid daytime pH spikes.\n3. **Hard Tap Water:** Pakistani municipal and borehole ground water often has high carbonate hardness (alkalinity buffer > 150 ppm CaCO₃). Use RO (Reverse Osmosis) water for long-term stability.`
      },
      {
        keywords: ['yellow', 'chlorosis', 'veins', 'leaf'],
        response: `🟡 **Leaf Chlorosis Diagnostic:**\n- **Interveinal Chlorosis on NEW Upper Leaves:** Iron (Fe) deficiency. Usually caused by pH rising above 6.5, which locks out iron uptake even if iron is present in the solution. Fix: Lower pH to 5.8.\n- **Interveinal Chlorosis on OLDER Lower Leaves:** Magnesium (Mg) deficiency. Fix: Add Epsom salt (Magnesium Sulfate) at 0.5g/Litre.`
      },
      {
        keywords: ['burnt tips', 'burn', 'tip burn', 'crispy'],
        response: `🔥 **Nutrient Salt Burn & Tip Burn:**\n- **Causes:** EC level is too high for the current transpiration rate, leading to osmotic stress and salt accumulation at the leaf margins.\n- **Action:** Immediately dilute the reservoir with 25% fresh RO water and lower EC to 1.2 mS/cm.`
      },
      {
        keywords: ['root rot', 'pythium', 'brown roots', 'slimy'],
        response: `🪵 **Pythium Root Rot Emergency Treatment:**\n1. **Symptoms:** Roots turn brown, slimy, stringy, and develop a foul stagnant odor.\n2. **Primary Cause:** Water temperature exceeding 23°C combined with Dissolved Oxygen dropping below 5 mg/L.\n3. **Remedy:** Flush system, clean reservoir with 3% Food-Grade Hydrogen Peroxide (H₂O₂ at 2-3ml/Litre), run air bubbler at maximum, and introduce beneficial Bacillus Amyloliquefaciens (Hydroguard).`
      }
    ];
  }

  handleUserMessage(userText) {
    const query = userText.toLowerCase().trim();
    if (!query) return;

    // Append User Message to UI
    this.appendChatMessage('user', 'You', userText);

    // AI Reasoning & Answer Generation
    setTimeout(() => {
      let matched = this.knowledgeBase.find(item => 
        item.keywords.some(k => query.includes(k))
      );

      let responseText = '';
      if (matched) {
        responseText = matched.response;
      } else if (query.includes('analyze') || query.includes('status') || query.includes('telemetry')) {
        const tel = window.app ? window.app.state.telemetry : { ph: 5.95, ec: 1.42, waterTemp: 20.4, dissolvedOxygen: 8.1 };
        responseText = `📊 **Live Hydroponic Telemetry Diagnostic Analysis:**\n\n` +
          `• **pH:** ${tel.ph.toFixed(2)} — ${tel.ph >= 5.5 && tel.ph <= 6.5 ? '✅ In safe target zone for nutrient bioavailability.' : '⚠️ Drifting out of optimal zone.'}\n` +
          `• **EC:** ${tel.ec.toFixed(2)} mS/cm — ${tel.ec >= 1.2 && tel.ec <= 1.8 ? '✅ Excellent vegetative nutrient strength.' : '⚠️ Review nutrient dosage.'}\n` +
          `• **Water Solution Temp:** ${tel.waterTemp.toFixed(1)}°C — ✅ Safe from fungal Pythium propagation.\n` +
          `• **Dissolved Oxygen:** ${tel.dissolvedOxygen.toFixed(1)} mg/L — ✅ High root oxygenation.\n\n` +
          `**Agronomist Verdict:** System is operating at **${this.vitalityScore}% biological vitality**. Auto-dosing pumps are on standby.`;
      } else {
        responseText = `🌿 **Slynks Agronomist Recommendation:**\n\nRegarding "${userText}": In modern closed-loop hydroponics (NFT, DWC, Ebb & Flow), maintaining stable pH between 5.8-6.2 and keeping root temperatures below 22°C ensures 98%+ mineral bioavailability.\n\nWould you like me to run an **automated nutrient dosing cycle** or adjust your **light photoperiod**?`;
      }

      this.appendChatMessage('ai', 'Slynks Hydro-AI', responseText);
      if (window.notifications) window.notifications.playChime('info');
    }, 450);
  }

  appendChatMessage(sender, name, content) {
    const stream = document.getElementById('chat-messages-stream');
    if (!stream) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg msg-${sender}`;

    // Format markdown-like bold and bullet points
    let formattedContent = content
      .replace(/\n\n/g, '<p></p>')
      .replace(/\n• /g, '<li>')
      .replace(/\n- /g, '<li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    msgDiv.innerHTML = `
      <div class="msg-avatar">
        <i data-lucide="${sender === 'ai' ? 'bot' : 'user'}"></i>
      </div>
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
      yellow_veins: "🟡 **Interveinal Chlorosis Detected:** New upper leaves yellowing while veins stay green indicates **Iron (Fe) Lockout**. In 90% of hydroponic setups, this is caused by water pH climbing above 6.4. Action: Dose 8ml pH Down to return to 5.8.",
      burnt_tips: "🔥 **Crispy Leaf Tip Burn Detected:** High electrical conductivity (EC) or sudden drop in humidity causes salt accumulation at leaf tips. Action: Top up 10L clean RO water to reduce EC from 1.9 to 1.4 mS/cm.",
      slimy_roots: "🪵 **Pythium Root Rot Hazard Detected:** Brown slimy roots occur when water solution temperature exceeds 24°C and dissolved oxygen is depleted. Action: Add 3% Food Grade H₂O₂ (3ml/L) and turn aerator to 100%.",
      curled_leaves: "🍂 **Cupped Leaf Stress Detected:** High Vapor Pressure Deficit (VPD > 1.6 kPa) or excessive light intensity is causing leaf margins to curl up to conserve moisture. Action: Raise grow light fixture by 10cm.",
      algae_growth: "🟢 **Algae Bloom in Reservoir:** Light penetrating reservoir tank or net cups allows photosynthetic algae to thrive and steal nitrogen. Action: Blackout reservoir lid with opaque foil and cover open net cup gaps."
    };

    const diagnosis = symptomMap[symptomKey] || "Symptom recorded. Monitoring nutrient levels.";
    this.appendChatMessage('ai', 'Slynks Diagnostic Doctor', diagnosis);
    if (window.notifications) {
      window.notifications.showToast('Symptom Analyzed', 'Slynks Biobot diagnosed crop deficiency!', 'emerald');
      window.notifications.playChime('info');
    }
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

    const promptChips = document.querySelectorAll('.prompt-chip');
    promptChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const promptText = e.currentTarget.dataset.prompt;
        if (promptText) this.handleUserMessage(promptText);
      });
    });

    const symptomChips = document.querySelectorAll('.symptom-chip');
    symptomChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const symptom = e.currentTarget.dataset.symptom;
        if (symptom) this.diagnoseSymptom(symptom);
      });
    });

    const clearChatBtn = document.getElementById('btn-clear-chat');
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => {
        const stream = document.getElementById('chat-messages-stream');
        if (stream) {
          stream.innerHTML = `
            <div class="chat-msg msg-ai">
              <div class="msg-avatar"><i data-lucide="bot"></i></div>
              <div class="msg-bubble">
                <div class="msg-sender">Slynks Hydro-AI</div>
                <div class="msg-content">Chat history cleared. How can I assist your hydroponic crops today?</div>
                <span class="msg-timestamp">Just now</span>
              </div>
            </div>
          `;
          if (window.lucide) window.lucide.createIcons({ root: stream });
        }
      });
    }

    const applyPrescBtn = document.getElementById('btn-apply-prescription');
    if (applyPrescBtn) {
      applyPrescBtn.addEventListener('click', () => this.applyPrescription());
    }

    const quickScanBtn = document.getElementById('btn-quick-scan');
    if (quickScanBtn) {
      quickScanBtn.addEventListener('click', () => {
        if (window.notifications) {
          window.notifications.showToast('AI Health Scan', `System Vitality: ${this.vitalityScore}% • All parameters within biological safe zones.`, 'emerald');
          window.notifications.playChime('success');
        }
      });
    }
  }
}

window.SlynksAIAgent = SlynksAIAgent;
