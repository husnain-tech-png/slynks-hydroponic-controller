/**
 * SLYNKS HYDROPONIC CONTROLLER - ACCURATE PAKISTANI PAYMENT SYSTEM
 * Designated Receiver Number: 03154483615 (Easypaisa / JazzCash / Raast)
 * Workflow: Payment Submission -> Status PENDING -> Admin/Backend Verification -> Status VERIFIED / REJECTED
 */

class SlynksPaymentGateway {
  constructor() {
    this.designatedNumber = "03154483615";
    this.accountTitle = "Slynks Hydroponics / Official Receiver";
    this.selectedMethod = "easypaisa";
    this.isProActive = false;
    this.adminPasscode = "admin123";
    this.isAdminUnlocked = false;
    
    this.transactions = this.loadLocalTransactions();
    this.checkSubscriptionStatus();
    this.bindEvents();
    this.renderAdminLedger();
  }

  loadLocalTransactions() {
    const saved = localStorage.getItem("slynks_payment_ledger");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    // Default sample record showing PENDING structure
    return [
      {
        trxId: "TRX-EP-8921045",
        senderName: "Ahmad Khan (Islamabad)",
        senderMobile: "03001234567",
        paymentChannel: "Easypaisa",
        amount: "₨ 50.00 PKR",
        designatedReceiver: "03154483615",
        status: "PENDING",
        submissionTime: new Date(Date.now() - 3600000).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }),
        verificationTime: null,
        adminNotes: "Awaiting statement confirmation"
      }
    ];
  }

  saveLocalTransactions() {
    localStorage.setItem("slynks_payment_ledger", JSON.stringify(this.transactions));
  }

  checkSubscriptionStatus() {
    // Pro is ONLY active if there is at least one VERIFIED transaction in the ledger
    const hasVerifiedTx = this.transactions.some(t => t.status === "VERIFIED");
    this.setProActive(hasVerifiedTx);
  }

  setProActive(active = true) {
    this.isProActive = active;
    localStorage.setItem("slynks_pro_subscribed", active ? "true" : "false");

    const badge = document.getElementById("pro-status-badge");
    const tierText = document.getElementById("tier-text");
    if (badge && tierText) {
      if (active) {
        tierText.innerHTML = "★ PRO ACTIVE (VERIFIED)";
        badge.querySelector(".pro-tag").style.background = "linear-gradient(135deg, #10b981, #047857)";
      } else {
        tierText.innerHTML = "PRO TIER (₨50)";
        badge.querySelector(".pro-tag").style.background = "var(--emerald-600)";
      }
    }
  }

  switchPaymentMethod(method) {
    this.selectedMethod = method;

    const buttons = document.querySelectorAll(".pay-method-btn");
    buttons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.method === method);
    });

    const forms = document.querySelectorAll(".pay-sub-form");
    forms.forEach(form => {
      form.classList.remove("active");
    });

    const activeForm = document.getElementById(`form-${method}`);
    if (activeForm) {
      activeForm.classList.add("active");
    }
  }

  async submitTransaction(details) {
    const trxId = details.trxId.trim().toUpperCase();
    if (!trxId || !details.senderMobile) {
      if (window.notifications) {
        window.notifications.showToast("Required Fields Missing", "Please enter your Sender Mobile Number and Transaction ID.", "amber");
      }
      return;
    }

    // Check for duplicate TRX ID
    if (this.transactions.some(t => t.trxId.toUpperCase() === trxId)) {
      if (window.notifications) {
        window.notifications.showToast("Duplicate TRX ID", "This Transaction ID has already been submitted.", "amber");
      }
      return;
    }

    const newTx = {
      trxId: trxId,
      senderName: details.senderName || "Subscriber",
      senderMobile: details.senderMobile,
      paymentChannel: this.getChannelTitle(this.selectedMethod),
      amount: "₨ 50.00 PKR",
      designatedReceiver: this.designatedNumber,
      status: "PENDING", // Strictly PENDING on submission
      submissionTime: new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) + " PST",
      verificationTime: null,
      adminNotes: "Submitted by user. Awaiting 1Link / Easypaisa confirmation."
    };

    // Save locally
    this.transactions.unshift(newTx);
    this.saveLocalTransactions();

    // Try posting to backend if server is active
    try {
      await fetch("/api/payments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: newTx.senderName,
          senderMobile: newTx.senderMobile,
          paymentChannel: newTx.paymentChannel,
          trxId: newTx.trxId,
          amount: "50"
        })
      });
    } catch (e) {
      console.log("Backend offline, transaction logged locally.");
    }

    // Show Confirmation Receipt with PENDING status
    this.showSubmissionConfirmation(newTx);
    this.renderAdminLedger();
  }

  showSubmissionConfirmation(tx) {
    const modal = document.getElementById("payment-modal-backdrop");
    if (!modal) return;

    modal.classList.add("open");
    document.getElementById("modal-step-processing").style.display = "none";
    document.getElementById("modal-step-otp").style.display = "none";
    document.getElementById("modal-step-success").style.display = "flex";

    // Update receipt fields
    const titleEl = document.querySelector("#modal-step-success h2");
    const subEl = document.querySelector("#modal-step-success p");
    const statusBadge = document.querySelector("#printable-receipt .badge-green");

    if (titleEl) {
      titleEl.innerHTML = "Transaction Submitted!";
      titleEl.style.color = "var(--amber-500)";
    }
    if (subEl) {
      subEl.innerHTML = "Status: <strong class='text-amber'>PENDING VERIFICATION</strong>. Slynks administration will verify against account <code>03154483615</code> within 15-30 minutes.";
    }
    if (statusBadge) {
      statusBadge.textContent = "PENDING";
      statusBadge.className = "status-indicator-tag tag-warn";
    }

    document.getElementById("receipt-tx-id").textContent = tx.trxId;
    document.getElementById("receipt-date").textContent = tx.submissionTime;
    document.getElementById("receipt-channel").textContent = tx.paymentChannel;
    document.getElementById("receipt-account").textContent = tx.senderMobile;

    if (window.notifications) {
      window.notifications.showToast("Payment Submitted", `TRX ID ${tx.trxId} recorded with status PENDING.`, "amber");
      window.notifications.playChime("info");
    }
  }

  // Admin Verification Methods
  verifyTransaction(trxId, approve = true, reason = "") {
    const tx = this.transactions.find(t => t.trxId.toUpperCase() === trxId.toUpperCase());
    if (!tx) return;

    tx.status = approve ? "VERIFIED" : "REJECTED";
    tx.verificationTime = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) + " PST";
    tx.adminNotes = approve ? "Payment verified from statement for 03154483615" : (reason || "Invalid TRX ID or amount mismatch");

    this.saveLocalTransactions();
    this.checkSubscriptionStatus();
    this.renderAdminLedger();

    // Sync to backend if possible
    fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trxId, status: tx.status, notes: tx.adminNotes })
    }).catch(() => {});

    if (window.notifications) {
      window.notifications.showToast(
        approve ? "Payment Approved" : "Payment Rejected",
        `TRX ${trxId} marked as ${tx.status}. ${approve ? "Pro features unlocked!" : ""}`,
        approve ? "emerald" : "ruby"
      );
      window.notifications.playChime(approve ? "success" : "critical");
    }
  }

  renderAdminLedger() {
    const tbody = document.getElementById("admin-payments-tbody");
    if (!tbody) return;

    if (this.transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-3">No payment submissions recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.transactions.map(tx => {
      let statusTag = "tag-warn";
      if (tx.status === "VERIFIED") statusTag = "tag-good";
      if (tx.status === "REJECTED") statusTag = "tag-danger";

      return `
        <tr>
          <td><strong class="font-mono">${tx.trxId}</strong></td>
          <td>${tx.senderName}</td>
          <td><code>${tx.senderMobile}</code></td>
          <td>${tx.paymentChannel}</td>
          <td><strong>${tx.amount}</strong></td>
          <td><span class="status-indicator-tag ${statusTag}">${tx.status}</span></td>
          <td>
            ${tx.status === "PENDING" ? `
              <button class="btn btn-sm btn-primary btn-approve-tx" data-trx="${tx.trxId}">
                <i data-lucide="check"></i> Approve
              </button>
              <button class="btn btn-sm btn-outline btn-reject-tx" data-trx="${tx.trxId}">
                <i data-lucide="x"></i> Reject
              </button>
            ` : `
              <span class="text-xs text-muted">${tx.verificationTime || "Completed"}</span>
            `}
          </td>
        </tr>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons({ root: tbody });
  }

  getChannelTitle(method) {
    const titles = {
      easypaisa: "Easypaisa (03154483615)",
      jazzcash: "JazzCash (03154483615)",
      raast: "Raast Instant (03154483615)",
      bank: "1Link Bank Transfer (03154483615)"
    };
    return titles[method] || "Pakistani Payment Channel";
  }

  bindEvents() {
    // Payment Method selection buttons
    const methodBtns = document.querySelectorAll(".pay-method-btn");
    methodBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const method = e.currentTarget.dataset.method;
        this.switchPaymentMethod(method);
      });
    });

    // Form 1: Easypaisa Submission
    const epForm = document.getElementById("form-easypaisa");
    if (epForm) {
      epForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const mobile = document.getElementById("ep-mobile").value.trim();
        const name = document.getElementById("ep-name") ? document.getElementById("ep-name").value.trim() : "Easypaisa User";
        const trxId = document.getElementById("ep-trx-id").value.trim();
        this.submitTransaction({
          senderName: name,
          senderMobile: `+92 ${mobile}`,
          trxId: trxId
        });
      });
    }

    // Form 2: JazzCash Submission
    const jcForm = document.getElementById("form-jazzcash");
    if (jcForm) {
      jcForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const mobile = document.getElementById("jc-mobile").value.trim();
        const name = document.getElementById("jc-name") ? document.getElementById("jc-name").value.trim() : "JazzCash User";
        const trxId = document.getElementById("jc-trx-id").value.trim();
        this.submitTransaction({
          senderName: name,
          senderMobile: `+92 ${mobile}`,
          trxId: trxId
        });
      });
    }

    // Form 3: Raast Submission
    const raastForm = document.getElementById("form-raast");
    if (raastForm) {
      raastForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const senderId = document.getElementById("raast-sender-id").value.trim();
        const trxId = document.getElementById("raast-trx-id").value.trim();
        this.submitTransaction({
          senderName: "Raast Payer",
          senderMobile: senderId,
          trxId: trxId
        });
      });
    }

    // Form 4: Bank Transfer Submission
    const bankForm = document.getElementById("form-bank");
    if (bankForm) {
      bankForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const bankSelect = document.getElementById("bank-selector");
        const bankName = bankSelect.options[bankSelect.selectedIndex].text;
        const senderAccount = document.getElementById("bank-sender-acc").value.trim();
        const trxId = document.getElementById("bank-tx-id").value.trim();
        this.submitTransaction({
          senderName: `Bank Transfer (${bankName})`,
          senderMobile: senderAccount,
          trxId: trxId
        });
      });
    }

    // Admin Verification Actions Event Delegation
    document.addEventListener("click", (e) => {
      const approveBtn = e.target.closest(".btn-approve-tx");
      if (approveBtn) {
        const trx = approveBtn.dataset.trx;
        this.verifyTransaction(trx, true);
      }

      const rejectBtn = e.target.closest(".btn-reject-tx");
      if (rejectBtn) {
        const trx = rejectBtn.dataset.trx;
        const reason = prompt("Enter rejection reason (e.g. Invalid Transaction ID, ₨50 not received):", "Invalid Transaction Reference");
        if (reason !== null) {
          this.verifyTransaction(trx, false, reason);
        }
      }
    });

    // Track Transaction Status Lookup Form
    const trackForm = document.getElementById("form-track-status");
    if (trackForm) {
      trackForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const searchTrx = document.getElementById("track-trx-input").value.trim().toUpperCase();
        const found = this.transactions.find(t => t.trxId.toUpperCase() === searchTrx);
        const resultBox = document.getElementById("track-result-box");
        
        if (found && resultBox) {
          resultBox.style.display = "block";
          resultBox.innerHTML = `
            <div class="p-3 bg-darker rounded border border-subtle">
              <div class="d-flex justify-content-between">
                <strong>TRX ID: ${found.trxId}</strong>
                <span class="status-indicator-tag ${found.status === 'VERIFIED' ? 'tag-good' : found.status === 'REJECTED' ? 'tag-danger' : 'tag-warn'}">${found.status}</span>
              </div>
              <div class="text-xs text-muted mt-2">
                <div>Sender: ${found.senderName} (${found.senderMobile})</div>
                <div>Amount: ${found.amount} ➔ Receiver: ${found.designatedReceiver}</div>
                <div>Submitted: ${found.submissionTime}</div>
                <div>Notes: <em>${found.adminNotes}</em></div>
              </div>
            </div>
          `;
        } else if (resultBox) {
          resultBox.style.display = "block";
          resultBox.innerHTML = `<div class="p-3 bg-darker rounded text-ruby text-sm">❌ Transaction ID <strong>${searchTrx}</strong> not found. Please verify your reference number.</div>`;
        }
      });
    }

    // Admin Passcode Unlock
    const adminUnlockBtn = document.getElementById("btn-unlock-admin");
    if (adminUnlockBtn) {
      adminUnlockBtn.addEventListener("click", () => {
        const input = document.getElementById("admin-passcode-input");
        if (input && input.value.trim() === this.adminPasscode) {
          this.isAdminUnlocked = true;
          document.getElementById("admin-login-box").style.display = "none";
          document.getElementById("admin-portal-box").style.display = "block";
          if (window.notifications) {
            window.notifications.showToast("Admin Authenticated", "Admin Payment Verification Portal unlocked.", "emerald");
          }
        } else {
          alert("Incorrect admin passcode. (Default: admin123)");
        }
      });
    }

    // Close Modal Button
    const closeBtn = document.getElementById("btn-close-payment-modal");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        document.getElementById("payment-modal-backdrop").classList.remove("open");
      });
    }

    const printBtn = document.getElementById("btn-print-receipt");
    if (printBtn) {
      printBtn.addEventListener("click", () => window.print());
    }
  }
}

window.SlynksPaymentGateway = SlynksPaymentGateway;
