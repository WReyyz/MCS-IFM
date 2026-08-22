import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow, updateRow, deleteRow, supabase } from '../lib/supabase.js';
import { SCHEDULE_STATUS, SHIFTS, SHIFT_CELL_COLORS, TECHNICIAN_SKILLS } from '../utils/constants.js';
import { formatDate, escapeHtml, badge, setupBulkSelection } from '../utils/helpers.js';

// ─── Module state ───────────────────────────────────────────
let technicianList  = [];
let scheduleData    = [];
let shiftMaster     = [];
let matrixData      = {};    // { 'profile_id|YYYY-MM-DD': { shift_code, id } }
let activeTab       = 'matriks';
let matrixPeriodStart = '';
let matrixPeriodEnd   = '';
let filterTechId    = '';    // '' = semua

// ─── Helpers ────────────────────────────────────────────────
function getDaysArray(startStr, endStr) {
  const days = [];
  const cur  = new Date(startStr + 'T00:00:00');
  const end  = new Date(endStr   + 'T00:00:00');
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00').getDay();
  return d === 0 || d === 6;
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().slice(0, 10);
}

// ─── Entry point ─────────────────────────────────────────────
export async function renderTechnician() {
  const content = renderAppShell('Jadwal Teknisi');

  // ── Inject CSS ──
  if (!document.getElementById('tech-page-styles')) {
    const style = document.createElement('style');
    style.id = 'tech-page-styles';
    style.textContent = `
      /* ── Page header ── */
      .tech-page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--sp-6);
        flex-wrap: wrap;
        gap: var(--sp-4);
      }
      .tech-page-header-left h2 {
        font-size: 1.6rem;
        font-weight: var(--fw-bold);
        color: var(--text-primary);
        margin-bottom: 2px;
      }
      .tech-page-header-left p {
        font-size: var(--fs-sm);
        color: var(--text-secondary);
      }
      .tech-header-right {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        flex-wrap: wrap;
      }
      .tech-date-range {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: 6px 12px;
        font-size: var(--fs-sm);
        font-weight: var(--fw-medium);
        color: var(--text-primary);
      }
      .tech-date-range input[type="date"] {
        border: none;
        background: transparent;
        color: var(--text-primary);
        font-size: var(--fs-sm);
        font-weight: var(--fw-medium);
        padding: 0;
        cursor: pointer;
        outline: none;
      }
      .tech-date-sep { color: var(--text-muted); font-weight: var(--fw-normal); }

      /* ── Tabs ── */
      .tech-tabs {
        display: flex;
        gap: var(--sp-1);
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: var(--sp-1);
        margin-bottom: var(--sp-6);
        width: fit-content;
      }
      .tech-tab-btn {
        padding: 8px 20px;
        border-radius: var(--radius-md);
        border: none;
        background: transparent;
        color: var(--text-secondary);
        font-weight: var(--fw-medium);
        font-size: var(--fs-sm);
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tech-tab-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
      .tech-tab-btn.active {
        background: var(--primary);
        color: #fff;
        box-shadow: 0 2px 8px rgba(23,59,99,0.3);
      }
      .tech-tab-panel { display: none; }
      .tech-tab-panel.active { display: block; }

      /* ── Stat Cards ── */
      .tech-stat-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-xl);
        padding: var(--sp-5);
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        transition: box-shadow 0.2s, transform 0.2s;
      }
      .tech-stat-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.10); transform: translateY(-2px); }
      .tech-stat-card-icon {
        width: 40px; height: 40px;
        border-radius: var(--radius-md);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.1rem;
      }
      .tech-stat-card-label {
        font-size: var(--fs-xs);
        font-weight: var(--fw-semibold);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .tech-stat-card-value {
        font-size: 2rem;
        font-weight: var(--fw-bold);
        color: var(--text-primary);
        line-height: 1;
      }
      .tech-stat-card-sub {
        font-size: var(--fs-xs);
        color: var(--text-muted);
      }

      /* ── Filter bar ── */
      .tech-filter-bar {
        margin-bottom: var(--sp-4);
      }
      .tech-filter-group {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }
      .tech-filter-group label {
        font-size: var(--fs-sm);
        color: var(--text-secondary);
        white-space: nowrap;
        font-weight: var(--fw-medium);
      }
      .tech-filter-group select {
        min-width: 180px;
      }
      .tech-filter-apply {
        margin-left: auto;
      }

      /* ── Matrix section title ── */
      .matrix-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--sp-3);
      }
      .matrix-section-header h3 {
        font-size: 1rem;
        font-weight: var(--fw-semibold);
        color: var(--text-primary);
      }
      .matrix-nav {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }
      .matrix-nav-btn {
        width: 28px; height: 28px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.8rem;
        transition: background 0.15s;
      }
      .matrix-nav-btn:hover { background: var(--bg-hover); }

      /* ── Matrix table ── */
      .matrix-outer { overflow-x: auto; border-radius: var(--radius-xl); border: 1px solid var(--border-color); }
      .matrix-table {
        border-collapse: collapse;
        white-space: nowrap;
        min-width: 100%;
        font-size: var(--fs-xs);
        background: var(--bg-surface);
      }
      .matrix-table th, .matrix-table td {
        border: 1px solid var(--border-color);
        text-align: center;
        padding: 0;
      }
      /* sticky name col header */
      .matrix-table thead th:first-child {
        min-width: 170px;
        text-align: left;
        padding: 10px 14px;
        position: sticky; left: 0; z-index: 3;
        background: var(--bg-surface);
        font-size: var(--fs-xs);
        color: var(--text-muted);
        font-weight: var(--fw-semibold);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      /* second sticky col (shift badge) */
      .matrix-table thead th:nth-child(2) {
        min-width: 90px;
        position: sticky; left: 170px; z-index: 3;
        background: var(--bg-surface);
        font-size: var(--fs-xs);
        color: var(--text-muted);
        font-weight: var(--fw-semibold);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 10px 8px;
      }
      .matrix-table thead th.day-header {
        padding: 6px 4px;
        min-width: 46px;
        font-size: 0.65rem;
        font-weight: var(--fw-semibold);
        color: var(--text-secondary);
        background: var(--bg-surface);
        position: sticky; top: 0; z-index: 2;
      }
      .matrix-table thead th.day-header.is-today {
        color: var(--primary);
        font-weight: var(--fw-bold);
      }
      .matrix-table thead th.day-header.is-weekend {
        color: #EF4444;
      }
      .matrix-table thead th.day-header.is-today.is-weekend {
        color: #EF4444;
      }

      /* body rows */
      .matrix-table tbody tr:hover td { background: var(--bg-hover); }
      .matrix-table tbody tr:hover td.sticky-col { background: var(--bg-hover); }

      .sticky-col {
        position: sticky; left: 0; z-index: 1;
        background: var(--bg-surface);
        text-align: left;
        padding: 8px 14px;
        font-weight: var(--fw-medium);
        min-width: 170px;
      }
      .sticky-col-2 {
        position: sticky; left: 170px; z-index: 1;
        background: var(--bg-surface);
        padding: 6px 8px;
        min-width: 90px;
        text-align: center;
      }
      .matrix-cell {
        height: 38px;
        cursor: pointer;
        transition: filter 0.15s;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: var(--fw-semibold);
        font-size: 0.78rem;
        min-width: 46px;
      }
      .matrix-cell:hover { filter: brightness(0.92); }
      .matrix-cell.cell-off {
        background: rgba(239,68,68,0.15);
        color: #EF4444;
        font-weight: var(--fw-bold);
      }
      .matrix-cell.cell-work {
        background: transparent;
        color: var(--text-primary);
      }
      .matrix-cell.cell-weekend-empty {
        background: transparent;
        color: var(--text-muted);
      }

      /* total row */
      .matrix-table .total-row td {
        background: #EBF3FF;
        font-weight: var(--fw-bold);
        font-size: var(--fs-xs);
        padding: 8px 4px;
        color: var(--primary);
      }
      .matrix-table .total-row td.sticky-col {
        background: #EBF3FF;
        color: var(--primary);
      }
      .matrix-table .total-row td.sticky-col-2 {
        background: #EBF3FF;
      }
      .matrix-table .total-row td.cell-off-total {
        background: rgba(239,68,68,0.18);
        color: #EF4444;
      }

      /* ── Legend ── */
      .matrix-legend {
        display: flex;
        align-items: center;
        gap: var(--sp-5);
        padding: var(--sp-3) var(--sp-4);
        border-top: 1px solid var(--border-color);
        font-size: var(--fs-xs);
        color: var(--text-secondary);
        flex-wrap: wrap;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }
      .legend-chip {
        width: 28px; height: 20px;
        border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.7rem;
        font-weight: var(--fw-bold);
      }
      .legend-chip.work { background: rgba(23,59,99,0.1); color: var(--primary); }
      .legend-chip.off  { background: rgba(239,68,68,0.15); color: #EF4444; }
      .legend-chip.dash { background: transparent; color: var(--text-muted); font-size: 1rem; }

      /* ── Shift Master ── */
      .shift-master-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: var(--sp-3);
        margin-bottom: var(--sp-4);
      }
      .shift-master-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: var(--sp-4);
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        transition: box-shadow 0.2s;
      }
      .shift-master-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
      .shift-master-kode { font-size: 1.6rem; font-weight: var(--fw-bold); color: var(--primary); }
      .shift-master-label { font-size: var(--fs-sm); color: var(--text-secondary); }
      .shift-master-durasi { font-size: var(--fs-xs); color: var(--text-muted); }
      .shift-master-actions { display: flex; gap: 4px; margin-top: auto; padding-top: var(--sp-2); border-top: 1px solid var(--border-color); }

      /* ── Daftar Teknisi ── */

      /* ── Cell shift badge ── */
      .shift-badge {
        display: inline-flex;
        align-items: center;
        padding: 3px 8px;
        border-radius: 99px;
        font-size: 0.7rem;
        font-weight: var(--fw-semibold);
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  // ── HTML ──
  content.innerHTML = `
    <div class="animate-fade-in">
      <!-- Header -->
      <div class="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          <h2 class="h4 fw-bold mb-1">Jadwal Teknisi</h2>
          <p class="text-secondary small mb-0">Kelola jadwal teknisi dan hitung manhours secara otomatis</p>
        </div>
        <div class="d-flex align-items-center gap-3 flex-wrap">
          <div class="d-flex align-items-center gap-2 bg-white border rounded px-3 py-2 small">
            <input type="date" id="matrix-start" class="border-0 bg-transparent" style="outline:none; width:auto;" />
            <span class="text-muted">–</span>
            <input type="date" id="matrix-end" class="border-0 bg-transparent" style="outline:none; width:auto;" />
            ${icons.calendar || '📅'}
          </div>
          <button class="btn btn-outline-secondary" id="btn-export-excel">${icons.download || '⬇'} Ekspor Excel</button>
          <button class="btn btn-primary" id="btn-save-matrix" style="display:none;">💾 Simpan Semua</button>
        </div>
      </div>

      <!-- TABS -->
      <div class="nav nav-pills bg-white border rounded p-1 mb-4 d-inline-flex tech-tabs">
        <button class="nav-link tech-tab-btn active" data-tab="matriks">${icons.calendarCheck} Jadwal Matriks</button>
        <button class="nav-link tech-tab-btn" data-tab="daftar">${icons.users} Daftar Teknisi</button>
        <button class="nav-link tech-tab-btn" data-tab="shift-master">${icons.clock} Master Shift</button>
      </div>

      <!-- PANEL: Jadwal Matriks -->
      <div class="tech-tab-panel active" id="panel-matriks">
        <!-- 4 Stat Cards -->
        <div class="row g-4 mb-4" id="matrix-stat-grid">
          <div class="col-md-3 col-sm-6">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-body">
                <div class="d-flex align-items-center mb-3">
                  <div class="rounded p-2 bg-primary bg-opacity-10 text-primary me-3">${icons.clock || '⏱'}</div>
                  <div class="text-uppercase text-muted small fw-bold">Total Manhours</div>
                </div>
                <h3 class="fw-bold mb-1" id="stat-total-mh">—</h3>
                <div class="text-muted small" id="stat-total-mh-sub">Periode ini</div>
              </div>
            </div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-body">
                <div class="d-flex align-items-center mb-3">
                  <div class="rounded p-2 text-white me-3" style="background:#8B5CF6;">${icons.users || '👥'}</div>
                  <div class="text-uppercase text-muted small fw-bold">Total Teknisi</div>
                </div>
                <h3 class="fw-bold mb-1" id="stat-matrix-techs">—</h3>
                <div class="text-muted small">Orang Aktif</div>
              </div>
            </div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-body">
                <div class="d-flex align-items-center mb-3">
                  <div class="rounded p-2 text-white me-3" style="background:#10B981;">${icons.calendarCheck || '📅'}</div>
                  <div class="text-uppercase text-muted small fw-bold">Total Shift</div>
                </div>
                <h3 class="fw-bold mb-1" id="stat-total-shifts">—</h3>
                <div class="text-muted small">Shift / Hari</div>
              </div>
            </div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-body">
                <div class="d-flex align-items-center mb-3">
                  <div class="rounded p-2 text-white me-3" style="background:#F59E0B;">${icons.activity || '📈'}</div>
                  <div class="text-uppercase text-muted small fw-bold">Rata-rata Manhours</div>
                </div>
                <h3 class="fw-bold mb-1" id="stat-avg-mh">—</h3>
                <div class="text-muted small">Jam / Hari</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="d-flex align-items-end gap-3 mb-4 flex-wrap">
          <div>
            <label class="form-label small mb-1">Pilih Teknisi</label>
            <select class="form-select" id="filter-technician" style="min-width:200px;">
              <option value="">Semua Teknisi</option>
            </select>
          </div>
          <button class="btn btn-primary d-flex align-items-center gap-2" id="btn-load-matrix">${icons.activity} Tampilkan</button>
        </div>

        <!-- Matrix -->
        <div class="card" style="padding:0;overflow:hidden;">
          <div class="matrix-section-header" style="padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--border-color); margin:0;">
            <h3>Jadwal &amp; Manhours Harian</h3>
            <div class="matrix-nav">
              <span style="font-size:var(--fs-xs);color:var(--text-muted)" id="matrix-period-label"></span>
              <button class="matrix-nav-btn" id="btn-prev-month" title="Bulan Sebelumnya">&#8249;</button>
              <button class="matrix-nav-btn" id="btn-today" title="Hari Ini" style="font-size:0.65rem;padding:0 6px;width:auto;">Hari Ini</button>
              <button class="matrix-nav-btn" id="btn-next-month" title="Bulan Berikutnya">&#8250;</button>
            </div>
          </div>
          <div id="matrix-wrapper"><div class="empty-state"><p>Klik <strong>Tampilkan</strong> untuk memuat jadwal</p></div></div>
          <div class="matrix-legend" id="matrix-legend" style="display:none;">
            <div class="legend-item">
              <div class="legend-chip work">8</div>
              <span>Hari Kerja (8 Jam)</span>
            </div>
            <div class="legend-item">
              <div class="legend-chip off">0</div>
              <span>Libur / Off</span>
            </div>
            <div class="legend-item">
              <div class="legend-chip dash">–</div>
              <span>Akhir Pekan</span>
            </div>
          </div>
        </div>
      </div>

      <!-- PANEL: Daftar Teknisi -->
      <div class="tech-tab-panel" id="panel-daftar">
        <div class="row g-4 mb-4">
          <div class="col-md-4">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-body">
                <div class="d-flex align-items-center mb-3">
                  <div class="rounded p-2 text-white me-3" style="background:#10b981;">${icons.userCheck}</div>
                  <div class="text-uppercase text-muted small fw-bold">Bertugas Hari Ini</div>
                </div>
                <h3 class="fw-bold mb-0" id="stat-on-duty">—</h3>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-body">
                <div class="d-flex align-items-center mb-3">
                  <div class="rounded p-2 text-white me-3" style="background:#6b7280;">${icons.userX}</div>
                  <div class="text-uppercase text-muted small fw-bold">Libur Hari Ini</div>
                </div>
                <h3 class="fw-bold mb-0" id="stat-off-duty">—</h3>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-body">
                <div class="d-flex align-items-center mb-3">
                  <div class="rounded p-2 text-white me-3" style="background:#8b5cf6;">${icons.users}</div>
                  <div class="text-uppercase text-muted small fw-bold">Total Teknisi</div>
                </div>
                <h3 class="fw-bold mb-0" id="stat-total-tech">—</h3>
              </div>
            </div>
          </div>
        </div>
        <div class="card animate-fade-in-up" style="margin-bottom:var(--sp-5)">
          <div class="card-header"><h3 class="card-title">Daftar Teknisi</h3></div>
          <div id="tech-table-wrapper"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
        <div class="card animate-fade-in-up">
          <div class="card-header">
            <h3 class="card-title">Jadwal Hari Ini</h3>
            <button class="btn btn-primary btn-sm" id="add-schedule-btn">${icons.plus} Atur Jadwal</button>
          </div>
          <div id="schedule-wrapper"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
      </div>

      <!-- PANEL: Master Shift -->
      <div class="tech-tab-panel" id="panel-shift-master">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-4);">
          <p style="color:var(--text-secondary);font-size:var(--fs-sm);">Kelola kode shift dan jam kerja yang digunakan dalam matriks jadwal.</p>
          <button class="btn btn-primary" id="btn-add-shift">${icons.plus} Tambah Kode Shift</button>
        </div>
        <div id="shift-master-wrapper"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>
  `;

  // ── Set default dates (current month) ──
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const startDefault = `${y}-${String(m + 1).padStart(2,'0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const endDefault = `${y}-${String(m + 1).padStart(2,'0')}-${lastDay}`;
  document.getElementById('matrix-start').value = startDefault;
  document.getElementById('matrix-end').value   = endDefault;
  matrixPeriodStart = startDefault;
  matrixPeriodEnd   = endDefault;

  // ── Tab switching ──
  content.querySelectorAll('.tech-tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      content.querySelectorAll('.tech-tab-btn').forEach(b => b.classList.remove('active'));
      content.querySelectorAll('.tech-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      document.getElementById(`panel-${activeTab}`)?.classList.add('active');

      // Show/hide header actions based on tab
      const saveBtn = document.getElementById('btn-save-matrix');
      const exportBtn = document.getElementById('btn-export-excel');
      if (activeTab === 'matriks') {
        if (saveBtn) saveBtn.style.display = '';
        if (exportBtn) exportBtn.style.display = '';
      } else {
        if (saveBtn) saveBtn.style.display = 'none';
        if (exportBtn) exportBtn.style.display = 'none';
      }

      if (activeTab === 'shift-master') renderShiftMasterPanel();
      if (activeTab === 'daftar') await loadTechData();
    });
  });

  // ── Events ──
  document.getElementById('btn-load-matrix').addEventListener('click', loadMatrix);
  document.getElementById('btn-save-matrix').addEventListener('click', saveAllMatrixData);
  document.getElementById('btn-export-excel').addEventListener('click', exportToCSV);
  document.getElementById('btn-add-shift').addEventListener('click', () => showShiftForm());

  document.getElementById('btn-prev-month').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('btn-next-month').addEventListener('click', () => shiftMonth(1));
  document.getElementById('btn-today').addEventListener('click', () => {
    const n = new Date();
    const y2 = n.getFullYear(), m2 = n.getMonth();
    document.getElementById('matrix-start').value = `${y2}-${String(m2+1).padStart(2,'0')}-01`;
    document.getElementById('matrix-end').value   = `${y2}-${String(m2+1).padStart(2,'0')}-${new Date(y2,m2+1,0).getDate()}`;
    loadMatrix();
  });

  // ── Initial data load ──
  await loadInitialData();
  await loadMatrix();
}

