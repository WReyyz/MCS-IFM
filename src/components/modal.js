import { icons } from './icons.js';

/**
 * Show a modal dialog
 * @param {Object} options - { title, body (HTML string), footer (HTML string), size ('modal-lg' or ''), onMount }
 * @returns {Function} close function
 */
export function showModal({ title, body, footer, size = '', onMount }) {
  const root = document.getElementById('modal-root');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${size}">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" id="modal-close-btn">${icons.x}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;

  root.appendChild(overlay);

  const close = () => {
    overlay.remove();
  };

  overlay.querySelector('#modal-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // ESC key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  if (onMount) {
    requestAnimationFrame(() => onMount(overlay, close));
  }

  return close;
}

/**
 * Show a confirmation dialog
 */
export function showConfirm({ title = 'Konfirmasi', message, onConfirm }) {
  const close = showModal({
    title,
    body: `
      <div class="confirm-body">
        ${icons.alertTriangle}
        <h3>${title}</h3>
        <p>${message}</p>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="confirm-cancel">Batal</button>
      <button class="btn btn-danger" id="confirm-ok">Hapus</button>
    `,
    onMount: (overlay, closeFn) => {
      overlay.querySelector('#confirm-cancel').addEventListener('click', closeFn);
      overlay.querySelector('#confirm-ok').addEventListener('click', () => {
        closeFn();
        onConfirm();
      });
    }
  });
  return close;
}
