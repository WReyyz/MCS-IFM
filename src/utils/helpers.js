/**
 * Format date to Indonesian locale
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('id-ID');
}

/**
 * Debounce function
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Generate Work Order number: WO-YYYYMMDD-XXXX
 */
export function generateWoNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `WO-${date}-${rand}`;
}

/**
 * Calculate man hours effectiveness percentage
 */
export function calcEffectiveness(estimated, actual) {
  if (!estimated || estimated === 0) return 0;
  return Math.round((actual / estimated) * 100);
}

/**
 * Create a status badge HTML
 */
export function badge(text, color, bg) {
  return `<span class="badge" style="color:${color};background:${bg}">${text}</span>`;
}

/**
 * Sanitize HTML to prevent XSS
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Get relative time string
 */
export function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} hari lalu`;
  return formatDate(dateStr);
}

/**
 * Check if a date is overdue (before today)
 */
export function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

/**
 * Animated counter for dashboard stats
 */
export function animateCounter(element, target, duration = 1000, suffix = '') {
  let start = 0;
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    element.textContent = current.toLocaleString('id-ID') + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/**
 * Setup bulk selection for tables
 * @param {HTMLElement} wrapper - The table wrapper containing checkboxes
 * @param {Function} onChange - Callback (selectedIds) => void
 */
export function setupBulkSelection(wrapper, onChange) {
  if (!wrapper) return;
  const selectAll = wrapper.querySelector('#select-all');
  const checkboxes = wrapper.querySelectorAll('.row-checkbox');
  
  if (!selectAll) return;

  const getSelected = () => {
    return Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
  };

  selectAll.addEventListener('change', (e) => {
    checkboxes.forEach(cb => { cb.checked = e.target.checked; });
    onChange(getSelected());
  });

  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const selected = getSelected();
      selectAll.checked = selected.length === checkboxes.length && checkboxes.length > 0;
      onChange(selected);
    });
  });
}
