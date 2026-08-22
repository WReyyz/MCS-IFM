import { icons } from './icons.js'; // icons still used in showConfirm body

/**
 * Show a modal dialog
 * @param {Object} options - { title, body (HTML string), footer (HTML string), size ('modal-lg' or ''), onMount }
 * @returns {Function} close function
 */
export function showModal({ title, body, footer, size = '', onMount }) {
  const root = document.getElementById('modal-root');

  const overlay = document.createElement('div');
  overlay.className = 'modal fade show d-block';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
  overlay.tabIndex = -1;
  overlay.innerHTML = `
    <div class="modal-dialog modal-dialog-centered ${size}">
      <div class="modal-content border-0 shadow">
        <div class="modal-header">
          <h5 class="modal-title fw-semibold">${title}</h5>
          <button type="button" class="btn-close" id="modal-close-btn" aria-label="Tutup"></button>
        </div>
        <div class="modal-body">
          ${body}
        </div>
        ${footer ? `<div class="modal-footer bg-light">${footer}</div>` : ''}
      </div>
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
export function showConfirm({ title = 'Konfirmasi', message, confirmText = 'Hapus', cancelText = 'Batal', onConfirm }) {
  const close = showModal({
    title,
    body: `
      <div class="text-center p-4">
        <div class="text-warning mb-3" style="font-size: 3rem;">
          ${icons.alertTriangle}
        </div>
        <h4 class="mb-3 fw-bold text-dark">${title}</h4>
        <p class="text-muted mb-0">${message}</p>
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary px-4" id="confirm-cancel">${cancelText}</button>
      <button class="btn btn-danger px-4" id="confirm-ok">${confirmText}</button>
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
