import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow, deleteRow, updateRow, getCurrentProfile, supabase } from '../lib/supabase.js';
import { formatDate, escapeHtml, debounce } from '../utils/helpers.js';

// ─── State ────────────────────────────────────────────────────────────────────
let allWOs         = [];
let allPMs         = [];
let equipmentList  = [];
let templateList   = [];
let technicianList = [];
let currentProfile = null;
let activeChip     = 'generated'; // chip aktif
let activeTab      = 'wo';        // 'wo' | 'jadwal'
let searchQuery    = '';
// Map: wo_id -> array of technician full_name (dari tabel wo_assignees)
let woAssigneesMap = {};          // { 'wo-uuid': ['Nama A', 'Nama B'] }

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function renderPreventiveMaintenance() {
  currentProfile = await getCurrentProfile();
  const isAdmin  = currentProfile?.role === 'admin';

  injectStyles();

  const content = renderAppShell('Preventive Maintenance');
  content.innerHTML = buildPageHTML(isAdmin);

  // ── Tab nav ──
  content.querySelectorAll('.pm-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ── Tab WO: search ──
  content.querySelector('#pm-search')?.addEventListener('input',
    debounce(e => { searchQuery = e.target.value.toLowerCase(); renderWoTable(); }, 280)
  );

  // ── Tab WO: filter toggle button ──
  content.querySelector('#pm-filter-btn')?.addEventListener('click', () => {
    const panel = content.querySelector('#pm-filter-panel');
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
  });

  // ── Tab WO: filter area/interval selects ──
  content.querySelector('#filter-area')?.addEventListener('change', renderWoTable);
    content.querySelector('#filter-month')?.addEventListener('change', renderWoTable);
  content.querySelector('#filter-interval')?.addEventListener('change', renderWoTable);

  // ── Tab WO: chip filter ──
  content.querySelectorAll('.pm-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      content.querySelectorAll('.pm-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeChip = chip.dataset.chip;
      renderWoTable();
    });
  });

  // ── Tab WO: generate WO ──
  if (isAdmin) {
    content.querySelector('#btn-generate-wo')?.addEventListener('click', handleGenerateWO);
  }

  // ── Tab Jadwal: equipment change → auto-detect template MDS ──
  content.querySelector('#sched-equip')?.addEventListener('change', e => {
    autoFillTemplateByEquipment(e.target.value);
  });

  // ── Tab Jadwal: save schedule ──
  if (isAdmin) {
    content.querySelector('#btn-save-jadwal')?.addEventListener('click', saveJadwal);
  }

  await loadData();
}

// ─── Build HTML ───────────────────────────────────────────────────────────────

function buildPageHTML(isAdmin) {
  return `
    <div class="animate-fade-in pm-root">

      <!-- PAGE HEADER -->
      <div class="pm-page-header">
        <div>
          <h2 class="pm-title">Work order</h2>
          <span class="pm-subtitle">Preventive maintenance</span>
        </div>
        <div class="pm-header-right">
          ${isAdmin ? `
            <button class="pm-btn-generate" id="btn-generate-wo">
              ${icons.plus || '+'} Generate WO 1 Tahun
            </button>
          ` : ''}
        </div>
      </div>

      <!-- TAB NAV -->
      <div class="pm-tabs-nav">
        <button class="pm-tab-btn active" data-tab="wo">Work Order PM</button>
        <button class="pm-tab-btn" data-tab="jadwal">Jadwal PM</button>
      </div>

      <!-- ══════════════════════════════════════════════
           PANEL: WORK ORDER PM
      ══════════════════════════════════════════════ -->
      <div id="panel-wo" class="pm-panel">

        <!-- Search + Filter bar -->
        <div class="pm-search-bar">
          <div class="pm-searchbox">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input type="text" id="pm-search" placeholder="Cari equipment atau no WO..." />
          </div>
          <button class="pm-btn-filter" id="pm-filter-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            Filter
          </button>
        </div>

        <!-- Advanced filter panel (hidden by default) -->
        <div id="pm-filter-panel" style="display:none;" class="pm-filter-panel">
          <div class="pm-filter-row">
            <div>
              <label class="pm-filter-label">Area</label>
              <select class="pm-filter-select" id="filter-area">
                <option value="">Semua Area</option>
              </select>
            </div>
            <div>
              <label class="pm-filter-label">Bulan</label>
              <select class="pm-filter-select" id="filter-month">
                <option value="">Semua Bulan</option>
                <option value="1">Januari</option>
                <option value="2">Februari</option>
                <option value="3">Maret</option>
                <option value="4">April</option>
                <option value="5">Mei</option>
                <option value="6">Juni</option>
                <option value="7">Juli</option>
                <option value="8">Agustus</option>
                <option value="9">September</option>
                <option value="10">Oktober</option>
                <option value="11">November</option>
                <option value="12">Desember</option>
              </select>
            </div>
            <div>
              <label class="pm-filter-label">Interval</label>
              <select class="pm-filter-select" id="filter-interval">
                <option value="">Semua Interval</option>
                <option value="30">Monthly (30 hari)</option>
                <option value="60">2 Bulan (60 hari)</option>
                <option value="90">3 Bulan (90 hari)</option>
                <option value="180">6 Bulan (180 hari)</option>
                <option value="365">Annual (365 hari)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Status Chips -->
        <div class="pm-chips-row" id="pm-chips-row">
          <button class="pm-chip active" data-chip="generated">Menunggu ploting <span class="chip-count" id="cnt-generated">0</span></button>
          <button class="pm-chip" data-chip="diploting">Diploting <span class="chip-count" id="cnt-diploting">0</span></button>
          <button class="pm-chip" data-chip="menunggu_approval">Menunggu approval <span class="chip-count" id="cnt-approval">0</span></button>
          <button class="pm-chip" data-chip="closed">Closed <span class="chip-count" id="cnt-closed">0</span></button>
          <button class="pm-chip pm-chip-danger" data-chip="overdue">Overdue <span class="chip-count" id="cnt-overdue">0</span></button>
        </div>

        <!-- WO Table -->
        <div class="pm-table-card" id="pm-wo-table-wrapper">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════
           PANEL: JADWAL PM
      ══════════════════════════════════════════════ -->
      <div id="panel-jadwal" class="pm-panel" style="display:none;">

        ${isAdmin ? `
        <div class="pm-card mb-4">
          <div class="pm-card-header">
            ${icons.calendarCheck || '📅'} Tambah Jadwal PM Baru
          </div>
          <div class="pm-card-body">
            <div class="pm-form-grid">
              <!-- Removed No. Urut (sched-seq) -->
              <div class="pm-form-group">
                <label>Equipment <span style="color:#ef4444">*</span></label>
                <select id="sched-equip" class="pm-select">
                  <option value="">Pilih Equipment...</option>
                </select>
              </div>
              <div class="pm-form-group" style="max-width:220px;">
                <label>Template MDS (otomatis)</label>
                <div id="sched-template-info" class="pm-template-info">
                  <span class="pm-template-placeholder">— Pilih equipment dahulu —</span>
                </div>
                <input type="hidden" id="sched-template-id">
              </div>
              <div class="pm-form-group" style="max-width:120px;">
                <label>Interval (hari)</label>
                <input type="number" id="sched-freq" class="pm-input" placeholder="—" readonly>
              </div>
              <div class="pm-form-group" style="max-width:160px;">
                <label>Plan Start <span style="color:#ef4444">*</span></label>
                <input type="date" id="sched-start" class="pm-input">
              </div>
            </div>
            <div class="pm-form-footer">
              <button class="pm-btn-primary" id="btn-save-jadwal">
                ${icons.plus || '+'} Simpan Jadwal
              </button>
            </div>
          </div>
        </div>
        ` : ''}

        <div class="pm-card">
          <div class="pm-card-header" style="display:flex;align-items:center;justify-content:space-between;">
            <span>Jadwal PM Aktif</span>
            <span class="pm-badge-count" id="jadwal-count">—</span>
          </div>
          <div id="jadwal-table-wrapper">
            <div class="page-loading"><div class="spinner"></div></div>
          </div>
        </div>

        <!-- Tabel WO Bulan Ini -->
        <div class="pm-card mt-3" id="monthly-wo-card">
          <div class="pm-card-header" style="display:flex;align-items:center;justify-content:space-between;">
            <span>📋 Work Order Bulan Ini</span>
            <span class="pm-badge-count" id="monthly-wo-count">—</span>
          </div>
          <div id="monthly-wo-wrapper">
            <div class="page-loading"><div class="spinner"></div></div>
          </div>
        </div>
      </div>

    </div>
  `;
}

