/**
 * SLYNKS HYDROPONIC CONTROLLER - AUTHENTICATION & USER MANAGEMENT
 * Professional, simple, and persistent user authentication system with Grower/Admin roles.
 */

class SlynksAuthManager {
  constructor() {
    this.currentUser = this.loadSession();
    this.usersDatabase = this.loadUsersDatabase();
    this.bindEvents();
    this.updateUserUI();
  }

  loadSession() {
    const saved = localStorage.getItem('slynks_auth_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    // Default logged-in user for seamless instant access
    return {
      name: 'Husnain Grower',
      email: 'grower@slynks.hydro',
      role: 'Grower (Hydro Pro)',
      phone: '03154483615',
      farmName: 'Slynks Smart Hydro Farm #1',
      avatar: '🌱',
      isLoggedIn: true
    };
  }

  loadUsersDatabase() {
    const saved = localStorage.getItem('slynks_users_db');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        email: 'grower@slynks.hydro',
        password: 'password123',
        name: 'Husnain Grower',
        phone: '03154483615',
        role: 'Grower (Hydro Pro)',
        farmName: 'Slynks Smart Hydro Farm #1',
        avatar: '🌱'
      },
      {
        email: 'admin@slynks.hydro',
        password: 'admin',
        name: 'Slynks System Administrator',
        phone: '03154483615',
        role: 'Administrator',
        farmName: 'Slynks Central HQ',
        avatar: '🛡️'
      }
    ];
  }

  saveSession(user) {
    this.currentUser = user;
    localStorage.setItem('slynks_auth_session', JSON.stringify(user));
    this.updateUserUI();
  }

  saveUsersDatabase() {
    localStorage.setItem('slynks_users_db', JSON.stringify(this.usersDatabase));
  }

  login(email, password) {
    email = email.trim().toLowerCase();
    const user = this.usersDatabase.find(u => u.email.toLowerCase() === email && u.password === password);
    
    if (user) {
      const sessionUser = {
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        farmName: user.farmName,
        avatar: user.avatar || '🌿',
        isLoggedIn: true
      };
      this.saveSession(sessionUser);
      this.closeAuthModal();
      
      if (window.notifications) {
        window.notifications.showToast('Welcome Back!', `Logged in as ${user.name} (${user.role}).`, 'emerald');
        window.notifications.playChime('success');
      }
      return { success: true };
    } else {
      return { success: false, message: 'Invalid email or password. (Demo: grower@slynks.hydro / password123)' };
    }
  }

  signup(name, email, phone, farmName, password) {
    email = email.trim().toLowerCase();
    if (this.usersDatabase.some(u => u.email.toLowerCase() === email)) {
      return { success: false, message: 'An account with this email already exists.' };
    }

    const newUser = {
      name: name.trim(),
      email: email,
      phone: phone.trim(),
      farmName: farmName.trim() || 'My Hydroponic Farm',
      password: password,
      role: 'Grower (Hydro Pro)',
      avatar: '🌱'
    };

    this.usersDatabase.push(newUser);
    this.saveUsersDatabase();

    const sessionUser = {
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone,
      farmName: newUser.farmName,
      avatar: newUser.avatar,
      isLoggedIn: true
    };
    this.saveSession(sessionUser);
    this.closeAuthModal();

    if (window.notifications) {
      window.notifications.showToast('Account Created!', `Welcome to Slynks, ${newUser.name}!`, 'emerald');
      window.notifications.playChime('success');
    }
    return { success: true };
  }

  logout() {
    this.currentUser = {
      name: 'Guest User',
      email: 'guest@slynks.hydro',
      role: 'Guest Mode',
      phone: '--',
      farmName: 'Demo Farm',
      avatar: '👤',
      isLoggedIn: false
    };
    localStorage.removeItem('slynks_auth_session');
    this.updateUserUI();

    if (window.notifications) {
      window.notifications.showToast('Logged Out', 'You are now in guest mode.', 'amber');
      window.notifications.playChime('info');
    }
  }

  quickDemoLogin(role = 'grower') {
    if (role === 'admin') {
      this.login('admin@slynks.hydro', 'admin');
    } else {
      this.login('grower@slynks.hydro', 'password123');
    }
  }

  updateUserUI() {
    const u = this.currentUser;
    
    // Header user badge
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');
    const avatarEl = document.getElementById('header-user-avatar');

    if (nameEl) nameEl.textContent = u.name;
    if (roleEl) roleEl.textContent = u.role;
    if (avatarEl) avatarEl.textContent = u.avatar || '🌱';

    // Update account drawer if present
    const profileName = document.getElementById('profile-card-name');
    const profileEmail = document.getElementById('profile-card-email');
    const profileRole = document.getElementById('profile-card-role');
    const profileFarm = document.getElementById('profile-card-farm');
    if (profileName) profileName.textContent = u.name;
    if (profileEmail) profileEmail.textContent = u.email;
    if (profileRole) profileRole.textContent = u.role;
    if (profileFarm) profileFarm.textContent = u.farmName;
  }

  openAuthModal(tab = 'login') {
    const modal = document.getElementById('auth-modal-backdrop');
    if (!modal) return;
    modal.classList.add('open');
    this.switchAuthTab(tab);
  }

  closeAuthModal() {
    const modal = document.getElementById('auth-modal-backdrop');
    if (modal) modal.classList.remove('open');
  }

  switchAuthTab(tab) {
    const loginForm = document.getElementById('auth-login-form');
    const signupForm = document.getElementById('auth-signup-form');
    const tabLogin = document.getElementById('auth-tab-login');
    const tabSignup = document.getElementById('auth-tab-signup');

    if (tab === 'signup') {
      if (loginForm) loginForm.style.display = 'none';
      if (signupForm) signupForm.style.display = 'flex';
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabSignup) tabSignup.classList.add('active');
    } else {
      if (loginForm) loginForm.style.display = 'flex';
      if (signupForm) signupForm.style.display = 'none';
      if (tabLogin) tabLogin.classList.add('active');
      if (tabSignup) tabSignup.classList.remove('active');
    }
  }

  bindEvents() {
    // Header User Profile Click
    const profileBtn = document.getElementById('header-user-btn');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        const modal = document.getElementById('profile-modal-backdrop');
        if (modal) modal.classList.add('open');
      });
    }

    // Login Form Submit
    const loginForm = document.getElementById('auth-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-login-email').value;
        const pass = document.getElementById('auth-login-password').value;
        const res = this.login(email, pass);
        if (!res.success) {
          const errEl = document.getElementById('auth-login-error');
          if (errEl) {
            errEl.textContent = res.message;
            errEl.style.display = 'block';
          }
        }
      });
    }

    // Sign Up Form Submit
    const signupForm = document.getElementById('auth-signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('auth-signup-name').value;
        const email = document.getElementById('auth-signup-email').value;
        const phone = document.getElementById('auth-signup-phone').value;
        const farm = document.getElementById('auth-signup-farm').value;
        const pass = document.getElementById('auth-signup-password').value;
        const res = this.signup(name, email, phone, farm, pass);
        if (!res.success) {
          const errEl = document.getElementById('auth-signup-error');
          if (errEl) {
            errEl.textContent = res.message;
            errEl.style.display = 'block';
          }
        }
      });
    }

    // Auth Tabs Switch
    const tabLogin = document.getElementById('auth-tab-login');
    const tabSignup = document.getElementById('auth-tab-signup');
    if (tabLogin) tabLogin.addEventListener('click', () => this.switchAuthTab('login'));
    if (tabSignup) tabSignup.addEventListener('click', () => this.switchAuthTab('signup'));

    // Quick Demo Buttons
    const btnDemoGrower = document.getElementById('btn-demo-grower');
    const btnDemoAdmin = document.getElementById('btn-demo-admin');
    if (btnDemoGrower) btnDemoGrower.addEventListener('click', () => this.quickDemoLogin('grower'));
    if (btnDemoAdmin) btnDemoAdmin.addEventListener('click', () => this.quickDemoLogin('admin'));

    // Logout Button
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.logout();
        const pModal = document.getElementById('profile-modal-backdrop');
        if (pModal) pModal.classList.remove('open');
      });
    }

    // Switch Account Button in Profile
    const btnSwitchAccount = document.getElementById('btn-switch-account');
    if (btnSwitchAccount) {
      btnSwitchAccount.addEventListener('click', () => {
        const pModal = document.getElementById('profile-modal-backdrop');
        if (pModal) pModal.classList.remove('open');
        this.openAuthModal('login');
      });
    }

    // Close Modals
    const closeAuthBtn = document.getElementById('btn-close-auth-modal');
    if (closeAuthBtn) closeAuthBtn.addEventListener('click', () => this.closeAuthModal());

    const closeProfileBtn = document.getElementById('btn-close-profile-modal');
    if (closeProfileBtn) {
      closeProfileBtn.addEventListener('click', () => {
        const pModal = document.getElementById('profile-modal-backdrop');
        if (pModal) pModal.classList.remove('open');
      });
    }
  }
}

window.SlynksAuthManager = SlynksAuthManager;
