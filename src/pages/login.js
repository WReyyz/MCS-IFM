import { signIn } from '../lib/supabase.js';

export async function renderLogin() {
  const app = document.getElementById('app');
  app.className = '';
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo-icon">M</div>
          <div class="login-logo-text">
            <h1>MCS</h1>
            <p>Maintenance Control System</p>
          </div>
        </div>

        <div class="alert alert-danger d-none" id="login-error" role="alert"></div>
        <div class="alert alert-success d-none" id="login-success" role="alert"></div>

        <!-- LOGIN FORM -->
        <form id="login-form">
          <div class="mb-3">
            <label class="form-label fw-medium text-white">Email</label>
            <input type="email" class="form-control glass-input" id="login-email" required autocomplete="email" />
          </div>
          <div class="mb-3 position-relative">
            <label class="form-label fw-medium text-white">Kata Sandi</label>
            <div class="position-relative">
              <input type="password" class="form-control glass-input" id="login-password" style="padding-right: 40px;" required autocomplete="current-password" />
              <button type="button" id="toggle-password" class="btn btn-link position-absolute end-0 top-50 translate-middle-y text-white text-decoration-none" style="z-index: 10; opacity: 0.7;">
                <!-- Eye icon (show) -->
                <svg id="eye-icon-show" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                <!-- Eye-off icon (hide) -->
                <svg id="eye-icon-hide" class="d-none" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary w-100 py-2 mt-1 d-flex align-items-center justify-content-center gap-2" id="login-btn">
            <span id="login-btn-text">Masuk</span>
            <div class="spinner" id="login-spinner" style="display:none"></div>
          </button>
        </form>

        <p class="text-center mt-4" style="font-size:0.72rem; color: rgba(255, 255, 255, 0.7)">
          © ${new Date().getFullYear()} MCS — Maintenance Control System
        </p>
      </div>
      <div class="login-bg"></div>
    </div>
  `;

  const loginForm = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('login-password');
  const eyeIconShow = document.getElementById('eye-icon-show');
  const eyeIconHide = document.getElementById('eye-icon-hide');

  // ---- Toggle password visibility ----
  togglePasswordBtn.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      eyeIconShow.classList.add('d-none');
      eyeIconHide.classList.remove('d-none');
    } else {
      passwordInput.type = 'password';
      eyeIconShow.classList.remove('d-none');
      eyeIconHide.classList.add('d-none');
    }
  });

  // ---- Login handler ----
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('d-none');
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
      errorEl.classList.remove('d-none');
    } finally {
      spinner.style.display = 'none';
      btnText.textContent = 'Masuk';
    }
  });
}