// ─── Tab switch ───────────────────────────────────────────────────────────────

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.pm-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.getElementById('panel-wo').style.display     = tab === 'wo'     ? '' : 'none';
  document.getElementById('panel-jadwal').style.display = tab === 'jadwal' ? '' : 'none';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('pm-page-styles')) return;
  const s = document.createElement('style');
  s.id = 'pm-page-styles';
  s.textContent = `
    .pm-root { max-width: 100%; }

    /* ── Page header ── */
    .pm-page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
    }
    .pm-title  { font-size: 1.45rem; font-weight: 700; margin: 0; line-height: 1.2; }
    .pm-subtitle { font-size: 0.82rem; color: var(--text-secondary, #6b7280); }

    /* ── Tab nav ── */
    .pm-tabs-nav {
      display: flex; gap: 4px;
      border-bottom: 2px solid var(--border-color, #e5e7eb);
      margin-bottom: 20px;
    }
    .pm-tab-btn {
      padding: 8px 18px; font-size: 0.86rem; font-weight: 600;
      border: none; background: transparent;
      color: var(--text-secondary, #9ca3af);
      cursor: pointer; border-bottom: 2px solid transparent;
      margin-bottom: -2px; border-radius: 6px 6px 0 0;
      transition: color .15s, border-color .15s;
    }
    .pm-tab-btn:hover { color: var(--text-primary, #111); }
    .pm-tab-btn.active { color: #2563eb; border-bottom-color: #2563eb; }

    /* ── Generate btn ── */
    .pm-btn-generate {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px;
      background: #2563eb; color: #fff;
      border: none; cursor: pointer; font-weight: 600; font-size: 0.86rem;
      transition: background .15s;
    }
    .pm-btn-generate:hover { background: #1d4ed8; }

    /* ── Search bar ── */
    .pm-search-bar {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 14px;
    }
    .pm-searchbox {
      flex: 1; position: relative; display: flex; align-items: center;
      background: var(--card-bg, #fff);
      border: 1px solid var(--border-color, #d1d5db);
      border-radius: 8px; overflow: hidden;
    }
    .pm-searchbox svg {
      position: absolute; left: 12px; width: 16px; height: 16px;
      color: var(--text-secondary, #9ca3af); pointer-events: none;
    }
    .pm-searchbox input {
      width: 100%; padding: 9px 12px 9px 38px;
      border: none; background: transparent; outline: none;
      font-size: 0.875rem; color: var(--text-primary, #111);
    }
    .pm-btn-filter {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 8px;
      background: var(--card-bg, #fff);
      border: 1px solid var(--border-color, #d1d5db);
      color: var(--text-primary, #374151);
      cursor: pointer; font-size: 0.86rem; font-weight: 500;
      white-space: nowrap; transition: background .15s;
    }
    .pm-btn-filter:hover { background: #f3f4f6; }

    /* ── Advanced filter panel ── */
    .pm-filter-panel {
      background: var(--card-bg, #fff);
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 10px; padding: 14px 18px;
      margin-bottom: 14px;
    }
    .pm-filter-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .pm-filter-label { display: block; font-size: 0.75rem; font-weight: 600;
      color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; }
    .pm-filter-select {
      padding: 6px 10px; border-radius: 6px;
      border: 1px solid var(--border-color, #d1d5db);
      background: var(--bg-secondary, #f9fafb); font-size: 0.84rem;
      min-width: 160px;
    }

    /* ── Status chips ── */
    .pm-chips-row {
      display: flex; gap: 8px; flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .pm-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 999px;
      border: 1.5px solid var(--border-color, #d1d5db);
      background: transparent;
      color: var(--text-secondary, #6b7280);
      font-size: 0.82rem; font-weight: 600; cursor: pointer;
      transition: all .15s; white-space: nowrap;
    }
    .pm-chip:hover { border-color: #2563eb; color: #2563eb; }
    .pm-chip.active {
      background: #2563eb; border-color: #2563eb; color: #fff;
    }
    .pm-chip-danger.active { background: #dc2626; border-color: #dc2626; }
    .pm-chip-danger:not(.active):hover { border-color: #dc2626; color: #dc2626; }
    .chip-count {
      background: rgba(255,255,255,.25);
      padding: 0px 6px; border-radius: 999px;
      font-size: 0.75rem; font-weight: 700;
    }
    .pm-chip:not(.active) .chip-count {
      background: var(--bg-secondary, #f3f4f6);
      color: var(--text-primary, #374151);
    }

    /* ── WO Table card ── */
    .pm-table-card {
      background: var(--card-bg, #fff);
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 12px; overflow: hidden;
    }
    .pm-table-card table {
      width: 100%; border-collapse: collapse; font-size: 0.85rem;
    }
    .pm-table-card thead th {
      padding: 11px 16px;
      text-align: left; font-size: 0.75rem;
      font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-secondary, #6b7280);
      background: var(--bg-secondary, #f9fafb);
      border-bottom: 1px solid var(--border-color, #e5e7eb);
      white-space: nowrap;
    }
    .pm-table-card tbody tr {
      border-bottom: 1px solid var(--border-color, #f3f4f6);
      transition: background .12s;
    }
    .pm-table-card tbody tr:last-child { border-bottom: none; }
    .pm-table-card tbody tr:hover { background: var(--bg-secondary, #f9fafb); }
    .pm-table-card tbody td { padding: 13px 16px; vertical-align: middle; }
    .pm-table-card tbody tr.wo-overdue-row { background: rgba(239,68,68,.04); }

    /* ── WO number cell ── */
    .wo-num {
      font-family: 'Courier New', monospace;
      font-weight: 700; font-size: 0.88rem;
      color: var(--text-primary, #111);
      letter-spacing: 0.02em;
    }
    .wo-equip-name { font-weight: 600; font-size: 0.88rem; }
    .wo-equip-sub  { font-size: 0.75rem; color: var(--text-secondary, #9ca3af); margin-top: 1px; }

    /* ── Interval badge ── */
    .interval-badge {
      display: inline-block; padding: 2px 9px;
      border-radius: 999px; font-size: 0.73rem; font-weight: 700;
      background: #eff6ff; color: #1d4ed8;
      border: 1px solid #bfdbfe; white-space: nowrap;
    }

    /* ── Status badge ── */
    .wo-status-badge {
      display: inline-block; padding: 2px 10px;
      border-radius: 999px; font-size: 0.72rem; font-weight: 600;
      white-space: nowrap;
    }

    /* ── Ploting button ── */
    .btn-ploting-row {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 16px; border-radius: 8px;
      background: var(--card-bg, #fff);
      color: var(--text-primary, #111);
      border: 1.5px solid var(--border-color, #d1d5db);
      font-size: 0.82rem; font-weight: 600;
      cursor: pointer; white-space: nowrap;
      transition: all .15s;
    }
    .btn-ploting-row:hover {
      background: #2563eb; color: #fff; border-color: #2563eb;
    }
    .btn-reassign-row {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 14px; border-radius: 8px;
      background: transparent; color: #2563eb;
      border: 1.5px solid #2563eb;
      font-size: 0.82rem; font-weight: 600;
      cursor: pointer; white-space: nowrap; transition: all .15s;
    }
    .btn-reassign-row:hover { background: #eff6ff; }

    /* ── Teknisi belum ── */
    .tech-none { color: var(--text-secondary, #9ca3af); font-size: 0.83rem; font-style: italic; }

    /* ── Empty state ── */
    .pm-empty-state {
      padding: 56px 20px; text-align: center;
      color: var(--text-secondary, #9ca3af);
    }
    .pm-empty-state svg { width:44px;height:44px;opacity:.3;margin-bottom:10px; }
    .pm-empty-state p { font-size: 0.9rem; margin: 0; }

    /* ── Jadwal panel cards ── */
    .pm-card {
      background: var(--card-bg, #fff);
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 12px; overflow: hidden;
    }
    .mb-4 { margin-bottom: 20px; }
    .pm-card-header {
      padding: 14px 20px;
      font-weight: 700; font-size: 0.88rem;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
      background: var(--bg-secondary, #f9fafb);
      display: flex; align-items: center; gap: 8px;
    }
    .pm-card-body { padding: 18px 20px; }
    .pm-form-grid {
      display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end;
    }
    .pm-form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 90px; }
    .pm-form-group label { font-size: 0.78rem; font-weight: 600;
      color: var(--text-secondary); text-transform: uppercase; }
    .pm-select, .pm-input {
      padding: 8px 10px; border-radius: 8px;
      border: 1px solid var(--border-color, #d1d5db);
      background: var(--bg-secondary, #f9fafb);
      font-size: 0.85rem; color: var(--text-primary);
      width: 100%;
    }
    .pm-template-info {
      padding: 8px 10px; border-radius: 8px;
      border: 1px solid var(--border-color, #d1d5db);
      background: var(--bg-secondary, #f9fafb);
      font-size: 0.85rem; min-height: 37px;
      display: flex; align-items: center;
    }
    .pm-template-placeholder { color: var(--text-secondary, #9ca3af); font-style: italic; }
    .pm-template-found { color: #16a34a; font-weight: 600; }
    .pm-template-missing { color: #dc2626; font-weight: 600; }
    .pm-form-footer { margin-top: 16px; display: flex; justify-content: flex-end; }

    /* monthly WO table */
    .monthly-wo-table { width:100%; border-collapse:collapse; font-size:0.84rem; }
    .monthly-wo-table th { padding:9px 14px; font-size:.73rem; text-transform:uppercase; font-weight:700;
      color:var(--text-secondary); background:var(--bg-secondary,#f9fafb);
      border-bottom:1px solid var(--border-color,#e5e7eb); white-space:nowrap; }
    .monthly-wo-table td { padding:10px 14px; border-bottom:1px solid var(--border-color,#f3f4f6); vertical-align:middle; }
    .monthly-wo-table tr:last-child td { border-bottom:none; }
    .seq-badge {
      display:inline-flex; align-items:center; justify-content:center;
      width:24px; height:24px; border-radius:50%;
      background:#2563eb; color:#fff; font-size:.72rem; font-weight:700;
    }
    .pm-btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 20px; border-radius: 8px;
      background: #16a34a; color: #fff;
      border: none; cursor: pointer; font-weight: 600; font-size: 0.86rem;
      transition: background .15s;
    }
    .pm-btn-primary:hover { background: #15803d; }
    .pm-badge-count {
      background: var(--bg-secondary, #f3f4f6);
      padding: 2px 10px; border-radius: 999px;
      font-size: 0.78rem; font-weight: 700;
    }
    .jadwal-interval {
      display: inline-block; padding: 2px 9px;
      border-radius: 999px; font-size: 0.73rem; font-weight: 700;
      background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;
    }
    .jadwal-status-aktif  { color: #16a34a; font-size: 0.78rem; font-weight: 600; }
    .jadwal-status-overdue{ color: #dc2626; font-size: 0.78rem; font-weight: 600; }
    .jadwal-status-nonaktif{ color: #6b7280; font-size: 0.78rem; font-weight: 600; }

    /* ── Modal ploting ── */
    .tech-list { display:flex; flex-direction:column; gap:8px; max-height:290px; overflow-y:auto; }
    .tech-item {
      display:flex; align-items:center; gap:12px;
      padding: 10px 14px; border-radius: 10px;
      border: 1.5px solid var(--border-color, #e5e7eb);
      cursor: pointer; transition: all .14s; user-select:none;
    }
    .tech-item:hover  { background: #f0f9ff; border-color: #93c5fd; }
    .tech-item.sel    { background: #eff6ff; border-color: #2563eb; }
    .tech-ava {
      width:38px; height:38px; border-radius:50%; flex-shrink:0;
      background: linear-gradient(135deg,#2563eb,#7c3aed);
      display:flex; align-items:center; justify-content:center;
      color:#fff; font-weight:700; font-size:.92rem;
    }
    .tech-nm  { font-weight:600; font-size:.88rem; }
    .tech-rl  { font-size:.74rem; color:var(--text-secondary); }
  `;
  document.head.appendChild(s);
}

