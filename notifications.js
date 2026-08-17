/**
 * SLYNKS HYDROPONIC CONTROLLER - SMART NOTIFICATIONS & ALERT ENGINE
 */

class SlynksNotificationSystem {
  constructor() {
    this.soundEnabled = true;
    this.audioCtx = null;
    this.thresholdRules = {
      phMin: 5.5,
      phMax: 6.5,
      ecMin: 1.0,
      ecMax: 2.2,
      tempMax: 24.0,
      levelMin: 20,
      doMin: 5.0,
      audioChime: true,
      desktopPush: true,
      whatsappSms: false
    };

    this.activeAlerts = [];
    this.toastContainer = document.getElementById('toast-container');
    this.initSoundEngine();
    this.loadRules();
    this.bindEvents();
  }

  initSoundEngine() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  resumeAudioContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playChime(type = 'info') {
    if (!this.soundEnabled || !this.thresholdRules.audioChime) return;
    this.resumeAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'success') {
        // High pleasant ascending dual chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.25); // G5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'warning') {
        // Warning pulsed tone
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.setValueAtTime(370, now + 0.15); // F#4
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'critical') {
        // Critical double beep
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.setValueAtTime(659, now + 0.1);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        // Gentle info blip
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (err) {
      console.warn('Audio play error:', err);
    }
  }

  showToast(title, message, type = 'emerald') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'bell';
    if (type === 'emerald') iconName = 'check-circle';
    if (type === 'amber') iconName = 'alert-triangle';
    if (type === 'ruby') iconName = 'alert-octagon';

    toast.innerHTML = `
      <div style="color: ${type === 'emerald' ? 'var(--emerald-400)' : type === 'amber' ? 'var(--amber-500)' : 'var(--ruby-500)'}">
        <i data-lucide="${iconName}"></i>
      </div>
      <div>
        <strong style="display: block; font-size: 0.85rem; color: #fff;">${title}</strong>
        <span style="font-size: 0.75rem; color: var(--text-secondary);">${message}</span>
      </div>
    `;

    this.toastContainer.appendChild(toast);
    if (window.lucide) window.lucide.createIcons({ root: toast });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  evaluateTelemetry(telemetry) {
    if (!telemetry || telemetry.ph === null || telemetry.ec === null) {
      this.renderNeeds([]);
      return;
    }
    const { ph, ec, waterTemp, waterLevel, dissolvedOxygen } = telemetry;
    const rules = this.thresholdRules;
    const needsList = [];

    // Check pH
    if (ph > rules.phMax) {
      needsList.push({
        id: 'ph-high',
        priority: 'medium',
        title: `pH High Alert (${ph.toFixed(2)} pH)`,
        desc: `Nutrient lockout risk. Recommended: Auto-dose ${(Math.max(5, (ph - 6.0) * 15)).toFixed(0)}ml pH Down.`,
        actionText: 'Dose pH Down',
        actionType: 'dose-ph-down',
        amount: Math.max(5, Math.round((ph - 6.0) * 15))
      });
    } else if (ph < rules.phMin) {
      needsList.push({
        id: 'ph-low',
        priority: 'medium',
        title: `pH Low Alert (${ph.toFixed(2)} pH)`,
        desc: `Solution too acidic. Recommended: Dose ${(Math.max(5, (5.8 - ph) * 15)).toFixed(0)}ml pH Up buffer.`,
        actionText: 'Dose pH Up',
        actionType: 'dose-ph-up',
        amount: Math.max(5, Math.round((5.8 - ph) * 15))
      });
    }

    // Check EC
    if (ec < rules.ecMin) {
      needsList.push({
        id: 'ec-low',
        priority: 'medium',
        title: `Nutrient Depleted (EC ${ec.toFixed(2)} mS/cm)`,
        desc: `Plants absorbed ions. Top up with 15ml Nutrient A+B stock solution.`,
        actionText: 'Dose Nutrients',
        actionType: 'dose-nutrients',
        amount: 15
      });
    } else if (ec > rules.ecMax) {
      needsList.push({
        id: 'ec-high',
        priority: 'high',
        title: `Salinity Burn Risk (EC ${ec.toFixed(2)} mS/cm)`,
        desc: `TDS is high. Top up 10L clean fresh RO water to dilute concentration.`,
        actionText: 'Dilute with RO Water',
        actionType: 'refill-water',
        amount: 10
      });
    }

    // Check Water Level
    if (waterLevel < rules.levelMin) {
      needsList.push({
        id: 'water-low',
        priority: 'high',
        title: `Reservoir Water Low (${waterLevel}% Remaining)`,
        desc: `Prevent pump dry-run damage. Add fresh water solution.`,
        actionText: 'Add 15L Water',
        actionType: 'refill-water',
        amount: 15
      });
    }

    // Check Water Temp
    if (waterTemp > rules.tempMax) {
      needsList.push({
        id: 'temp-high',
        priority: 'high',
        title: `High Solution Temp (${waterTemp.toFixed(1)}°C)`,
        desc: `Risk of Pythium root rot & low oxygen. Engage exhaust ventilation or ice pack cooling.`,
        actionText: 'Boost Aerator & Fan',
        actionType: 'boost-cooling'
      });
    }

    // Check DO
    if (dissolvedOxygen < rules.doMin) {
      needsList.push({
        id: 'do-low',
        priority: 'high',
        title: `Low Dissolved Oxygen (${dissolvedOxygen.toFixed(1)} mg/L)`,
        desc: `Root hypoxia danger. Air bubbler stone requires continuous boost.`,
        actionText: 'Boost Oxygen Stone',
        actionType: 'boost-aerator'
      });
    }

    this.updateNeedsUI(needsList);
    this.updateProactiveBanner(needsList);
  }

