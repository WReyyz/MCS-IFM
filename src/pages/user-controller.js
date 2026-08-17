import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, updateRow, getCurrentProfile, supabase, signUp, bulkUpdateRows, resetPassword } from '../lib/supabase.js';
import { ROLES, TECHNICIAN_SKILLS } from '../utils/constants.js';
import { formatDate, escapeHtml, badge, setupBulkSelection } from '../utils/helpers.js';

let allUsers = [];
let currentProfile = null;
let selectedUserIds = [];
let activeTab = 'list'; // 'list' | 'register' | 'reset'

export async function renderUserController() {
  const content = renderAppShell('Kontrol Pengguna');

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <h2>Kontrol Pengguna</h2>
      </div>

      <!-- ACCESS DENIED (non-admin) -->
      <div id="user-access-denied" style="display:none">
        <div style="padding:var(--sp-6);background:var(--danger-bg);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-md);display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-sm);color:var(--danger)">
          ${icons.alertTriangle} Halaman ini hanya dapat diakses oleh Admin.
        </div>
      </div>

      <!-- ADMIN PANEL -->
      <div id="user-admin-panel" style="display:none">
        <!-- Sub-Tabs -->
        <div class="login-tabs" id="uc-tabs" style="margin-bottom:var(--sp-5)">
          <button class="login-tab active" data-uc-tab="list">Daftar Pengguna</button>
          <button class="login-tab" data-uc-tab="register">Daftar Akun Baru</button>
          <button class="login-tab" data-uc-tab="reset">Reset Kata Sandi</button>
        </div>

        <!-- ERROR / SUCCESS banner -->
        <div class="login-error" id="uc-error"></div>
        <div class="login-success" id="uc-success"></div>

        <!-- TAB: LIST -->
        <div id="uc-tab-list">
          <div class="page-header" style="margin-bottom:var(--sp-4)">
            <div></div>
            <div class="page-header-actions">
              <button class="btn btn-primary" id="add-user-btn">${icons.plus} Tambah Pengguna</button>
            </div>
          </div>
          <div id="user-table-wrapper">
            <div class="page-loading"><div class="spinner"></div></div>
          </div>
          <!-- BULK ACTION BAR -->
          <div class="bulk-action-bar" id="bulk-action-bar">
            <div class="bulk-selected-count">
              <span class="badge" id="bulk-count-badge">0</span> item terpilih
            </div>
            <div class="bulk-actions">
              <select class="form-select form-select-sm" id="bulk-status-select" style="min-width:150px;padding-top:4px;padding-bottom:4px">
                <option value="">Ubah Status...</option>
                <option value="true">Aktif</option>
                <option value="false">Non-Aktif</option>
              </select>
              <button class="btn btn-primary btn-sm" id="btn-bulk-update" style="padding:4px 12px">Update</button>
            </div>
          </div>
        </div>

        <!-- TAB: REGISTER -->
        <div id="uc-tab-register" style="display:none">
          <div style="max-width:480px;margin:0 auto">
            <p style="margin-bottom:var(--sp-4);font-size:var(--fs-sm);color:var(--text-muted)">
              Daftarkan akun pengguna baru ke sistem.
            </p>
            <form id="uc-reg-form">
              <div class="form-group">
                <label class="form-label">Nama Lengkap *</label>
                <input type="text" class="form-input" id="uc-reg-name" placeholder="Nama lengkap" required />
              </div>
              <div class="form-group">
                <label class="form-label">Email *</label>
                <input type="email" class="form-input" id="uc-reg-email" placeholder="email@contoh.com" required autocomplete="off" />
              </div>
              <div class="form-group">
                <label class="form-label">Kata Sandi *</label>
                <input type="password" class="form-input" id="uc-reg-password" placeholder="Minimal 6 karakter" required minlength="6" autocomplete="new-password" />
              </div>
              <div class="form-group">
                <label class="form-label">Konfirmasi Kata Sandi *</label>
                <input type="password" class="form-input" id="uc-reg-confirm" placeholder="Ulangi kata sandi" required minlength="6" autocomplete="new-password" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Role</label>
                  <select class="form-select" id="uc-reg-role">
                    ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === 'technician' ? 'selected' : ''}>${v.label}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Departemen</label>
                  <input class="form-input" id="uc-reg-dept" placeholder="Opsional" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Telepon</label>
                <input class="form-input" id="uc-reg-phone" placeholder="08xxxxxxxxxx" />
              </div>
              <button type="submit" class="btn btn-primary" id="uc-reg-btn" style="width:100%">
                <span id="uc-reg-btn-text">Daftarkan Akun</span>
                <div class="spinner" id="uc-reg-spinner" style="display:none"></div>
              </button>
            </form>
          </div>
        </div>

        <!-- TAB: RESET SANDI -->
        <div id="uc-tab-reset" style="display:none">
          <div style="max-width:480px;margin:0 auto">
            <p style="margin-bottom:var(--sp-4);font-size:var(--fs-sm);color:var(--text-muted)">
              Reset kata sandi pengguna berdasarkan email terdaftar.
            </p>
            <form id="uc-reset-form">
              <div class="form-group">
                <label class="form-label">Email Pengguna</label>
                <input type="email" class="form-input" id="uc-reset-email" placeholder="Masukkan email terdaftar" required autocomplete="off" />
              </div>
              <div class="form-group">
                <label class="form-label">Kata Sandi Baru</label>
                <input type="password" class="form-input" id="uc-reset-password" placeholder="Minimal 6 karakter" required minlength="6" autocomplete="new-password" />
              </div>
              <div class="form-group">
                <label class="form-label">Konfirmasi Kata Sandi Baru</label>
                <input type="password" class="form-input" id="uc-reset-confirm" placeholder="Ulangi kata sandi baru" required minlength="6" autocomplete="new-password" />
              </div>
              <button type="submit" class="btn btn-primary" id="uc-reset-btn" style="width:100%">
                <span id="uc-reset-btn-text">Ubah Kata Sandi</span>
                <div class="spinner" id="uc-reset-spinner" style="display:none"></div>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  await initUserController();
}