// ─── Load Data ────────────────────────────────────────────────────────────────

async function loadData() {
  try {
    const woOpts = {
      select: `*, equipment:equipment_id(namaEquipment, idAset, area, type, manuf, noInventory), assignee:profiles!assigned_to(full_name), inspector:profiles!inspector_id(full_name)`,
      filters: [{ column: 'type', value: 'preventive' }],
      order: { column: 'opened_at', ascending: false },
    };
    const pmOpts = {
      select: `*, equipment:equipment_id(namaEquipment, idAset, area), template:mds_template_id(name, interval_days)`,
      order: { column: 'sequence_no', ascending: true },
    };

    [allWOs, allPMs, equipmentList, templateList, technicianList] = await Promise.all([
      fetchAll('work_orders', woOpts),
      fetchAll('preventive_maintenance', pmOpts),
      fetchAll('equipment', { order: { column: 'noInventory', ascending: true } }),
      fetchAll('mds_templates', { order: { column: 'name', ascending: true } }),
      fetchAll('profiles', {
        filters: [{ column: 'role', value: 'technician' }],
        order: { column: 'full_name', ascending: true },
      }),
    ]);

    // Load semua wo_assignees sekaligus, build map: wo_id -> [name, ...]
    woAssigneesMap = {};
    try {
      const woIds = allWOs.map(w => w.id);
      if (woIds.length > 0) {
        const { data: assigneeRows } = await supabase
          .from('wo_assignees')
          .select('wo_id, profiles!wo_assignees_technician_id_fkey(full_name)')
          .in('wo_id', woIds);
        (assigneeRows || []).forEach(row => {
          if (!woAssigneesMap[row.wo_id]) woAssigneesMap[row.wo_id] = [];
          if (row.profiles?.full_name) woAssigneesMap[row.wo_id].push(row.profiles.full_name);
        });
      }
    } catch (_) { /* RLS belum aktif? abaikan dulu */ }

    populateFilterSelects();
    populateFormSelects();
    updateChipCounts();
    renderWoTable();
    renderJadwalTable();
    await renderMonthlyWoPreview();
  } catch (err) {
    console.error(err);
    showToast('Gagal memuat data PM', 'error');
  }
}

// ─── Populate selects ─────────────────────────────────────────────────────────

function populateFilterSelects() {
  const areas = [...new Set(allWOs.map(w => w.equipment?.area).filter(Boolean))].sort();
  const areaEl = document.getElementById('filter-area');
  if (areaEl) {
    areaEl.innerHTML = '<option value="">Semua Area</option>' +
      areas.map(a => `<option value="${a}">${escapeHtml(a)}</option>`).join('');
  }
}

function populateFormSelects() {
  if (currentProfile?.role !== 'admin') return;

  const eqEl = document.getElementById('sched-equip');
  if (eqEl) {
    // Filter: hanya equipment yang belum punya jadwal PM aktif
    const scheduledIds = allPMs
      .filter(p => p.status !== 'inactive')
      .map(p => p.equipment_id);

    eqEl.innerHTML = '<option value="">Pilih Equipment...</option>' +
      equipmentList
        .filter(e => !scheduledIds.includes(e.idAset))
        .map(e => {
          const noInv = e.noInventory || e.idAset || '-';
          const nm = e.namaEquipment || '-';
          const ar = e.area || '-';
          return `<option value="${e.idAset}" data-name="${escapeHtml(nm)}">${escapeHtml(noInv)} - ${escapeHtml(nm)} - ${escapeHtml(ar)}</option>`;
        })
        .join('');
  }
}

