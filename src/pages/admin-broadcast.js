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
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-3);padding:var(--sp-3) 0;border-bottom:1px solid var(--border-color)">
          <div style="flex:1">
            <div style="font-weight:var(--fw-semibold);font-size:var(--fs-sm);color:var(--text-primary)">${escapeHtml(n.title)}</div>
            <div style="font-size:var(--fs-xs);color:var(--text-secondary);margin-top:4px">${escapeHtml(n.body)}</div>
            <div style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:4px">${timeAgo(n.created_at)} • ${escapeHtml(n.profiles?.full_name || 'Admin')}</div>
          </div>
          <button class="btn btn-ghost btn-icon btn-sm" data-delete-notif="${n.id}" style="color:var(--danger);flex-shrink:0">${icons.trash}</button>
        </div>
      `).join('');

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <h2>Broadcast Notifikasi</h2>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);align-items:start">
        <!-- Form Kirim -->
        <div class="broadcast-form-card">
          <h4 style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-4)">${icons.broadcast} Kirim Pesan ke Semua Teknisi</h4>
          <div class="form-group">
            <label class="form-label">Judul Notifikasi *</label>
            <input type="text" class="form-input" id="notif-title" placeholder="Cth: Pengumuman Shift Malam" />
          </div>
          <div class="form-group">
            <label class="form-label">Isi Pesan *</label>
            <textarea class="form-textarea" id="notif-body" placeholder="Isi pesan yang akan diterima semua teknisi..." style="min-height:120px"></textarea>
          </div>
          <button class="btn btn-primary" id="notif-send" style="width:100%">
            ${icons.send} Kirim Sekarang
          </button>
        </div>

        <!-- Riwayat -->
        <div class="broadcast-form-card">
          <h4 style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-4)">${icons.history} Riwayat Notifikasi</h4>
          <div id="notif-list">${notifListHtml}</div>
        </div>
      </div>
    </div>
  `;

  content.querySelector('#notif-send').addEventListener('click', async () => {
    const title = content.querySelector('#notif-title').value.trim();
    const body = content.querySelector('#notif-body').value.trim();
    if (!title || !body) { showToast('Judul dan isi pesan wajib diisi', 'warning'); return; }
    const btn = content.querySelector('#notif-send');
    btn.disabled = true;
    btn.textContent = 'Mengirim...';
    try {
      await sendNotification(title, body);
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