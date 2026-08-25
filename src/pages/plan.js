import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { fetchAll } from '../lib/supabase.js';
import { escapeHtml } from '../utils/helpers.js';
import { INTERVAL_TYPES } from '../utils/constants.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// Module-level chart instances so we can destroy & re-render
let chartTrend = null;

export async function renderPlan() {
  const content = renderAppShell('Plan — Man Hours Analysis');

  // Inject page-specific styles
  if (!document.getElementById('plan-page-styles')) {
    const style = document.createElement('style');
    style.id = 'plan-page-styles';
    style.textContent = `
      .plan-filters {
        display: flex;
        align-items: flex-end;
        gap: var(--sp-3);
        flex-wrap: wrap;
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: var(--sp-4);
        margin-bottom: var(--sp-5);
      }
      .plan-filter-group {
        display: flex;
        flex-direction: column;
        gap: var(--sp-1);
        min-width: 150px;
      }
      .plan-filter-group label {
        font-size: var(--fs-xs);
        color: var(--text-muted);
        font-weight: var(--fw-medium);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .plan-summary-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--sp-4);
        margin-bottom: var(--sp-5);
      }
      @media (max-width: 900px) { .plan-summary-cards { grid-template-columns: 1fr; } }
      .plan-stat-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: var(--sp-5);
        position: relative;
        overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .plan-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
      .plan-stat-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
        background: var(--card-accent, var(--primary));
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      }
      .plan-stat-icon {
        width: 44px; height: 44px;
        border-radius: var(--radius-md);
        display: flex; align-items: center; justify-content: center;
        margin-bottom: var(--sp-3);
      }
      .plan-stat-value {
        font-size: 2.2rem;
        font-weight: var(--fw-bold);
        color: var(--text-primary);
        line-height: 1;
        margin-bottom: var(--sp-1);
      }
      .plan-stat-label {
        font-size: var(--fs-xs);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: var(--fw-medium);
      }
      .plan-stat-sub {
        font-size: var(--fs-sm);
        color: var(--text-secondary);
        margin-top: var(--sp-2);
      }
      .plan-charts-row {
        display: grid;
        grid-template-columns: 300px 1fr;
        gap: var(--sp-4);
        margin-bottom: var(--sp-5);
      }
      @media (max-width: 900px) { .plan-charts-row { grid-template-columns: 1fr; } }
      .effectiveness-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 999px;
        font-size: var(--fs-sm);
        font-weight: var(--fw-semibold);
      }
      .eff-ideal { background: rgba(140,198,63,0.15); color: #8CC63F; }
      .eff-overload { background: rgba(245,158,11,0.15); color: #F59E0B; }
      .eff-critical { background: rgba(239,68,68,0.15); color: #EF4444; }
      .plan-tech-table { margin-bottom: var(--sp-5); }
      .eff-bar-wrap { display: flex; align-items: center; gap: 8px; }
      .eff-bar { height: 8px; border-radius: 4px; background: var(--border-color); flex: 1; overflow: hidden; }
      .eff-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
      .plan-loading { display: flex; align-items: center; justify-content: center; padding: 60px; }
      .plan-info-banner {
        background: rgba(23,59,99,0.08);
        border: 1px solid rgba(23,59,99,0.2);
        border-radius: var(--radius-md);
        padding: var(--sp-3) var(--sp-4);
        font-size: var(--fs-xs);
        color: var(--text-secondary);
        margin-bottom: var(--sp-4);
        display: flex;
        align-items: center;
        gap: var(--sp-2);
      }
    `;
    document.head.appendChild(style);
  }

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="mb-4">
        <h2 class="h4 fw-bold mb-1">Plan — Analisis Man Hours</h2>
      </div>

      <!-- INFO BANNER -->
      <div class="alert alert-info d-flex align-items-center gap-2 py-2 px-3 small mb-4 border-0 bg-primary bg-opacity-10 text-primary">
        ${icons.activity}
        <div><strong>Load Man Hours</strong> dihitung dari master data Maintenance Requirements tiap equipment (bukan WO/PM).
        <strong>Available Man Hours</strong> dihitung dari Jadwal Shift teknisi yang diinput di halaman Jadwal &amp; Teknisi.</div>
      </div>

      <!-- FILTERS -->
      <div class="d-flex align-items-end gap-3 flex-wrap mb-4 bg-white border rounded p-3">
        <div>
          <label class="form-label small mb-1 text-muted text-uppercase fw-semibold" style="letter-spacing:0.05em;">Jenis Periode</label>
          <select class="form-select" id="plan-period-type">
            <option value="month">Bulanan</option>
            <option value="week">Mingguan</option>
            <option value="year">Tahunan</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        <div id="filter-month-wrap">
          <label class="form-label small mb-1 text-muted text-uppercase fw-semibold" style="letter-spacing:0.05em;">Bulan</label>
          <input type="month" class="form-control" id="plan-month" value="${currentMonth}" />
        </div>
        <div id="filter-week-wrap" style="display:none;">
          <label class="form-label small mb-1 text-muted text-uppercase fw-semibold" style="letter-spacing:0.05em;">Minggu</label>
          <input type="week" class="form-control" id="plan-week" value="${getISOWeek(now)}" />
        </div>
        <div id="filter-year-wrap" style="display:none;">
          <label class="form-label small mb-1 text-muted text-uppercase fw-semibold" style="letter-spacing:0.05em;">Tahun</label>
          <input type="number" class="form-control" id="plan-year" value="${now.getFullYear()}" min="2000" max="2100" style="width:110px;" />
        </div>
        <div id="filter-range-start-wrap" style="display:none;">
          <label class="form-label small mb-1 text-muted text-uppercase fw-semibold" style="letter-spacing:0.05em;">Dari Tanggal</label>
          <input type="date" class="form-control" id="plan-range-start" value="${now.toISOString().slice(0,10)}" />
        </div>
        <div id="filter-range-end-wrap" style="display:none;">
          <label class="form-label small mb-1 text-muted text-uppercase fw-semibold" style="letter-spacing:0.05em;">Sampai Tanggal</label>
          <input type="date" class="form-control" id="plan-range-end" value="${now.toISOString().slice(0,10)}" />
        </div>
        <div id="filter-breakdown-wrap">
          <label class="form-label small mb-1 text-muted text-uppercase fw-semibold" style="letter-spacing:0.05em;">Tampilan Grafik</label>
          <select class="form-select" id="plan-chart-breakdown">
            <option value="day">Per Hari</option>
            <option value="week">Per Minggu</option>
          </select>
        </div>
        <button class="btn btn-primary d-flex align-items-center gap-2" id="btn-plan-refresh">
          ${icons.activity} Hitung
        </button>
      </div>

      <!-- SUMMARY CARDS -->
      <div class="row g-4 mb-4">
        <div class="col-md-4">
          <div class="card h-100 border-0 shadow-sm" style="border-top: 3px solid #173B63 !important;">
            <div class="card-body">
              <div class="d-flex align-items-center mb-3">
                <div class="rounded p-2 bg-primary bg-opacity-10 text-primary me-3">${icons.clock}</div>
                <div class="text-uppercase text-muted small fw-bold">Available Man Hours</div>
              </div>
              <h3 class="fw-bold mb-1" id="stat-available">–</h3>
              <div class="text-muted small" id="stat-available-sub">dari jadwal shift teknisi</div>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card h-100 border-0 shadow-sm" style="border-top: 3px solid #8b5cf6 !important;">
            <div class="card-body">
              <div class="d-flex align-items-center mb-3">
                <div class="rounded p-2 text-white me-3" style="background:#8b5cf6;">${icons.clipboardList}</div>
                <div class="text-uppercase text-muted small fw-bold">Load Man Hours</div>
              </div>
              <h3 class="fw-bold mb-1" id="stat-load">–</h3>
              <div class="text-muted small" id="stat-load-sub">dari requirement equipment</div>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card h-100 border-0 shadow-sm" style="border-top: 3px solid #10b981 !important;">
            <div class="card-body">
              <div class="d-flex align-items-center justify-content-between mb-3">
                <div class="d-flex align-items-center">
                  <div class="rounded p-2 text-white me-3" style="background:#10b981;">${icons.trendingUp}</div>
                  <div class="text-uppercase text-muted small fw-bold">Efektivitas</div>
                </div>
                <div id="stat-eff-badge">–</div>
              </div>
              <h3 class="fw-bold mb-1" id="stat-effectiveness">–%</h3>
            </div>
          </div>
        </div>
      </div>

      <!-- CHARTS ROW -->
      <div class="row g-4 mb-4">
        <!-- Trend Chart -->
        <div class="col-12">
          <div class="card h-100 border-0 shadow-sm animate-fade-in-up">
            <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
              <h6 class="card-title mb-0 fw-bold">Tren Available vs Load Man Hours</h6>
            </div>
            <div class="card-body">
              <div style="position:relative;height:300px;">
                <canvas id="chart-trend"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TECHNICIAN BREAKDOWN TABLE -->
      <div class="card border-0 shadow-sm animate-fade-in-up mb-5">
        <div class="card-header bg-white pt-4 pb-3">
          <h6 class="card-title mb-0 fw-bold">Breakdown per Teknisi</h6>
        </div>
        <div class="card-body p-0" id="tech-breakdown-wrapper">
          <div class="plan-loading"><div class="spinner"></div></div>
        </div>
      </div>

    </div>
  `;

  // Period type toggle
  document.getElementById('plan-period-type').addEventListener('change', (e) => {
    const v = e.target.value;
    document.getElementById('filter-month-wrap').style.display       = v === 'month'  ? '' : 'none';
    document.getElementById('filter-week-wrap').style.display        = v === 'week'   ? '' : 'none';
    document.getElementById('filter-year-wrap').style.display        = v === 'year'   ? '' : 'none';
    document.getElementById('filter-range-start-wrap').style.display = v === 'custom' ? '' : 'none';
    document.getElementById('filter-range-end-wrap').style.display   = v === 'custom' ? '' : 'none';
    // Show breakdown only for month or custom
    const breakdownWrap = document.getElementById('filter-breakdown-wrap');
    if (breakdownWrap) breakdownWrap.style.display = (v === 'year' || v === 'week') ? 'none' : '';
  });

  document.getElementById('btn-plan-refresh').addEventListener('click', loadPlanData);

  // Initial load
  await loadPlanData();
}

// ──────────────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────────────

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getPeriodRange() {
  const type = document.getElementById('plan-period-type').value;

  if (type === 'month') {
    const monthVal = document.getElementById('plan-month').value;
    const [y, m] = monthVal.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { start, end };
  }

  if (type === 'year') {
    const y = parseInt(document.getElementById('plan-year').value) || new Date().getFullYear();
    const start = new Date(y, 0, 1);
    const end   = new Date(y, 11, 31);
    return { start, end };
  }

  if (type === 'week') {
    const weekVal = document.getElementById('plan-week').value;
    const [year, week] = weekVal.split('-W');
    const jan4 = new Date(parseInt(year), 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    const start = new Date(startOfWeek1);
    start.setDate(startOfWeek1.getDate() + (parseInt(week) - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }

  const start = new Date(document.getElementById('plan-range-start').value);
  const end = new Date(document.getElementById('plan-range-end').value);
  return { start, end };
}

function getDaysInRange(start, end) {
  const days = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endD = new Date(end);
  endD.setHours(23, 59, 59, 999);
  while (cur <= endD) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function getEffColor(pct) {
  if (pct >= 70 && pct <= 100) return '#8CC63F';
  if (pct > 100 && pct <= 120) return '#F59E0B';
  return '#EF4444';
}

function getEffLabel(pct) {
  if (pct >= 70 && pct <= 100) return { text: 'Ideal', cls: 'eff-ideal' };
  if (pct > 100 && pct <= 120) return { text: 'Overload Ringan', cls: 'eff-overload' };
  if (pct > 120) return { text: 'Overload Berat', cls: 'eff-critical' };
  if (pct < 50 && pct > 0) return { text: 'Underutilized', cls: 'eff-critical' };
  return { text: 'Tidak Ada Data', cls: 'eff-overload' };
}

/**
 * Calculate the number of occurrences of a maintenance interval within a period.
 * @param {string} intervalType - 'daily'|'weekly'|'monthly'|'custom'
 * @param {number} intervalDays - only for 'custom'
 * @param {number} totalDays - total days in the selected period
 */
function calcOccurrences(intervalType, intervalDays, totalDays) {
  const fn = INTERVAL_TYPES[intervalType]?.multiplierFn;
  if (!fn) return 0;
  return Math.max(0, fn(totalDays, intervalDays));
}

// ──────────────────────────────────────────────────────────────
//  Main Data Loader
// ──────────────────────────────────────────────────────────────

async function loadPlanData() {
  const btn = document.getElementById('btn-plan-refresh');
  if (btn) { btn.disabled = true; btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Memuat...`; }

  try {
    const { start, end } = getPeriodRange();
    const startStr = start.toISOString().slice(0, 10);
    const endStr   = end.toISOString().slice(0, 10);
    const days     = getDaysInRange(start, end);
    const totalDays = days.length;

    // Fetch all required data in parallel
    const [technicians, shiftMaster, schedules, requirements, pmSchedules, closedWOs] = await Promise.all([
      // All technicians
      fetchAll('profiles', {
        filters: [{ column: 'role', value: 'technician' }],
        order: { column: 'full_name', ascending: true }
      }),
      // Shift master (kode → durasi_jam)
      fetchAll('shift_master', { order: { column: 'kode', ascending: true } }),
      // Schedules for all technicians in the period
      fetchAll('technician_schedule', {
        filters: [
          { column: 'schedule_date', op: 'gte', value: startStr },
          { column: 'schedule_date', op: 'lte', value: endStr },
        ],
        order: { column: 'schedule_date', ascending: true }
      }),
      // Equipment maintenance requirements
      fetchAll('equipment_maintenance_requirements', {
        select: 'id, equipment_id, interval_type, interval_days, man_hours, assigned_to',
        order: { column: 'equipment_id', ascending: true }
      }),
      // Preventive maintenance scheduled dates (next_due in period)
      fetchAll('preventive_maintenance', {
        select: 'id, equipment_id, next_due, assigned_to',
        filters: [
          { column: 'next_due', op: 'gte', value: startStr },
          { column: 'next_due', op: 'lte', value: endStr },
        ]
      }),
      // Closed work orders in the period for Actual Man Hours
      fetchAll('work_orders', {
        select: 'id, closed_at, man_hours_actual, assigned_to',
        filters: [
          { column: 'status', value: 'closed' },
          { column: 'closed_at', op: 'gte', value: startStr + 'T00:00:00.000Z' },
          { column: 'closed_at', op: 'lte', value: endStr + 'T23:59:59.999Z' }
        ]
      }),
    ]);

    // ── Build shift lookup: kode → durasi_jam ────────────────
    const shiftDurations = {};
    shiftMaster.forEach(sm => { shiftDurations[sm.kode] = parseFloat(sm.durasi_jam) || 0; });

    // ── Build schedule lookup: 'profileId|YYYY-MM-DD' → shift_code ─
    const scheduleLookup = {};
    schedules.forEach(s => {
      const kode = s.shift_code || s.shift || '';
      scheduleLookup[`${s.profile_id}|${s.schedule_date}`] = kode;
    });

    // ── AVAILABLE MAN HOURS ──────────────────────────────────
    // Per technician per day = durasi_jam of their shift code (0 if no schedule or Off)
    const availPerTech = {}; // profileId → total available hours
    const availPerDay  = {}; // YYYY-MM-DD → total available hours (all techs)

    technicians.forEach(t => { availPerTech[t.id] = 0; });
    days.forEach(d => { availPerDay[d] = 0; });

    technicians.forEach(t => {
      days.forEach(d => {
        const kode = scheduleLookup[`${t.id}|${d}`] || '';
        const hours = shiftDurations[kode] ?? 0;
        availPerTech[t.id] += hours;
        availPerDay[d]     += hours;
      });
    });

    const totalAvailable = technicians.reduce((sum, t) => sum + (availPerTech[t.id] || 0), 0);

    // ── LOAD MAN HOURS ───────────────────────────────────────
    // Sumber: PM yang terjadwal (next_due dalam periode ini) × man_hours dari requirement equipment.
    // Bukan dari requirements × calcOccurrences (formula lama dihapus).

    const loadPerTech = {}; // profileId → total load hours
    const loadPerDay  = {}; // YYYY-MM-DD → load hours pada hari tersebut

    technicians.forEach(t => { loadPerTech[t.id] = 0; });
    days.forEach(d => { loadPerDay[d] = 0; });

    // Build: equipment_id → total man_hours dari requirements
    const equipReqHours = {}; // equipment_id → total man_hours (semua requirement)
    requirements.forEach(req => {
      const mh = parseFloat(req.man_hours) || 0;
      if (mh > 0) {
        equipReqHours[req.equipment_id] = (equipReqHours[req.equipment_id] || 0) + mh;
      }
    });

    // Build: equipment_id → assigned_to (dari requirements)
    const equipAssigned = {}; // equipment_id → profile_id
    requirements.forEach(req => {
      if (req.assigned_to) equipAssigned[req.equipment_id] = req.assigned_to;
    });

    // Hitung load dari PM yang terjadwal dalam periode (next_due)
    let totalLoad = 0;
    pmSchedules.forEach(pm => {
      const dateStr = pm.next_due;
      const mh      = equipReqHours[pm.equipment_id] || 0;

      totalLoad += mh;

      // loadPerDay — untuk grafik
      if (dateStr && loadPerDay.hasOwnProperty(dateStr)) {
        loadPerDay[dateStr] += mh;
      }

      // loadPerTech — gunakan assigned_to dari PM, fallback ke requirement
      const techId = pm.assigned_to || equipAssigned[pm.equipment_id];
      if (techId && loadPerTech.hasOwnProperty(techId)) {
        loadPerTech[techId] += mh;
      }
    });

    // ── ACTUAL MAN HOURS ─────────────────────────────────────
    const actualPerTech = {};
    const actualPerDay = {};
    technicians.forEach(t => { actualPerTech[t.id] = 0; });
    days.forEach(d => { actualPerDay[d] = 0; });

    let totalActual = 0;
    closedWOs.forEach(wo => {
      const mh = parseFloat(wo.man_hours_actual) || 0;
      if (mh > 0 && wo.closed_at) {
        totalActual += mh;
        const dateStr = wo.closed_at.slice(0, 10);
        if (actualPerDay.hasOwnProperty(dateStr)) {
          actualPerDay[dateStr] += mh;
        }
        if (wo.assigned_to && actualPerTech.hasOwnProperty(wo.assigned_to)) {
          actualPerTech[wo.assigned_to] += mh;
        }
      }
    });

    // ── EFFECTIVENESS ────────────────────────────────────────
    const effectiveness = totalAvailable > 0
      ? Math.round((totalLoad / totalAvailable) * 100)
      : 0;

    // ── Update Summary Cards ─────────────────────────────────
    const statAvail    = document.getElementById('stat-available');
    const statLoad     = document.getElementById('stat-load');
    const statEff      = document.getElementById('stat-effectiveness');
    const statAvailSub = document.getElementById('stat-available-sub');
    const statLoadSub  = document.getElementById('stat-load-sub');
    const statEffBadge = document.getElementById('stat-eff-badge');

    if (statAvail) statAvail.textContent = totalAvailable.toFixed(1) + ' jam';
    if (statLoad)  statLoad.textContent  = totalLoad.toFixed(1) + ' jam';
    if (statEff)   statEff.textContent   = effectiveness + '%';

    const schedCount = Object.values(scheduleLookup).filter(v => v && v !== 'O').length;
    if (statAvailSub) statAvailSub.textContent =
      `${technicians.length} teknisi — ${schedCount} entri shift dalam periode`;
    if (statLoadSub) statLoadSub.textContent =
      `${pmSchedules.length} jadwal PM terjadwal dalam periode`;


    const effLabel = getEffLabel(effectiveness);
    if (statEffBadge) statEffBadge.innerHTML =
      `<span class="effectiveness-badge ${effLabel.cls}">${effLabel.text}</span>`;

    // ── Trend Chart ──────────────────────────────────────────
    const periodType   = document.getElementById('plan-period-type').value;
    const breakdownSel = document.getElementById('plan-chart-breakdown');
    // For 'year' → always monthly. For 'week' → always daily. For 'month'/'custom' → use dropdown.
    let chartMode;
    if (periodType === 'year')  chartMode = 'month';
    else if (periodType === 'week') chartMode = 'day';
    else chartMode = breakdownSel?.value || 'day';

    renderTrendChart(days, availPerDay, loadPerDay, actualPerDay, chartMode);

    // ── Tech Breakdown Table ─────────────────────────────────
    renderTechBreakdown(technicians, availPerTech, loadPerTech, actualPerTech, requirements, totalDays);

  } catch (err) {
    console.error('Plan page error:', err);
    const wrapper = document.getElementById('tech-breakdown-wrapper');
    if (wrapper) wrapper.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">Gagal memuat data: ${escapeHtml(err.message)}</p></div>`;
  } finally {
    const btn = document.getElementById('btn-plan-refresh');
    if (btn) { btn.disabled = false; btn.innerHTML = `${icons.activity} Hitung`; }
  }
}