// Auto-isi template MDS berdasarkan nama equipment yang dipilih
function autoFillTemplateByEquipment(equipId) {
  const infoEl  = document.getElementById('sched-template-info');
  const hiddenEl = document.getElementById('sched-template-id');
  const freqEl  = document.getElementById('sched-freq');
  if (!infoEl) return;

  if (!equipId) {
    infoEl.innerHTML  = '<span class="pm-template-placeholder">— Pilih equipment dahulu —</span>';
    if (hiddenEl) hiddenEl.value = '';
    if (freqEl)  freqEl.value   = '';
    return;
  }

  // Cari nama equipment
  const eq = equipmentList.find(e => e.idAset === equipId);
  if (!eq) return;

  // Cari template yang namanya = namaEquipment
  const tpl = templateList.find(t => t.name === eq.namaEquipment);

  if (tpl) {
    infoEl.innerHTML   = `<span class="pm-template-found">✓ ${escapeHtml(tpl.name)} (${tpl.interval_days} hari)</span>`;
    if (hiddenEl) hiddenEl.value = tpl.id;
    if (freqEl)  freqEl.value   = tpl.interval_days;
  } else {
    infoEl.innerHTML   = `<span class="pm-template-missing">⚠ Belum ada template MDS untuk equipment ini.<br><small>Buat dulu di menu Master Template MDS.</small></span>`;
    if (hiddenEl) hiddenEl.value = '';
    if (freqEl)  freqEl.value   = '';
  }
}

// ─── Chip counts ──────────────────────────────────────────────────────────────

