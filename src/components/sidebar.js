import { signOut, getCurrentProfile } from '../lib/supabase.js';
import { ROLES } from '../utils/constants.js';
import { icons } from './icons.js';

const ALL_MENU_ITEMS = [
  { section: 'UTAMA' },
  { path: '/', label: 'Dashboard', icon: 'layoutDashboard', roles: ['admin', 'inspector'] },
  { path: '/equipment', label: 'Daftar Equipment', icon: 'cpu', roles: ['admin', 'inspector'] },
  { section: 'PEMELIHARAAN' },
  // Dropdown: Preventive Maintenance (parent group)
  {
    label: 'Preventive Maintenance', icon: 'calendarCheck', roles: ['admin', 'inspector'],
    dropdown: true,
    children: [
      { path: '/preventive-maintenance', label: 'Jadwal PM & Work Order', icon: 'clipboardList', roles: ['admin', 'inspector'] },
      { path: '/mds-templates', label: 'Master Template MDS', icon: 'clipboardCheck', roles: ['admin'] },
      { path: '/approval', label: 'Approval Checklist', icon: 'shieldCheck', roles: ['admin', 'inspector'] },
    ]
  },
  { path: '/work-order', label: 'Work Order', icon: 'clipboardList', roles: ['admin', 'inspector'] },
  { path: '/material-stock', label: 'Stok Material', icon: 'package', roles: ['admin', 'inspector'] },
  { path: '/tools', label: 'Tools', icon: 'wrench', roles: ['admin', 'inspector'] },
  { path: '/plan', label: 'Plan', icon: 'ganttChart', roles: ['admin', 'inspector'] },
  { section: 'MANAJEMEN' },
  { path: '/technician', label: 'Jadwal & Teknisi', icon: 'calendarCheck', roles: ['admin'] },
  { path: '/user-controller', label: 'Kontrol Pengguna', icon: 'shield', roles: ['admin'] },
  { path: '/admin-broadcast', label: 'Broadcast Notifikasi', icon: 'broadcast', roles: ['admin'] },
  { section: 'AKUN' },
  { path: '/profile', label: 'Profil Saya', icon: 'user', roles: ['admin', 'inspector'] },
];

export function renderSidebar(container) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';

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
    if (e.target.closest('.nav-item:not(.nav-dropdown-toggle)') && window.innerWidth <= 1024) {
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

function renderMenuItem(item, currentPath, userRole) {
  // Section header
  if (item.section) return null; // handled separately

  // Dropdown parent
  if (item.dropdown) {
    // Filter children by role
    const visibleChildren = item.children.filter(c => c.roles && c.roles.includes(userRole));
    if (visibleChildren.length === 0) return '';

    // Check if any child is active
    const isChildActive = visibleChildren.some(c => currentPath === c.path);
    const isOpen = isChildActive; // auto-open if child is active

    const childrenHtml = visibleChildren.map(child => {
      const isActive = currentPath === child.path;
      return `
        <a href="#${child.path}" class="nav-item nav-sub-item ${isActive ? 'active' : ''}" data-path="${child.path}">
          ${icons[child.icon]}
          <span>${child.label}</span>
        </a>`;
    }).join('');

    return `
      <div class="nav-dropdown ${isOpen ? 'open' : ''}" data-dropdown>
        <div class="nav-item nav-dropdown-toggle ${isChildActive ? 'active' : ''}">
          ${icons[item.icon]}
          <span>${item.label}</span>
          <span class="nav-dropdown-arrow">${icons.chevronDown}</span>
        </div>
        <div class="nav-dropdown-menu">
          ${childrenHtml}
        </div>
      </div>`;
  }

  // Regular nav item
  if (item.path) {
    const isActive = (item.path === '/' && (currentPath === '/' || currentPath === '/dashboard')) ||
                     (item.path !== '/' && currentPath === item.path);
    return `
      <a href="#${item.path}" class="nav-item ${isActive ? 'active' : ''}" data-path="${item.path}">
        ${icons[item.icon]}
        <span>${item.label}</span>
      </a>`;
  }

  return '';
}

async function loadSidebarProfile() {
  try {
    const profile = await getCurrentProfile();
    const userRole = profile?.role || 'user';
    const currentPath = window.location.hash.slice(1) || '/';

    const nav = document.getElementById('sidebar-nav');
    if (nav) {
      // Build HTML
      let html = '';
      for (let i = 0; i < ALL_MENU_ITEMS.length; i++) {
        const item = ALL_MENU_ITEMS[i];

        // Section header
        if (item.section) {
          // Check if there's at least one visible item after this section
          let hasVisible = false;
          for (let j = i + 1; j < ALL_MENU_ITEMS.length; j++) {
            const next = ALL_MENU_ITEMS[j];
            if (next.section) break;
            if (next.dropdown) {
              const visibleChildren = next.children.filter(c => c.roles && c.roles.includes(userRole));
              if (visibleChildren.length > 0) { hasVisible = true; break; }
            } else if (next.roles && next.roles.includes(userRole)) {
              hasVisible = true; break;
            }
          }
          if (hasVisible) {
            html += `<div class="nav-section"><div class="nav-section-title">${item.section}</div></div>`;
          }
          continue;
        }

        // Skip items not visible for this role
        if (!item.dropdown && item.roles && !item.roles.includes(userRole)) continue;

        html += renderMenuItem(item, currentPath, userRole) || '';
      }

      nav.innerHTML = html;

      // Attach dropdown toggle listeners
      nav.querySelectorAll('.nav-dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
          e.preventDefault();
          const dropdown = toggle.closest('[data-dropdown]');
          if (dropdown) {
            dropdown.classList.toggle('open');
          }
        });
      });
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
