import { toggleMobileSidebar } from './sidebar.js';
import { icons } from './icons.js';

export function renderTopbar(container, title = 'Dashboard') {
  const topbar = document.createElement('header');
  topbar.className = 'navbar navbar-expand-lg bg-white shadow-sm px-3 border-bottom';
  const now = new Date();
  const fullDate = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  topbar.innerHTML = `
    <div class="container-fluid px-0">
      <div class="d-flex align-items-center">
        <button class="btn btn-light d-lg-none me-3" id="mobile-menu-btn" aria-label="Buka menu">${icons.menu}</button>
        <h1 class="h5 mb-0 fw-bold text-dark">${title}</h1>
      </div>
      <div class="d-none d-md-flex align-items-center">
        <span class="text-muted small" title="${fullDate}">${fullDate}</span>
      </div>
    </div>
  `;

  container.appendChild(topbar);

  topbar.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);

  return topbar;
}
