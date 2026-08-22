import { renderTechShell } from '../components/tech-shell.js';
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/modal.js';
import { getCurrentProfile, updateProfile, updateUserEmail, updateUserPassword, signOut, getTechWOHistory } from '../lib/supabase.js';
import { WO_STATUS, WO_PRIORITY, WO_CATEGORY } from '../utils/constants.js';
import { formatDate, badge, escapeHtml, timeAgo } from '../utils/helpers.js';

export async function renderTechProfile() {
  const { content, profile } = await renderTechShell('profile');
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const history = await getTechWOHistory(profile.id);
    renderProfileContent(content, profile, history);
  } catch (err) {
    renderProfileContent(content, profile, []);
  }
}

function renderProfileContent(content, profile, history) {
  const avatarContent = profile?.avatar_url
    ? `<img src="${profile.avatar_url}" alt="avatar" />`
    : `<span>${(profile?.full_name || 'T').charAt(0).toUpperCase()}</span>`;

  const historyHtml = history.length === 0
    ? `<div class="tech-empty" style="padding:var(--sp-5) 0">${icons.history}<p>Belum ada WO yang diselesaikan</p></div>`
    : history.map(wo => {
        const cat = WO_CATEGORY[wo.category] || WO_CATEGORY.OTHER;
        return `
          <div class="tech-history-item">
            <div style="flex:1">
              <div style="font-family:monospace;font-size:var(--fs-xs);color:var(--accent)">${escapeHtml(wo.wo_number)}</div>
              <div style="font-size:var(--fs-sm);color:var(--text-primary);margin-top:2px;line-height:1.4">${escapeHtml(wo.description || '-')}</div>
              <div style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:4px">${timeAgo(wo.closed_at)}</div>
            </div>
            <div style="flex-shrink:0;text-align:right">
              ${badge(cat.label, cat.color, cat.bg)}
              <div style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:4px">${wo.man_hours_actual || 0}h</div>
            </div>
          </div>
        `;
      }).join('');

  content.innerHTML = `
    <!-- Profile Header -->
    <div class="text-center mb-4 pt-3">
      <div class="tech-profile-avatar mx-auto mb-3" id="avatar-trigger" style="width:80px;height:80px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:2rem;position:relative;cursor:pointer;overflow:hidden;">
        ${avatarContent}
        <div class="tech-profile-avatar-overlay" style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:white;font-size:1rem;padding:4px 0;text-align:center;">${icons.camera}</div>
      </div>
      <input type="file" id="avatar-input" accept="image/*" style="display:none" />
      <h4 class="mb-1 text-dark fw-bold">${escapeHtml(profile?.full_name || 'Teknisi')}</h4>
      <span class="badge bg-primary bg-opacity-10 text-primary">Teknisi</span>
    </div>

    <!-- Edit Profile -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body p-4">
        <h6 class="card-title d-flex align-items-center gap-2 mb-4 fw-semibold text-dark">${icons.user} Edit Profil</h6>
        <div class="mb-3">
          <label class="form-label">Nama Lengkap</label>
          <input type="text" class="form-control" id="p-name" value="${escapeHtml(profile?.full_name || '')}" placeholder="Nama lengkap" />
        </div>
        <div class="mb-4">
          <label class="form-label">Email</label>
          <input type="email" class="form-control" id="p-email" value="${escapeHtml(profile?.email || '')}" placeholder="Email" />
        </div>
        <button class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2" id="p-save-info">${icons.save} Simpan Perubahan</button>
      </div>
    </div>

    <!-- Change Password -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body p-4">
        <h6 class="card-title d-flex align-items-center gap-2 mb-4 fw-semibold text-dark">${icons.shieldCheck} Ganti Password</h6>
        <div class="mb-3">
          <label class="form-label">Password Baru</label>
          <input type="password" class="form-control" id="p-new-pass" placeholder="Minimal 6 karakter" />
        </div>
        <div class="mb-4">
          <label class="form-label">Konfirmasi Password</label>
          <input type="password" class="form-control" id="p-confirm-pass" placeholder="Ulangi password baru" />
        </div>
        <button class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2" id="p-save-pass">${icons.shieldCheck} Ganti Password</button>
      </div>
    </div>

    <!-- WO History -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body p-4">
        <div class="d-flex align-items-center justify-content-between mb-4">
          <h6 class="card-title d-flex align-items-center gap-2 mb-0 fw-semibold text-dark">${icons.history} Riwayat WO Selesai</h6>
          <span class="badge bg-secondary rounded-pill">${history.length}</span>
        </div>
        ${historyHtml}
      </div>
    </div>

    <!-- Logout -->
    <button class="btn btn-outline-danger w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-5" id="p-logout">
      ${icons.logOut} Keluar dari Akun
    </button>
  `;

  // Avatar upload
  const avatarTrigger = content.querySelector('#avatar-trigger');
  const avatarInput = content.querySelector('#avatar-input');
  avatarTrigger.addEventListener('click', () => avatarInput.click());
  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Ukuran foto maks 2MB', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      try {
        await updateProfile(profile.id, { avatar_url: base64 });
        showToast('Foto profil berhasil diperbarui', 'success');
        renderTechProfile();
      } catch { showToast('Gagal memperbarui foto', 'error'); }
    };
    reader.readAsDataURL(file);
  });

  // Save info
  content.querySelector('#p-save-info').addEventListener('click', async () => {
    const name = content.querySelector('#p-name').value.trim();
    const email = content.querySelector('#p-email').value.trim();
    if (!name) { showToast('Nama tidak boleh kosong', 'warning'); return; }
    try {
      await updateProfile(profile.id, { full_name: name });
      if (email && email !== profile.email) {
        await updateUserEmail(email);
        showToast('Email diperbarui. Cek inbox email Anda untuk konfirmasi.', 'info');
      }
      showToast('Profil berhasil diperbarui', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui profil', 'error');
    }
  });

  // Change password
  content.querySelector('#p-save-pass').addEventListener('click', async () => {
    const newPass = content.querySelector('#p-new-pass').value;
    const confirmPass = content.querySelector('#p-confirm-pass').value;
    if (!newPass || newPass.length < 6) { showToast('Password minimal 6 karakter', 'warning'); return; }
    if (newPass !== confirmPass) { showToast('Konfirmasi password tidak cocok', 'warning'); return; }
    try {
      await updateUserPassword(newPass);
      showToast('Password berhasil diubah', 'success');
      content.querySelector('#p-new-pass').value = '';
      content.querySelector('#p-confirm-pass').value = '';
    } catch (err) {
      showToast(err.message || 'Gagal mengubah password', 'error');
    }
  });

  // Logout
  content.querySelector('#p-logout').addEventListener('click', () => {
    showConfirm({
      title: 'Keluar Akun',
      message: 'Yakin ingin keluar dari akun?',
      confirmText: 'Logout',
      onConfirm: async () => {
        await signOut();
        window.location.hash = '/login';
      }
    });
  });
}