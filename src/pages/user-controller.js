import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, updateRow, getCurrentProfile, supabase, signUp, bulkUpdateRows, resetPasswordByEmployeeId } from '../lib/supabase.js';
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
      <div class="mb-4 d-flex justify-content-between align-items-center">
        <h2 class="h4 fw-bold mb-0">Kontrol Pengguna</h2>
      </div>

      <!-- ACCESS DENIED (non-admin) -->
      <div id="user-access-denied" style="display:none">
        <div class="alert alert-danger d-flex align-items-center gap-2 small">
          ${icons.alertTriangle} Halaman ini hanya dapat diakses oleh Admin.
        </div>
      </div>

      <!-- ADMIN PANEL -->
      <div id="user-admin-panel" style="display:none">
        <!-- Sub-Tabs -->
        <ul class="nav nav-pills mb-4 bg-white border rounded p-1 d-inline-flex" id="uc-tabs">
          <li class="nav-item">
            <button class="nav-link active" data-uc-tab="list">Daftar Pengguna</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" data-uc-tab="register">Daftar Akun Baru</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" data-uc-tab="reset">Reset Kata Sandi</button>
          </li>
        </ul>

        <!-- ERROR / SUCCESS banner -->
        <div class="alert alert-danger d-none" id="uc-error"></div>
        <div class="alert alert-success d-none" id="uc-success"></div>

        <!-- TAB: LIST -->
        <div id="uc-tab-list">
          <div class="d-flex justify-content-end mb-3">
            <button class="btn btn-primary d-flex align-items-center gap-2" id="add-user-btn">${icons.plus} Tambah Pengguna</button>
          </div>
          <div id="user-table-wrapper" class="card border-0 shadow-sm">
            <div class="card-body p-0">
              <div class="plan-loading p-5 d-flex justify-content-center"><div class="spinner"></div></div>
            </div>
          </div>
          <!-- BULK ACTION BAR -->
          <div class="bulk-action-bar" id="bulk-action-bar">
            <div class="bulk-selected-count">
              <span class="badge bg-primary" id="bulk-count-badge">0</span> item terpilih
            </div>
              <div class="bulk-actions d-flex gap-2 align-items-center">
                <select class="form-select form-select-sm" id="bulk-status-select" style="min-width:150px;">
                  <option value="">Ubah Status...</option>
                  <option value="true">Aktif</option>
                  <option value="false">Non-Aktif</option>
                </select>
                <button class="btn btn-primary btn-sm" id="btn-bulk-update">Update</button>
                <button class="btn btn-danger btn-sm" id="btn-bulk-delete" title="Hapus Pengguna Terpilih">${icons.trash || 'Hapus'}</button>
              </div>
          </div>
        </div>

        <!-- TAB: REGISTER -->
        <div id="uc-tab-register" style="display:none">
          <div class="card border-0 shadow-sm mx-auto" style="max-width:500px;">
            <div class="card-body p-4">
              <p class="text-muted small mb-4">
                Daftarkan akun pengguna baru ke sistem.
              </p>
              <form id="uc-reg-form">
                <div class="mb-3">
                  <label class="form-label">Nama Lengkap *</label>
                  <input type="text" class="form-control" id="uc-reg-name" placeholder="Nama lengkap" required />
                </div>
                <div class="mb-3">
                  <label class="form-label">ID Pegawai *</label>
                  <input type="text" class="form-control" id="uc-reg-employee-id" placeholder="Contoh: EMP001" required autocomplete="off" />
                  <div class="form-text">ID unik yang digunakan pegawai untuk login.</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Email <span class="text-muted">(Opsional, untuk data internal)</span></label>
                  <input type="email" class="form-control" id="uc-reg-email" placeholder="email@contoh.com" autocomplete="off" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Kata Sandi *</label>
                  <input type="password" class="form-control" id="uc-reg-password" placeholder="Minimal 6 karakter" required minlength="6" autocomplete="new-password" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Konfirmasi Kata Sandi *</label>
                  <input type="password" class="form-control" id="uc-reg-confirm" placeholder="Ulangi kata sandi" required minlength="6" autocomplete="new-password" />
                </div>
                <div class="row g-3 mb-3">
                  <div class="col-md-6">
                    <label class="form-label">Role</label>
                    <select class="form-select" id="uc-reg-role">
                      ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === 'technician' ? 'selected' : ''}>${v.label}</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Departemen</label>
                    <input class="form-control" id="uc-reg-dept" placeholder="Opsional" />
                  </div>
                </div>
                <div class="mb-4">
                  <label class="form-label">Telepon</label>
                  <input class="form-control" id="uc-reg-phone" placeholder="08xxxxxxxxxx" />
                </div>
                <button type="submit" class="btn btn-primary w-100 d-flex justify-content-center align-items-center gap-2" id="uc-reg-btn">
                  <span id="uc-reg-btn-text">Daftarkan Akun</span>
                  <div class="spinner border border-2 border-white ms-2" id="uc-reg-spinner" style="display:none; width: 1rem; height: 1rem; border-right-color: transparent !important;"></div>
                </button>
              </form>
            </div>
          </div>
        </div>

        <!-- TAB: RESET SANDI -->
        <div id="uc-tab-reset" style="display:none">
          <div class="card border-0 shadow-sm mx-auto" style="max-width:500px;">
            <div class="card-body p-4">
              <p class="text-muted small mb-4">
                Reset kata sandi pengguna berdasarkan ID Pegawai.
              </p>
              <form id="uc-reset-form">
                <div class="mb-3">
                  <label class="form-label">ID Pegawai</label>
                  <input type="text" class="form-control" id="uc-reset-employee-id" placeholder="Masukkan ID Pegawai" required autocomplete="off" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Kata Sandi Baru</label>
                  <input type="password" class="form-control" id="uc-reset-password" placeholder="Minimal 6 karakter" required minlength="6" autocomplete="new-password" />
                </div>
                <div class="mb-4">
                  <label class="form-label">Konfirmasi Kata Sandi Baru</label>
                  <input type="password" class="form-control" id="uc-reset-confirm" placeholder="Ulangi kata sandi baru" required minlength="6" autocomplete="new-password" />
                </div>
                <button type="submit" class="btn btn-primary w-100 d-flex justify-content-center align-items-center gap-2" id="uc-reset-btn">
                  <span id="uc-reset-btn-text">Ubah Kata Sandi</span>
                  <div class="spinner border border-2 border-white ms-2" id="uc-reset-spinner" style="display:none; width: 1rem; height: 1rem; border-right-color: transparent !important;"></div>
                </button>
              </form>
            </div>
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
  document.getElementById('btn-bulk-delete').addEventListener('click', handleBulkDelete);

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
  if (ucError)   { ucError.textContent = ''; ucError.classList.add('d-none'); }
  if (ucSuccess) { ucSuccess.textContent = ''; ucSuccess.classList.add('d-none'); }

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
  errorEl.classList.add('d-none');
  successEl.classList.add('d-none');

  const spinner = document.getElementById('uc-reg-spinner');
  const btnText = document.getElementById('uc-reg-btn-text');

  const name       = document.getElementById('uc-reg-name').value.trim();
  const employeeId = document.getElementById('uc-reg-employee-id').value.trim();
  const email      = document.getElementById('uc-reg-email').value.trim();
  const password   = document.getElementById('uc-reg-password').value;
  const confirm    = document.getElementById('uc-reg-confirm').value;
  const role       = document.getElementById('uc-reg-role').value;
  const dept       = document.getElementById('uc-reg-dept').value.trim();
  const phone      = document.getElementById('uc-reg-phone').value.trim();

  if (!employeeId) {
    errorEl.textContent = 'ID Pegawai wajib diisi';
    errorEl.classList.remove('d-none');
    return;
  }
  if (password !== confirm) {
    errorEl.textContent = 'Kata sandi dan konfirmasi tidak cocok';
    errorEl.classList.remove('d-none');
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'Kata sandi minimal 6 karakter';
    errorEl.classList.remove('d-none');
    return;
  }

  // Gunakan email dummy jika tidak diisi (Supabase Auth wajib email)
  const authEmail = email || `${employeeId.toLowerCase().replace(/\s+/g, '')}@mcs.internal`;

  spinner.style.display = 'block';
  btnText.textContent = 'Mendaftarkan...';

  try {
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: { full_name: name, role },
      },
    });

    if (error) throw error;

    // Simpan employee_id ke profiles (trigger on_auth_user_created sudah buat row-nya)
    // Coba update langsung dengan retry singkat karena profile mungkin belum ada
    if (data?.user?.id) {
      const maxRetry = 5;
      for (let i = 0; i < maxRetry; i++) {
        const { error: upErr } = await supabase
          .from('profiles')
          .update({ employee_id: employeeId, department: dept, phone })
          .eq('id', data.user.id);
        if (!upErr) break;
        await new Promise(r => setTimeout(r, 600));
      }
    }

    successEl.textContent = 'Akun berhasil didaftarkan!';
    successEl.classList.remove('d-none');
    document.getElementById('uc-reg-form').reset();
    setTimeout(() => successEl.classList.add('d-none'), 4000);

    // Refresh daftar pengguna di background
    await loadUsers();
  } catch (err) {
    const msg = err.message;
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      errorEl.textContent = 'Email atau ID Pegawai sudah terdaftar.';
    } else {
      errorEl.textContent = msg || 'Gagal mendaftarkan akun';
    }
    errorEl.classList.remove('d-none');
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
  errorEl.classList.add('d-none');
  successEl.classList.add('d-none');

  const spinner = document.getElementById('uc-reset-spinner');
  const btnText = document.getElementById('uc-reset-btn-text');

  const employeeId  = document.getElementById('uc-reset-employee-id').value.trim();
  const newPassword = document.getElementById('uc-reset-password').value;
  const confirm     = document.getElementById('uc-reset-confirm').value;

  if (newPassword !== confirm) {
    errorEl.textContent = 'Kata sandi baru dan konfirmasi tidak cocok';
    errorEl.classList.remove('d-none');
    return;
  }
  if (newPassword.length < 6) {
    errorEl.textContent = 'Kata sandi minimal 6 karakter';
    errorEl.classList.remove('d-none');
    return;
  }

  spinner.style.display = 'block';
  btnText.textContent = 'Memproses...';

  try {
    const success = await resetPasswordByEmployeeId(employeeId, newPassword);
    if (success) {
      successEl.textContent = 'Kata sandi berhasil diubah!';
      successEl.classList.remove('d-none');
      document.getElementById('uc-reset-form').reset();
      setTimeout(() => successEl.classList.add('d-none'), 4000);
    } else {
      throw new Error('ID Pegawai tidak ditemukan atau tidak terdaftar');
    }
  } catch (err) {
    errorEl.textContent = err.message || 'Gagal mengubah kata sandi';
    errorEl.classList.remove('d-none');
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

async function handleBulkDelete() {
  if (selectedUserIds.length === 0) return;
  showConfirm({
    message: `Hapus ${selectedUserIds.length} pengguna secara permanen? Tindakan ini tidak dapat dibatalkan.`,
    onConfirm: async () => {
      try {
        const { error } = await supabase.from('profiles').delete().in('id', selectedUserIds);
        if (error) throw error;
        showToast('Berhasil menghapus pengguna', 'success');
        selectedUserIds = [];
        updateBulkBar();
        await loadUsers();
      } catch (err) {
        showToast('Gagal menghapus pengguna', 'error');
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
    <div class="table-responsive">
      <table class="table table-hover table-bordered mb-0">
        <thead>
          <tr class="table-light">
            <th class="col-checkbox"><input type="checkbox" class="form-check-input" id="select-all" /></th>
            <th>Pengguna</th><th>Departemen</th><th>Role</th><th>Skill</th><th>Telepon</th><th>Status</th><th>Terdaftar</th><th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${allUsers.map(u => {
            const skillKey  = (u.skill || '').toUpperCase();
            const skillInfo = TECHNICIAN_SKILLS[skillKey];
            const skillBadge = skillInfo
              ? `<span class="badge" style="background:${skillInfo.bg};color:${skillInfo.color}">${skillInfo.label}</span>`
              : `<span class="text-muted small">—</span>`;
            return `
            <tr>
              <td class="col-checkbox"><input type="checkbox" class="form-check-input row-checkbox" value="${u.id}" ${selectedUserIds.includes(u.id) ? 'checked' : ''} /></td>
              <td>
                <div class="d-flex align-items-center gap-3">
                  <div class="sidebar-avatar" style="width:32px;height:32px;font-size:var(--fs-xs)">${(u.full_name || 'U').charAt(0).toUpperCase()}</div>
                  <div>
                    <div class="fw-medium">${escapeHtml(u.full_name || '-')}</div>
                    <div class="text-muted small">${u.employee_id ? `<span class="badge bg-secondary bg-opacity-25 text-secondary fw-normal">ID: ${escapeHtml(u.employee_id)}</span>` : '<span class="text-danger small">Belum ada ID Pegawai</span>'}</div>
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
                  <button class="btn btn-outline-warning btn-sm btn-icon" data-edit-user="${u.id}" title="Edit">${icons.edit}</button>
                  <button class="btn btn-outline-${u.is_active ? 'danger' : 'success'} btn-sm btn-icon" data-toggle-user="${u.id}" title="${u.is_active ? 'Nonaktifkan' : 'Aktifkan'}">
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
      <div class="mb-3">
        <label class="form-label">Nama Lengkap *</label>
        <input class="form-control" id="new-user-name" placeholder="Nama lengkap" required />
      </div>
      <div class="mb-3">
        <label class="form-label">ID Pegawai *</label>
        <input type="text" class="form-control" id="new-user-employee-id" placeholder="Contoh: EMP001" required />
        <div class="form-text">ID unik yang digunakan untuk login.</div>
      </div>
      <div class="mb-3">
        <label class="form-label">Email <span class="text-muted small">(Opsional)</span></label>
        <input type="email" class="form-control" id="new-user-email" placeholder="email@contoh.com" />
      </div>
      <div class="mb-3">
        <label class="form-label">Kata Sandi *</label>
        <input type="password" class="form-control" id="new-user-password" placeholder="Minimal 6 karakter" required minlength="6" />
      </div>
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <label class="form-label">Role</label>
          <select class="form-select" id="new-user-role">
            ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Departemen</label>
          <input class="form-control" id="new-user-dept" placeholder="Departemen" />
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Telepon</label>
        <input class="form-control" id="new-user-phone" placeholder="08xxxxxxxxxx" />
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="new-user-cancel">Batal</button>
      <button class="btn btn-primary" id="new-user-save">Tambah Pengguna</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#new-user-cancel').addEventListener('click', close);
      overlay.querySelector('#new-user-save').addEventListener('click', async () => {
        const name       = overlay.querySelector('#new-user-name').value.trim();
        const employeeId = overlay.querySelector('#new-user-employee-id').value.trim();
        const email      = overlay.querySelector('#new-user-email').value.trim();
        const password   = overlay.querySelector('#new-user-password').value;
        const role       = overlay.querySelector('#new-user-role').value;
        const dept       = overlay.querySelector('#new-user-dept').value.trim();
        const phone      = overlay.querySelector('#new-user-phone').value.trim();

        if (!name || !employeeId || !password) {
          showToast('Nama, ID Pegawai, dan Kata Sandi wajib diisi', 'warning');
          return;
        }
        if (password.length < 6) {
          showToast('Kata sandi minimal 6 karakter', 'warning');
          return;
        }

        // Gunakan email dummy jika tidak diisi
        const authEmail = email || `${employeeId.toLowerCase().replace(/\s+/g, '')}@mcs.internal`;

        try {
          const { data, error } = await supabase.auth.signUp({
            email: authEmail,
            password,
            options: { data: { full_name: name, role } },
          });
          if (error) throw error;

          // Update employee_id ke profiles dengan retry
          if (data?.user?.id) {
            for (let i = 0; i < 5; i++) {
              const { error: upErr } = await supabase
                .from('profiles')
                .update({ employee_id: employeeId, department: dept, phone })
                .eq('id', data.user.id);
              if (!upErr) break;
              await new Promise(r => setTimeout(r, 600));
            }
          }

          showToast('Pengguna berhasil ditambahkan', 'success');
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
      <div class="mb-3">
        <label class="form-label">Nama Lengkap</label>
        <input class="form-control" id="edit-user-name" value="${user.full_name || ''}" />
      </div>
      <div class="mb-3">
        <label class="form-label">ID Pegawai</label>
        <input type="text" class="form-control" id="edit-user-employee-id" value="${user.employee_id || ''}" placeholder="Contoh: EMP001" />
        <div class="form-text">ID yang digunakan pegawai untuk login. Harus unik.</div>
      </div>
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <label class="form-label">Role</label>
          <select class="form-select" id="edit-user-role">
            ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${user.role === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Departemen</label>
          <input class="form-control" id="edit-user-dept" value="${user.department || ''}" />
        </div>
      </div>
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <label class="form-label">Skill</label>
          <select class="form-select" id="edit-user-skill">
            <option value="">— Tidak Ada —</option>
            ${Object.entries(TECHNICIAN_SKILLS).map(([k, v]) => `<option value="${k}" ${(user.skill || '').toUpperCase() === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Telepon</label>
          <input class="form-control" id="edit-user-phone" value="${user.phone || ''}" />
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="edit-user-cancel">Batal</button>
      <button class="btn btn-primary" id="edit-user-save">Simpan Perubahan</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#edit-user-cancel').addEventListener('click', close);
      overlay.querySelector('#edit-user-save').addEventListener('click', async () => {
        const employeeId = overlay.querySelector('#edit-user-employee-id').value.trim();
        const data = {
          full_name:   overlay.querySelector('#edit-user-name').value.trim(),
          employee_id: employeeId || null,
          role:        overlay.querySelector('#edit-user-role').value,
          department:  overlay.querySelector('#edit-user-dept').value.trim(),
          skill:       overlay.querySelector('#edit-user-skill').value,
          phone:       overlay.querySelector('#edit-user-phone').value.trim(),
        };

        try {
          await updateRow('profiles', user.id, data);
          showToast('Pengguna berhasil diperbarui', 'success');
          close();
          await loadUsers();
        } catch (err) {
          if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
            showToast('ID Pegawai sudah digunakan oleh pengguna lain', 'error');
          } else {
            showToast(err.message || 'Gagal menyimpan', 'error');
          }
        }
      });
    }
  });
}
