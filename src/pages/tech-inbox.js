import { renderTechShell } from '../components/tech-shell.js';
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { getNotifications } from '../lib/supabase.js';
import { timeAgo, escapeHtml } from '../utils/helpers.js';

export async function renderTechInbox() {
  // Bersihkan modal lama jika tersisa di body
  const oldModal = document.getElementById('notifModal');
  if (oldModal && oldModal.parentNode === document.body) {
    oldModal.remove();
  }

  const { content } = await renderTechShell('inbox');
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const notifs = await getNotifications();
    const readNotifs = JSON.parse(localStorage.getItem('readNotifs') || '[]');
    const unreadCount = notifs.filter(n => !readNotifs.includes(n.id)).length;

    if (notifs.length === 0) {
      content.innerHTML = `
        <div class="mb-4 d-flex justify-content-between align-items-center">
          <h5 class="mb-0 fw-semibold text-dark">Inbox Notifikasi</h5>
          <span class="badge bg-primary rounded-pill">0</span>
        </div>
        <div class="text-center p-5 text-muted bg-light rounded border border-dashed">
          <div class="fs-1 mb-2">${icons.bell}</div>
          <p class="mb-0">Belum ada notifikasi dari admin</p>
        </div>
      `;
      return;
    }
    const notifHtml = notifs.map(n => {
      const adminName = n.profiles?.full_name || 'Admin';
      const isRead = readNotifs.includes(n.id);

      return `
        <div class="card border-0 shadow-sm mb-3 tech-notif-card" data-id="${n.id}" data-title="${escapeHtml(n.title)}" data-body="${escapeHtml(n.body)}" data-image="${escapeHtml(n.image_url || '')}" data-admin="${escapeHtml(adminName)}" data-time="${timeAgo(n.created_at)}" style="cursor: pointer; ${isRead ? 'opacity: 0.8;' : 'border-left: 4px solid var(--bs-primary) !important;'}">
          <div class="card-body">
            <div class="d-flex align-items-start gap-3">
              <div class="text-primary fs-3 p-2 bg-primary bg-opacity-10 rounded position-relative">
                ${icons.broadcast}
                ${!isRead ? '<span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"><span class="visually-hidden">New alerts</span></span>' : ''}
              </div>
              <div class="flex-grow-1" style="min-width: 0;">
                <div class="d-flex justify-content-between align-items-start mb-1">
                  <h6 class="mb-0 fw-semibold text-truncate ${isRead ? 'text-muted' : ''}">${escapeHtml(n.title)}</h6>
                  <small class="text-muted text-nowrap ms-2">${timeAgo(n.created_at)}</small>
                </div>
                <div class="small text-muted mb-2">Dari: ${escapeHtml(adminName)}</div>
                <p class="mb-0 text-dark text-truncate" style="font-size: 0.95rem;">${escapeHtml(n.body)}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    content.innerHTML = `
      <div class="mb-4 d-flex justify-content-between align-items-center">
        <h5 class="mb-0 fw-semibold text-dark">Inbox Notifikasi</h5>
        <span class="badge ${unreadCount > 0 ? 'bg-danger' : 'bg-primary'} rounded-pill" id="inbox-page-badge">${unreadCount} Baru</span>
      </div>
      ${notifHtml}
      
      <!-- Modal Notifikasi -->
      <div class="modal fade" id="notifModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow">
            <div class="modal-header border-bottom-0 pb-0">
              <h5 class="modal-title fw-bold" id="notifModalTitle"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="d-flex justify-content-between align-items-center mb-3 small border-bottom pb-2">
                <span class="text-muted fw-medium" id="notifModalAdmin"></span>
                <span class="text-muted" id="notifModalTime"></span>
              </div>
              <div class="text-dark" id="notifModalBody" style="white-space: pre-wrap; font-size: 1rem; line-height: 1.5;"></div>
              <div class="mt-3 text-center" id="notifModalImageWrap" style="display:none;">
                <img id="notifModalImage" src="" style="max-width:100%; border-radius:8px; border: 1px solid var(--border-color);" />
              </div>
            </div>
            <div class="modal-footer border-top-0 pt-0">
              <button type="button" class="btn btn-primary w-100 py-2" data-bs-dismiss="modal">Tutup</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize modal once
    const modalEl = content.querySelector('#notifModal');
    
    // Pindahkan modal ke body agar tidak terhalang z-index dari container (backdrop menutupi modal)
    document.body.appendChild(modalEl);
    
    const notifModal = new bootstrap.Modal(modalEl);

    // Manual close handlers just in case data-bs-dismiss is flaky
    modalEl.querySelectorAll('[data-bs-dismiss="modal"]').forEach(btn => {
      btn.addEventListener('click', () => notifModal.hide());
    });

    let currentUnread = unreadCount;

    // Click handler for notifications
    const cards = content.querySelectorAll('.tech-notif-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const title = card.getAttribute('data-title');
        const body = card.getAttribute('data-body');
        const image = card.getAttribute('data-image');
        const admin = card.getAttribute('data-admin');
        const time = card.getAttribute('data-time');

        // Populate modal
        modalEl.querySelector('#notifModalTitle').textContent = title;
        modalEl.querySelector('#notifModalAdmin').textContent = `Dari: ${admin}`;
        modalEl.querySelector('#notifModalTime').textContent = time;
        modalEl.querySelector('#notifModalBody').textContent = body;
        
        const imgWrap = modalEl.querySelector('#notifModalImageWrap');
        if (image) {
          modalEl.querySelector('#notifModalImage').src = image;
          imgWrap.style.display = 'block';
        } else {
          imgWrap.style.display = 'none';
        }

        // Show modal
        notifModal.show();

        // Mark as read without re-rendering
        if (!readNotifs.includes(id)) {
          readNotifs.push(id);
          localStorage.setItem('readNotifs', JSON.stringify(readNotifs));
          
          // Update card UI to look read
          card.style.borderLeft = 'none';
          card.style.opacity = '0.8';
          const titleEl = card.querySelector('h6');
          if (titleEl) titleEl.classList.add('text-muted');
          const dot = card.querySelector('.bg-danger.rounded-circle');
          if (dot) dot.remove();

          // Update counts
          currentUnread = Math.max(0, currentUnread - 1);
          
          // Update Inbox Page Badge
          const pageBadge = content.querySelector('#inbox-page-badge');
          if (pageBadge) {
            pageBadge.textContent = `${currentUnread} Baru`;
            if (currentUnread === 0) {
              pageBadge.classList.remove('bg-danger');
              pageBadge.classList.add('bg-primary');
            }
          }

          // Update Topbar dot
          const topbarBtn = document.getElementById('topbar-notif-btn');
          if (topbarBtn && currentUnread === 0) {
            const dot = topbarBtn.querySelector('.badge-dot');
            if (dot) dot.remove();
          }

          // Update Bottom Nav Badge
          const bottomNav = document.querySelector('.tech-bottom-nav .tech-nav-item[data-tab="inbox"]');
          if (bottomNav) {
            const navBadge = bottomNav.querySelector('.tech-nav-badge');
            if (currentUnread > 0) {
              if (navBadge) navBadge.textContent = currentUnread > 9 ? '9+' : currentUnread;
              else bottomNav.insertAdjacentHTML('beforeend', `<span class="tech-nav-badge">${currentUnread > 9 ? '9+' : currentUnread}</span>`);
            } else if (navBadge) {
              navBadge.remove();
            }
          }

          // Update Sidebar Badge (if visible)
          const sidebarLink = document.querySelector('.sidebar-nav .nav-item[href="#/tech-inbox"]');
          if (sidebarLink) {
            const sideBadge = sidebarLink.querySelector('.badge');
            if (currentUnread > 0) {
              if (sideBadge) sideBadge.textContent = currentUnread > 9 ? '9+' : currentUnread;
            } else if (sideBadge) {
              sideBadge.remove();
            }
          }
        }
      });
    });

  } catch (err) {
    content.innerHTML = '<div class="tech-empty"><p>Gagal memuat notifikasi</p></div>';
    showToast('Gagal memuat inbox', 'error');
  }
}