async function initUserController() {
  currentProfile = await getCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';

  const deniedEl = document.getElementById('user-access-denied');
  const panelEl  = document.getElementById('user-admin-panel');

  if (!isAdmin) {
    deniedEl.style.display = 'block';
    panelEl.style.display  = 'none';
    return;
  }

  panelEl.style.display = 'block';

  // ---- Tab switching ----
  const tabs = document.querySelectorAll('[data-uc-tab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.ucTab);
    });
  });

  // ---- List tab actions ----
  document.getElementById('add-user-btn').addEventListener('click', () => showUserForm());
  document.getElementById('btn-bulk-update').addEventListener('click', handleBulkUpdate);

  // ---- Register form ----
  document.getElementById('uc-reg-form').addEventListener('submit', handleRegister);

  // ---- Reset form ----
  document.getElementById('uc-reset-form').addEventListener('submit', handleResetPassword);

  await loadUsers();
}

function switchTab(tabName) {
  activeTab = tabName;
  const ucError   = document.getElementById('uc-error');
  const ucSuccess = document.getElementById('uc-success');
  if (ucError)   { ucError.textContent = ''; ucError.classList.remove('show'); }
  if (ucSuccess) { ucSuccess.textContent = ''; ucSuccess.classList.remove('show'); }

  // Update button states
  document.querySelectorAll('[data-uc-tab]').forEach(t => {
    t.classList.toggle('active', t.dataset.ucTab === tabName);
  });

  // Show/hide panels
  document.getElementById('uc-tab-list').style.display     = tabName === 'list'     ? 'block' : 'none';
  document.getElementById('uc-tab-register').style.display = tabName === 'register' ? 'block' : 'none';
  document.getElementById('uc-tab-reset').style.display    = tabName === 'reset'    ? 'block' : 'none';
}

// ---- Register handler ----
async function handleRegister(e) {
  e.preventDefault();
  const errorEl   = document.getElementById('uc-error');
  const successEl = document.getElementById('uc-success');
  errorEl.classList.remove('show');
  successEl.classList.remove('show');

  const spinner = document.getElementById('uc-reg-spinner');
  const btnText = document.getElementById('uc-reg-btn-text');

  const name     = document.getElementById('uc-reg-name').value.trim();
  const email    = document.getElementById('uc-reg-email').value.trim();
  const password = document.getElementById('uc-reg-password').value;
  const confirm  = document.getElementById('uc-reg-confirm').value;
  const role     = document.getElementById('uc-reg-role').value;

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
        data: { full_name: name, role },
      },
    });

    if (error) throw error;

    successEl.textContent = 'Akun berhasil didaftarkan!';
    successEl.classList.add('show');
    document.getElementById('uc-reg-form').reset();
    setTimeout(() => successEl.classList.remove('show'), 4000);

    // Refresh daftar pengguna di background
    await loadUsers();
  } catch (err) {
    const msg = err.message;
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      errorEl.textContent = 'Email sudah terdaftar.';
    } else {
      errorEl.textContent = msg || 'Gagal mendaftarkan akun';
    }
    errorEl.classList.add('show');
  } finally {
    spinner.style.display = 'none';
    btnText.textContent = 'Daftarkan Akun';
  }
}

