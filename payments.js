/**
 * SLYNKS HYDROPONIC CONTROLLER - PAKISTANI LOCAL PAYMENT GATEWAYS (₨50)
 * Integrated with Easypaisa, JazzCash, Raast (SBP), and 1Link Pakistani Banks
 */

class SlynksPaymentGateway {
  constructor() {
    this.selectedMethod = 'easypaisa';
    this.isProActive = false;
    this.modalBackdrop = document.getElementById('payment-modal-backdrop');
    this.currentTxDetails = {};

    this.checkSubscriptionStatus();
    this.bindEvents();
  }

  checkSubscriptionStatus() {
    const saved = localStorage.getItem('slynks_pro_subscribed');
    if (saved === 'true') {
      this.setProActive(true);
    }
  }

  setProActive(active = true) {
    this.isProActive = active;
    localStorage.setItem('slynks_pro_subscribed', active ? 'true' : 'false');

    const badge = document.getElementById('pro-status-badge');
    const tierText = document.getElementById('tier-text');
    if (badge && tierText) {
      if (active) {
        tierText.innerHTML = '★ PRO ACTIVE (₨50)';
        badge.querySelector('.pro-tag').style.background = 'linear-gradient(135deg, #10b981, #047857)';
      } else {
        tierText.innerHTML = 'PRO TIER (₨50)';
      }
    }
  }