// ── Shift month navigation ──
function shiftMonth(delta) {
  const start = new Date(document.getElementById('matrix-start').value + 'T00:00:00');
  start.setMonth(start.getMonth() + delta);
  const y = start.getFullYear(), m = start.getMonth();
  document.getElementById('matrix-start').value = `${y}-${String(m+1).padStart(2,'0')}-01`;
  document.getElementById('matrix-end').value   = `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`;
  loadMatrix();
}

// ─── Initial data ──────────────────────────────────────────
async function loadInitialData() {
  try {
    [technicianList, shiftMaster] = await Promise.all([
      fetchAll('profiles', { filters: [{ column: 'role', value: 'technician' }], order: { column: 'full_name', ascending: true } }),
      fetchAll('shift_master', { order: { column: 'kode', ascending: true } }),
    ]);

    // Populate filter dropdown
    const filterSel = document.getElementById('filter-technician');
    if (filterSel) {
      technicianList.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.full_name || t.id;
        filterSel.appendChild(opt);
      });
      filterSel.addEventListener('change', () => { filterTechId = filterSel.value; });
    }
  } catch (err) {
    console.error('loadInitialData error:', err);
  }
}

// ═══════════════════════════════════════════════════════════
//  TAB 1: Daftar Teknisi
// ═══════════════════════════════════════════════════════════
async function loadTechData() {
  try {
    const today = new Date().toISOString().split('T')[0];
    [technicianList, scheduleData, shiftMaster] = await Promise.all([
      fetchAll('profiles', { filters: [{ column: 'role', value: 'technician' }], order: { column: 'full_name', ascending: true } }),
      fetchAll('technician_schedule', {
        select: '*, profiles:profile_id(full_name)',
        filters: [{ column: 'schedule_date', value: today }],
        order: { column: 'created_at', ascending: false }
      }),
      fetchAll('shift_master', { order: { column: 'kode', ascending: true } }),
    ]);

    const onDuty  = scheduleData.filter(s => s.status === 'on_duty').length;
    const offDuty = scheduleData.filter(s => s.status !== 'on_duty').length;

    document.getElementById('stat-on-duty').textContent   = onDuty;
    document.getElementById('stat-off-duty').textContent  = offDuty;
    document.getElementById('stat-total-tech').textContent = technicianList.length;

    renderTechTable();
    renderScheduleTable();

    const addBtn = document.getElementById('add-schedule-btn');
    if (addBtn) addBtn.addEventListener('click', () => showScheduleForm());
  } catch (err) {
    showToast('Gagal memuat data teknisi', 'error');
    console.error(err);
  }
}

