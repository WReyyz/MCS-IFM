import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { getDashboardStats, getWoMonthlyTrend, getWoDailyStats, fetchAll } from '../lib/supabase.js';
import { animateCounter, formatDate, isOverdue } from '../utils/helpers.js';
import { EQUIPMENT_STATUS, WO_STATUS, WO_PRIORITY, WO_CATEGORY } from '../utils/constants.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export async function renderDashboard() {
  const content = renderAppShell('Dashboard');

  const now = new Date();
  const monthLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  content.innerHTML = `
    <div class="stagger">
      <div class="dashboard-top-row stagger">
        <div class="stat-card animate-fade-in-up" style="--stat-accent:linear-gradient(135deg,#00d4ff,#0099ff);flex:0 0 auto;min-width:200px">
          <div class="stat-icon" style="background:rgba(0,212,255,0.15);color:#00d4ff">${icons.hardDrive}</div>
          <div class="stat-value" id="stat-equip">0</div>
          <div class="stat-label">Total Inventory</div>
          <div class="stat-sub" id="stat-equip-sub">-</div>
        </div>
        <div class="chart-card animate-fade-in-up" style="flex:1;min-width:0">
          <div class="chart-card-header">
            <h3 class="chart-card-title">Work Order Harian — ${monthLabel}</h3>
          </div>
          <div style="position:relative;height:220px">
            <canvas id="chart-wo-daily"></canvas>
          </div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card animate-fade-in-up">
          <div class="chart-card-header">
            <h3 class="chart-card-title">Tren Work Order (6 Bulan)</h3>
          </div>
          <canvas id="chart-wo-trend"></canvas>
        </div>
        <div class="chart-card animate-fade-in-up">
          <div class="chart-card-header">
            <h3 class="chart-card-title">Status Equipment</h3>
          </div>
          <canvas id="chart-equip-status"></canvas>
        </div>
      </div>

      <div class="dashboard-bottom">
        <div class="card animate-fade-in-up">
          <div class="card-header">
            <h3 class="card-title">Work Order Terbaru</h3>
            <a href="#/work-order" class="btn btn-ghost btn-sm">Lihat Semua ${icons.chevronRight}</a>
          </div>
          <div id="recent-wo-table"></div>
        </div>
        <div class="card animate-fade-in-up">
          <div class="card-header">
            <h3 class="card-title">PM Mendatang</h3>
            <a href="#/preventive-maintenance" class="btn btn-ghost btn-sm">Lihat Semua ${icons.chevronRight}</a>
          </div>
          <div id="upcoming-pm-list"></div>
        </div>
      </div>
    </div>
  `;

  loadDashboardData();
}

