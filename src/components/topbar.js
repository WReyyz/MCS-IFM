import { toggleMobileSidebar } from './sidebar.js';
import { icons } from './icons.js';

export function renderTopbar(container, title = 'Dashboard') {
  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  topbar.innerHTML = `
    <div class="topbar-left">
      <button class="mobile-menu-btn" id="mobile-menu-btn">${icons.menu}</button>
      <h1 class="topbar-title">${title}</h1>
    </div>
    <div class="topbar-right">
      <span style="font-size:var(--fs-xs);color:var(--text-muted)">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
    </div>
  `;

  container.appendChild(topbar);

  topbar.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);

  return topbar;
}
