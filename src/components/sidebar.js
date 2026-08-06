import { signOut, getCurrentProfile } from '../lib/supabase.js';
import { ROLES } from '../utils/constants.js';
import { icons } from './icons.js';

const MENU_ITEMS = [
  { section: 'UTAMA' },
  { path: '/', label: 'Dashboard', icon: 'layoutDashboard' },
  { path: '/equipment', label: 'Daftar Equipment', icon: 'cpu' },
  { section: 'PEMELIHARAAN' },
  { path: '/preventive-maintenance', label: 'Preventive Maintenance', icon: 'calendarCheck' },
  { path: '/work-order', label: 'Work Order', icon: 'clipboardList' },
  { path: '/material-stock', label: 'Stok Material', icon: 'package' },
  { section: 'MANAJEMEN' },
  { path: '/technician', label: 'Manajemen Teknisi', icon: 'users' },
  { path: '/user-controller', label: 'Kontrol Pengguna', icon: 'shield' },
];

export function renderSidebar(container) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';

  const currentPath = window.location.hash.slice(1) || '/';

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">M</div>
      <div class="sidebar-brand">
        <span class="sidebar-brand-name">MCS</span>
        <span class="sidebar-brand-tag">Maintenance Control System</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${MENU_ITEMS.map(item => {
        if (item.section) {
          return `<div class="nav-section"><div class="nav-section-title">${item.section}</div></div>`;
        }
        const isActive = (item.path === '/' && (currentPath === '/' || currentPath === '/dashboard')) ||
                         (item.path !== '/' && currentPath === item.path);
        return `
          <a href="#${item.path}" class="nav-item ${isActive ? 'active' : ''}" data-path="${item.path}">
            ${icons[item.icon]}
            <span>${item.label}</span>
          </a>`;
      }).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user" id="sidebar-user">
        <div class="sidebar-avatar" id="sidebar-avatar">-</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" id="sidebar-user-name">Loading...</div>
          <div class="sidebar-user-role" id="sidebar-user-role">-</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" id="logout-btn" style="width:100%;margin-top:var(--sp-2);justify-content:center">
        ${icons.logOut}
        <span>Keluar</span>
      </button>
    </div>
  `;

  container.prepend(sidebar);

  // Overlay for mobile
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  container.prepend(overlay);

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });

  // Close sidebar on nav item click (mobile)
  sidebar.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      }
    });
  });

  // Logout
  sidebar.querySelector('#logout-btn').addEventListener('click', async () => {
    await signOut();
    window.location.hash = '/login';
  });

  // Load profile
  loadSidebarProfile();

  return sidebar;
}

async function loadSidebarProfile() {
  try {
    const profile = await getCurrentProfile();
    if (profile) {
      const nameEl = document.getElementById('sidebar-user-name');
      const roleEl = document.getElementById('sidebar-user-role');
      const avatarEl = document.getElementById('sidebar-avatar');
      if (nameEl) nameEl.textContent = profile.full_name || 'User';
      if (roleEl) roleEl.textContent = ROLES[profile.role]?.label || profile.role;
      if (avatarEl) avatarEl.textContent = (profile.full_name || 'U').charAt(0).toUpperCase();
    }
  } catch (e) {
    console.error('Error loading profile:', e);
  }
}

export function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar && overlay) {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  }
}

