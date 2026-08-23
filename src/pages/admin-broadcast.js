import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { sendNotification, getNotifications, deleteNotification } from '../lib/supabase.js';
import { timeAgo, escapeHtml } from '../utils/helpers.js';
import { showConfirm } from '../components/modal.js';

export async function renderAdminBroadcast() {
  const content = renderAppShell('Broadcast Notifikasi');

  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  const notifs = await getNotifications().catch(() => []);

  const notifListHtml = notifs.length === 0
    ? `<div class="empty-state"><p>Belum ada notifikasi terkirim</p></div>`
    : notifs.map(n => `
        <div class="d-flex align-items-start justify-content-between gap-3 py-3 border-bottom">
          <div class="flex-grow-1">
            <div class="fw-semibold">${escapeHtml(n.title)}</div>
            <div class="text-secondary small mt-1" style="white-space: pre-wrap;">${escapeHtml(n.body)}</div>
            ${n.image_url ? `<div class="mt-2"><img src="${n.image_url}" style="max-width:200px; max-height:200px; border-radius:8px; object-fit:cover; border: 1px solid var(--border-color);" /></div>` : ''}
            <div class="text-muted" style="font-size:.7rem;margin-top:8px">${timeAgo(n.created_at)} • ${escapeHtml(n.profiles?.full_name || 'Admin')}</div>
          </div>
          <button class="btn btn-outline-danger btn-sm btn-icon flex-shrink-0" data-delete-notif="${n.id}" title="Hapus">${icons.trash}</button>
        </div>
      `).join('');

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <h2>Broadcast Notifikasi</h2>
      </div>
      <div class="row g-4">
        <!-- Form Kirim -->
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-body">
              <h6 class="card-title d-flex align-items-center gap-2 mb-4">${icons.broadcast} Kirim Pesan ke Semua Teknisi</h6>
              <div class="mb-3">
                <label class="form-label">Judul Notifikasi *</label>
                <input type="text" class="form-control" id="notif-title" placeholder="Cth: Pengumuman Shift Malam" />
              </div>
              <div class="mb-3">
                <label class="form-label">Gambar/Poster (Opsional)</label>
                <input type="file" class="form-control" id="notif-image" accept="image/*" />
                <div class="mt-2" id="notif-image-preview-wrap" style="display:none;">
                  <img id="notif-image-preview" src="" style="max-width:100%; max-height:200px; border-radius:8px; object-fit:contain; border: 1px solid var(--border-color);" />
                  <button class="btn btn-sm btn-outline-danger mt-2" id="btn-remove-image">Hapus Gambar</button>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Isi Pesan *</label>
                <textarea class="form-control" id="notif-body" placeholder="Isi pesan yang akan diterima semua teknisi..." style="min-height:120px"></textarea>
              </div>
              <button class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2" id="notif-send">
                ${icons.send} Kirim Sekarang
              </button>
            </div>
          </div>
        </div>

        <!-- Riwayat -->
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-body">
              <h6 class="card-title d-flex align-items-center gap-2 mb-4">${icons.history} Riwayat Notifikasi</h6>
              <div id="notif-list">${notifListHtml}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  let imageBase64 = null;
  const imageInput = content.querySelector('#notif-image');
  const previewWrap = content.querySelector('#notif-image-preview-wrap');
  const previewImg = content.querySelector('#notif-image-preview');
  
  imageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      imageBase64 = ev.target.result;
      previewImg.src = imageBase64;
      previewWrap.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  content.querySelector('#btn-remove-image')?.addEventListener('click', () => {
    imageBase64 = null;
    imageInput.value = '';
    previewWrap.style.display = 'none';
  });

  content.querySelector('#notif-send').addEventListener('click', async () => {
    const title = content.querySelector('#notif-title').value.trim();
    const body = content.querySelector('#notif-body').value.trim();
    if (!title || !body) { showToast('Judul dan isi pesan wajib diisi', 'warning'); return; }
    const btn = content.querySelector('#notif-send');
    btn.disabled = true;
    btn.textContent = 'Mengirim...';
    try {
      await sendNotification(title, body, imageBase64);
      showToast('Notifikasi berhasil dikirim ke semua teknisi!', 'success');
      content.querySelector('#notif-title').value = '';
      content.querySelector('#notif-body').value = '';
      renderAdminBroadcast();
    } catch (err) {
      showToast(err.message || 'Gagal mengirim notifikasi', 'error');
      btn.disabled = false;
      btn.innerHTML = icons.send + ' Kirim Sekarang';
    }
  });

  content.querySelectorAll('[data-delete-notif]').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm({
        message: 'Hapus notifikasi ini?',
        onConfirm: async () => {
          try {
            await deleteNotification(btn.dataset.deleteNotif);
            showToast('Notifikasi dihapus', 'success');
            renderAdminBroadcast();
          } catch { showToast('Gagal menghapus', 'error'); }
        }
      });
    });
  });
}