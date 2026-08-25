import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { getDashboardStats, getWoMonthlyTrend, getWoDailyStats, fetchAll } from '../lib/supabase.js';
import { animateCounter, formatDate, isOverdue } from '../utils/helpers.js';
import { EQUIPMENT_STATUS, WO_STATUS, WO_PRIORITY, WO_CATEGORY } from '../utils/constants.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// Industrial Patina — chart palette
const CHART = {
  open:    '#2D6A9F',   // cold blue
  closed:  '#2E8B57',   // forest green
  hold:    '#E8920A',   // safety amber
  planned: '#1A2230',   // iron dark
  grid:    'rgba(28,33,39,0.07)',
  tick:    '#8A96A3',
  tooltip: { bg: '#1C2127', border: 'rgba(255,255,255,0.10)', title: '#fff', body: 'rgba(255,255,255,0.75)' },
};

// Shared chart options
const baseScaleOpts = {
  x: { ticks: { color: CHART.tick, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { color: CHART.grid } },
  y: { ticks: { color: CHART.tick, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { color: CHART.grid }, beginAtZero: true },
};
const baseTooltip = {
  backgroundColor: CHART.tooltip.bg,
  borderColor: CHART.tooltip.border,
  borderWidth: 1,
  titleColor: CHART.tooltip.title,
  bodyColor: CHART.tooltip.body,
  cornerRadius: 6,
  padding: 10,
};

export async function renderDashboard() {
  const content = renderAppShell('Dashboard');

  const now = new Date();
  const monthLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  content.innerHTML = `
    <div class="stagger">



      <!-- Stat Cards Row -->
      <div class="stat-cards animate-fade-in-up">
        <div class="stat-card" style="--stat-border-color:var(--mcs-warning)">
          <div class="stat-category">WO Corrective</div>
          <div class="stat-value" id="stat-wo-corr">—</div>
          <div class="stat-label">Dibuat hari ini</div>
          <div class="stat-sub">
            <span class="stat-sub-dot" style="background:var(--mcs-warning)"></span>
            <span>Total WO Corrective Harian</span>
          </div>
        </div>
        <div class="stat-card" style="--stat-border-color:var(--mcs-info)">
          <div class="stat-category">WO Preventive</div>
          <div class="stat-value" id="stat-wo-prev">—</div>
          <div class="stat-label">Dibuat hari ini</div>
          <div class="stat-sub">
            <span class="stat-sub-dot" style="background:var(--mcs-info)"></span>
            <span>Total WO Preventive Harian</span>
          </div>
        </div>
        <div class="stat-card" style="--stat-border-color:var(--mcs-amber)">
          <div class="stat-category">Status Hold</div>
          <div class="stat-value" id="stat-wo-hold">—</div>
          <div class="stat-label">WO Aktif ditahan</div>
          <div class="stat-sub">
            <span class="stat-sub-dot" style="background:var(--mcs-amber)"></span>
            <span>Total WO Hold</span>
          </div>
        </div>
        <div class="stat-card" style="--stat-border-color:var(--mcs-operational)">
          <div class="stat-category">Status Selesai</div>
          <div class="stat-value" id="stat-wo-close">—</div>
          <div class="stat-label">WO ditutup hari ini</div>
          <div class="stat-sub">
            <span class="stat-sub-dot" style="background:var(--mcs-operational)"></span>
            <span>Total WO Selesai Harian</span>
          </div>
        </div>
      </div>

      <!-- Charts -->
      <div class="charts-grid mb-4">
        <div class="chart-card animate-fade-in-up">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">Distribusi Work Order (Hari Ini)</div>
              <div class="chart-card-subtitle">Total & Status Harian</div>
            </div>
          </div>
          <div class="donut-chart-wrapper" style="height:240px">
            <canvas id="chart-wo-distribution"></canvas>
          </div>
          <div id="chart-distribution-notice" style="display:none"></div>
        </div>
        <div class="chart-card animate-fade-in-up">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">Work Order Harian — ${monthLabel}</div>
              <div class="chart-card-subtitle">Open · Closed · Hold per hari</div>
            </div>
          </div>
          <div style="position:relative;height:240px" id="chart-daily-wrapper">
            <canvas id="chart-wo-daily"></canvas>
          </div>
          <div id="chart-daily-notice" style="display:none"></div>
        </div>
      </div>

      <!-- Bottom: Recent WO + Upcoming PM -->
      <div class="dashboard-bottom">
        <div class="card animate-fade-in-up">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h6 class="fw-semibold mb-0">Work Order Terbaru</h6>
              <a href="#/work-order" class="btn btn-sm btn-outline-secondary">Lihat Semua ${icons.chevronRight}</a>
            </div>
            <div id="recent-wo-table"></div>
          </div>
        </div>
        <div class="card animate-fade-in-up">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h6 class="fw-semibold mb-0">PM Mendatang</h6>
              <a href="#/preventive-maintenance" class="btn btn-sm btn-outline-secondary">Lihat Semua ${icons.chevronRight}</a>
            </div>
            <div id="upcoming-pm-list"></div>
          </div>
        </div>
      </div>

    </div>
  `;


  loadDashboardData();
}

async function loadDashboardData() {
  try {
    const [stats, dailyStats, recentWOs, upcomingPMs] = await Promise.all([
      getDashboardStats(),
      getWoDailyStats(),
      fetchAll('work_orders', {
        select: '*,profiles:assigned_to(full_name)',
        order: { column: 'created_at', ascending: false },
        limit: 5
      }),
      fetchAll('preventive_maintenance', {
        select: '*, equipment(namaEquipment)',
        order: { column: 'next_due', ascending: true },
        limit: 5,
        filters: [{ column: 'status', value: 'scheduled' }]
      }),
    ]);


    // ── Stat cards ───────────────────────────────────────────────────────
    animateCounter(document.getElementById('stat-wo-corr'), stats.woCorrectiveToday || 0);
    animateCounter(document.getElementById('stat-wo-prev'), stats.woPreventiveToday || 0);
    animateCounter(document.getElementById('stat-wo-hold'), stats.woHoldActive || 0);
    animateCounter(document.getElementById('stat-wo-close'), stats.woClosedToday || 0);

    // ── WO Daily Chart ───────────────────────────────────────────────────
    renderDailyChart(dailyStats);

    // ── Distribusi WO Donut ──────────────────────────────────────────────
    renderWoDistributionDonut(stats);

    // ── Recent WOs ───────────────────────────────────────────────────────
    renderRecentWOs(recentWOs);

    // ── Upcoming PMs ─────────────────────────────────────────────────────
    renderUpcomingPMs(upcomingPMs);

  } catch (err) {
    console.error('Dashboard error:', err);
  }
}


// ── Daily WO Chart ────────────────────────────────────────────────────────────
function renderDailyChart(dailyStats) {
  const wrapper = document.getElementById('chart-daily-wrapper');
  const noticeEl = document.getElementById('chart-daily-notice');
  const ctx = document.getElementById('chart-wo-daily');
  if (!ctx) return;

  const totalActivity = dailyStats.reduce((sum, d) => sum + (d.open||0) + (d.closed||0) + (d.hold||0), 0);

  if (totalActivity === 0) {
    // Empty state
    wrapper.style.display = 'none';
    noticeEl.style.display = 'block';
    noticeEl.innerHTML = `
      <div class="chart-empty">
        <div class="chart-empty-icon">${icons.clipboardList || '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M14 4h2a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2h2"/></svg>'}</div>
        <h4>Belum ada WO bulan ini</h4>
        <p>Work order yang dibuat bulan ini akan muncul di sini</p>
      </div>`;
    return;
  }

  // Low-data notice if only a few days have activity
  const activeDays = dailyStats.filter(d => (d.open||0) + (d.closed||0) + (d.hold||0) > 0).length;
  if (activeDays <= 3 && dailyStats.length > 10) {
    noticeEl.style.display = 'block';
    noticeEl.innerHTML = `
      <div class="chart-low-data-notice">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Data hanya tersedia pada ${activeDays} hari — grafik akan lebih informatif saat bulan berjalan.
      </div>`;
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dailyStats.map(d => d.label),
      datasets: [
        {
          label: 'Closed',
          data: dailyStats.map(d => d.closed),
          backgroundColor: CHART.closed + 'CC',
          borderRadius: { topLeft: 3, topRight: 3, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: 'bottom',
          stack: 'stack1',
          order: 2,
        },
        {
          label: 'Open',
          data: dailyStats.map(d => d.open),
          backgroundColor: CHART.open + 'CC',
          borderRadius: { topLeft: 3, topRight: 3, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: 'bottom',
          stack: 'stack1',
          order: 2,
        },
        {
          label: 'Hold',
          data: dailyStats.map(d => d.hold),
          backgroundColor: CHART.hold + 'CC',
          borderRadius: { topLeft: 3, topRight: 3, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: 'bottom',
          stack: 'stack1',
          order: 2,
        },
        {
          label: 'Total Terplan',
          data: dailyStats.map(d => d.totalPlanned),
          type: 'line',
          borderColor: CHART.planned,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [4, 3],
          pointRadius: 0,
          tension: 0.2,
          fill: false,
          order: 1,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: CHART.tick,
            font: { size: 10 },
            usePointStyle: true,
            pointStyle: 'rectRounded',
            padding: 14,
          }
        },
        tooltip: baseTooltip,
      },
      scales: {
        x: { ...baseScaleOpts.x, stacked: true },
        y: { ...baseScaleOpts.y, stacked: true },
      }
    }
  });
}

// ── Distribusi Work Order (Hari Ini) Donut ──────────────────────────────────────
function renderWoDistributionDonut(stats) {
  const noticeEl = document.getElementById('chart-distribution-notice');
  const ctx = document.getElementById('chart-wo-distribution');
  if (!ctx) return;

  const counts = [
    stats.woCorrectiveToday || 0,
    stats.woPreventiveToday || 0,
    stats.woHoldActive || 0,
    stats.woClosedToday || 0,
  ];
  const total = counts.reduce((a, b) => a + b, 0);

  if (total === 0) {
    ctx.style.display = 'none';
    noticeEl.style.display = 'block';
    noticeEl.innerHTML = `
      <div class="chart-empty" style="min-height:180px">
        <div class="chart-empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg></div>
        <h4>Belum ada data Work Order</h4>
        <p>Data hari ini belum tersedia</p>
      </div>`;
    return;
  }

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Corrective', 'Preventive', 'Hold', 'Selesai'],
      datasets: [{
        data: counts,
        backgroundColor: [
          '#E8920ACC', // amber for corrective
          '#00B4D8CC', // info for preventive
          '#F4A261CC', // slightly lighter amber for hold
          '#2E8B57CC', // green for close
        ],
        borderWidth: 0,
        spacing: 2,
        borderRadius: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: CHART.tick,
            padding: 12,
            font: { size: 10 },
            usePointStyle: true,
            pointStyle: 'rectRounded',
          }
        },
        tooltip: baseTooltip,
      }
    }
  });
}