  switchPaymentMethod(method) {
    this.selectedMethod = method;

    // Update buttons
    const buttons = document.querySelectorAll('.pay-method-btn');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.method === method);
    });

    // Update forms
    const forms = document.querySelectorAll('.pay-sub-form');
    forms.forEach(form => {
      form.classList.remove('active');
    });

    const activeForm = document.getElementById(`form-${method}`);
    if (activeForm) {
      activeForm.classList.add('active');
    }
  }

  startCheckout(details) {
    this.currentTxDetails = {
      ...details,
      amount: '₨ 50.00 PKR',
      txId: 'TXN-PK-' + Math.floor(1000000 + Math.random() * 9000000),
      timestamp: new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) + ' PST'
    };

    const gatewayNameEl = document.getElementById('modal-gateway-name');
    if (gatewayNameEl) {
      const names = {
        easypaisa: 'Easypaisa Mobile Wallet',
        jazzcash: 'JazzCash MPIN System',
        raast: 'Raast Instant (State Bank of Pakistan)',
        bank: `${details.bankName || 'Meezan Bank'} (1Link)`
      };
      gatewayNameEl.textContent = names[this.selectedMethod] || '1Link Switch';
    }

    const phoneTarget = document.getElementById('modal-phone-target');
    if (phoneTarget) {
      phoneTarget.textContent = details.accountNumber || '+92 300 1234567';
    }

    // Open Modal and Show Step 1 (Processing)
    this.modalBackdrop.classList.add('open');
    this.showModalStep('processing');

    // Simulate Payment Channel Handshake
    setTimeout(() => {
      if (this.selectedMethod === 'bank' || this.selectedMethod === 'raast') {
        // Direct Success for verified bank ref
        this.showPaymentSuccess();
      } else {
        // Show OTP / MPIN prompt for Mobile Wallets
        this.showModalStep('otp');
      }
    }, 1600);
  }

  showModalStep(stepName) {
    document.getElementById('modal-step-processing').style.display = stepName === 'processing' ? 'flex' : 'none';
    document.getElementById('modal-step-otp').style.display = stepName === 'otp' ? 'flex' : 'none';
    document.getElementById('modal-step-success').style.display = stepName === 'success' ? 'flex' : 'none';
  }

  confirmOtp() {
    this.showModalStep('processing');
    const gatewayNameEl = document.getElementById('modal-gateway-name');
    if (gatewayNameEl) gatewayNameEl.textContent = 'Verifying OTP & Debiting ₨50...';

    setTimeout(() => {
      this.showPaymentSuccess();
    }, 1200);
  }

  showPaymentSuccess() {
    this.setProActive(true);
    this.showModalStep('success');

    // Populate Receipt
    const txIdEl = document.getElementById('receipt-tx-id');
    const dateEl = document.getElementById('receipt-date');
    const channelEl = document.getElementById('receipt-channel');
    const accountEl = document.getElementById('receipt-account');

    if (txIdEl) txIdEl.textContent = this.currentTxDetails.txId;
    if (dateEl) dateEl.textContent = this.currentTxDetails.timestamp;
    if (channelEl) channelEl.textContent = this.getChannelTitle(this.selectedMethod);
    if (accountEl) accountEl.textContent = this.currentTxDetails.accountNumber || '03001234567';

    if (window.notifications) {
      window.notifications.showToast('Subscription Active', '₨50 payment verified! Slynks Hydro Pro unlocked.', 'emerald');
      window.notifications.playChime('success');
    }
  }

  getChannelTitle(method) {
    const titles = {
      easypaisa: 'Easypaisa Mobile Account',
      jazzcash: 'JazzCash Wallet / USSD',
      raast: 'Raast Instant Payment (State Bank)',
      bank: '1Link Pakistani Interbank Transfer'
    };
    return titles[method] || 'Pakistani Payment Gateway';
  }

  printReceipt() {
    window.print();
  }

  closeModal() {
    this.modalBackdrop.classList.remove('open');
  }

  bindEvents() {
    // Method selector clicks
    const methodBtns = document.querySelectorAll('.pay-method-btn');
    methodBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const method = e.currentTarget.dataset.method;
        this.switchPaymentMethod(method);
      });
    });

    // Form 1: Easypaisa
    const epForm = document.getElementById('form-easypaisa');
    if (epForm) {
      epForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const mobile = document.getElementById('ep-mobile').value.trim();
        this.startCheckout({
          method: 'easypaisa',
          accountNumber: `+92 ${mobile}`
        });
      });
    }

    // Form 2: JazzCash
    const jcForm = document.getElementById('form-jazzcash');
    if (jcForm) {
      jcForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const mobile = document.getElementById('jc-mobile').value.trim();
        this.startCheckout({
          method: 'jazzcash',
          accountNumber: `+92 ${mobile}`
        });
      });
    }

    // Form 3: Raast
    const raastForm = document.getElementById('form-raast');
    if (raastForm) {
      raastForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const raastId = document.getElementById('raast-sender-id').value.trim();
        this.startCheckout({
          method: 'raast',
          accountNumber: raastId
        });
      });
    }

    // Form 4: Bank
    const bankForm = document.getElementById('form-bank');
    if (bankForm) {
      bankForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const bankSelect = document.getElementById('bank-selector');
        const bankName = bankSelect.options[bankSelect.selectedIndex].text;
        const txRef = document.getElementById('bank-tx-id').value.trim();
        this.startCheckout({
          method: 'bank',
          bankName,
          accountNumber: txRef
        });
      });
    }

    // OTP confirmation button
    const confirmOtpBtn = document.getElementById('btn-confirm-otp');
    if (confirmOtpBtn) {
      confirmOtpBtn.addEventListener('click', () => this.confirmOtp());
    }

    // Close and print buttons
    const closePaymentBtn = document.getElementById('btn-close-payment-modal');
    if (closePaymentBtn) {
      closePaymentBtn.addEventListener('click', () => {
        this.closeModal();
        if (window.app) window.app.switchTab('dashboard');
      });
    }

    const printReceiptBtn = document.getElementById('btn-print-receipt');
    if (printReceiptBtn) {
      printReceiptBtn.addEventListener('click', () => this.printReceipt());
    }

    // Header Pro badge click opens upgrade tab
    const proBadge = document.getElementById('pro-badge-click');
    if (proBadge) {
      proBadge.addEventListener('click', () => {
        if (window.app) window.app.switchTab('payments');
      });
    }
  }
}

window.SlynksPaymentGateway = SlynksPaymentGateway;