// ──────────────────────────────────────────────────────────────
//  Trend Chart  — 100% stacked bar (Available / Load / Actual %)
// ──────────────────────────────────────────────────────────────
function renderTrendChart(days, availPerDay, loadPerDay, actualPerDay, chartMode = 'day') {
  const ctx = document.getElementById('chart-trend');
  if (!ctx) return;

  if (chartTrend) { chartTrend.destroy(); chartTrend = null; }

  // ─── aggregate raw data per bucket ───────────────────────────
  let labels    = [];
  let rawAvail  = [];   // absolute hours
  let rawLoad   = [];
  let rawActual = [];

  if (chartMode === 'month') {
    const months = {};
    days.forEach(d => {
      const mk = d.slice(0, 7);
      if (!months[mk]) months[mk] = { avail: 0, load: 0, actual: 0 };
      months[mk].avail  += availPerDay[d]  || 0;
      months[mk].load   += loadPerDay[d]   || 0;
      months[mk].actual += actualPerDay[d] || 0;
    });
    Object.entries(months).forEach(([mk, data]) => {
      const dt = new Date(mk + '-01T00:00:00');
      labels.push(dt.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }));
      rawAvail.push(parseFloat(data.avail.toFixed(2)));
      rawLoad.push(parseFloat(data.load.toFixed(2)));
      rawActual.push(parseFloat(data.actual.toFixed(2)));
    });
  } else if (chartMode === 'week') {
    const weeks = {};
    days.forEach(d => {
      const wk = getISOWeek(new Date(d + 'T00:00:00'));
      if (!weeks[wk]) weeks[wk] = { avail: 0, load: 0, actual: 0 };
      weeks[wk].avail  += availPerDay[d]  || 0;
      weeks[wk].load   += loadPerDay[d]   || 0;
      weeks[wk].actual += actualPerDay[d] || 0;
    });
    Object.entries(weeks).forEach(([wk, data]) => {
      labels.push(wk.replace(/^\d+-W/, 'W'));
      rawAvail.push(parseFloat(data.avail.toFixed(2)));
      rawLoad.push(parseFloat(data.load.toFixed(2)));
      rawActual.push(parseFloat(data.actual.toFixed(2)));
    });
  } else {
    days.forEach(d => {
      labels.push(new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
      rawAvail.push(parseFloat((availPerDay[d]  || 0).toFixed(2)));
      rawLoad.push(parseFloat((loadPerDay[d]    || 0).toFixed(2)));
      rawActual.push(parseFloat((actualPerDay[d] || 0).toFixed(2)));
    });
  }

  // ─── Convert to true-stacked segments (all sum to 100%) ──────
  // Segment layout (bottom → top):
  //   [1] Actual Used   = actual / avail × 100              → Emerald
  //   [2] Load (planned but not yet actual) = max(0, load/avail*100 - actualPct) → Purple
  //   [3] Remaining capacity = 100 - max(loadPct, actualPct) → Blue-gray
  // All 3 in the SAME stack → 1 bar per day

  const actualSegPct   = rawAvail.map((av, i) =>
    av > 0 ? parseFloat(((rawActual[i] / av) * 100).toFixed(1)) : 0
  );
  const loadSegPct     = rawAvail.map((av, i) => {
    if (av <= 0) return 0;
    const loadPct   = (rawLoad[i]   / av) * 100;
    const actPct    = (rawActual[i] / av) * 100;
    return parseFloat(Math.max(0, loadPct - actPct).toFixed(1));
  });
  const remainSegPct   = rawAvail.map((av, i) => {
    if (av <= 0) return 0;
    const loadPct   = (rawLoad[i]   / av) * 100;
    const actPct    = (rawActual[i] / av) * 100;
    const used      = Math.max(loadPct, actPct);
    return parseFloat(Math.max(0, 100 - used).toFixed(1));
  });

  chartTrend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual Man Hours',
          data: actualSegPct,
          backgroundColor: 'rgba(16,185,129,0.88)',
          hoverBackgroundColor: 'rgba(16,185,129,1)',
          borderWidth: 0,
          borderSkipped: false,
          borderRadius: 0,
          stack: 'single',
          order: 1,
        },
        {
          label: 'Load Man Hours',
          data: loadSegPct,
          backgroundColor: 'rgba(139,92,246,0.85)',
          hoverBackgroundColor: 'rgba(139,92,246,1)',
          borderWidth: 0,
          borderSkipped: false,
          borderRadius: 0,
          stack: 'single',
          order: 1,
        },
        {
          label: 'Available (Sisa)',
          data: remainSegPct,
          backgroundColor: 'rgba(59,130,246,0.22)',
          hoverBackgroundColor: 'rgba(59,130,246,0.35)',
          borderWidth: 0,
          borderSkipped: false,
          borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 },
          stack: 'single',
          order: 1,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 500, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: '#374151',
            font: { size: 11, weight: '600' },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            boxWidth: 8,
            boxHeight: 8,
            generateLabels: (chart) => {
              return [
                { text: 'Actual Man Hours',  fillStyle: 'rgba(16,185,129,0.88)',  strokeStyle: 'transparent', lineWidth: 0, hidden: false, datasetIndex: 0 },
                { text: 'Load Man Hours',    fillStyle: 'rgba(139,92,246,0.85)', strokeStyle: 'transparent', lineWidth: 0, hidden: false, datasetIndex: 1 },
                { text: 'Available (Sisa)',  fillStyle: 'rgba(59,130,246,0.22)',  strokeStyle: 'transparent', lineWidth: 0, hidden: false, datasetIndex: 2 },
              ];
            }
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.96)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#F8FAFC',
          bodyColor: 'rgba(248,250,252,0.85)',
          footerColor: 'rgba(248,250,252,0.5)',
          cornerRadius: 10,
          padding: 14,
          titleFont: { size: 12, weight: '700' },
          bodyFont: { size: 11 },
          callbacks: {
            title: (items) => items[0]?.label || '',
            beforeBody: (items) => {
              const i = items[0]?.dataIndex;
              if (i == null || rawAvail[i] === 0) return '';
              return `  Kapasitas: ${rawAvail[i].toFixed(1)} jam`;
            },
            label: (item) => {
              const i = item.dataIndex;
              if (item.datasetIndex === 0) {
                const pct = actualSegPct[i];
                return `  ● Actual  : ${rawActual[i].toFixed(1)} jam  (${pct}%)`;
              }
              if (item.datasetIndex === 1) {
                const pct = loadSegPct[i];
                const loadPctTotal = rawAvail[i] > 0
                  ? parseFloat(((rawLoad[i] / rawAvail[i]) * 100).toFixed(1)) : 0;
                return `  ● Load    : ${rawLoad[i].toFixed(1)} jam  (${loadPctTotal}%)`;
              }
              if (item.datasetIndex === 2) {
                const pct = remainSegPct[i];
                const sisa = rawAvail[i] - Math.max(rawLoad[i], rawActual[i]);
                return `  ● Sisa    : ${Math.max(0, sisa).toFixed(1)} jam  (${pct}%)`;
              }
              return null;
            },
            footer: (items) => {
              const i = items[0]?.dataIndex;
              if (i == null || rawAvail[i] === 0) return '';
              const utilRate = rawAvail[i] > 0
                ? parseFloat(((rawActual[i] / rawAvail[i]) * 100).toFixed(1)) : 0;
              return `  Utilisasi: ${utilRate}%`;
            }
          }
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: '#6B7280',
            font: { size: 10 },
            maxRotation: 45,
            minRotation: 0,
          },
          grid: { display: false },
          border: { color: 'rgba(107,114,128,0.15)' },
        },
        y: {
          stacked: true,
          min: 0,
          max: 100,
          ticks: {
            color: '#6B7280',
            font: { size: 10 },
            callback: (v) => v + '%',
            stepSize: 25,
          },
          grid: {
            color: 'rgba(107,114,128,0.10)',
            drawTicks: false,
          },
          border: { dash: [4, 4], color: 'transparent' },
          title: {
            display: true,
            text: '% dari Kapasitas (Available Man Hours)',
            color: '#9CA3AF',
            font: { size: 10, weight: '500' },
            padding: { bottom: 8 },
          },
        },
      },
    }
  });
}