function renderTechTable() {
  const wrapper = document.getElementById('tech-table-wrapper');
  if (!wrapper) return;
  if (technicianList.length === 0) {
    wrapper.innerHTML = `<div class="empty-state"><p>Belum ada teknisi terdaftar</p></div>`;
    return;
  }
  wrapper.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover table-bordered mb-0">
        <thead>
          <tr>
            <th>Nama</th><th>Departemen</th><th>Telepon</th><th>Status Hari Ini</th>
          </tr>
        </thead>
        <tbody>
          ${technicianList.map(t => {
            const todaySchedule = scheduleData.find(s => s.profile_id === t.id);
            const statusKey = todaySchedule?.status || 'off_duty';
            return `
            <tr>
              <td>
                <div class="d-flex align-items-center gap-3">
                  <div class="sidebar-avatar" style="width:32px;height:32px;font-size:var(--fs-xs)">${(t.full_name || 'T').charAt(0).toUpperCase()}</div>
                  <span class="fw-medium">${escapeHtml(t.full_name || '-')}</span>
                </div>
              </td>
              <td>${escapeHtml(t.department || '-')}</td>
              <td>${escapeHtml(t.phone || '-')}</td>
              <td>${badge(SCHEDULE_STATUS[statusKey]?.label, SCHEDULE_STATUS[statusKey]?.color, SCHEDULE_STATUS[statusKey]?.bg)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderScheduleTable() {
  const wrapper = document.getElementById('schedule-wrapper');
  if (!wrapper) return;
  if (scheduleData.length === 0) {
    wrapper.innerHTML = `<div class="empty-state"><p>Belum ada jadwal hari ini</p></div>`;
    return;
  }
  wrapper.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover table-bordered mb-0">
        <thead>
          <tr>
            <th>Teknisi</th><th>Shift</th><th>Status</th><th>Catatan</th><th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${scheduleData.map(s => {
            const shiftInfo = shiftMaster.find(sm => sm.kode === (s.shift_code || s.shift));
            const shiftLabel = shiftInfo ? `${shiftInfo.kode} — ${shiftInfo.label}` : (s.shift_code || s.shift || '-');
            return `
            <tr>
              <td>${s.profiles?.full_name || '-'}</td>
              <td><span class="fw-semibold">${escapeHtml(shiftLabel)}</span></td>
              <td>${badge(SCHEDULE_STATUS[s.status]?.label, SCHEDULE_STATUS[s.status]?.color, SCHEDULE_STATUS[s.status]?.bg)}</td>
              <td>${escapeHtml(s.notes || '-')}</td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-outline-warning btn-sm btn-icon" data-edit-schedule="${s.id}" title="Edit">${icons.edit}</button>
                  <button class="btn btn-outline-danger btn-sm btn-icon" data-del-schedule="${s.id}" title="Hapus">${icons.trash}</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  wrapper.querySelectorAll('[data-edit-schedule]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sched = scheduleData.find(s => s.id === btn.dataset.editSchedule);
      if (sched) showScheduleForm(sched);
    });
  });
  wrapper.querySelectorAll('[data-del-schedule]').forEach(btn => {
    btn.addEventListener('click', async () => {
      showConfirm({
        message: 'Hapus jadwal ini?',
        onConfirm: async () => {
          try {
            await deleteRow('technician_schedule', btn.dataset.delSchedule);
            showToast('Jadwal dihapus', 'success');
            await loadTechData();
          } catch { showToast('Gagal menghapus', 'error'); }
        }
      });
    });
  });
}

