import { signIn, signUp, resetPassword, supabase } from '../lib/supabase.js';
import { icons } from '../components/icons.js';
import { ROLES } from '../utils/constants.js';

export async function renderLogin() {
  const app = document.getElementById('app');
  app.className = '';
  app.innerHTML = `
    <div class="login-page">
      <div class="login-bg"></div>
      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo-icon">M</div>
          <div class="login-logo-text">
            <h1>MCS</h1>
            <p>Maintenance Control System</p>
          </div>
        </div>

        <!-- Tab Switcher -->
        <div class="login-tabs" id="login-tabs">
          <button class="login-tab active" data-tab="login">Masuk</button>
          <button class="login-tab" data-tab="register">Daftar Akun</button>
          <button class="login-tab" data-tab="forgot">Lupa Sandi</button>
        </div>

        <div class="login-error" id="login-error"></div>
        <div class="login-success" id="login-success"></div>

        <!-- LOGIN FORM -->
        <form class="login-form" id="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="login-email" placeholder="Masukkan email" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Kata Sandi</label>
            <input type="password" class="form-input" id="login-password" placeholder="Masukkan kata sandi" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary" id="login-btn">
            <span id="login-btn-text">Masuk</span>
            <div class="spinner" id="login-spinner" style="display:none"></div>
          </button>
        </form>

        <!-- REGISTER FORM -->
        <form class="login-form" id="register-form" style="display:none">
          <div class="form-group">
            <label class="form-label">Nama Lengkap</label>
            <input type="text" class="form-input" id="reg-name" placeholder="Masukkan nama lengkap" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="reg-email" placeholder="Masukkan email" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Kata Sandi</label>
            <input type="password" class="form-input" id="reg-password" placeholder="Minimal 6 karakter" required minlength="6" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label class="form-label">Konfirmasi Kata Sandi</label>
            <input type="password" class="form-input" id="reg-confirm" placeholder="Ulangi kata sandi" required minlength="6" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-select" id="reg-role">
              ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === 'technician' ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
          </div>
          <button type="submit" class="btn btn-primary" id="reg-btn">
            <span id="reg-btn-text">Daftar</span>
            <div class="spinner" id="reg-spinner" style="display:none"></div>
          </button>
        </form>

        <!-- FORGOT PASSWORD FORM -->
        <form class="login-form" id="forgot-form" style="display:none">
          <div class="form-group">
            <label class="form-label">Email Pengguna</label>
            <input type="email" class="form-input" id="forgot-email" placeholder="Masukkan email terdaftar" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Kata Sandi Baru</label>
            <input type="password" class="form-input" id="forgot-password" placeholder="Minimal 6 karakter" required minlength="6" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label class="form-label">Konfirmasi Kata Sandi Baru</label>
            <input type="password" class="form-input" id="forgot-confirm" placeholder="Ulangi kata sandi baru" required minlength="6" autocomplete="new-password" />
          </div>
          <button type="submit" class="btn btn-primary" id="forgot-btn">
            <span id="forgot-btn-text">Ubah Sandi</span>
            <div class="spinner" id="forgot-spinner" style="display:none"></div>
          </button>
        </form>

        <p style="text-align:center;margin-top:var(--sp-6);font-size:var(--fs-xs);color:var(--text-muted)">
          © ${new Date().getFullYear()} MCS — Maintenance Control System
        </p>
      </div>
    </div>
  `;

  // ---- Tab switching ----
  const tabs = document.querySelectorAll('.login-tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const forgotForm = document.getElementById('forgot-form');
  const errorEl = document.getElementById('login-error');
  const successEl = document.getElementById('login-success');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      errorEl.classList.remove('show');
      successEl.classList.remove('show');

      if (tab.dataset.tab === 'login') {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
        forgotForm.style.display = 'none';
      } else if (tab.dataset.tab === 'register') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
        forgotForm.style.display = 'none';
      } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        forgotForm.style.display = 'flex';
      }
    });
  });

  // ---- Login handler ----
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');
    successEl.classList.remove('show');
    const spinner = document.getElementById('login-spinner');
    const btnText = document.getElementById('login-btn-text');
    spinner.style.display = 'block';
    btnText.textContent = 'Memproses...';

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      await signIn(email, password);
      window.location.hash = '/';
    } catch (err) {
      errorEl.textContent = err.message === 'Invalid login credentials'
        ? 'Email atau kata sandi salah'
        : err.message === 'Email not confirmed'
        ? 'Email belum dikonfirmasi. Cek inbox email Anda.'
        : err.message;
      errorEl.classList.add('show');
    } finally {
      spinner.style.display = 'none';
      btnText.textContent = 'Masuk';
    }
  });

  // ---- Register handler ----
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');
    successEl.classList.remove('show');
    const spinner = document.getElementById('reg-spinner');
    const btnText = document.getElementById('reg-btn-text');

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const role = document.getElementById('reg-role').value;

    if (password !== confirm) {
      errorEl.textContent = 'Kata sandi dan konfirmasi tidak cocok';
      errorEl.classList.add('show');
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'Kata sandi minimal 6 karakter';
      errorEl.classList.add('show');
      return;
    }

    spinner.style.display = 'block';
    btnText.textContent = 'Mendaftarkan...';

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: role,
          },
        },
      });

      if (error) throw error;

      // Check if user needs email confirmation or is immediately active
      if (data.user && data.session) {
        // Auto-confirmed — login langsung
        successEl.textContent = 'Akun berhasil dibuat! Mengalihkan...';
        successEl.classList.add('show');
        setTimeout(() => {
          window.location.hash = '/';
        }, 1000);
      } else if (data.user && !data.session) {
        // Needs email confirmation
        successEl.textContent = 'Akun berhasil dibuat! Silakan cek email untuk verifikasi, lalu masuk.';
        successEl.classList.add('show');
        // Switch to login tab
        tabs.forEach(t => t.classList.remove('active'));
        tabs[0].classList.add('active');
        registerForm.style.display = 'none';
        loginForm.style.display = 'flex';
        // Pre-fill email
        document.getElementById('login-email').value = email;
      }
    } catch (err) {
      const msg = err.message;
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        errorEl.textContent = 'Email sudah terdaftar. Silakan masuk.';
      } else {
        errorEl.textContent = msg || 'Gagal mendaftarkan akun';
      }
      errorEl.classList.add('show');
    } finally {
      spinner.style.display = 'none';
      btnText.textContent = 'Daftar';
    }
  });

  // ---- Forgot Password handler ----
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');
    successEl.classList.remove('show');
    const spinner = document.getElementById('forgot-spinner');
    const btnText = document.getElementById('forgot-btn-text');

    const email = document.getElementById('forgot-email').value.trim();
    const newPassword = document.getElementById('forgot-password').value;
    const confirm = document.getElementById('forgot-confirm').value;

    if (newPassword !== confirm) {
      errorEl.textContent = 'Kata sandi baru dan konfirmasi tidak cocok';
      errorEl.classList.add('show');
      return;
    }

    if (newPassword.length < 6) {
      errorEl.textContent = 'Kata sandi minimal 6 karakter';
      errorEl.classList.add('show');
      return;
    }

    spinner.style.display = 'block';
    btnText.textContent = 'Memproses...';

    try {
      const success = await resetPassword(email, newPassword);
      if (success) {
        successEl.textContent = 'Kata sandi berhasil diubah! Silakan masuk dengan kata sandi baru Anda.';
        successEl.classList.add('show');
        
        // Switch to login tab
        setTimeout(() => {
          tabs.forEach(t => t.classList.remove('active'));
          tabs[0].classList.add('active');
          forgotForm.style.display = 'none';
          loginForm.style.display = 'flex';
          document.getElementById('login-email').value = email;
          document.getElementById('login-password').value = '';
          successEl.classList.remove('show');
        }, 3000);
      } else {
        throw new Error('Email tidak ditemukan atau tidak terdaftar');
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Gagal mengubah kata sandi';
      errorEl.classList.add('show');
    } finally {
      spinner.style.display = 'none';
      btnText.textContent = 'Ubah Sandi';
    }
  });
}