// ──────────────────────────────────────────────────────────────
//  Technician Breakdown Table
// ──────────────────────────────────────────────────────────────
function renderTechBreakdown(technicians, availPerTech, loadPerTech, actualPerTech, requirements, totalDays) {
  const wrapper = document.getElementById('tech-breakdown-wrapper');
  if (!wrapper) return;

  if (technicians.length === 0) {
    wrapper.innerHTML = `<div class="empty-state"><p>Belum ada data teknisi</p></div>`;
    return;
  }

  // Count requirements per tech
  const reqCountPerTech = {};
  requirements.forEach(r => {
    if (r.assigned_to) {
      reqCountPerTech[r.assigned_to] = (reqCountPerTech[r.assigned_to] || 0) + 1;
    }
  });

  const rows = technicians.map(t => {
    const available = availPerTech[t.id] || 0;
    const load      = loadPerTech[t.id] || 0;
    const actual    = actualPerTech[t.id] || 0;
    const eff       = available > 0 ? Math.round((load / available) * 100) : 0;
    const color     = getEffColor(eff);
    const effLabel  = getEffLabel(eff);
    const barPct    = Math.min(eff, 150) / 150 * 100;
    const reqCount  = reqCountPerTech[t.id] || 0;
    return { t, available, load, actual, eff, color, effLabel, barPct, reqCount };
  });

  rows.sort((a, b) => b.eff - a.eff);

  wrapper.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover table-bordered mb-0">
        <thead>
          <tr class="table-light">
            <th>Teknisi</th>
            <th>Available Hours</th>
            <th>Load Hours (Requirements)</th>
            <th>Actual Hours (Closed WO)</th>
            <th>Efektivitas</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(({ t, available, load, actual, eff, color, effLabel, barPct, reqCount }) => `
            <tr>
              <td>
                <div class="d-flex align-items-center gap-3">
                  <div class="sidebar-avatar" style="width:32px;height:32px;font-size:var(--fs-xs);">${(t.full_name || 'T').charAt(0).toUpperCase()}</div>
                  <div>
                    <div class="fw-medium">${escapeHtml(t.full_name || '-')}</div>
                    ${reqCount > 0 ? `<div class="text-muted small">${reqCount} req di-assign</div>` : '<div class="text-muted small">Tidak ada req yang di-assign</div>'}
                  </div>
                </div>
              </td>
              <td>
                <div class="fw-semibold">${available.toFixed(1)} jam</div>
                <div class="text-muted small">dari jadwal shift</div>
              </td>
              <td>
                <div class="fw-semibold">${load.toFixed(1)} jam</div>
                <div class="text-muted small">${reqCount} requirement</div>
              </td>
              <td>
                <div class="fw-semibold text-success">${actual.toFixed(1)} jam</div>
                <div class="text-muted small">dari WO closed</div>
              </td>
              <td style="min-width:160px;">
                <div class="d-flex align-items-center gap-2">
                  <div class="progress flex-grow-1" style="height: 8px;">
                    <div class="progress-bar" role="progressbar" style="width:${barPct}%;background:${color};" aria-valuenow="${barPct}" aria-valuemin="0" aria-valuemax="100"></div>
                  </div>
                  <span class="fw-semibold text-end" style="color:${color};min-width:40px;">${eff}%</span>
                </div>
              </td>
              <td><span class="badge" style="background-color: ${color}; color: ${color === '#F59E0B' ? '#000' : '#fff'};">${effLabel.text}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="p-3 small text-muted border-top">
      <strong>Load Hours</strong> = Σ (man_hours_requirement × jumlah kemunculan interval dalam periode), dari master data Equipment — Maintenance Requirements.<br>
      <strong>Available Hours</strong> = Σ durasi jam shift teknisi dari Jadwal Matriks.<br>
      Teknisi tanpa requirement yang di-assign = Load 0 jam (requirement tanpa PIC tidak terhitung di sini).
    </div>
  `;
}
