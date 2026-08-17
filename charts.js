/**
 * SLYNKS HYDROPONIC CONTROLLER - HISTORICAL TELEMETRY CHARTS & ANALYTICS
 */

class SlynksAnalyticsManager {
  constructor() {
    this.currentRange = '1h';
    this.charts = {};
    this.historyData = this.generateHistoricalData('1h');
    this.initCharts();
    this.bindEvents();
  }

  generateHistoricalData(range) {
    const pointsCount = range === '1h' ? 24 : range === '24h' ? 48 : range === '7d' ? 56 : 60;
    const labels = [];
    const phData = [];
    const ecData = [];
    const waterTempData = [];
    const airTempData = [];
    const waterLevelData = [];
    const doData = [];
    const lightData = [];

    const now = new Date();

    for (let i = pointsCount - 1; i >= 0; i--) {
      let timeLabel = '';
      if (range === '1h') {
        const d = new Date(now.getTime() - i * 2.5 * 60 * 1000);
        timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } else if (range === '24h') {
        const d = new Date(now.getTime() - i * 30 * 60 * 1000);
        timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } else if (range === '7d') {
        const d = new Date(now.getTime() - i * 3 * 3600 * 1000);
        timeLabel = `${d.getDate()} Aug ${String(d.getHours()).padStart(2, '0')}h`;
      } else {
        const d = new Date(now.getTime() - i * 12 * 3600 * 1000);
        timeLabel = `${d.getDate()} Aug`;
      }

      labels.push(timeLabel);

      // Organic realistic fluctuating values
      const progress = (pointsCount - i) / pointsCount;
      const ph = 5.85 + Math.sin(progress * Math.PI * 4) * 0.18 + (Math.random() * 0.05);
      const ec = 1.38 + Math.cos(progress * Math.PI * 3) * 0.09 + (Math.random() * 0.04);
      const waterTemp = 20.0 + Math.sin(progress * Math.PI * 2) * 1.2 + (Math.random() * 0.3);
      const airTemp = 23.5 + Math.sin(progress * Math.PI * 2) * 2.5 + (Math.random() * 0.4);
      const waterLevel = Math.max(25, 95 - (progress * 22) + (Math.random() * 1.5));
      const doVal = 8.4 - (waterTemp - 18) * 0.15 + (Math.random() * 0.2);
      const isDay = Math.sin(progress * Math.PI * 3) > -0.2;
      const lightVal = isDay ? 22000 + Math.random() * 1500 : 0;

      phData.push(parseFloat(ph.toFixed(2)));
      ecData.push(parseFloat(ec.toFixed(2)));
      waterTempData.push(parseFloat(waterTemp.toFixed(1)));
      airTempData.push(parseFloat(airTemp.toFixed(1)));
      waterLevelData.push(parseFloat(waterLevel.toFixed(1)));
      doData.push(parseFloat(doVal.toFixed(1)));
      lightData.push(Math.round(lightVal));
    }

    return {
      labels,
      phData,
      ecData,
      waterTempData,
      airTempData,
      waterLevelData,
      doData,
      lightData
    };
  }

  initCharts() {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded');
      return;
    }

