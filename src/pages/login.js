import { signIn } from '../lib/supabase.js';

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

        <p style="text-align:center;margin-top:var(--sp-6);font-size:var(--fs-xs);color:var(--text-muted)">
          © ${new Date().getFullYear()} MCS — Maintenance Control System
        </p>
      </div>
    </div>
  `;

  const loginForm = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');

  // ---- Login handler ----
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');
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
}
