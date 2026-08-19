import { renderTechShell } from '../components/tech-shell.js';
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { getNotifications } from '../lib/supabase.js';
import { timeAgo, escapeHtml } from '../utils/helpers.js';

export async function renderTechInbox() {
  const { content } = await renderTechShell('inbox');
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const notifs = await getNotifications();
    if (notifs.length === 0) {
      content.innerHTML = `
        <div style="margin-bottom:var(--sp-4)">
          <div class="tech-section-header">
            <span class="tech-section-title">Inbox Notifikasi</span>
            <span class="tech-section-count">0</span>
          </div>
        </div>
        <div class="tech-empty">${icons.bell}<p>Belum ada notifikasi dari admin</p></div>
      `;
      return;
    }
    const notifHtml = notifs.map(n => {
      const adminName = n.profiles?.full_name || 'Admin';
      return `
        <div class="tech-notif-card">
          <div class="tech-notif-card-header">
            <div class="tech-notif-icon">${icons.broadcast}</div>
            <div style="flex:1">
              <div class="tech-notif-title">${escapeHtml(n.title)}</div>
              <div style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:2px">Dari: ${escapeHtml(adminName)}</div>
            </div>
            <div class="tech-notif-time">${timeAgo(n.created_at)}</div>
          </div>
          <div class="tech-notif-body">${escapeHtml(n.body)}</div>
        </div>
      `;
    }).join('');

    content.innerHTML = `
      <div style="margin-bottom:var(--sp-4)">
        <div class="tech-section-header">
          <span class="tech-section-title">Inbox Notifikasi</span>
          <span class="tech-section-count">${notifs.length}</span>
        </div>
      </div>
      ${notifHtml}
    `;
  } catch (err) {
    content.innerHTML = '<div class="tech-empty"><p>Gagal memuat notifikasi</p></div>';
    showToast('Gagal memuat inbox', 'error');
  }
}