    // Chart 1: pH & EC Dual Axis
    const ctxPhEc = document.getElementById('chart-ph-ec');
    if (ctxPhEc) {
      this.charts.phEc = new Chart(ctxPhEc, {
        type: 'line',
        data: {
          labels: this.historyData.labels,
          datasets: [
            {
              label: 'Water pH',
              data: this.historyData.phData,
              borderColor: '#34d399',
              backgroundColor: 'rgba(52, 211, 153, 0.1)',
              yAxisID: 'yPh',
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              pointRadius: 1
            },
            {
              label: 'EC (mS/cm)',
              data: this.historyData.ecData,
              borderColor: '#fbbf24',
              backgroundColor: 'rgba(251, 191, 36, 0.1)',
              yAxisID: 'yEc',
              borderWidth: 2,
              tension: 0.3,
              fill: false,
              pointRadius: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { size: 10 } }
            },
            yPh: {
              type: 'linear',
              position: 'left',
              min: 4.5,
              max: 7.5,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#34d399', font: { size: 10 } },
              title: { display: true, text: 'pH Level', color: '#34d399' }
            },
            yEc: {
              type: 'linear',
              position: 'right',
              min: 0.5,
              max: 2.5,
              grid: { drawOnChartArea: false },
              ticks: { color: '#fbbf24', font: { size: 10 } },
              title: { display: true, text: 'EC (mS/cm)', color: '#fbbf24' }
            }
          },
          plugins: {
            legend: { labels: { color: '#e2e8f0', font: { size: 11 } } }
          }
        }
      });
    }

    // Chart 2: Water vs Ambient Temp
    const ctxTemp = document.getElementById('chart-temperature');
    if (ctxTemp) {
      this.charts.temp = new Chart(ctxTemp, {
        type: 'line',
        data: {
          labels: this.historyData.labels,
          datasets: [
            {
              label: 'Water Solution Temp (°C)',
              data: this.historyData.waterTempData,
              borderColor: '#06b6d4',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              pointRadius: 1
            },
            {
              label: 'Grow Room Air Temp (°C)',
              data: this.historyData.airTempData,
              borderColor: '#f97316',
              borderWidth: 2,
              borderDash: [4, 4],
              tension: 0.3,
              fill: false,
              pointRadius: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { size: 10 } }
            },
            y: {
              min: 15,
              max: 32,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { size: 10 } }
            }
          },
          plugins: {
            legend: { labels: { color: '#e2e8f0', font: { size: 11 } } }
          }
        }
      });
    }

    // Chart 3: Reservoir Water Level
    const ctxLevel = document.getElementById('chart-water-level');
    if (ctxLevel) {
      this.charts.level = new Chart(ctxLevel, {
        type: 'line',
        data: {
          labels: this.historyData.labels,
          datasets: [
            {
              label: 'Reservoir Level (%)',
              data: this.historyData.waterLevelData,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              borderWidth: 2,
              tension: 0.2,
              fill: true,
              pointRadius: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { size: 10 } }
            },
            y: {
              min: 0,
              max: 100,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#3b82f6', font: { size: 10 } }
            }
          },
          plugins: {
            legend: { labels: { color: '#e2e8f0', font: { size: 11 } } }
          }
        }
      });
    }

    // Chart 4: Dissolved Oxygen & Light PAR
    const ctxDoLight = document.getElementById('chart-do-light');
    if (ctxDoLight) {
      this.charts.doLight = new Chart(ctxDoLight, {
        type: 'line',
        data: {
          labels: this.historyData.labels,
          datasets: [
            {
              label: 'Dissolved Oxygen (mg/L)',
              data: this.historyData.doData,
              borderColor: '#22d3ee',
              yAxisID: 'yDo',
              borderWidth: 2,
              tension: 0.3,
              pointRadius: 1
            },
            {
              label: 'Grow Light (LUX)',
              data: this.historyData.lightData,
              borderColor: '#eab308',
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              yAxisID: 'yLux',
              borderWidth: 1.5,
              tension: 0.1,
              fill: true,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { size: 10 } }
            },
            yDo: {
              type: 'linear',
              position: 'left',
              min: 4,
              max: 12,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#22d3ee', font: { size: 10 } }
            },
            yLux: {
              type: 'linear',
              position: 'right',
              min: 0,
              max: 30000,
              grid: { drawOnChartArea: false },
              ticks: { color: '#eab308', font: { size: 10 } }
            }
          },
          plugins: {
            legend: { labels: { color: '#e2e8f0', font: { size: 11 } } }
          }
        }
      });
    }
  }

  updateTimeRange(range) {
    this.currentRange = range;
    this.historyData = this.generateHistoricalData(range);

    if (this.charts.phEc) {
      this.charts.phEc.data.labels = this.historyData.labels;
      this.charts.phEc.data.datasets[0].data = this.historyData.phData;
      this.charts.phEc.data.datasets[1].data = this.historyData.ecData;
      this.charts.phEc.update();
    }

    if (this.charts.temp) {
      this.charts.temp.data.labels = this.historyData.labels;
      this.charts.temp.data.datasets[0].data = this.historyData.waterTempData;
      this.charts.temp.data.datasets[1].data = this.historyData.airTempData;
      this.charts.temp.update();
    }

    if (this.charts.level) {
      this.charts.level.data.labels = this.historyData.labels;
      this.charts.level.data.datasets[0].data = this.historyData.waterLevelData;
      this.charts.level.update();
    }

    if (this.charts.doLight) {
      this.charts.doLight.data.labels = this.historyData.labels;
      this.charts.doLight.data.datasets[0].data = this.historyData.doData;
      this.charts.doLight.data.datasets[1].data = this.historyData.lightData;
      this.charts.doLight.update();
    }
  }

  appendLivePoint(telemetry) {
    if (!this.charts.phEc || !this.historyData.labels || telemetry.ph === null || telemetry.ec === null) return;

    const now = new Date();
    const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // Slide window
    this.charts.phEc.data.labels.shift();
    this.charts.phEc.data.labels.push(timeLabel);
    this.charts.phEc.data.datasets[0].data.shift();
    this.charts.phEc.data.datasets[0].data.push(telemetry.ph);
    this.charts.phEc.data.datasets[1].data.shift();
    this.charts.phEc.data.datasets[1].data.push(telemetry.ec);
    this.charts.phEc.update('none');
  }

  exportCSV() {
    let csv = 'Timestamp,Water_pH,EC_mS_cm,Water_Temp_C,Air_Temp_C,Reservoir_Level_Pct,Dissolved_Oxygen_mg_L,Grow_Light_LUX\n';
    
    for (let i = 0; i < this.historyData.labels.length; i++) {
      csv += `"${this.historyData.labels[i]}",${this.historyData.phData[i]},${this.historyData.ecData[i]},${this.historyData.waterTempData[i]},${this.historyData.airTempData[i]},${this.historyData.waterLevelData[i]},${this.historyData.doData[i]},${this.historyData.lightData[i]}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `slynks_hydroponics_telemetry_${this.currentRange}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.notifications) {
      window.notifications.showToast('CSV Exported', 'Historical sensor datastream downloaded successfully!', 'emerald');
      window.notifications.playChime('success');
    }
  }

  bindEvents() {
    const timeButtons = document.querySelectorAll('.btn-time');
    timeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        timeButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.updateTimeRange(e.currentTarget.dataset.range);
      });
    });

    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportCSV());
    }

    const reportBtn = document.getElementById('btn-generate-report');
    if (reportBtn) {
      reportBtn.addEventListener('click', () => {
        const modal = document.getElementById('report-modal-backdrop');
        if (modal) modal.classList.add('open');
      });
    }

    const closeReport = document.getElementById('btn-close-report-modal');
    const dismissReport = document.getElementById('btn-dismiss-audit-modal');
    if (closeReport) closeReport.addEventListener('click', () => document.getElementById('report-modal-backdrop').classList.remove('open'));
    if (dismissReport) dismissReport.addEventListener('click', () => document.getElementById('report-modal-backdrop').classList.remove('open'));

    const printBtn = document.getElementById('btn-print-audit-report');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }
}

window.SlynksAnalyticsManager = SlynksAnalyticsManager;