// ── Recent WOs table ──────────────────────────────────────────────────────────
function renderRecentWOs(recentWOs) {
  const woContainer = document.getElementById('recent-wo-table');
  if (!woContainer) return;

  if (recentWOs.length === 0) {
    woContainer.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M14 4h2a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2h2"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
        <h4>Belum ada work order</h4>
        <p>Work order akan muncul di sini setelah dibuat</p>
      </div>`;
    return;
  }

  woContainer.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover table-sm mb-0">
        <thead>
          <tr>
            <th>No. WO</th><th>Kategori</th><th>Status</th><th>Prioritas</th>
          </tr>
        </thead>
        <tbody>
          ${recentWOs.map(wo => {
            const cat = WO_CATEGORY[wo.category] || WO_CATEGORY.OTHER;
            const st  = WO_STATUS[wo.status]     || {};
            const pri = WO_PRIORITY[wo.priority] || {};
            return `
            <tr>
              <td><span class="wo-number">${wo.wo_number}</span></td>
              <td><span class="badge" style="color:${cat.color};background:${cat.bg}">${cat.label}</span></td>
              <td><span class="badge" style="color:${st.color};background:${st.bg}">${st.label || wo.status}</span></td>
              <td><span class="badge" style="color:${pri.color};background:${pri.bg}">${pri.label || wo.priority}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Upcoming PMs ──────────────────────────────────────────────────────────────
function renderUpcomingPMs(upcomingPMs) {
  const pmContainer = document.getElementById('upcoming-pm-list');
  if (!pmContainer) return;

  if (upcomingPMs.length === 0) {
    pmContainer.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></svg>
        <h4>Tidak ada PM terjadwal</h4>
        <p>Jadwal preventive maintenance akan muncul di sini</p>
      </div>`;
    return;
  }

  pmContainer.innerHTML = upcomingPMs.map(pm => {
    const overdue = isOverdue(pm.next_due);
    return `
    <div class="pm-list-item">
      <div class="pm-list-info">
        <div class="pm-list-title">${pm.title}</div>
        <div class="pm-list-equip">${pm.equipment?.namaEquipment || '—'}</div>
      </div>
      <span class="badge" style="
        color:${overdue ? 'var(--danger)' : 'var(--info)'};
        background:${overdue ? 'var(--danger-bg)' : 'var(--info-bg)'}">
        ${overdue ? 'Terlambat' : formatDate(pm.next_due)}
      </span>
    </div>`;
  }).join('');
}
