import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { getCurrentProfile, updateProfile, updateUserEmail, updateUserPassword } from '../lib/supabase.js';
import { escapeHtml } from '../utils/helpers.js';

export async function renderProfile() {
  const content = renderAppShell('Profil Saya');
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const profile = await getCurrentProfile();
    renderProfileContent(content, profile);
  } catch (err) {
    showToast('Gagal memuat profil', 'error');
    content.innerHTML = '<div class="alert alert-danger">Gagal memuat profil.</div>';
  }
}

function renderProfileContent(content, profile) {
  const avatarContent = profile?.avatar_url
    ? `<img src="${profile.avatar_url}" alt="avatar" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1;" />`
    : `<span style="position:relative;z-index:1;">${(profile?.full_name || 'A').charAt(0).toUpperCase()}</span>`;

  content.innerHTML = `
    <div class="row">
      <div class="col-md-4 mb-4">
        <!-- Profile Header -->
        <div class="card border-0 shadow-sm text-center pt-5 pb-4 px-4 h-100">
          <div class="mx-auto mb-3" id="avatar-trigger" style="width:100px;height:100px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:2.5rem;position:relative;cursor:pointer;overflow:hidden;border:4px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            ${avatarContent}
            <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:white;font-size:0.9rem;padding:4px 0;text-align:center;z-index:2;">${icons.camera}</div>
          </div>
          <input type="file" id="avatar-input" accept="image/*" style="display:none" />
          <h5 class="mb-1 text-dark fw-bold">${escapeHtml(profile?.full_name || 'Admin')}</h5>
          <div class="mb-3">
            <span class="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill">${(profile?.role || 'Admin').toUpperCase()}</span>
          </div>
          <p class="text-muted small">Klik foto untuk mengubah avatar profil Anda. Maksimal ukuran file 2MB.</p>
        </div>
      </div>
      
      <div class="col-md-8">
        <!-- Edit Profile -->
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-body p-4">
            <h6 class="card-title d-flex align-items-center gap-2 mb-4 fw-semibold text-dark">${icons.user} Informasi Dasar</h6>
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label text-muted small fw-semibold">Nama Lengkap</label>
                <input type="text" class="form-control" id="p-name" value="${escapeHtml(profile?.full_name || '')}" placeholder="Nama lengkap" />
              </div>
              <div class="col-md-6 mb-4">
                <label class="form-label text-muted small fw-semibold">Alamat Email</label>
                <input type="email" class="form-control" id="p-email" value="${escapeHtml(profile?.email || '')}" placeholder="Email login" />
              </div>
            </div>
            <div class="d-flex justify-content-end">
              <button class="btn btn-primary d-flex align-items-center gap-2" id="p-save-info">
                ${icons.save} Simpan Perubahan
              </button>
            </div>
          </div>
        </div>

        <!-- Change Password -->
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-body p-4">
            <h6 class="card-title d-flex align-items-center gap-2 mb-4 fw-semibold text-dark">${icons.shieldCheck} Keamanan & Password</h6>
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label text-muted small fw-semibold">Password Baru</label>
                <input type="password" class="form-control" id="p-new-pass" placeholder="Minimal 6 karakter" />
              </div>
              <div class="col-md-6 mb-4">
                <label class="form-label text-muted small fw-semibold">Konfirmasi Password Baru</label>
                <input type="password" class="form-control" id="p-confirm-pass" placeholder="Ulangi password baru" />
              </div>
            </div>
            <div class="d-flex justify-content-end">
              <button class="btn btn-primary d-flex align-items-center gap-2" id="p-save-pass">
                ${icons.shieldCheck} Ganti Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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
        renderProfile();
      } catch { showToast('Gagal memperbarui foto', 'error'); }
    };
    reader.readAsDataURL(file);
  });

  // Save info
  content.querySelector('#p-save-info').addEventListener('click', async () => {
    const name = content.querySelector('#p-name').value.trim();
    const email = content.querySelector('#p-email').value.trim();
    if (!name) { showToast('Nama tidak boleh kosong', 'warning'); return; }
    
    const btn = content.querySelector('#p-save-info');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
    btn.disabled = true;

    try {
      await updateProfile(profile.id, { full_name: name });
      if (email && email !== profile.email) {
        await updateUserEmail(email);
        showToast('Email diperbarui. Cek inbox email Anda untuk konfirmasi.', 'info');
      } else {
        showToast('Profil berhasil diperbarui', 'success');
      }
      renderProfile();
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui profil', 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });

  // Change password
  content.querySelector('#p-save-pass').addEventListener('click', async () => {
    const newPass = content.querySelector('#p-new-pass').value;
    const confirmPass = content.querySelector('#p-confirm-pass').value;
    
    if (!newPass || newPass.length < 6) { showToast('Password minimal 6 karakter', 'warning'); return; }
    if (newPass !== confirmPass) { showToast('Konfirmasi password tidak cocok', 'warning'); return; }
    
    const btn = content.querySelector('#p-save-pass');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
    btn.disabled = true;

    try {
      await updateUserPassword(newPass);
      showToast('Password berhasil diubah', 'success');
      content.querySelector('#p-new-pass').value = '';
      content.querySelector('#p-confirm-pass').value = '';
    } catch (err) {
      showToast(err.message || 'Gagal mengganti password', 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
}