function updateChipCounts() {
  let gen = 0, dip = 0, app = 0, cls = 0, ovd = 0;
  for (const wo of allWOs) {
    if (isOverdue(wo))                   { ovd++; continue; }
    if (wo.status === 'generated')         gen++;
    else if (wo.status === 'diploting')    dip++;
    else if (wo.status === 'menunggu_approval') app++;
    else if (wo.status === 'closed')       cls++;
  }
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('cnt-generated', gen);
  set('cnt-diploting',  dip);
  set('cnt-approval',   app);
  set('cnt-closed',     cls);
  set('cnt-overdue',    ovd);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOverdue(wo) {
  if (wo.status === 'closed') return false;
  const due = wo.opened_at || wo.plan_start;
  return due ? new Date(due) < new Date(new Date().toDateString()) : false;
}

function intervalLabel(days) {
  if (!days) return '-';
  const map = { 30:'1 bulan', 31:'1 bulan', 60:'2 bulan', 61:'2 bulan',
                90:'3 bulan', 180:'6 bulan', 365:'1 tahun', 366:'1 tahun' };
  return map[days] || `${days} hari`;
}

function statusBadge(status) {
  const conf = {
    generated:         { label: 'Generated',         color: '#92400e', bg: '#fef3c7' },
    diploting:         { label: 'Diploting',          color: '#1e40af', bg: '#dbeafe' },
    menunggu_approval: { label: 'Menunggu Approval',  color: '#6d28d9', bg: '#ede9fe' },
    revisi:            { label: 'Revisi',             color: '#dc2626', bg: '#fee2e2' },
    closed:            { label: 'Closed',             color: '#166534', bg: '#dcfce7' },
    overdue:           { label: 'Overdue',            color: '#fff',    bg: '#ef4444' },
  };
  const c = conf[status] || { label: status, color: '#374151', bg: '#f3f4f6' };
  return `<span class="wo-status-badge" style="color:${c.color};background:${c.bg};">${c.label}</span>`;
}

// ─── Render WO Table ──────────────────────────────────────────────────────────

function renderWoTable() {
  const wrapper = document.getElementById('pm-wo-table-wrapper');
  if (!wrapper) return;
  const isAdmin = currentProfile?.role === 'admin';

  const areaFilter     = document.getElementById('filter-area')?.value     || '';
  const intervalFilter = document.getElementById('filter-interval')?.value || '';
  const monthFilter    = document.getElementById('filter-month')?.value    || '';

  const data = allWOs.filter(wo => {
    const eff = isOverdue(wo) ? 'overdue' : wo.status;
    if (activeChip && eff !== activeChip) return false;

    if (searchQuery) {
      const hay = `${wo.wo_number} ${wo.equipment?.namaEquipment} ${wo.equipment?.idAset} ${wo.equipment?.area}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }

    if (areaFilter && wo.equipment?.area !== areaFilter) return false;

    if (intervalFilter) {
      const pmSched = allPMs.find(p => p.equipment_id === wo.equipment_id);
      if (String(pmSched?.interval_days) !== intervalFilter) return false;
    }
    
    if (monthFilter) {
      const woDate = new Date(wo.opened_at || wo.plan_start);
      if (!isNaN(woDate) && (woDate.getMonth() + 1).toString() !== monthFilter) return false;
    }

    return true;
  });

  if (data.length === 0) {
    wrapper.innerHTML = `
      <div class="pm-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" display="block" margin="0 auto">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
        </svg>
        <p>Tidak ada Work Order PM di kategori ini</p>
      </div>`;
    return;
  }

  wrapper.innerHTML = `
    <div style="overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th>No WO</th>
            <th>Equipment</th>
            <th>Area</th>
            <th>Interval</th>
            <th>Next plan</th>
            <th>Teknisi</th>
            <th>Inspector</th>
            <th>Status</th>
            ${isAdmin ? '<th></th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${data.map(wo => renderWoRow(wo, isAdmin)).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (isAdmin) {
    wrapper.querySelectorAll('[data-plot]').forEach(btn =>
      btn.addEventListener('click', () => {
        const wo = allWOs.find(w => w.id === btn.dataset.plot);
        if (wo) showPlotingModal(wo, false);
      })
    );
    wrapper.querySelectorAll('[data-reassign]').forEach(btn =>
      btn.addEventListener('click', () => {
        const wo = allWOs.find(w => w.id === btn.dataset.reassign);
        if (wo) showPlotingModal(wo, true);
      })
    );
    wrapper.querySelectorAll('[data-delete-wo]').forEach(btn =>
      btn.addEventListener('click', () => {
        const wo = allWOs.find(w => w.id === btn.dataset.deleteWo);
        if (wo) showConfirmDeleteWo(wo);
      })
    );
  }
  // Print PDF — semua role bisa print WO closed
  wrapper.querySelectorAll('[data-print-pdf]').forEach(btn =>
    btn.addEventListener('click', () => {
      const wo = allWOs.find(w => w.id === btn.dataset.printPdf);
      if (wo) printWoPdf(wo);
    })
  );
}

function renderWoRow(wo, isAdmin) {
  const effStatus = isOverdue(wo) ? 'overdue' : wo.status;
  const rowCls    = effStatus === 'overdue' ? 'wo-overdue-row' : '';

  const eqName = escapeHtml(wo.equipment?.namaEquipment || wo.equipment_id || '-');
  const area   = escapeHtml(wo.equipment?.area || '-');

  const pmSched  = allPMs.find(p => p.equipment_id === wo.equipment_id);
  const interval = intervalLabel(pmSched?.interval_days);
  const nextPlan = formatDate(wo.opened_at || wo.plan_start || pmSched?.next_due);

  // Tampilkan semua nama tim dari wo_assignees, fallback ke assignee.full_name
  const teamNames = woAssigneesMap[wo.id];
  let techHtml;
  if (teamNames && teamNames.length > 0) {
    techHtml = teamNames.map(n => escapeHtml(n)).join(', ');
  } else if (wo.assignee?.full_name) {
    techHtml = escapeHtml(wo.assignee.full_name);
  } else if (wo.assigned_to) {
    const t = technicianList.find(x => x.id === wo.assigned_to);
    techHtml = t ? escapeHtml(t.full_name) : `<span class="tech-none">Belum ditugaskan</span>`;
  } else {
    techHtml = `<span class="tech-none">Belum ditugaskan</span>`;
  }

  const inspectorHtml = wo.inspector?.full_name
    ? escapeHtml(wo.inspector.full_name)
    : `<span class="tech-none">—</span>`;

  let aksiHtml = '';
  if (isAdmin) {
    if (wo.status === 'generated') {
      aksiHtml = `<button class="btn-ploting-row" data-plot="${wo.id}">Ploting</button>`;
    } else if (wo.status === 'diploting' || wo.status === 'revisi') {
      aksiHtml = `<button class="btn-reassign-row" data-reassign="${wo.id}">Reassign</button>`;
    }
    // Tampilkan tombol hapus untuk semua status WO PM jika admin
    aksiHtml += `
      <button class="btn btn-outline-danger btn-sm btn-icon" data-delete-wo="${wo.id}" title="Hapus WO" style="padding:4px 6px;margin-left:4px;">
        ${icons.trash}
      </button>`;
  }
  // Tombol Print PDF tersedia untuk WO closed
  const printBtn = wo.status === 'closed'
    ? `<button class="btn-print-pdf" data-print-pdf="${wo.id}" title="Print PDF Checklist">🖨 PDF</button>`
    : '';

  return `
    <tr class="${rowCls}">
      <td><span class="wo-num">${escapeHtml(wo.wo_number || '-')}</span></td>
      <td>
        <div class="wo-equip-name">${eqName}</div>
      </td>
      <td>${area}</td>
      <td><span class="interval-badge">${interval}</span></td>
      <td style="white-space:nowrap;">${nextPlan}</td>
      <td>${techHtml}</td>
      <td style="font-size:.83rem;">${inspectorHtml}</td>
      <td>${statusBadge(effStatus)}</td>
      <td style="white-space:nowrap;">${isAdmin ? aksiHtml : ''} ${printBtn}</td>
    </tr>
  `;
}

// ─── Print PDF Checklist ──────────────────────────────────────────────────────

async function printWoPdf(wo) {
  showToast('Memuat data checklist...', 'info');

  try {
    const templateId = wo.mds_template_id;

    // Fetch checklist results
    const { data: results } = await supabase
      .from('wo_checklist_results')
      .select('*, template_item:mds_template_items(activity_title, section, order_idx)')
      .eq('wo_id', wo.id)
      .order('created_at', { ascending: true });

    // Fetch template info
    let template = null;
    let templateItems = [];
    if (templateId) {
      const { data: tplData } = await supabase
        .from('mds_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      template = tplData;

      const { data: tItems } = await supabase
        .from('mds_template_items')
        .select('*')
        .eq('template_id', templateId)
        .order('order_idx', { ascending: true });
      templateItems = tItems || [];
    }

    // Fetch technician + inspector profiles
    let techProfiles = [];
    let inspProfile = null;
    
    // Ambil semua teknisi dari wo_assignees
    const { data: assignees } = await supabase
      .from('wo_assignees')
      .select('technician_id, profiles!wo_assignees_technician_id_fkey(full_name, employee_id)')
      .eq('wo_id', wo.id);
      
    if (assignees && assignees.length > 0) {
      techProfiles = assignees.map(a => a.profiles);
    } else if (wo.assigned_to) {
      const { data: tp } = await supabase.from('profiles').select('full_name, employee_id').eq('id', wo.assigned_to).single();
      if (tp) techProfiles.push(tp);
    }

    if (wo.inspector_id) {
      const { data: ip } = await supabase.from('profiles').select('full_name, employee_id').eq('id', wo.inspector_id).single();
      inspProfile = ip;
    }

    // Merge: map results by template_item_id
    const resultMap = {};
    (results || []).forEach(r => { if (r.template_item_id) resultMap[r.template_item_id] = r; });

    // Group items by section (preserve order)
    const sectionsOrdered = [];
    const sectionMap = {};
    templateItems.forEach(item => {
      const sec = item.section || 'General';
      if (!sectionMap[sec]) {
        sectionMap[sec] = [];
        sectionsOrdered.push(sec);
      }
      sectionMap[sec].push(item);
    });

    const pmSched    = allPMs.find(p => p.equipment_id === wo.equipment_id);
    const eqName     = wo.equipment?.namaEquipment || wo.equipment_id || '-';
    const area       = wo.equipment?.area || '-';
    const techName   = techProfiles.length > 0 ? techProfiles.map(t => t.full_name).join(', ') : (wo.assignee?.full_name || '-');
    const inspName   = inspProfile?.full_name || wo.inspector?.full_name || '-';
    const inspEmpId  = inspProfile?.employee_id || '-';
    const interval   = intervalLabel(pmSched?.interval_days);
    const formNo     = template?.form_number || '-';
    const revision   = template?.revision || '0';
    const mdsNo      = formNo;
    const reference  = formNo;
    const completionDate = wo.approved_at
      ? new Date(wo.approved_at).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })
      : wo.closed_at
        ? new Date(wo.closed_at).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })
        : '-';

    // Build activity rows
    let activityRowsHtml = '';
    let allPass = true;
    let sectionIdx = 0;
    
    for (const secName of sectionsOrdered) {
      sectionIdx++;
      const items = sectionMap[secName];
      
      // Section header row
      activityRowsHtml += `
        <tr class="section-row">
          <td class="cell-center">${sectionIdx}</td>
          <td colspan="4" class="section-title">${escapeHtml(secName)}</td>
        </tr>`;
      
      items.forEach((item, subIdx) => {
        const r = resultMap[item.id];
        const result  = r?.result || '';
        const isPass  = result === 'Pass';
        const isFail  = result === 'Failed';
        if (isFail) allPass = false;
        
        // Buat box untuk nilai jika item membutuhkan input (seperti Temperatur, Humidity)
        let inputBoxHtml = '';
        if (item.needs_input) {
          const val = (r?.measurement_value !== undefined && r?.measurement_value !== null) ? r.measurement_value : '&nbsp;&nbsp;&nbsp;&nbsp;';
          inputBoxHtml = `<div style="display:inline-block; border:1px solid #111; padding:2px 8px; min-width:35px; text-align:center; margin-left:10px; font-weight:bold;">${val}</div> <span style="font-size:9px;">${escapeHtml(item.expected_unit || '')}</span>`;
        }

        activityRowsHtml += `
          <tr>
            <td class="cell-center"></td>
            <td class="cell-activity">
              ${String.fromCharCode(97 + subIdx)}. ${escapeHtml(item.activity_title)}
              ${inputBoxHtml}
              ${item.description ? `<br><small class="desc">${escapeHtml(item.description)}</small>` : ''}
            </td>
            <td class="cell-center">${isPass ? '✓' : ''}</td>
            <td class="cell-center">${isFail ? '✗' : ''}</td>
          </tr>`;
      });
    }

    // Generate sign boxes html (QR Code)
    const woNum = wo.wo_number || '-';
    let signBoxesHtml = '';
    techProfiles.forEach(tp => {
      const tName = tp?.full_name || '-';
      const tEmp  = tp?.employee_id || '-';
      const qrData = `TEKNISI\nNama: ${tName}\nNoPeg: ${tEmp}`;
      signBoxesHtml += `
          <div class="sign-box">
            <div class="sign-label">Teknisi</div>
            <div class="barcode-area">
              <div data-qrcode="${escapeHtml(qrData)}" style="display:flex;justify-content:center;"></div>
              <div class="sign-name">${escapeHtml(tName)}</div>
              <div class="sign-empid">NoPeg: ${escapeHtml(tEmp)}</div>
            </div>
          </div>
      `;
    });
    // Fallback jika tidak ada teknisi
    if (techProfiles.length === 0) {
      signBoxesHtml += `
          <div class="sign-box">
            <div class="sign-label">Teknisi</div>
            <div class="barcode-area">
              <div data-qrcode="-"></div>
              <div class="sign-name">-</div>
              <div class="sign-empid">NoPeg: -</div>
            </div>
          </div>
      `;
    }

    const inspQrData = `INSPECTOR\nNama: ${inspName}\nNoPeg: ${inspEmpId}`;
    signBoxesHtml += `
          <div class="sign-box">
            <div class="sign-label">Inspector / Approver</div>
            <div class="barcode-area">
              <div data-qrcode="${escapeHtml(inspQrData)}" style="display:flex;justify-content:center;"></div>
              <div class="sign-name">${escapeHtml(inspName)}</div>
              <div class="sign-empid">NoPeg: ${escapeHtml(inspEmpId)}</div>
            </div>
          </div>
    `;

    const printHtml = `
      <!DOCTYPE html><html lang="id"><head>
        <meta charset="UTF-8">
        <title>MD Sheet — ${escapeHtml(wo.wo_number)}</title>
        <style>
          @page { margin: 12mm 10mm; size: A4; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; }

          /* ── MDS Header ── */
          .mds-header {
            display: flex; align-items: center; border: 2px solid #111;
            margin-bottom: 0;
          }
          .mds-logo {
            width: 140px; padding: 8px 12px; border-right: 2px solid #111;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
          }
          .mds-logo .logo-text { font-weight: 900; font-size: 14px; color: #1e3a5f; }
          .mds-logo .logo-sub  { font-size: 7px; color: #6b7280; text-align: center; }
          .mds-title-cell {
            flex: 1; text-align: center; padding: 10px;
            font-size: 24px; font-weight: 900; letter-spacing: 2px;
          }

          /* ── Meta Grid ── */
          .meta-table { width: 100%; border-collapse: collapse; border: 2px solid #111; border-top: none; }
          .meta-table td { padding: 3px 8px; font-size: 10.5px; border-bottom: 1px solid #ccc; }
          .meta-table td.label { font-weight: 600; width: 130px; }
          .meta-table td.sep   { width: 10px; text-align: center; }
          .meta-table td.val   { min-width: 130px; }

          /* ── Description ── */
          .desc-block { border: 2px solid #111; border-top: none; padding: 6px 10px; font-size: 10.5px; }
          .desc-block b { font-weight: 700; }

          /* ── Activity Table ── */
          .activity-table { width: 100%; border-collapse: collapse; border: 2px solid #111; border-top: none; margin-bottom: 0; }
          .activity-table th, .activity-table td { border: 1px solid #111; padding: 5px 6px; font-size: 10.5px; }
          .activity-table thead th { background: #f3f4f6; font-weight: 700; text-align: center; font-size: 10px; text-transform: uppercase; }
          .cell-center  { text-align: center; vertical-align: middle; width: 50px; }
          .cell-activity { vertical-align: top; }
          .cell-sign { width: 60px; text-align: center; }
          .section-row td { background: #f9fafb; }
          .section-title  { font-weight: 700; font-size: 11px; }
          .desc { color: #6b7280; font-size: 9.5px; }

          /* ── Footer / Signature ── */
          .completion-bar {
            border: 2px solid #111; border-top: none; padding: 6px 10px;
            font-size: 11px; font-weight: 700; text-align: center;
          }
          .sign-area {
            border: 2px solid #111; border-top: none;
            display: flex;
          }
          .sign-box {
            flex: 1; text-align: center; padding: 10px 8px;
            border-right: 1px solid #111;
          }
          .sign-box:last-child { border-right: none; }
          .sign-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #374151; margin-bottom: 6px; }
          .barcode-area { min-height: 90px; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 4px; padding: 4px 0; }
          .sign-name { font-weight: 700; font-size: 11px; margin-top: 4px; }
          .sign-empid { font-size: 9px; color: #6b7280; }

          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        <script>
          // QR Code dynamic generator - render on load
          window.addEventListener('load', () => {
            document.querySelectorAll('[data-qrcode]').forEach(el => {
              const text = el.getAttribute('data-qrcode');
              if (text && text !== '-') {
                el.innerHTML = '';
                try {
                  new QRCode(el, {
                    text: text,
                    width: 72,
                    height: 72,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                  });
                } catch(e) {
                  el.innerHTML = '<div style="font-size:9px;color:#999;">QR Error</div>';
                }
              } else {
                el.innerHTML = '<div style="width:72px;height:72px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:9px;color:#ccc;">-</div>';
              }
            });
          });
        </script>
      </head><body>
        <!-- ══ MDS HEADER ══ -->
        <div class="mds-header">
          <div class="mds-logo">
            <div class="logo-text">GMF AeroAsia</div>
            <div class="logo-sub">GARUDA INDONESIA GROUP</div>
          </div>
          <div class="mds-title-cell">MD SHEET</div>
        </div>

        <!-- ══ META INFO ══ -->
        <table class="meta-table">
          <tr>
            <td class="label">Equipment Name</td><td class="sep">:</td><td class="val">${escapeHtml(eqName)}</td>
            <td class="label">Job Description</td><td class="sep">:</td><td class="val">Industrial</td>
          </tr>
          <tr>
            <td class="label">Inventory No.</td><td class="sep">:</td><td class="val">${escapeHtml(wo.equipment?.noInventory || wo.equipment?.idAset || '-')}</td>
            <td class="label">MD Sheet No.</td><td class="sep">:</td><td class="val">${escapeHtml(mdsNo)}</td>
          </tr>
          <tr>
            <td class="label">Type / Model</td><td class="sep">:</td><td class="val">${escapeHtml(wo.equipment?.type || '-')}</td>
            <td class="label">Periode</td><td class="sep">:</td><td class="val">${interval}</td>
          </tr>
          <tr>
            <td class="label">Manufacture /Vendor</td><td class="sep">:</td><td class="val">${escapeHtml(wo.equipment?.manuf || '-')}</td>
            <td class="label">Reference</td><td class="sep">:</td><td class="val">${escapeHtml(reference)}</td>
          </tr>
          <tr>
            <td class="label">Location</td><td class="sep">:</td><td class="val">${escapeHtml(area)}</td>
            <td class="label">WO. Number</td><td class="sep">:</td><td class="val">${escapeHtml(wo.wo_number || '-')}</td>
          </tr>
        </table>

        <!-- ══ DESCRIPTION ══ -->
        <div class="desc-block">
          <b>Deskripsi jenis pekerjaan :</b><br>
          Melakukan inspeksi dan minor cleaning pada unit ${escapeHtml(eqName)}
        </div>

        <!-- ══ ACTIVITY TABLE ══ -->
        <table class="activity-table">
          <thead>
            <tr>
              <th rowspan="2" style="width:40px;">NO</th>
              <th rowspan="2">Activity</th>
              <th colspan="2">RESULT</th>
            </tr>
            <tr>
              <th style="width:50px;">PASS</th>
              <th style="width:50px;">FAILED</th>
            </tr>
          </thead>
          <tbody>
            ${activityRowsHtml}
            ${templateItems.length === 0 ? '<tr><td colspan="4" style="text-align:center;padding:20px;color:#999;">Tidak ada data checklist</td></tr>' : ''}
          </tbody>
        </table>

        <!-- ══ DATE OF COMPLETION ══ -->
        <div class="completion-bar">
          Date Of Complisement : ${completionDate}
        </div>

        <!-- ══ DIGITAL SIGNATURE ══ -->
        <div class="sign-area">
          ${signBoxesHtml}
          <div class="sign-box">
            <div class="sign-label">Kepala Pemeliharaan</div>
            <div class="barcode-area">
              <div style="min-height:30px;"></div>
              <div class="sign-name">&nbsp;</div>
            </div>
          </div>
        </div>

      </body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(printHtml);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 800);
  } catch (err) {
    console.error(err);
    showToast('Gagal generate PDF: ' + (err.message || ''), 'error');
  }
}
// ─── Render Jadwal Table ──────────────────────────────────────────────────────

function renderJadwalTable() {
  const wrapper = document.getElementById('jadwal-table-wrapper');
  const cntEl   = document.getElementById('jadwal-count');
  if (!wrapper) return;
  if (cntEl) cntEl.textContent = allPMs.length;
  const isAdmin = currentProfile?.role === 'admin';

  if (allPMs.length === 0) {
    wrapper.innerHTML = `
      <div class="pm-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p>Belum ada jadwal PM. ${isAdmin ? 'Tambahkan di atas.' : ''}</p>
      </div>`;
    return;
  }

  const today = new Date().toDateString();

  // Urutkan berdasarkan sequence_no
  const sortedPMs = [...allPMs].sort((a, b) => (a.sequence_no || 0) - (b.sequence_no || 0));

  wrapper.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="table table-hover mb-0" style="font-size:0.85rem;">
        <thead style="background:var(--bg-secondary,#f9fafb);">
          <tr>
            <th style="padding:11px 16px;font-size:.75rem;text-transform:uppercase;font-weight:700;color:var(--text-secondary);">#</th>
            <th style="padding:11px 16px;font-size:.75rem;text-transform:uppercase;font-weight:700;color:var(--text-secondary);">Equipment</th>
            <th style="padding:11px 16px;font-size:.75rem;text-transform:uppercase;font-weight:700;color:var(--text-secondary);">Area</th>
            <th style="padding:11px 16px;font-size:.75rem;text-transform:uppercase;font-weight:700;color:var(--text-secondary);">Template MDS</th>
            <th style="padding:11px 16px;font-size:.75rem;text-transform:uppercase;font-weight:700;color:var(--text-secondary);">Interval</th>
            <th style="padding:11px 16px;font-size:.75rem;text-transform:uppercase;font-weight:700;color:var(--text-secondary);">Plan Start</th>
            <th style="padding:11px 16px;font-size:.75rem;text-transform:uppercase;font-weight:700;color:var(--text-secondary);">Next Plan</th>
            <th style="padding:11px 16px;font-size:.75rem;text-transform:uppercase;font-weight:700;color:var(--text-secondary);">Status</th>
            ${isAdmin ? '<th style="padding:11px 16px;"></th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${sortedPMs.map(pm => {
            const eqName  = escapeHtml(pm.equipment?.namaEquipment || pm.equipment_id || '-');
            const area    = escapeHtml(pm.equipment?.area || '-');
            const tpl     = escapeHtml(pm.template?.name || '-');
            const intv    = intervalLabel(pm.interval_days);
            const seqNo   = pm.sequence_no || '-';
            const isOD    = pm.next_due && new Date(pm.next_due) < new Date(today) && pm.status !== 'inactive';
            const statusHtml = pm.status === 'inactive'
              ? `<span class="jadwal-status-nonaktif">Nonaktif</span>`
              : isOD
                ? `<span class="jadwal-status-overdue">⚠ Overdue</span>`
                : `<span class="jadwal-status-aktif">● Aktif</span>`;

            return `
              <tr>
                <td style="padding:12px 16px;text-align:center;">
                  <span class="seq-badge">${seqNo}</span>
                </td>
                <td style="padding:12px 16px;">
                  <div style="font-weight:600;font-size:.88rem;">${eqName}</div>
                  <div style="font-size:.73rem;color:var(--text-secondary);">${escapeHtml(pm.equipment_id || '')}</div>
                </td>
                <td style="padding:12px 16px;">${area}</td>
                <td style="padding:12px 16px;"><small>${tpl}</small></td>
                <td style="padding:12px 16px;"><span class="jadwal-interval">${intv}</span></td>
                <td style="padding:12px 16px;white-space:nowrap;">${formatDate(pm.plan_start)}</td>
                <td style="padding:12px 16px;white-space:nowrap;">${formatDate(pm.next_due)}</td>
                <td style="padding:12px 16px;">${statusHtml}</td>
                ${isAdmin ? `
                  <td style="padding:12px 16px;">
                    <button class="btn btn-outline-danger btn-sm btn-icon" data-delete-pm="${pm.id}" title="Hapus">
                      ${icons.trash}
                    </button>
                  </td>` : ''}
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (isAdmin) {
    wrapper.querySelectorAll('[data-delete-pm]').forEach(btn =>
      btn.addEventListener('click', () => {
        const pm = allPMs.find(p => p.id === btn.dataset.deletePm);
        if (!pm) return;
        showConfirm({
          message: `Hapus jadwal PM untuk "${pm.equipment?.namaEquipment || pm.equipment_id}"?`,
          onConfirm: async () => {
            try {
              await deleteRow('preventive_maintenance', pm.id);
              showToast('Jadwal PM dihapus', 'success');
              await loadData();
            } catch (_) { showToast('Gagal menghapus', 'error'); }
          }
        });
      })
    );
  }
}

function showConfirmDeleteWo(wo) {
  showConfirm({
    message: `Hapus Work Order PM "${wo.wo_number}"?`,
    confirmText: 'Hapus',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await deleteRow('work_orders', wo.id);
        showToast('Work Order dihapus', 'success');
        await loadData();
      } catch (err) {
        showToast('Gagal menghapus WO', 'error');
      }
    }
  });
}