function showScheduleForm(existing = null) {
  const isEdit = !!existing;
  const today = new Date().toISOString().split('T')[0];
  showModal({
    title: isEdit ? 'Edit Jadwal' : 'Atur Jadwal Teknisi',
    body: `
      <div class="row g-3">
        <div class="col-12">
          <label class="form-label">Teknisi *</label>
          <select class="form-select" id="sched-tech">
            <option value="">Pilih Teknisi</option>
            ${technicianList.map(t => `<option value="${t.id}" ${existing?.profile_id === t.id ? 'selected' : ''}>${escapeHtml(t.full_name)}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Tanggal *</label>
          <input type="date" class="form-control" id="sched-date" value="${existing?.schedule_date || today}" />
        </div>
        <div class="col-md-6">
          <label class="form-label">Kode Shift</label>
          <select class="form-select" id="sched-shift-code">
            <option value="">-- Pilih --</option>
            ${shiftMaster.map(sm => `<option value="${sm.kode}" ${(existing?.shift_code || existing?.shift) === sm.kode ? 'selected' : ''}>${sm.kode} — ${sm.label} (${sm.durasi_jam}h)</option>`).join('')}
          </select>
        </div>
        <div class="col-12">
          <label class="form-label">Status</label>
          <select class="form-select" id="sched-status">
            ${Object.entries(SCHEDULE_STATUS).map(([k, v]) => `<option value="${k}" ${existing?.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="col-12">
          <label class="form-label">Catatan</label>
          <input class="form-control" id="sched-notes" value="${escapeHtml(existing?.notes || '')}" placeholder="Catatan opsional" />
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="sched-cancel">Batal</button>
      <button class="btn btn-primary" id="sched-save">${isEdit ? 'Simpan' : 'Tambah Jadwal'}</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#sched-cancel').addEventListener('click', close);
      overlay.querySelector('#sched-save').addEventListener('click', async () => {
        const profile_id    = overlay.querySelector('#sched-tech').value;
        const schedule_date = overlay.querySelector('#sched-date').value;
        if (!profile_id || !schedule_date) return showToast('Teknisi dan Tanggal wajib diisi', 'warning');
        const shiftCode = overlay.querySelector('#sched-shift-code').value;
        const data = {
          profile_id,
          schedule_date,
          shift_code: shiftCode || null,
          shift: ['pagi', 'siang', 'malam'].includes(shiftCode) ? shiftCode : (existing?.shift || 'pagi'),
          status: overlay.querySelector('#sched-status').value,
          notes: overlay.querySelector('#sched-notes').value.trim(),
        };
        try {
          if (isEdit) {
            await updateRow('technician_schedule', existing.id, data);
            showToast('Jadwal diperbarui', 'success');
          } else {
            await insertRow('technician_schedule', data);
            showToast('Jadwal ditambahkan', 'success');
          }
          close();
          await loadTechData();
        } catch (err) { showToast(err.message || 'Gagal menyimpan', 'error'); }
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  TAB 2: Jadwal Matriks
// ═══════════════════════════════════════════════════════════
async function loadMatrix() {
  const startStr = document.getElementById('matrix-start').value;
  const endStr   = document.getElementById('matrix-end').value;
  if (!startStr || !endStr) return showToast('Pilih periode terlebih dahulu', 'warning');
  if (startStr > endStr)   return showToast('Tanggal awal harus sebelum tanggal akhir', 'warning');

  matrixPeriodStart = startStr;
  matrixPeriodEnd   = endStr;

  // Update period label
  const labelEl = document.getElementById('matrix-period-label');
  if (labelEl) {
    const s = new Date(startStr + 'T00:00:00');
    const e = new Date(endStr + 'T00:00:00');
    labelEl.textContent = `${s.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })} – ${e.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}`;
  }

  const wrapper = document.getElementById('matrix-wrapper');
  wrapper.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    // Load all needed data
    if (technicianList.length === 0) {
      technicianList = await fetchAll('profiles', { filters: [{ column: 'role', value: 'technician' }], order: { column: 'full_name', ascending: true } });
    }
    if (shiftMaster.length === 0) {
      shiftMaster = await fetchAll('shift_master', { order: { column: 'kode', ascending: true } });
    }

    let schedules = await fetchAll('technician_schedule', {
      filters: [
        { column: 'schedule_date', op: 'gte', value: startStr },
        { column: 'schedule_date', op: 'lte', value: endStr },
      ]
    });

    // Build matrixData lookup
    matrixData = {};
    schedules.forEach(s => {
      const key = `${s.profile_id}|${s.schedule_date}`;
      matrixData[key] = { shift_code: s.shift_code || s.shift || '', id: s.id };
    });

    // ── AUTO-REPEAT: if bulan ini kosong, ambil pola dari bulan sebelumnya ──
    const hasData = schedules.some(s => s.shift_code || s.shift);
    if (!hasData && technicianList.length > 0) {
      const prevEnd   = new Date(startStr + 'T00:00:00');
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(1); // first day of previous month
      const prevStartStr = prevStart.toISOString().slice(0, 10);
      const prevEndStr   = prevEnd.toISOString().slice(0, 10);

      const prevSchedules = await fetchAll('technician_schedule', {
        filters: [
          { column: 'schedule_date', op: 'gte', value: prevStartStr },
          { column: 'schedule_date', op: 'lte', value: prevEndStr },
        ]
      });

      if (prevSchedules.length > 0) {
        // Build prev pattern: techId → { dayOfWeek(0-6) → shift_code }
        // We use day-of-week pattern so Mon→Mon, Tue→Tue etc.
        const prevPattern = {}; // techId → Map<dayOfWeek, shift_code>
        prevSchedules.forEach(s => {
          const dow = new Date(s.schedule_date + 'T00:00:00').getDay();
          if (!prevPattern[s.profile_id]) prevPattern[s.profile_id] = {};
          if (!prevPattern[s.profile_id][dow]) {
            prevPattern[s.profile_id][dow] = s.shift_code || s.shift || '';
          }
        });

        // Apply pattern to current period
        const curDays = getDaysArray(startStr, endStr);
        let appliedCount = 0;
        technicianList.forEach(t => {
          const pattern = prevPattern[t.id];
          if (!pattern) return;
          curDays.forEach(d => {
            const dow  = new Date(d + 'T00:00:00').getDay();
            const kode = pattern[dow];
            if (kode) {
              const key = `${t.id}|${d}`;
              matrixData[key] = { shift_code: kode, _dirty: true };
              appliedCount++;
            }
          });
        });

        if (appliedCount > 0) {
          showToast(
            `Pola dari ${prevStart.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} diterapkan otomatis. Klik "Simpan Semua" untuk menyimpan.`,
            'info'
          );
          document.getElementById('btn-save-matrix').style.display = '';
        }
      }
    }

    // Compute & display stats
    updateMatrixStats(getDaysArray(startStr, endStr));

    // Render matrix
    renderMatrix(getDaysArray(startStr, endStr));

    document.getElementById('btn-save-matrix').style.display = '';
    const legend = document.getElementById('matrix-legend');
    if (legend) legend.style.display = '';
  } catch (err) {
    wrapper.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">Gagal memuat matriks: ${escapeHtml(err.message)}</p></div>`;
    console.error(err);
  }
}

function updateMatrixStats(days) {
  const visibleTechs = filterTechId
    ? technicianList.filter(t => t.id === filterTechId)
    : technicianList;

  let totalMH = 0;
  let totalShiftEntries = 0;
  let workDays = 0;

  days.forEach(d => {
    let dayMH = 0;
    visibleTechs.forEach(t => {
      const kode = matrixData[`${t.id}|${d}`]?.shift_code || '';
      const sm = shiftMaster.find(s => s.kode === kode);
      if (sm && !sm.is_off) {
        dayMH += parseFloat(sm.durasi_jam) || 0;
        totalShiftEntries++;
      }
    });
    totalMH += dayMH;
    if (dayMH > 0) workDays++;
  });

  const avgMH = workDays > 0 ? (totalMH / days.length).toFixed(2) : '0';
  const month = new Date(matrixPeriodStart + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  document.getElementById('stat-total-mh').textContent     = totalMH.toFixed(2) + ' Jam';
  document.getElementById('stat-total-mh-sub').textContent = month;
  document.getElementById('stat-matrix-techs').textContent = visibleTechs.length;
  document.getElementById('stat-total-shifts').textContent = shiftMaster.filter(sm => !sm.is_off).length;
  document.getElementById('stat-avg-mh').textContent       = avgMH;
}

function renderMatrix(days) {
  const wrapper = document.getElementById('matrix-wrapper');
  if (!wrapper) return;

  const visibleTechs = filterTechId
    ? technicianList.filter(t => t.id === filterTechId)
    : technicianList;

  if (visibleTechs.length === 0) {
    wrapper.innerHTML = '<div class="empty-state"><p>Belum ada teknisi terdaftar</p></div>';
    return;
  }

  const dayLabels = days.map(d => {
    const dt      = new Date(d + 'T00:00:00');
    const dayName = dt.toLocaleDateString('id-ID', { weekday: 'short' });
    const dayNum  = dt.getDate();
    return { d, dayName, dayNum, isToday: isToday(d), isWeekend: isWeekend(d) };
  });

  // ── Header row ──
  const headerCols = dayLabels.map(({ d, dayName, dayNum, isToday: tod, isWeekend: wknd }) => {
    let cls = 'day-header';
    if (tod)  cls += ' is-today';
    if (wknd) cls += ' is-weekend';
    return `<th class="${cls}" title="${d}">
      <div style="font-size:0.6rem;opacity:0.8">${dayName}</div>
      <div>${dayNum}</div>
    </th>`;
  }).join('');

  // ── Body rows ──
  const bodyRows = visibleTechs.map(t => {
    // Render skill badge
    const skillKey   = (t.skill || '').toUpperCase();
    const skillInfo  = TECHNICIAN_SKILLS[skillKey];
    const skillBadge = skillInfo
      ? `<span class="shift-badge" style="background:${skillInfo.bg};color:${skillInfo.color};font-weight:700;">${skillInfo.label}</span>`
      : `<span class="shift-badge" style="background:rgba(107,114,128,0.10);color:#6B7280;">—</span>`;

    const cells = dayLabels.map(({ d, isWeekend: wknd }) => {
      const key     = `${t.id}|${d}`;
      const entry   = matrixData[key];
      const kode    = entry?.shift_code || '';
      const sm      = shiftMaster.find(s => s.kode === kode);
      const durasi  = sm ? parseFloat(sm.durasi_jam) || 0 : 0;
      const isOff   = !kode || (sm && sm.is_off);

      let cellClass = 'matrix-cell';
      let cellText  = '—';

      if (kode && !isOff) {
        cellClass += ' cell-work';
        cellText = durasi > 0 ? durasi.toFixed(0) : kode;
      } else if (kode && isOff) {
        cellClass += ' cell-off';
        cellText = '0';
      } else if (wknd) {
        cellClass += ' cell-weekend-empty';
        cellText = '—';
      }

      return `<td data-tech="${t.id}" data-date="${d}" style="padding:0;">
        <div class="${cellClass}" data-key="${key}">${cellText}</div>
      </td>`;
    }).join('');

    return `<tr>
      <td class="sticky-col">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="sidebar-avatar" style="width:28px;height:28px;font-size:0.65rem;flex-shrink:0">${(t.full_name || 'T').charAt(0).toUpperCase()}</div>
          <span style="font-size:var(--fs-xs)">${escapeHtml(t.full_name || '-')}</span>
        </div>
      </td>
      <td class="sticky-col-2">${skillBadge}</td>
      ${cells}
    </tr>`;
  }).join('');

  // ── Total row ──
  const totalCols = dayLabels.map(({ d, isWeekend: wknd }) => {
    let total = 0;
    visibleTechs.forEach(t => {
      const kode = matrixData[`${t.id}|${d}`]?.shift_code || '';
      const sm   = shiftMaster.find(s => s.kode === kode);
      total += sm ? (parseFloat(sm.durasi_jam) || 0) : 0;
    });
    const isOff = total === 0 && !wknd;
    const cls   = total === 0 ? (wknd ? '' : 'cell-off-total') : '';
    return `<td class="${cls}" style="padding:6px 4px;">${total > 0 ? total.toFixed(0) : (wknd ? '—' : '0')}</td>`;
  }).join('');

  wrapper.innerHTML = `
    <div class="matrix-outer">
      <table class="matrix-table" id="the-matrix">
        <thead><tr>
          <th style="position:sticky;left:0;z-index:4;background:var(--bg-surface);text-align:left;padding:10px 14px;font-size:var(--fs-xs);color:var(--text-muted);font-weight:var(--fw-semibold);text-transform:uppercase;letter-spacing:0.05em;min-width:170px;">TEKNISI</th>
          <th style="position:sticky;left:170px;z-index:4;background:var(--bg-surface);padding:10px 8px;font-size:var(--fs-xs);color:var(--text-muted);font-weight:var(--fw-semibold);text-transform:uppercase;letter-spacing:0.05em;min-width:90px;">SKILL</th>
          ${headerCols}
        </tr></thead>
        <tbody>
          ${bodyRows}
          <tr class="total-row">
            <td class="sticky-col" style="background:#EBF3FF;color:var(--primary);font-size:var(--fs-xs);">TOTAL MANHOURS / HARI</td>
            <td class="sticky-col-2" style="background:#EBF3FF;"></td>
            ${totalCols}
          </tr>
        </tbody>
      </table>
    </div>
  `;

  // ── Attach click handlers to cells ──
  wrapper.querySelectorAll('.matrix-cell[data-key]').forEach(cell => {
    cell.addEventListener('click', () => {
      const key      = cell.dataset.key;
      const [techId, dateStr] = key.split('|');
      const tech     = technicianList.find(t => t.id === techId);
      const entry    = matrixData[key];
      const currentKode = entry?.shift_code || '';
      showCellModal(tech, dateStr, currentKode, key);
    });
  });
}

// ── Cell click modal ──
function showCellModal(tech, dateStr, currentKode, key) {
  const dt = new Date(dateStr + 'T00:00:00');
  const dateFormatted = dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  showModal({
    title: `Atur Jadwal — ${escapeHtml(tech?.full_name || '-')}`,
    body: `
      <p class="text-muted small mb-4">${dateFormatted}</p>
      <div class="mb-3">
        <label class="form-label">Kode Shift</label>
        <select class="form-select" id="cell-shift-code">
          <option value="">— Tidak Ada / Kosong —</option>
          ${shiftMaster.map(sm => `<option value="${sm.kode}" ${currentKode === sm.kode ? 'selected' : ''}>${sm.kode} — ${sm.label} (${sm.durasi_jam}h)</option>`).join('')}
        </select>
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="cell-cancel">Batal</button>
      <button class="btn btn-outline-danger btn-sm me-auto" id="cell-clear">Hapus</button>
      <button class="btn btn-primary" id="cell-save">Simpan</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#cell-cancel').addEventListener('click', close);

      // Clear cell
      overlay.querySelector('#cell-clear').addEventListener('click', () => {
        if (!matrixData[key]) matrixData[key] = {};
        matrixData[key].shift_code = '';
        matrixData[key]._dirty = true;
        refreshSingleCell(key);
        updateTotalCol(dateStr);
        updateMatrixStats(getDaysArray(matrixPeriodStart, matrixPeriodEnd));
        close();
      });

      // Save cell
      overlay.querySelector('#cell-save').addEventListener('click', () => {
        const kode = overlay.querySelector('#cell-shift-code').value;
        if (!matrixData[key]) matrixData[key] = {};
        matrixData[key].shift_code = kode;
        matrixData[key]._dirty = true;
        refreshSingleCell(key);
        updateTotalCol(dateStr);
        updateMatrixStats(getDaysArray(matrixPeriodStart, matrixPeriodEnd));
        close();
      });
    }
  });
}

// ── Refresh a single cell after edit ──
function refreshSingleCell(key) {
  const cell = document.querySelector(`.matrix-cell[data-key="${key}"]`);
  if (!cell) return;

  const [techId, dateStr] = key.split('|');
  const entry  = matrixData[key];
  const kode   = entry?.shift_code || '';
  const sm     = shiftMaster.find(s => s.kode === kode);
  const durasi = sm ? parseFloat(sm.durasi_jam) || 0 : 0;
  const isOff  = !kode || (sm && sm.is_off);
  const wknd   = isWeekend(dateStr);

  cell.className = 'matrix-cell';
  if (kode && !isOff) {
    cell.classList.add('cell-work');
    cell.textContent = durasi > 0 ? durasi.toFixed(0) : kode;
  } else if (kode && isOff) {
    cell.classList.add('cell-off');
    cell.textContent = '0';
  } else if (wknd) {
    cell.classList.add('cell-weekend-empty');
    cell.textContent = '—';
  } else {
    cell.textContent = '—';
  }
}

// ── Update the total row for a given date column ──
function updateTotalCol(dateStr) {
  const days  = getDaysArray(matrixPeriodStart, matrixPeriodEnd);
  const colIdx = days.indexOf(dateStr);
  if (colIdx < 0) return;

  const visibleTechs = filterTechId
    ? technicianList.filter(t => t.id === filterTechId)
    : technicianList;

  let total = 0;
  visibleTechs.forEach(t => {
    const kode = matrixData[`${t.id}|${dateStr}`]?.shift_code || '';
    const sm   = shiftMaster.find(s => s.kode === kode);
    total += sm ? parseFloat(sm.durasi_jam) || 0 : 0;
  });

  const totalRow  = document.querySelector('.total-row');
  if (!totalRow) return;
  const totalCells = totalRow.querySelectorAll('td');
  const targetCell = totalCells[colIdx + 2]; // +2 for sticky name+shift cols
  if (!targetCell) return;

  const wknd = isWeekend(dateStr);
  targetCell.className = total === 0 ? (wknd ? '' : 'cell-off-total') : '';
  targetCell.style.padding = '6px 4px';
  targetCell.textContent = total > 0 ? total.toFixed(0) : (wknd ? '—' : '0');
}

// ─── Save all matrix data ────────────────────────────────────
async function saveAllMatrixData() {
  const btn = document.getElementById('btn-save-matrix');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Menyimpan...'; }

  try {
    const upsertRows = [];
    const days = getDaysArray(matrixPeriodStart, matrixPeriodEnd);

    technicianList.forEach(t => {
      days.forEach(d => {
        const key   = `${t.id}|${d}`;
        const entry = matrixData[key];
        if (!entry?._dirty) return;
        const kode = entry.shift_code || '';
        upsertRows.push({
          profile_id:    t.id,
          schedule_date: d,
          shift_code:    kode || null,
          shift:         ['pagi','siang','malam'].includes(kode) ? kode : 'pagi',
          status:        kode && kode !== 'O' ? 'on_duty' : 'off_duty',
        });
      });
    });

    if (upsertRows.length === 0) {
      showToast('Tidak ada perubahan untuk disimpan', 'info');
      return;
    }

    const { error } = await supabase
      .from('technician_schedule')
      .upsert(upsertRows, { onConflict: 'profile_id,schedule_date' });
    if (error) throw error;

    // Clear dirty flags
    Object.values(matrixData).forEach(e => { e._dirty = false; });

    showToast(`${upsertRows.length} entri jadwal berhasil disimpan`, 'success');
  } catch (err) {
    showToast('Gagal menyimpan: ' + err.message, 'error');
    console.error(err);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '💾 Simpan Semua'; }
  }
}

// ─── Export to CSV ──────────────────────────────────────────
function exportToCSV() {
  if (!matrixPeriodStart || !matrixPeriodEnd) {
    showToast('Tampilkan matriks terlebih dahulu', 'warning');
    return;
  }
  const days = getDaysArray(matrixPeriodStart, matrixPeriodEnd);
  const header = ['Teknisi', 'Shift Utama', ...days].join(',');
  const rows = technicianList.map(t => {
    const primaryShift = (() => {
      const counts = {};
      days.forEach(d => {
        const kode = matrixData[`${t.id}|${d}`]?.shift_code || '';
        if (kode && kode !== 'O') counts[kode] = (counts[kode] || 0) + 1;
      });
      let best = '', max = 0;
      Object.entries(counts).forEach(([k, v]) => { if (v > max) { max = v; best = k; } });
      return best;
    })();
    const cells = days.map(d => {
      const kode = matrixData[`${t.id}|${d}`]?.shift_code || '';
      const sm   = shiftMaster.find(s => s.kode === kode);
      return sm ? (sm.is_off ? '0' : sm.durasi_jam) : '';
    });
    return [t.full_name || '-', primaryShift, ...cells].join(',');
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `jadwal-teknisi-${matrixPeriodStart}-${matrixPeriodEnd}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('File CSV berhasil diunduh', 'success');
}

// ═══════════════════════════════════════════════════════════
//  TAB 3: Master Shift
// ═══════════════════════════════════════════════════════════
async function renderShiftMasterPanel() {
  const wrapper = document.getElementById('shift-master-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    shiftMaster = await fetchAll('shift_master', { order: { column: 'kode', ascending: true } });
    if (shiftMaster.length === 0) {
      wrapper.innerHTML = `<div class="empty-state"><p>Belum ada kode shift. Klik "+ Tambah Kode Shift".</p></div>`;
      return;
    }
    wrapper.innerHTML = `
      <div class="shift-master-list">
        ${shiftMaster.map(sm => `
          <div class="shift-master-card">
            <div class="shift-master-kode">${escapeHtml(sm.kode)}</div>
            <div class="shift-master-label">${escapeHtml(sm.label)}</div>
            <div class="shift-master-durasi">
              ${sm.is_off
                ? `<span style="color:var(--text-muted)">Libur / Off — 0 jam</span>`
                : `<span style="color:var(--success);font-weight:var(--fw-semibold)">${sm.durasi_jam} jam kerja</span>`}
            </div>
            <div class="shift-master-actions">
              <button class="btn btn-ghost btn-sm" data-edit-shift="${sm.id}" style="color:var(--warning)">${icons.edit} Edit</button>
              <button class="btn btn-ghost btn-sm" data-del-shift="${sm.id}" style="color:var(--danger)">${icons.trash}</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="card bg-light border-0">
        <div class="card-body">
          <h6 class="card-title mb-3">Ringkasan Kode Shift</h6>
          <div class="table-responsive">
            <table class="table table-hover table-bordered bg-white mb-0">
              <thead><tr><th>Kode</th><th>Jam Kerja</th><th>Durasi</th><th>Tipe</th></tr></thead>
              <tbody>
                ${shiftMaster.map(sm => `
                  <tr>
                    <td><span class="fw-bold fs-5">${escapeHtml(sm.kode)}</span></td>
                    <td>${escapeHtml(sm.label)}</td>
                    <td>${sm.durasi_jam} jam</td>
                    <td>${sm.is_off ? badge('Libur', '#6B7280', 'rgba(107,114,128,0.12)') : badge('Kerja', '#8CC63F', 'rgba(140,198,63,0.12)')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    wrapper.querySelectorAll('[data-edit-shift]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sm = shiftMaster.find(s => s.id === btn.dataset.editShift);
        if (sm) showShiftForm(sm);
      });
    });
    wrapper.querySelectorAll('[data-del-shift]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sm = shiftMaster.find(s => s.id === btn.dataset.delShift);
        showConfirm({
          message: `Hapus kode shift "${sm?.kode}"?`,
          onConfirm: async () => {
            try {
              await deleteRow('shift_master', btn.dataset.delShift);
              showToast('Kode shift dihapus', 'success');
              await renderShiftMasterPanel();
            } catch { showToast('Gagal menghapus', 'error'); }
          }
        });
      });
    });
  } catch (err) {
    wrapper.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">Gagal memuat: ${escapeHtml(err.message)}</p></div>`;
  }
}

function showShiftForm(existing = null) {
  const isEdit = !!existing;
  showModal({
    title: isEdit ? `Edit Shift ${existing.kode}` : 'Tambah Kode Shift',
    body: `
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">Kode Shift *</label>
          <input class="form-control" id="sm-kode" value="${escapeHtml(existing?.kode || '')}" placeholder="Mis: P1, S2, M" ${isEdit ? 'disabled' : ''} style="text-transform:uppercase;font-weight:var(--fw-bold);letter-spacing:0.05em;" />
          <div class="form-text">Gunakan singkatan pendek (maks 4 karakter)</div>
        </div>
        <div class="col-md-6">
          <label class="form-label">Durasi Jam *</label>
          <input type="number" class="form-control" id="sm-durasi" value="${existing?.durasi_jam ?? ''}" placeholder="0" min="0" max="24" step="0.5" />
        </div>
        <div class="col-12">
          <label class="form-label">Jam Kerja (Label)</label>
          <input class="form-control" id="sm-label" value="${escapeHtml(existing?.label || '')}" placeholder="Mis: 07:00 – 15:00" />
        </div>
        <div class="col-12">
          <div class="form-check">
            <input type="checkbox" class="form-check-input" id="sm-isoff" ${existing?.is_off ? 'checked' : ''} />
            <label class="form-check-label" for="sm-isoff">Kode ini adalah Libur / Off (0 jam)</label>
          </div>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="sm-cancel">Batal</button>
      <button class="btn btn-primary" id="sm-save">${isEdit ? 'Simpan' : 'Tambah'}</button>
    `,
    onMount: (overlay, close) => {
      const isOffCb  = overlay.querySelector('#sm-isoff');
      const durasiIn = overlay.querySelector('#sm-durasi');
      isOffCb.addEventListener('change', () => { if (isOffCb.checked) durasiIn.value = '0'; });

      overlay.querySelector('#sm-cancel').addEventListener('click', close);
      overlay.querySelector('#sm-save').addEventListener('click', async () => {
        const kode   = (overlay.querySelector('#sm-kode').value || '').trim().toUpperCase();
        const label  = overlay.querySelector('#sm-label').value.trim();
        const durasi = parseFloat(overlay.querySelector('#sm-durasi').value);
        const is_off = overlay.querySelector('#sm-isoff').checked;
        if (!kode) return showToast('Kode wajib diisi', 'warning');
        if (isNaN(durasi)) return showToast('Durasi jam harus berupa angka', 'warning');
        const data = { kode, label, durasi_jam: durasi, is_off };
        try {
          if (isEdit) {
            await updateRow('shift_master', existing.id, data);
            showToast('Kode shift diperbarui', 'success');
          } else {
            await insertRow('shift_master', data);
            showToast('Kode shift ditambahkan', 'success');
          }
          close();
          await renderShiftMasterPanel();
        } catch (err) { showToast(err.message || 'Gagal menyimpan', 'error'); }
      });
    }
  });
}
