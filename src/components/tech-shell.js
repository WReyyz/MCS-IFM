import { icons } from './icons.js';
import { signOut, getCurrentProfile, getNotifications } from '../lib/supabase.js';

let currentProfile = null;
let notifCount = 0;

/**
 * Render the Technician App Shell (no sidebar, uses bottom nav)
 * @param {string} activeTab - 'wo-list' | 'create-wo' | 'material' | 'profile'
 * @returns {{ app: HTMLElement, content: HTMLElement }}
 */
export async function renderTechShell(activeTab = 'wo-list') {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.className = 'tech-app';

  // Load profile & notif count
  try {
    currentProfile = await getCurrentProfile();
    const notifs = await getNotifications();
    const readNotifs = JSON.parse(localStorage.getItem('readNotifs') || '[]');
    notifCount = notifs.filter(n => !readNotifs.includes(n.id)).length;
  } catch (e) {
    console.error('Tech shell load error:', e);
  }

  const avatarContent = currentProfile?.avatar_url
    ? `<img src="${currentProfile.avatar_url}" alt="avatar" />`
    : `<span>${(currentProfile?.full_name || 'T').charAt(0).toUpperCase()}</span>`;

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  // Topbar
  const topbar = document.createElement('header');
  topbar.className = 'tech-topbar';
  topbar.innerHTML = `
    <div class="tech-topbar-brand">
      <div class="tech-topbar-logo">M</div>
      <div>
        <div class="tech-topbar-title">MCS Teknisi</div>
        <div class="tech-topbar-subtitle">${today}</div>
      </div>
    </div>
    <div class="tech-topbar-right">

      <div class="tech-avatar-sm" id="topbar-avatar-btn">${avatarContent}</div>
    </div>
  `;
  app.appendChild(topbar);

  // Page content area
  const content = document.createElement('div');
  content.className = 'tech-page-content animate-fade-in';
  app.appendChild(content);

  // Bottom Navigation
  const bottomNav = document.createElement('nav');
  bottomNav.className = 'tech-bottom-nav';
  bottomNav.innerHTML = `
    <a href="#/tech-wo-list" class="tech-nav-item ${activeTab === 'wo-list' ? 'active' : ''}" data-tab="wo-list">
      ${icons.listTodo}
      <span>WO List</span>
    </a>
    <a href="#/tech-create-wo" class="tech-nav-item ${activeTab === 'create-wo' ? 'active' : ''}" data-tab="create-wo">
      ${icons.plus}
      <span>Buat WO</span>
    </a>
    <a href="#/tech-material" class="tech-nav-item ${activeTab === 'material' ? 'active' : ''}" data-tab="material">
      ${icons.package}
      <span>Material</span>
    </a>
    <a href="#/tech-profile" class="tech-nav-item ${activeTab === 'profile' ? 'active' : ''}" data-tab="profile">
      ${icons.user}
      <span>Profil</span>
    </a>
  `;
  app.appendChild(bottomNav);

  // Desktop Sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'tech-sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">M</div>
      <div class="sidebar-brand">
        <span class="sidebar-brand-name">MCS Teknisi</span>
        <span class="sidebar-brand-tag">Maintenance Control</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section">
        <div class="nav-section-title">Menu Teknisi</div>
        <a href="#/tech-wo-list" class="nav-item ${activeTab === 'wo-list' ? 'active' : ''}">
          ${icons.listTodo} WO List
        </a>
        <a href="#/tech-create-wo" class="nav-item ${activeTab === 'create-wo' ? 'active' : ''}">
          ${icons.plus} Buat WO
        </a>
        <a href="#/tech-material" class="nav-item ${activeTab === 'material' ? 'active' : ''}">
          ${icons.package} Material 
        </a>
        <a href="#/tech-profile" class="nav-item ${activeTab === 'profile' ? 'active' : ''}">
          ${icons.user} Profil
        </a>
      </div>
    </nav>
  `;
  app.appendChild(sidebar);


  topbar.querySelector('#topbar-avatar-btn')?.addEventListener('click', () => {
    window.location.hash = '/tech-profile';
  });

  return { app, content, profile: currentProfile };
}
