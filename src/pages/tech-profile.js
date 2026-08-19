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
    <div class="tech-profile-header">
      <div class="tech-profile-avatar" id="avatar-trigger">
        ${avatarContent}
        <div class="tech-profile-avatar-overlay">${icons.camera}</div>
      </div>
      <input type="file" id="avatar-input" accept="image/*" style="display:none" />
      <div class="tech-profile-name">${escapeHtml(profile?.full_name || 'Teknisi')}</div>
      <div class="tech-profile-role-badge">Teknisi</div>
    </div>

    <!-- Edit Profile -->
    <div class="tech-form-card">
      <div class="tech-form-card-title">${icons.user} Edit Profil</div>
      <div class="form-group">
        <label class="form-label">Nama Lengkap</label>
        <input type="text" class="form-input" id="p-name" value="${escapeHtml(profile?.full_name || '')}" placeholder="Nama lengkap" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="p-email" value="${escapeHtml(profile?.email || '')}" placeholder="Email" />
      </div>
      <button class="btn btn-primary" id="p-save-info" style="width:100%">${icons.save} Simpan Perubahan</button>
    </div>

    <!-- Change Password -->
    <div class="tech-form-card">
      <div class="tech-form-card-title">${icons.shieldCheck} Ganti Password</div>
      <div class="form-group">
        <label class="form-label">Password Baru</label>
        <input type="password" class="form-input" id="p-new-pass" placeholder="Minimal 6 karakter" />
      </div>
      <div class="form-group">
        <label class="form-label">Konfirmasi Password</label>
        <input type="password" class="form-input" id="p-confirm-pass" placeholder="Ulangi password baru" />
      </div>
      <button class="btn btn-primary" id="p-save-pass" style="width:100%">${icons.shieldCheck} Ganti Password</button>
    </div>

    <!-- WO History -->
    <div class="tech-history-card">
      <div class="tech-form-card-title" style="margin-bottom:var(--sp-3)">${icons.history} Riwayat WO Selesai <span class="tech-section-count" style="margin-left:auto">${history.length}</span></div>
      ${historyHtml}
    </div>

    <!-- Logout -->
    <button class="btn btn-ghost" id="p-logout" style="width:100%;justify-content:center;gap:var(--sp-2);color:var(--danger);border:1px solid var(--danger);margin-bottom:var(--sp-8)">
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