// ─── Render Preview WO Bulanan ────────────────────────────────────────────────

async function renderMonthlyWoPreview() {
  const wrapper  = document.getElementById('monthly-wo-wrapper');
  const countEl  = document.getElementById('monthly-wo-count');
  if (!wrapper) return;

  try {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;

    // Ambil semua WO PM di bulan ini
    const monthStart = `${year}-${String(month).padStart(2,'0')}-01`;
    const monthEnd   = new Date(year, month, 0).toISOString().split('T')[0]; // last day of month

    const { data: monthlyWOs, error } = await supabase
      .from('work_orders')
      .select(`
        id, wo_number, status, opened_at,
        equipment:equipment_id(namaEquipment, idAset, area),
        pm:pm_id(sequence_no, interval_days, mds_template_id)
      `)
      .eq('type', 'preventive')
      .gte('opened_at', monthStart)
      .lte('opened_at', monthEnd + 'T23:59:59')
      .order('opened_at', { ascending: true });

    if (error) throw error;

    const wos = monthlyWOs || [];
    if (countEl) countEl.textContent = wos.length;

    if (wos.length === 0) {
      wrapper.innerHTML = `
        <div class="pm-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p>Belum ada Work Order PM di bulan ${now.toLocaleString('id-ID', { month: 'long' })} ${year}.</p>
        </div>`;
      return;
    }

    const bulanLabel = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

    wrapper.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="monthly-wo-table">
          <thead>
            <tr>
              <th>#</th>
              <th>No WO</th>
              <th>Equipment</th>
              <th>Area</th>
              <th>Tanggal WO</th>
              <th>Status</th>
              ${currentProfile?.role === 'admin' ? '<th></th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${wos.map((wo, idx) => {
              const eqName   = escapeHtml(wo.equipment?.namaEquipment || wo.equipment_id || '-');
              const area     = escapeHtml(wo.equipment?.area || '-');
              const seqNo    = wo.pm?.sequence_no || (idx + 1);
              const woDate   = formatDate(wo.opened_at);
              const effStatus = isOverdue(wo) ? 'overdue' : wo.status;
              return `
                <tr>
                  <td><span class="seq-badge">${seqNo}</span></td>
                  <td><span class="wo-num">${escapeHtml(wo.wo_number || '-')}</span></td>
                  <td>
                    <div class="wo-equip-name">${eqName}</div>
                    <div class="wo-equip-sub">${escapeHtml(wo.equipment?.idAset || '')}</div>
                  </td>
                  <td>${area}</td>
                  <td style="white-space:nowrap;">${woDate}</td>
                  <td>${statusBadge(effStatus)}</td>
                  ${currentProfile?.role === 'admin' ? `
                  <td style="text-align:right;">
                    ${wo.status === 'generated' ? `
                      <button class="btn btn-outline-danger btn-sm btn-icon" data-delete-wo="${wo.id}" title="Hapus WO" style="padding:4px 6px;">
                        ${icons.trash}
                      </button>
                    ` : ''}
                  </td>` : ''}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (currentProfile?.role === 'admin') {
      wrapper.querySelectorAll('[data-delete-wo]').forEach(btn =>
        btn.addEventListener('click', () => {
          const wo = monthlyWOs.find(w => w.id === btn.dataset.deleteWo);
          if (wo) showConfirmDeleteWo(wo);
        })
      );
    }
  } catch (err) {
    console.error('Monthly WO preview error:', err);
    if (wrapper) wrapper.innerHTML = `<div class="pm-empty-state"><p class="text-danger">Gagal memuat data WO bulanan.</p></div>`;
  }
}

// ─── Save Jadwal ──────────────────────────────────────────────────────────────

async function saveJadwal() {
  const equipId    = document.getElementById('sched-equip')?.value;
  const templateId = document.getElementById('sched-template-id')?.value;
  const freq       = parseInt(document.getElementById('sched-freq')?.value) || 30;
  const planStart  = document.getElementById('sched-start')?.value;
  
  const eqIndex = equipmentList.findIndex(e => e.idAset === equipId);
  const seqNo = eqIndex !== -1 ? eqIndex + 1 : 0;

  if (!equipId)    { showToast('Pilih equipment',                       'warning'); return; }
  if (!templateId) { showToast('Template MDS belum ditemukan. Buat dulu di Master Template MDS.', 'warning'); return; }
  if (!planStart)  { showToast('Isi Plan Start',                        'warning'); return; }

  const existing = allPMs.find(p => p.equipment_id === equipId && p.status !== 'inactive');
  if (existing)    { showToast('Equipment ini sudah memiliki jadwal PM aktif', 'warning'); return; }

  const btn = document.getElementById('btn-save-jadwal');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  try {
    await insertRow('preventive_maintenance', {
      title: 'PREVENTIVE', equipment_id: equipId,
      mds_template_id: templateId, interval_days: freq,
      plan_start: planStart, next_due: planStart,
      sequence_no: seqNo,
      status: 'scheduled', description: '',
    });

    // Generate WO untuk bulan sesuai plan_start
    try {
      const pDate = new Date(planStart);
      await supabase.rpc('generate_yearly_pm_work_orders', {
          p_year:  pDate.getFullYear()
        });
    } catch (genErr) {
      console.warn('Generate monthly WO error (non-fatal):', genErr);
    }

    showToast('Jadwal PM berhasil disimpan & plan WO 1 tahun di-generate!', 'success');

    // Reset form
    ['sched-equip', 'sched-start'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('sched-freq').value = '';
    document.getElementById('sched-template-id').value = '';
    const infoEl = document.getElementById('sched-template-info');
    if (infoEl) infoEl.innerHTML = '<span class="pm-template-placeholder">— Pilih equipment dahulu —</span>';

    await loadData();
  } catch (err) {
    showToast('Gagal: ' + (err.message || ''), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${icons.plus || '+'} Simpan Jadwal`;
  }
}

// ─── Generate WO ─────────────────────────────────────────────────────────────

async function handleGenerateWO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthName = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  showConfirm({
    title: 'Generate Work Order PM',
    message: `Generate plan Work Order PM untuk 1 tahun ke depan (${year})?`,
    confirmText: 'Generate',
    confirmClass: 'btn-primary',
    onConfirm: async () => {
      const btn = document.getElementById('btn-generate-wo');
      if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }
      try {
        const { error } = await supabase.rpc('generate_yearly_pm_work_orders', {
            p_year: year
          });
        if (error) throw error;
        showToast('Work Order 1 tahun berhasil di-generate!', 'success');
        await loadData();
      } catch (err) {
        showToast('Gagal: ' + (err.message || ''), 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = `${icons.plus || '+'} Generate WO 1 Tahun`; }
      }
    }
  });
}

