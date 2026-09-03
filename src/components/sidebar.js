import { signOut, getCurrentProfile } from '../lib/supabase.js';
import { ROLES } from '../utils/constants.js';
import { icons } from './icons.js';

const ALL_MENU_ITEMS = [
  { section: 'UTAMA' },
  { path: '/', label: 'Dashboard', icon: 'layoutDashboard', roles: ['admin', 'inspector', 'manager', 'planner'] },
  { path: '/equipment', label: 'Daftar Equipment', icon: 'cpu', roles: ['admin', 'inspector', 'planner', 'manager'] },
  { section: 'PEMELIHARAAN' },
  { path: '/preventive-maintenance', label: 'Preventive Maintenance', icon: 'calendarCheck', roles: ['admin', 'inspector', 'planner', 'manager'] },
  { path: '/mds-templates', label: 'Master Template MDS', icon: 'clipboardCheck', roles: ['admin', 'planner'] },
  { path: '/approval', label: 'Inspection', icon: 'shieldCheck', roles: ['admin', 'inspector'] },
  { path: '/work-order', label: 'Corective', icon: 'clipboardList', roles: ['admin', 'inspector', 'planner'] },
  { path: '/material-stock', label: 'Stok Material', icon: 'package', roles: ['admin', 'inspector', 'planner'] },
  { path: '/tools', label: 'Tools', icon: 'wrench', roles: ['admin', 'planner'] },
  { path: '/plan', label: 'Plan', icon: 'ganttChart', roles: ['admin', 'planner'] },
  { section: 'MANAJEMEN' },
  { path: '/technician', label: 'Jadwal & Teknisi', icon: 'calendarCheck', roles: ['admin', 'planner'] },
  { path: '/user-controller', label: 'Kontrol Pengguna', icon: 'shield', roles: ['admin'] },
  { path: '/admin-broadcast', label: 'Broadcast Notifikasi', icon: 'broadcast', roles: ['admin'] },
  { section: 'AKUN' },
  { path: '/profile', label: 'Profil Saya', icon: 'user', roles: ['admin', 'inspector', 'planner', 'manager'] },
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
    <nav class="sidebar-nav" id="sidebar-nav">
      <!-- loaded dynamically based on profile -->
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user" id="sidebar-user">
        <div class="sidebar-avatar" id="sidebar-avatar">-</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" id="sidebar-user-name">Loading...</div>
          <div class="sidebar-user-role" id="sidebar-user-role">-</div>
        </div>
      </div>
      <button class="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-center gap-2" id="logout-btn">
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

  // Close sidebar on nav item click (mobile) using delegation
  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('.nav-item') && window.innerWidth <= 1024) {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    }
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
    const userRole = profile?.role || 'user';
    const currentPath = window.location.hash.slice(1) || '/';
    
    const nav = document.getElementById('sidebar-nav');
    if (nav) {
      let filteredItems = ALL_MENU_ITEMS.filter(item => {
        if (item.section) return true;
        return item.roles && item.roles.includes(userRole);
      });
      
      const finalItems = [];
      for (let i = 0; i < filteredItems.length; i++) {
        const item = filteredItems[i];
        if (item.section) {
          const nextItem = filteredItems[i + 1];
          if (nextItem && !nextItem.section) {
            finalItems.push(item);
          }
        } else {
          finalItems.push(item);
        }
      }

      nav.innerHTML = finalItems.map(item => {
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
      }).join('');
    }

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

