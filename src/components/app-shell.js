import { renderSidebar } from './sidebar.js';
import { renderTopbar } from './topbar.js';

/**
 * Render the authenticated app shell with sidebar + topbar + page content area
 * @param {string} pageTitle
 * @returns {HTMLElement} the page content container to render into
 */
export function renderAppShell(pageTitle) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.className = 'app';

  renderSidebar(app);

  const main = document.createElement('main');
  main.className = 'main-content';

  renderTopbar(main, pageTitle);

  const content = document.createElement('div');
  content.className = 'page-content';
  main.appendChild(content);

  app.appendChild(main);

  return content;
}