// ---- Reset Password handler ----
async function handleResetPassword(e) {
  e.preventDefault();
  const errorEl   = document.getElementById('uc-error');
  const successEl = document.getElementById('uc-success');
  errorEl.classList.remove('show');
  successEl.classList.remove('show');

  const spinner = document.getElementById('uc-reset-spinner');
  const btnText = document.getElementById('uc-reset-btn-text');

  const email       = document.getElementById('uc-reset-email').value.trim();
  const newPassword = document.getElementById('uc-reset-password').value;
  const confirm     = document.getElementById('uc-reset-confirm').value;

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
      successEl.textContent = 'Kata sandi berhasil diubah!';
      successEl.classList.add('show');
      document.getElementById('uc-reset-form').reset();
      setTimeout(() => successEl.classList.remove('show'), 4000);
    } else {
      throw new Error('Email tidak ditemukan atau tidak terdaftar');
    }
  } catch (err) {
    errorEl.textContent = err.message || 'Gagal mengubah kata sandi';
    errorEl.classList.add('show');
  } finally {
    spinner.style.display = 'none';
    btnText.textContent = 'Ubah Kata Sandi';
  }
}

// ---- Bulk update ----
async function handleBulkUpdate() {
  const newStatusStr = document.getElementById('bulk-status-select').value;
  if (!newStatusStr) return showToast('Pilih status terlebih dahulu', 'warning');
  if (selectedUserIds.length === 0) return;

  const isActive = newStatusStr === 'true';
  const label    = isActive ? 'Aktif' : 'Non-Aktif';

  showConfirm({
    message: `Ubah status ${selectedUserIds.length} pengguna menjadi ${label}?`,
    onConfirm: async () => {
      try {
        await bulkUpdateRows('profiles', selectedUserIds, { is_active: isActive });
        showToast('Berhasil update status massal', 'success');
        document.getElementById('bulk-status-select').value = '';
        selectedUserIds = [];
        updateBulkBar();
        await loadUsers();
      } catch (err) {
        showToast('Gagal update massal', 'error');
      }
    }
  });
}

function updateBulkBar() {
  const bar   = document.getElementById('bulk-action-bar');
  const bdg   = document.getElementById('bulk-count-badge');
  if (!bar || !bdg) return;
  if (selectedUserIds.length > 0) {
    bdg.textContent = selectedUserIds.length;
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
  }
}

async function loadUsers() {
  try {
    allUsers = await fetchAll('profiles', { order: { column: 'created_at', ascending: false } });
    renderTable();
  } catch (err) {
    showToast('Gagal memuat data pengguna', 'error');
  }
}

