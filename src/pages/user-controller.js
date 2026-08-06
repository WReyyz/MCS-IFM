import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, updateRow, getCurrentProfile, supabase, signUp, bulkUpdateRows } from '../lib/supabase.js';
import { ROLES } from '../utils/constants.js';
import { formatDate, escapeHtml, badge, setupBulkSelection } from '../utils/helpers.js';

let allUsers = [];
let currentProfile = null;
let selectedUserIds = [];

export async function renderUserController() {
  const content = renderAppShell('Kontrol Pengguna');

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <h2>Kontrol Pengguna</h2>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="add-user-btn">${icons.plus} Tambah Pengguna</button>
        </div>
      </div>
      <div id="user-access-warning" style="display:none;padding:var(--sp-3);background:var(--danger-bg);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-md);margin-bottom:var(--sp-4);font-size:var(--fs-sm);color:var(--danger);display:flex;align-items:center;gap:var(--sp-2)">
        ${icons.alertTriangle} Halaman ini hanya dapat diakses oleh Admin.
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
          <select class="form-select form-select-sm" id="bulk-status-select" style="min-width: 150px; padding-top: 4px; padding-bottom: 4px;">
            <option value="">Ubah Status...</option>
            <option value="true">Aktif</option>
            <option value="false">Non-Aktif</option>
          </select>
          <button class="btn btn-primary btn-sm" id="btn-bulk-update" style="padding: 4px 12px">Update</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-user-btn').addEventListener('click', () => showUserForm());
  document.getElementById('btn-bulk-update').addEventListener('click', handleBulkUpdate);

  await loadUsers();
}

async function handleBulkUpdate() {
  const newStatusStr = document.getElementById('bulk-status-select').value;
  if (!newStatusStr) return showToast('Pilih status terlebih dahulu', 'warning');
  if (selectedUserIds.length === 0) return;

  const isActive = newStatusStr === 'true';
  const label = isActive ? 'Aktif' : 'Non-Aktif';

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
  const bar = document.getElementById('bulk-action-bar');
  const badge = document.getElementById('bulk-count-badge');
  if (selectedUserIds.length > 0) {
    badge.textContent = selectedUserIds.length;
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
  }
}


async function loadUsers() {
  try {
    currentProfile = await getCurrentProfile();

    // Check if admin
    const warningEl = document.getElementById('user-access-warning');
    if (currentProfile?.role !== 'admin') {
      if (warningEl) warningEl.style.display = 'flex';
    } else {
      if (warningEl) warningEl.style.display = 'none';
    }

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
          <th>Pengguna</th><th>Departemen</th><th>Role</th><th>Telepon</th><th>Status</th><th>Terdaftar</th><th>Aksi</th>
        </tr></thead>
        <tbody>
          ${allUsers.map(u => `
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
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Setup bulk selection helper
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
        const name = overlay.querySelector('#new-user-name').value.trim();
        const email = overlay.querySelector('#new-user-email').value.trim();
        const password = overlay.querySelector('#new-user-password').value;
        const role = overlay.querySelector('#new-user-role').value;

        if (!name || !email || !password) {
          showToast('Nama, Email, dan Kata Sandi wajib diisi', 'warning');
          return;
        }
        if (password.length < 6) {
          showToast('Kata sandi minimal 6 karakter', 'warning');
          return;
        }

        try {
          await signUp(email, password, {
            full_name: name,
            role: role,
          });

          // Update profile with additional data
          // The trigger will create the profile, we need to wait then update
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
      <div class="form-group">
        <label class="form-label">Telepon</label>
        <input class="form-input" id="edit-user-phone" value="${user.phone || ''}" />
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
          full_name: overlay.querySelector('#edit-user-name').value.trim(),
          role: overlay.querySelector('#edit-user-role').value,
          department: overlay.querySelector('#edit-user-dept').value.trim(),
          phone: overlay.querySelector('#edit-user-phone').value.trim(),
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