// ─── Modal Ploting ────────────────────────────────────────────────────────────

async function showPlotingModal(wo, isReassign) {
  const eqName     = wo.equipment?.namaEquipment || wo.equipment_id || '-';
  const pmSched    = allPMs.find(p => p.equipment_id === wo.equipment_id);
  const interval   = intervalLabel(pmSched?.interval_days);

  // Saat Reassign: load semua teknisi yang sudah di-assign dari wo_assignees
  let selectedIds = [];
  if (isReassign) {
    try {
      const { data: rows } = await supabase
        .from('wo_assignees')
        .select('technician_id')
        .eq('wo_id', wo.id);
      if (rows && rows.length > 0) {
        selectedIds = rows.map(r => r.technician_id);
      } else {
        // fallback ke assigned_to jika tabel kosong
        if (wo.assigned_to) selectedIds = [wo.assigned_to];
      }
    } catch (_) {
      if (wo.assigned_to) selectedIds = [wo.assigned_to];
    }
  } else {
    selectedIds = wo.assigned_to ? [wo.assigned_to] : [];
  }

  const techHtml = technicianList.length === 0
    ? `<p style="text-align:center;color:var(--text-secondary);padding:20px 0;">Belum ada teknisi</p>`
    : `<div class="tech-list">
        ${technicianList.map(t => {
          const ini = (t.full_name || 'T').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
          const sel = selectedIds.includes(t.id);
          return `
            <div class="tech-item ${sel ? 'sel' : ''}" data-tid="${t.id}">
              <div class="tech-ava">${ini}</div>
              <div style="flex:1;">
                <div class="tech-nm">${escapeHtml(t.full_name)}</div>
                <div class="tech-rl">Teknisi</div>
              </div>
              <input type="checkbox" class="form-check-input" ${sel ? 'checked' : ''}
                style="width:18px;height:18px;pointer-events:none;" />
            </div>`;
        }).join('')}
      </div>`;

  showModal({
    title: isReassign ? 'Reassign Teknisi' : 'Ploting Teknisi',
    size: 'modal-md',
    body: `
      <div style="background:var(--bg-secondary,#f9fafb);border-radius:8px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:.73rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:2px;">Work Order</div>
        <div style="font-family:'Courier New',monospace;font-weight:700;font-size:1.05rem;">${escapeHtml(wo.wo_number || '-')}</div>
        <div style="font-size:.85rem;color:var(--text-secondary);margin-top:2px;">
          ${escapeHtml(eqName)} &nbsp;·&nbsp; <span class="interval-badge" style="font-size:.7rem;">${interval}</span>
        </div>
      </div>
      <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:8px;">
        Pilih Teknisi <span style="font-weight:400;">(bisa lebih dari 1)</span>
      </div>
      ${techHtml}
      <div id="plot-info" style="margin-top:10px;font-size:.82rem;color:var(--text-secondary);">
        ${selectedIds.length === 0 ? 'Belum ada teknisi dipilih' : `${selectedIds.length} teknisi dipilih`}
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="plot-cancel">Batal</button>
      <button class="btn btn-primary" id="plot-save">
        ${isReassign ? 'Simpan' : 'Tugaskan &amp; Ploting'}
      </button>`,
    onMount: (overlay, close) => {
      overlay.querySelectorAll('.tech-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.tid;
          const cb = item.querySelector('input');
          if (selectedIds.includes(id)) {
            selectedIds = selectedIds.filter(x => x !== id);
            item.classList.remove('sel');
            if (cb) cb.checked = false;
          } else {
            selectedIds.push(id);
            item.classList.add('sel');
            if (cb) cb.checked = true;
          }
          const info = overlay.querySelector('#plot-info');
          if (info) info.textContent = selectedIds.length === 0
            ? 'Belum ada teknisi dipilih' : `${selectedIds.length} teknisi dipilih`;
        });
      });

      overlay.querySelector('#plot-cancel').addEventListener('click', close);
      overlay.querySelector('#plot-save').addEventListener('click', async () => {
        if (!selectedIds.length) { showToast('Pilih minimal 1 teknisi', 'warning'); return; }
        const btn = overlay.querySelector('#plot-save');
        btn.disabled = true; btn.textContent = 'Menyimpan...';
        try {
          await updateRow('work_orders', wo.id, {
            status: 'diploting', assigned_to: selectedIds[0],
          });

          // Hapus assignee lama lalu insert semua yang dipilih
          const { error: delErr } = await supabase
            .from('wo_assignees').delete().eq('wo_id', wo.id);
          if (delErr) throw delErr;

          const { error: insErr } = await supabase
            .from('wo_assignees')
            .insert(
              selectedIds.map(tid => ({
                wo_id: wo.id, technician_id: tid,
                assigned_at: new Date().toISOString(),
                assigned_by: currentProfile?.id || null,
              }))
            );
          if (insErr) throw insErr;

          showToast(isReassign ? 'Teknisi diupdate!' : 'WO berhasil diploting!', 'success');
          close(); await loadData();
        } catch (err) {
          showToast('Gagal: ' + (err.message || ''), 'error');
          btn.disabled = false;
          btn.textContent = isReassign ? 'Simpan' : 'Tugaskan & Ploting';
        }
      });
    }
  });
}