function renderTable() {
  const wrapper = document.getElementById('user-table-wrapper');
  if (!wrapper) return;

  if (allUsers.length === 0) {
    wrapper.innerHTML = `<div class="empty-state">${icons.users}<h4>Tidak ada pengguna</h4></div>`;
    return;
  }

  wrapper.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead><tr>
          <th class="col-checkbox"><input type="checkbox" class="form-checkbox" id="select-all" /></th>
          <th>Pengguna</th><th>Departemen</th><th>Role</th><th>Skill</th><th>Telepon</th><th>Status</th><th>Terdaftar</th><th>Aksi</th>
        </tr></thead>
        <tbody>
          ${allUsers.map(u => {
            const skillKey  = (u.skill || '').toUpperCase();
            const skillInfo = TECHNICIAN_SKILLS[skillKey];
            const skillBadge = skillInfo
              ? `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:0.72rem;font-weight:700;background:${skillInfo.bg};color:${skillInfo.color}">${skillInfo.label}</span>`
              : `<span style="color:var(--text-muted);font-size:var(--fs-xs)">—</span>`;
            return `
            <tr>
              <td class="col-checkbox"><input type="checkbox" class="form-checkbox row-checkbox" value="${u.id}" ${selectedUserIds.includes(u.id) ? 'checked' : ''} /></td>
              <td>
                <div style="display:flex;align-items:center;gap:var(--sp-3)">
                  <div class="sidebar-avatar" style="width:32px;height:32px;font-size:var(--fs-xs)">${(u.full_name || 'U').charAt(0).toUpperCase()}</div>
                  <div>
                    <div style="font-weight:var(--fw-medium)">${escapeHtml(u.full_name || '-')}</div>
                    <div style="font-size:var(--fs-xs);color:var(--text-muted)">${u.id.slice(0, 8)}...</div>
                  </div>
                </div>
              </td>
              <td>${escapeHtml(u.department || '-')}</td>
              <td>${badge(ROLES[u.role]?.label || u.role, ROLES[u.role]?.color, ROLES[u.role]?.bg)}</td>
              <td>${skillBadge}</td>
              <td>${escapeHtml(u.phone || '-')}</td>
              <td>${u.is_active
                ? badge('Aktif', '#10b981', 'rgba(16,185,129,0.15)')
                : badge('Non-Aktif', '#ef4444', 'rgba(239,68,68,0.15)')
              }</td>
              <td>${formatDate(u.created_at)}</td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-ghost btn-icon btn-sm" data-edit-user="${u.id}" title="Edit">${icons.edit}</button>
                  <button class="btn btn-ghost btn-icon btn-sm" data-toggle-user="${u.id}" title="${u.is_active ? 'Nonaktifkan' : 'Aktifkan'}">
                    ${u.is_active ? icons.userX : icons.userCheck}
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  setupBulkSelection(wrapper, (selected) => {
    selectedUserIds = selected;
    updateBulkBar();
  });

  wrapper.querySelectorAll('[data-edit-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      const user = allUsers.find(u => u.id === btn.dataset.editUser);
      if (user) showEditUserForm(user);
    });
  });

  wrapper.querySelectorAll('[data-toggle-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const user = allUsers.find(u => u.id === btn.dataset.toggleUser);
      if (!user) return;
      try {
        await updateRow('profiles', user.id, { is_active: !user.is_active });
        showToast(`Pengguna ${user.is_active ? 'dinonaktifkan' : 'diaktifkan'}`, 'success');
        await loadUsers();
      } catch (err) {
        showToast('Gagal memperbarui status', 'error');
      }
    });
  });
}

function showUserForm() {
  showModal({
    title: 'Tambah Pengguna Baru',
    body: `
      <div class="form-group">
        <label class="form-label">Nama Lengkap *</label>
        <input class="form-input" id="new-user-name" placeholder="Nama lengkap" required />
      </div>
      <div class="form-group">
        <label class="form-label">Email *</label>
        <input type="email" class="form-input" id="new-user-email" placeholder="email@contoh.com" required />
      </div>
      <div class="form-group">
        <label class="form-label">Kata Sandi *</label>
        <input type="password" class="form-input" id="new-user-password" placeholder="Minimal 6 karakter" required minlength="6" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Role</label>
          <select class="form-select" id="new-user-role">
            ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Departemen</label>
          <input class="form-input" id="new-user-dept" placeholder="Departemen" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Telepon</label>
        <input class="form-input" id="new-user-phone" placeholder="08xxxxxxxxxx" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="new-user-cancel">Batal</button>
      <button class="btn btn-primary" id="new-user-save">Tambah Pengguna</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#new-user-cancel').addEventListener('click', close);
      overlay.querySelector('#new-user-save').addEventListener('click', async () => {
        const name     = overlay.querySelector('#new-user-name').value.trim();
        const email    = overlay.querySelector('#new-user-email').value.trim();
        const password = overlay.querySelector('#new-user-password').value;
        const role     = overlay.querySelector('#new-user-role').value;

        if (!name || !email || !password) {
          showToast('Nama, Email, dan Kata Sandi wajib diisi', 'warning');
          return;
        }
        if (password.length < 6) {
          showToast('Kata sandi minimal 6 karakter', 'warning');
          return;
        }

        try {
          await signUp(email, password, { full_name: name, role });
          showToast('Pengguna berhasil ditambahkan. User perlu verifikasi email.', 'success');
          close();
          setTimeout(() => loadUsers(), 1500);
        } catch (err) {
          showToast(err.message || 'Gagal menambahkan pengguna', 'error');
        }
      });
    }
  });
}

function showEditUserForm(user) {
  showModal({
    title: 'Edit Pengguna',
    body: `
      <div class="form-group">
        <label class="form-label">Nama Lengkap</label>
        <input class="form-input" id="edit-user-name" value="${user.full_name || ''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Role</label>
          <select class="form-select" id="edit-user-role">
            ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${user.role === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Departemen</label>
          <input class="form-input" id="edit-user-dept" value="${user.department || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Skill</label>
          <select class="form-select" id="edit-user-skill">
            <option value="">— Tidak Ada —</option>
            ${Object.entries(TECHNICIAN_SKILLS).map(([k, v]) => `<option value="${k}" ${(user.skill || '').toUpperCase() === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Telepon</label>
          <input class="form-input" id="edit-user-phone" value="${user.phone || ''}" />
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="edit-user-cancel">Batal</button>
      <button class="btn btn-primary" id="edit-user-save">Simpan Perubahan</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#edit-user-cancel').addEventListener('click', close);
      overlay.querySelector('#edit-user-save').addEventListener('click', async () => {
        const data = {
          full_name:  overlay.querySelector('#edit-user-name').value.trim(),
          role:       overlay.querySelector('#edit-user-role').value,
          department: overlay.querySelector('#edit-user-dept').value.trim(),
          skill:      overlay.querySelector('#edit-user-skill').value,
          phone:      overlay.querySelector('#edit-user-phone').value.trim(),
        };

        try {
          await updateRow('profiles', user.id, data);
          showToast('Pengguna berhasil diperbarui', 'success');
          close();
          await loadUsers();
        } catch (err) {
          showToast(err.message || 'Gagal menyimpan', 'error');
        }
      });
    }
  });
}