async function loadDashboardData() {
  try {
    const [stats, trend, dailyStats, recentWOs, upcomingPMs] = await Promise.all([
      getDashboardStats(),
      getWoMonthlyTrend(),
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

    // Animate Total Inventory stat
    animateCounter(document.getElementById('stat-equip'), stats.totalEquipment);
    document.getElementById('stat-equip-sub').textContent = `${stats.activeEquipment} operasional`;

    // Daily WO Chart (combined: stacked bar for Open/Closed/Hold + line for Total Planned)
    const dailyCtx = document.getElementById('chart-wo-daily');
    if (dailyCtx) {
      new Chart(dailyCtx, {
        type: 'bar',
        data: {
          labels: dailyStats.map(d => d.label),
          datasets: [
            {
              label: 'WO Closed',
              data: dailyStats.map(d => d.closed),
              backgroundColor: 'rgba(16,185,129,0.8)',
              borderRadius: 3,
              borderSkipped: false,
              stack: 'stack1',
              order: 2,
            },
            {
              label: 'WO Open',
              data: dailyStats.map(d => d.open),
              backgroundColor: 'rgba(59,130,246,0.8)',
              borderRadius: 3,
              borderSkipped: false,
              stack: 'stack1',
              order: 2,
            },
            {
              label: 'WO Hold',
              data: dailyStats.map(d => d.hold),
              backgroundColor: 'rgba(245,158,11,0.8)',
              borderRadius: 3,
              borderSkipped: false,
              stack: 'stack1',
              order: 2,
            },
            {
              label: 'Total WO Terplan',
              data: dailyStats.map(d => d.totalPlanned),
              type: 'line',
              borderColor: '#a855f7',
              backgroundColor: 'rgba(168,85,247,0.15)',
              borderWidth: 2.5,
              pointRadius: 3,
              pointBackgroundColor: '#a855f7',
              pointBorderColor: '#a855f7',
              tension: 0.3,
              fill: true,
              order: 1,
            },
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              labels: {
                color: '#9ca3af',
                font: { size: 11 },
                usePointStyle: true,
                pointStyle: 'rectRounded',
                padding: 16,
              }
            },
            tooltip: {
              backgroundColor: 'rgba(15,23,42,0.95)',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              titleColor: '#e2e8f0',
              bodyColor: '#cbd5e1',
              cornerRadius: 8,
              padding: 10,
            }
          },
          scales: {
            x: {
              ticks: { color: '#6b7280', font: { size: 10 } },
              grid: { color: 'rgba(255,255,255,0.04)' },
              stacked: true,
            },
            y: {
              ticks: { color: '#6b7280', stepSize: 1 },
              grid: { color: 'rgba(255,255,255,0.04)' },
              beginAtZero: true,
              stacked: true,
            }
          }
        }
      });
    }

    // WO Trend Chart (6 months)
    const trendCtx = document.getElementById('chart-wo-trend');
    if (trendCtx) {
      new Chart(trendCtx, {
        type: 'bar',
        data: {
          labels: trend.map(t => t.label),
          datasets: [
            {
              label: 'Terbuka',
              data: trend.map(t => t.open),
              backgroundColor: 'rgba(59,130,246,0.7)',
              borderRadius: 6,
              borderSkipped: false,
            },
            {
              label: 'Selesai',
              data: trend.map(t => t.closed),
              backgroundColor: 'rgba(16,185,129,0.7)',
              borderRadius: 6,
              borderSkipped: false,
            },
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#9ca3af', font: { size: 11 } } }
          },
          scales: {
            x: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true }
          }
        }
      });
    }

    // Equipment status chart
    const statusCtx = document.getElementById('chart-equip-status');
    if (statusCtx) {
      new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: Object.values(EQUIPMENT_STATUS).map(s => s.label),
          datasets: [{
            data: [
              stats.equipmentByStatus.operational,
              stats.equipmentByStatus.maintenance,
              stats.equipmentByStatus.breakdown,
              stats.equipmentByStatus.decommissioned,
            ],
            backgroundColor: Object.values(EQUIPMENT_STATUS).map(s => s.color),
            borderWidth: 0,
            spacing: 3,
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12, font: { size: 11 } } }
          }
        }
      });
    }

    // Recent WOs table
    const woContainer = document.getElementById('recent-wo-table');
    if (woContainer) {
      if (recentWOs.length === 0) {
        woContainer.innerHTML = `<div class="empty-state"><p>Belum ada work order</p></div>`;
      } else {
        woContainer.innerHTML = `
          <div class="table-container" style="border:none">
            <table class="data-table">
              <thead><tr>
                <th>No. WO</th><th>Kategori</th><th>Status</th><th>Prioritas</th>
              </tr></thead>
              <tbody>
                ${recentWOs.map(wo => {
                  const cat = WO_CATEGORY[wo.category] || WO_CATEGORY.OTHER;
                  return `
                  <tr>
                    <td><span class="wo-number">${wo.wo_number}</span></td>
                    <td><span class="badge" style="color:${cat.color};background:${cat.bg}">${cat.label}</span></td>
                    <td><span class="badge" style="color:${WO_STATUS[wo.status]?.color};background:${WO_STATUS[wo.status]?.bg}">${WO_STATUS[wo.status]?.label}</span></td>
                    <td><span class="badge" style="color:${WO_PRIORITY[wo.priority]?.color};background:${WO_PRIORITY[wo.priority]?.bg}">${WO_PRIORITY[wo.priority]?.label}</span></td>
                  </tr>
                `}).join('')}
              </tbody>
            </table>
          </div>`;
      }
    }

    // Upcoming PMs
    const pmContainer = document.getElementById('upcoming-pm-list');
    if (pmContainer) {
      if (upcomingPMs.length === 0) {
        pmContainer.innerHTML = `<div class="empty-state"><p>Tidak ada PM terjadwal</p></div>`;
      } else {
        pmContainer.innerHTML = upcomingPMs.map(pm => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-3) 0;border-bottom:1px solid var(--border-color);gap:var(--sp-3)">
            <div style="flex:1">
              <div style="font-weight:var(--fw-medium);font-size:var(--fs-sm)">${pm.title}</div>
              <div style="font-size:var(--fs-xs);color:var(--text-muted)">${pm.equipment?.namaEquipment || '-'}</div>
            </div>
            <div style="text-align:right">
              <span class="badge" style="color:${isOverdue(pm.next_due) ? 'var(--danger)' : 'var(--info)'};background:${isOverdue(pm.next_due) ? 'var(--danger-bg)' : 'var(--info-bg)'}">
                ${isOverdue(pm.next_due) ? 'Terlambat' : formatDate(pm.next_due)}
              </span>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

