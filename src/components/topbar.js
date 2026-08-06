import { toggleMobileSidebar } from './sidebar.js';
import { icons } from './icons.js';

export function renderTopbar(container, title = 'Dashboard') {
  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  const now = new Date();
  const fullDate = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shortDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  topbar.innerHTML = `
    <div class="topbar-left">
      <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Buka menu">${icons.menu}</button>
      <h1 class="topbar-title">${title}</h1>
    </div>
    <div class="topbar-right">
      <span class="topbar-date" title="${fullDate}">${fullDate}</span>
    </div>
  `;

  container.appendChild(topbar);

  topbar.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);

  return topbar;
}