  updateNeedsUI(needsList) {
    const listContainer = document.getElementById('active-needs-list');
    const badge = document.getElementById('alerts-tab-badge');
    const headerCount = document.getElementById('header-notif-count');
    
    if (badge) badge.textContent = needsList.length;
    if (headerCount) headerCount.textContent = needsList.length;

    if (!listContainer) return;

    if (needsList.length === 0) {
      listContainer.innerHTML = `
        <div class="need-item-card priority-info">
          <div class="need-icon"><i data-lucide="check-circle" class="text-emerald"></i></div>
          <div class="need-body">
            <div class="need-top">
              <span class="need-title">Hydroponic System in Perfect Balance</span>
              <span class="priority-tag tag-info">All Systems Good</span>
            </div>
            <p class="need-desc">pH, EC, Water Temperature, and Dissolved Oxygen are within target parameters.</p>
          </div>
        </div>
      `;
    } else {
      listContainer.innerHTML = needsList.map(need => `
        <div class="need-item-card priority-${need.priority}" id="need-${need.id}">
          <div class="need-icon">
            <i data-lucide="${need.priority === 'high' ? 'alert-octagon' : 'alert-triangle'}" class="${need.priority === 'high' ? 'text-ruby' : 'text-amber'}"></i>
          </div>
          <div class="need-body">
            <div class="need-top">
              <span class="need-title">${need.title}</span>
              <span class="priority-tag tag-${need.priority === 'high' ? 'danger' : 'medium'}">${need.priority.toUpperCase()}</span>
            </div>
            <p class="need-desc">${need.desc}</p>
            <div class="need-actions">
              <button class="btn btn-sm btn-primary need-action-btn" data-action="${need.actionType}" data-amount="${need.amount || 0}">
                <i data-lucide="sparkles"></i> ${need.actionText}
              </button>
              <button class="btn btn-sm btn-ghost need-snooze-btn" data-id="${need.id}">Snooze</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons({ root: listContainer });
  }

  updateProactiveBanner(needsList) {
    const banner = document.getElementById('proactive-alert-banner');
    if (!banner) return;

    if (needsList.length === 0) {
      banner.style.display = 'none';
      return;
    }

    const topNeed = needsList[0];
    banner.style.display = 'flex';
    document.getElementById('banner-title').textContent = `Hydroponic Need Detected: ${topNeed.title}`;
    document.getElementById('banner-desc').textContent = topNeed.desc;
    
    const quickFixBtn = document.getElementById('banner-quick-fix-btn');
    if (quickFixBtn) {
      quickFixBtn.innerHTML = `<i data-lucide="sparkles"></i> Quick Auto-Fix (${topNeed.actionText})`;
      quickFixBtn.onclick = () => {
        if (window.app) window.app.handleNeedAction(topNeed.actionType, topNeed.amount);
        banner.style.display = 'none';
      };
    }

    if (window.lucide) window.lucide.createIcons({ root: banner });
  }

  loadRules() {
    const saved = localStorage.getItem('slynks_threshold_rules');
    if (saved) {
      try {
        this.thresholdRules = { ...this.thresholdRules, ...JSON.parse(saved) };
      } catch (e) {
        console.error(e);
      }
    }
  }

  saveRulesFromUI() {
    this.thresholdRules.phMin = parseFloat(document.getElementById('rule-ph-min').value) || 5.5;
    this.thresholdRules.phMax = parseFloat(document.getElementById('rule-ph-max').value) || 6.5;
    this.thresholdRules.ecMin = parseFloat(document.getElementById('rule-ec-min').value) || 1.0;
    this.thresholdRules.ecMax = parseFloat(document.getElementById('rule-ec-max').value) || 2.2;
    this.thresholdRules.tempMax = parseFloat(document.getElementById('rule-temp-max').value) || 24.0;
    this.thresholdRules.levelMin = parseInt(document.getElementById('rule-level-min').value) || 20;
    this.thresholdRules.doMin = parseFloat(document.getElementById('rule-do-min').value) || 5.0;
    this.thresholdRules.audioChime = document.getElementById('chk-audio-chime').checked;
    this.thresholdRules.desktopPush = document.getElementById('chk-desktop-push').checked;
    this.thresholdRules.whatsappSms = document.getElementById('chk-whatsapp-sms').checked;

    localStorage.setItem('slynks_threshold_rules', JSON.stringify(this.thresholdRules));
    this.playChime('success');
    this.showToast('Rules Saved', 'Smart notification bounds and channels updated successfully!', 'emerald');
  }

  bindEvents() {
    const soundToggle = document.getElementById('sound-toggle-btn');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        const icon = document.getElementById('sound-icon');
        if (icon) {
          icon.setAttribute('data-lucide', this.soundEnabled ? 'volume-2' : 'volume-x');
          if (window.lucide) window.lucide.createIcons();
        }
        this.showToast(
          'Sound Notifications',
          this.soundEnabled ? 'Audio tones enabled' : 'Audio muted',
          this.soundEnabled ? 'emerald' : 'amber'
        );
        if (this.soundEnabled) this.playChime('info');
      });
    }

    const testBtn = document.getElementById('btn-test-alert');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        this.playChime('warning');
        this.showToast('Test Alarm', 'Smart notification chime triggered successfully (Web Audio API).', 'amber');
      });
    }

    const saveRulesBtn = document.getElementById('btn-save-rules');
    if (saveRulesBtn) {
      saveRulesBtn.addEventListener('click', () => this.saveRulesFromUI());
    }

    const bannerDismiss = document.getElementById('banner-dismiss-btn');
    if (bannerDismiss) {
      bannerDismiss.addEventListener('click', () => {
        const banner = document.getElementById('proactive-alert-banner');
        if (banner) banner.style.display = 'none';
      });
    }

    document.addEventListener('click', (e) => {
      const target = e.target.closest('.need-action-btn');
      if (target) {
        const action = target.dataset.action;
        const amount = parseFloat(target.dataset.amount) || 0;
        if (window.app) window.app.handleNeedAction(action, amount);
      }
    });
  }
}

window.SlynksNotificationSystem = SlynksNotificationSystem;
