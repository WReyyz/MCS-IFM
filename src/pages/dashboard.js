import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { getDashboardStats, getWoDailyTrendByType } from '../lib/supabase.js';
import { animateCounter, formatDate } from '../utils/helpers.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

let trendChart = null;
let prevDonut = null;
let corrDonut = null;

export async function renderDashboard() {
  const content = renderAppShell('Dashboard', 'Ringkasan aktivitas maintenance dan performa sistem');
  
  content.innerHTML = `
    <div class="stagger" style="background-color: #f8fafc; min-height: 100vh; padding-bottom: 2rem;">
      <!-- Header with Filter -->
      <div class="d-flex justify-content-end mb-3 animate-fade-in-up">
        <select id="dashboard-time-filter" class="form-select form-select-sm shadow-sm" style="width: auto; border-radius: 20px; padding-left: 1rem; padding-right: 2rem; border: none; cursor: pointer;">
          <option value="today">Hari Ini</option>
          <option value="weekly">Mingguan</option>
          <option value="monthly" selected>Bulanan</option>
          <option value="yearly">Tahunan</option>
        </select>
      </div>

      <!-- Main Content -->
      <div class="row g-3 mb-4 animate-fade-in-up">
        
        <!-- Total WO Card -->
        <div class="col-xl-3 col-sm-6">
          <div class="card h-100 border-0 shadow-sm" style="border-radius: 12px;">
            <div class="card-body d-flex flex-column justify-content-center">
              <div class="d-flex align-items-center mb-2">
                <div class="bg-primary text-white d-flex align-items-center justify-content-center rounded" style="width: 48px; height: 48px; margin-right: 12px;">
                  <i class="bi bi-file-earmark-text fs-4"></i>
                </div>
                <div>
                  <h6 class="text-secondary fw-semibold mb-0" style="font-size: 0.85rem;">Total Work Order</h6>
                  <div class="fs-2 fw-bold text-dark" id="stat-total-wo">0</div>
                </div>
              </div>
              <div class="mt-auto">
                <span id="trend-total-wo" class="fw-semibold small">...</span>
                <span class="text-muted small time-comparison-label">dari bulan lalu</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Preventive WO Card -->
        <div class="col-xl-3 col-sm-6">
          <div class="card h-100 border-0 shadow-sm" style="border-radius: 12px;">
            <div class="card-body d-flex flex-column justify-content-center">
              <div class="d-flex align-items-center mb-2">
                <div class="bg-success text-white d-flex align-items-center justify-content-center rounded" style="width: 48px; height: 48px; margin-right: 12px;">
                  <i class="bi bi-tools fs-4"></i>
                </div>
                <div>
                  <h6 class="text-secondary fw-semibold mb-0" style="font-size: 0.85rem;">WO Preventive</h6>
                  <div class="fs-2 fw-bold text-dark" id="stat-prev-wo">0</div>
                </div>
              </div>
              <div class="mt-auto">
                <span id="trend-prev-wo" class="fw-semibold small">...</span>
                <span class="text-muted small time-comparison-label">dari bulan lalu</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Corrective WO Card -->
        <div class="col-xl-3 col-sm-6">
          <div class="card h-100 border-0 shadow-sm" style="border-radius: 12px;">
            <div class="card-body d-flex flex-column justify-content-center">
              <div class="d-flex align-items-center mb-2">
                <div class="text-white d-flex align-items-center justify-content-center rounded" style="background-color: #ff5722; width: 48px; height: 48px; margin-right: 12px;">
                  <i class="bi bi-gear-fill fs-4"></i>
                </div>
                <div>
                  <h6 class="text-secondary fw-semibold mb-0" style="font-size: 0.85rem;">WO Corrective</h6>
                  <div class="fs-2 fw-bold text-dark" id="stat-corr-wo">0</div>
                </div>
              </div>
              <div class="mt-auto">
                <span id="trend-corr-wo" class="fw-semibold small">...</span>
                <span class="text-muted small time-comparison-label">dari bulan lalu</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Min Stock Card -->
        <div class="col-xl-3 col-sm-6">
          <div class="card h-100 border-0 shadow-sm" style="border-radius: 12px;">
            <div class="card-body d-flex flex-column justify-content-center">
              <div class="d-flex align-items-center mb-2">
                <div class="bg-primary bg-gradient text-white d-flex align-items-center justify-content-center rounded" style="background-color: #6f42c1 !important; width: 48px; height: 48px; margin-right: 12px;">
                  <i class="bi bi-box-seam fs-4"></i>
                </div>
                <div>
                  <h6 class="text-secondary fw-semibold mb-0" style="font-size: 0.85rem;">Material Min. Stock</h6>
                  <div class="fs-2 fw-bold text-dark" id="stat-min-stock">0</div>
                </div>
              </div>
              <div class="mt-auto text-secondary small">
                Perlu segera dipesan
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Donut Charts and Manpower Row -->
      <div class="row g-3 mb-4 animate-fade-in-up" style="animation-delay: 0.1s;">
        
        <!-- Status WO Preventive -->
        <div class="col-lg-4">
          <div class="card h-100 border-0 shadow-sm" style="border-radius: 12px;">
            <div class="card-body">
              <h6 class="fw-semibold mb-4 text-dark">Status WO Preventive <span class="text-muted fw-normal time-label">(Bulan Ini)</span></h6>
              <div class="d-flex align-items-center justify-content-center">
                <div style="position: relative; width: 140px; height: 140px;">
                  <canvas id="prev-donut-chart"></canvas>
                  <div class="position-absolute top-50 start-50 translate-middle text-center mt-1">
                    <h3 class="mb-0 fw-bold" id="donut-prev-total">0</h3>
                    <small class="text-muted d-block" style="font-size: 0.55rem; line-height: 1;">Total WO<br>Preventive</small>
                  </div>
                </div>
                <div class="ms-4" style="flex: 1;">
                  <div class="d-flex justify-content-between mb-2">
                    <div><span class="d-inline-block rounded-circle me-2" style="width: 8px; height: 8px; background-color: #0d6efd;"></span><small class="text-muted">Open</small></div>
                    <div><strong id="donut-prev-open">0</strong> <small class="text-muted" id="donut-prev-open-pct">(0%)</small></div>
                  </div>
                  <div class="d-flex justify-content-between mb-2">
                    <div><span class="d-inline-block rounded-circle me-2" style="width: 8px; height: 8px; background-color: #ffc107;"></span><small class="text-muted">Hold</small></div>
                    <div><strong id="donut-prev-hold">0</strong> <small class="text-muted" id="donut-prev-hold-pct">(0%)</small></div>
                  </div>
                  <div class="d-flex justify-content-between">
                    <div><span class="d-inline-block rounded-circle me-2" style="width: 8px; height: 8px; background-color: #198754;"></span><small class="text-muted">Closed</small></div>
                    <div><strong id="donut-prev-closed">0</strong> <small class="text-muted" id="donut-prev-closed-pct">(0%)</small></div>
                  </div>
                  <hr class="my-2">
                  <div class="d-flex justify-content-between">
                    <small class="text-muted">Total</small>
                    <strong id="donut-prev-total-text">0</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Status WO Corrective -->
        <div class="col-lg-4">
          <div class="card h-100 border-0 shadow-sm" style="border-radius: 12px;">
            <div class="card-body">
              <h6 class="fw-semibold mb-4 text-dark">Status WO Corrective <span class="text-muted fw-normal time-label">(Bulan Ini)</span></h6>
              <div class="d-flex align-items-center justify-content-center">
                <div style="position: relative; width: 140px; height: 140px;">
                  <canvas id="corr-donut-chart"></canvas>
                  <div class="position-absolute top-50 start-50 translate-middle text-center mt-1">
                    <h3 class="mb-0 fw-bold" id="donut-corr-total">0</h3>
                    <small class="text-muted d-block" style="font-size: 0.55rem; line-height: 1;">Total WO<br>Corrective</small>
                  </div>
                </div>
                <div class="ms-4" style="flex: 1;">
                  <div class="d-flex justify-content-between mb-2">
                    <div><span class="d-inline-block rounded-circle me-2" style="width: 8px; height: 8px; background-color: #0d6efd;"></span><small class="text-muted">Open</small></div>
                    <div><strong id="donut-corr-open">0</strong> <small class="text-muted" id="donut-corr-open-pct">(0%)</small></div>
                  </div>
                  <div class="d-flex justify-content-between mb-2">
                    <div><span class="d-inline-block rounded-circle me-2" style="width: 8px; height: 8px; background-color: #ffc107;"></span><small class="text-muted">Hold</small></div>
                    <div><strong id="donut-corr-hold">0</strong> <small class="text-muted" id="donut-corr-hold-pct">(0%)</small></div>
                  </div>
                  <div class="d-flex justify-content-between">
                    <div><span class="d-inline-block rounded-circle me-2" style="width: 8px; height: 8px; background-color: #198754;"></span><small class="text-muted">Closed</small></div>
                    <div><strong id="donut-corr-closed">0</strong> <small class="text-muted" id="donut-corr-closed-pct">(0%)</small></div>
                  </div>
                  <hr class="my-2">
                  <div class="d-flex justify-content-between">
                    <small class="text-muted">Total</small>
                    <strong id="donut-corr-total-text">0</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Efektivitas Manpower -->
        <div class="col-lg-4">
          <div class="card h-100 border-0 shadow-sm" style="border-radius: 12px; display: flex; flex-direction: column;">
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="fw-semibold mb-0 text-dark">Efektivitas Manpower <span class="text-muted fw-normal time-label">(Bulan Ini)</span></h6>
                <a href="#/technician" class="btn btn-sm btn-light border rounded-pill" style="font-size: 0.75rem;">Lihat Semua</a>
              </div>
              <div class="table-responsive flex-grow-1" style="margin-bottom: -1rem;">
                <table class="table table-borderless table-sm mb-0">
                  <thead>
                    <tr class="text-muted" style="font-size: 0.7rem; border-bottom: 1px solid #dee2e6;">
                      <th class="fw-semibold pb-2">TEKNISI</th>
                      <th class="fw-semibold pb-2 text-center">TOTAL WO</th>
                      <th class="fw-semibold pb-2 text-end">EFEKTIVITAS</th>
                    </tr>
                  </thead>
                  <tbody id="manpower-table-body">
                    <tr><td colspan="3" class="text-center py-4"><div class="spinner-border spinner-border-sm text-secondary"></div></td></tr>
                  </tbody>
                </table>
              </div>
              <div class="mt-3 pt-2 d-flex justify-content-between align-items-center" style="border-top: 1px solid #dee2e6;">
                <span class="fw-semibold" style="font-size: 0.85rem;">Rata-rata Efektivitas</span>
                <span class="fw-bold text-success" id="avg-effectiveness" style="font-size: 1rem;">0%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Row Tables and Charts -->
      <div class="row g-3 animate-fade-in-up" style="animation-delay: 0.2s;">
        <!-- Low Stock Materials -->
        <div class="col-lg-4">
          <div class="card h-100 border-0 shadow-sm" style="border-radius: 12px;">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="fw-semibold mb-0 text-dark" style="font-size: 0.9rem;">Material Min. Stock</h6>
                <a href="#/material-stock" class="btn btn-sm btn-light border rounded-pill" style="font-size: 0.75rem;">Lihat Semua</a>
              </div>
              <div class="table-responsive">
                <table class="table table-borderless table-sm mb-0 align-middle">
                  <thead>
                    <tr class="text-muted" style="font-size: 0.65rem; border-bottom: 1px solid #dee2e6;">
                      <th class="fw-semibold pb-2">PART NO.</th>
                      <th class="fw-semibold pb-2">NAMA MATERIAL</th>
                      <th class="fw-semibold pb-2 text-center">STOK</th>
                      <th class="fw-semibold pb-2 text-center">MIN. STOK</th>
                      <th class="fw-semibold pb-2 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody id="low-stock-table-body">
                    <tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-secondary"></div></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Equipment Performance -->
        <div class="col-lg-4">
          <div class="card h-100 border-0 shadow-sm" style="border-radius: 12px;">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="fw-semibold mb-0 text-dark" style="font-size: 0.9rem;">Status Performance Equipment <span class="text-muted fw-normal time-label">(Bulan Ini)</span></h6>
                <a href="#/equipment" class="btn btn-sm btn-light border rounded-pill" style="font-size: 0.75rem;">Lihat Semua</a>
              </div>
              <div class="table-responsive">
                <table class="table table-borderless table-sm mb-0 align-middle">
                  <thead>
                    <tr class="text-muted" style="font-size: 0.65rem; border-bottom: 1px solid #dee2e6;">
                      <th class="fw-semibold pb-2">EQUIPMENT</th>
                      <th class="fw-semibold pb-2">ID ASSET</th>
                      <th class="fw-semibold pb-2 text-end">PERFORMANCE</th>
                    </tr>
                  </thead>
                  <tbody id="performance-table-body">
                    <tr><td colspan="3" class="text-center py-4"><div class="spinner-border spinner-border-sm text-secondary"></div></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Ringkasan Work Order (Line Chart) -->
        <div class="col-lg-4">
          <div class="card h-100 border-0 shadow-sm" style="border-radius: 12px;">
            <div class="card-body d-flex flex-column">
              <h6 class="fw-semibold mb-3 text-dark" style="font-size: 0.9rem;">Ringkasan Work Order <span class="text-muted fw-normal time-label">(Bulan Ini)</span></h6>
              <div class="d-flex justify-content-center gap-4 mb-2">
                <div class="d-flex align-items-center">
                  <span class="d-inline-block rounded-circle me-2" style="width: 8px; height: 8px; background-color: #0d6efd;"></span>
                  <small class="text-muted fw-semibold" style="font-size: 0.75rem;">Preventive</small>
                </div>
                <div class="d-flex align-items-center">
                  <span class="d-inline-block rounded-circle me-2" style="width: 8px; height: 8px; background-color: #ff9800;"></span>
                  <small class="text-muted fw-semibold" style="font-size: 0.75rem;">Corrective</small>
                </div>
              </div>
              <div style="flex-grow: 1; min-height: 180px; position: relative;">
                <canvas id="trend-line-chart"></canvas>
              </div>
              <div class="row g-2 mt-3">
                <div class="col-4">
                  <div class="border rounded p-2 text-center h-100" style="background-color: #f8f9fa;">
                    <div class="small text-muted mb-1" style="font-size: 0.65rem; font-weight: 600;">Total WO</div>
                    <div class="text-primary fw-bold fs-5" id="summary-total-wo">0</div>
                  </div>
                </div>
                <div class="col-4">
                  <div class="border rounded p-2 text-center h-100 bg-white" style="border-color: rgba(25, 135, 84, 0.2) !important;">
                    <div class="small text-success mb-1" style="font-size: 0.65rem; font-weight: 600;">Preventive</div>
                    <div class="text-dark fw-bold fs-5" id="summary-prev-wo" style="line-height: 1;">0</div>
                    <div class="small text-muted" id="summary-prev-pct" style="font-size: 0.6rem;">(0%)</div>
                  </div>
                </div>
                <div class="col-4">
                  <div class="border rounded p-2 text-center h-100 bg-white" style="border-color: rgba(255, 152, 0, 0.2) !important;">
                    <div class="small text-warning mb-1" style="font-size: 0.65rem; font-weight: 600;">Corrective</div>
                    <div class="text-dark fw-bold fs-5" id="summary-corr-wo" style="line-height: 1;">0</div>
                    <div class="small text-muted" id="summary-corr-pct" style="font-size: 0.6rem;">(0%)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const timeFilter = document.getElementById('dashboard-time-filter');
  if (timeFilter) {
    timeFilter.addEventListener('change', (e) => {
      const timeRange = e.target.value;
      updateTimeLabels(timeRange);
      loadDashboardData(timeRange);
    });
  }

  function updateTimeLabels(timeRange) {
    let text = "(Bulan Ini)";
    let compareText = "dari bulan lalu";

    if (timeRange === 'today') {
      text = "(Hari Ini)";
      compareText = "dari kemarin";
    } else if (timeRange === 'weekly') {
      text = "(Mingguan)";
      compareText = "dari minggu lalu";
    } else if (timeRange === 'yearly') {
      text = "(Tahun Ini)";
      compareText = "dari tahun lalu";
    }
    
    document.querySelectorAll('.time-label').forEach(el => {
      el.textContent = text;
    });

    document.querySelectorAll('.time-comparison-label').forEach(el => {
      el.textContent = compareText;
    });
  }

  loadDashboardData('monthly');
}

async function loadDashboardData(timeRange = 'monthly') {
  try {
    const stats = await getDashboardStats(timeRange);
    
    // Total Work Order
    animateCounter(document.getElementById('stat-total-wo'), stats.totalWOs);
    const trendTotalEl = document.getElementById('trend-total-wo');
    trendTotalEl.textContent = stats.trendTotal > 0 ? `▲ ${stats.trendTotal}%` : (stats.trendTotal < 0 ? `▼ ${Math.abs(stats.trendTotal)}%` : `0%`);
    trendTotalEl.className = `fw-semibold small ${stats.trendTotal >= 0 ? 'text-success' : 'text-danger'}`;

    // WO Preventive
    animateCounter(document.getElementById('stat-prev-wo'), stats.totalPreventive);
    const trendPrevEl = document.getElementById('trend-prev-wo');
    trendPrevEl.textContent = stats.trendPreventive > 0 ? `▲ ${stats.trendPreventive}%` : (stats.trendPreventive < 0 ? `▼ ${Math.abs(stats.trendPreventive)}%` : `0%`);
    trendPrevEl.className = `fw-semibold small ${stats.trendPreventive >= 0 ? 'text-success' : 'text-danger'}`;

    // WO Corrective
    animateCounter(document.getElementById('stat-corr-wo'), stats.totalCorrective);
    const trendCorrEl = document.getElementById('trend-corr-wo');
    trendCorrEl.textContent = stats.trendCorrective > 0 ? `▲ ${stats.trendCorrective}%` : (stats.trendCorrective < 0 ? `▼ ${Math.abs(stats.trendCorrective)}%` : `0%`);
    trendCorrEl.className = `fw-semibold small ${stats.trendCorrective <= 0 ? 'text-success' : 'text-danger'}`; 

    // Material Min Stock
    animateCounter(document.getElementById('stat-min-stock'), stats.lowStockMaterials.length);

    // Donut Charts
    renderDonutChart(
      'prev-donut-chart', 
      stats.preventiveMonthStatus, 
      'donut-prev',
      prevDonut,
      (chart) => { prevDonut = chart; }
    );

    renderDonutChart(
      'corr-donut-chart', 
      stats.correctiveMonthStatus, 
      'donut-corr',
      corrDonut,
      (chart) => { corrDonut = chart; }
    );

    // Tables
    renderManpowerTable(stats.technicianStats || []);
    renderLowStockMaterials(stats.lowStockMaterials || []);
    renderEquipmentPerformance(stats.equipmentPerformance || []);

    // Summary Boxes at bottom right
    const pTotal = stats.preventiveMonthStatus?.total || 0;
    const cTotal = stats.correctiveMonthStatus?.total || 0;
    const summaryTotal = pTotal + cTotal;
    
    document.getElementById('summary-total-wo').textContent = summaryTotal;
    document.getElementById('summary-prev-wo').textContent = pTotal;
    document.getElementById('summary-prev-pct').textContent = `(${summaryTotal > 0 ? Math.round((pTotal/summaryTotal)*100) : 0}%)`;
    
    document.getElementById('summary-corr-wo').textContent = cTotal;
    document.getElementById('summary-corr-pct').textContent = `(${summaryTotal > 0 ? Math.round((cTotal/summaryTotal)*100) : 0}%)`;

    // Trend Line Chart
    const trendData = await getWoDailyTrendByType(timeRange);
    renderTrendChart(trendData);

  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function renderDonutChart(canvasId, statusObj, prefix, chartInstance, setChartInstance) {
  if (!statusObj) return;
  const total = statusObj.total || 0;
  const open = statusObj.open || 0;
  const hold = statusObj.hold || 0;
  const closed = statusObj.closed || 0;

  // Update text elements
  document.getElementById(`${prefix}-total`).textContent = total;
  document.getElementById(`${prefix}-total-text`).textContent = total;
  document.getElementById(`${prefix}-open`).textContent = open;
  document.getElementById(`${prefix}-hold`).textContent = hold;
  document.getElementById(`${prefix}-closed`).textContent = closed;

  const getPct = (val) => total > 0 ? `(${((val/total)*100).toFixed(1)}%)` : '(0%)';
  document.getElementById(`${prefix}-open-pct`).textContent = getPct(open);
  document.getElementById(`${prefix}-hold-pct`).textContent = getPct(hold);
  document.getElementById(`${prefix}-closed-pct`).textContent = getPct(closed);

  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const newChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Open', 'Hold', 'Closed'],
      datasets: [{
        data: [open, hold, closed],
        backgroundColor: ['#0d6efd', '#ffc107', '#198754'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.label}: ${context.raw}`;
            }
          }
        }
      }
    }
  });

  setChartInstance(newChart);
}

function renderManpowerTable(techs) {
  const tbody = document.getElementById('manpower-table-body');
  if (!tbody) return;

  if (techs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted">Tidak ada data manpower</td></tr>`;
    return;
  }

  // Sort by effectiveness descending
  techs.sort((a, b) => b.effectiveness - a.effectiveness);
  
  // Show top 5
  const displayTechs = techs.slice(0, 5);
  
  let totalEffectiveness = 0;
  techs.forEach(t => totalEffectiveness += t.effectiveness);
  const avg = techs.length > 0 ? Math.round(totalEffectiveness / techs.length) : 0;
  
  document.getElementById('avg-effectiveness').textContent = `${avg}%`;
  document.getElementById('avg-effectiveness').className = `fw-bold ${avg >= 80 ? 'text-success' : avg >= 60 ? 'text-warning' : 'text-danger'}`;

  tbody.innerHTML = displayTechs.map(t => {
    const barColor = t.effectiveness >= 80 ? '#198754' : t.effectiveness >= 60 ? '#ffc107' : '#dc3545';
    return `
      <tr>
        <td class="py-2">
          <div class="d-flex align-items-center">
            <div class="bg-secondary rounded-circle me-2 d-flex justify-content-center align-items-center text-white" style="width:24px; height:24px; font-size:10px;">
              ${t.name.substring(0,1).toUpperCase()}
            </div>
            <span class="fw-semibold" style="font-size: 0.8rem;">${t.name}</span>
          </div>
        </td>
        <td class="text-center py-2"><span class="fw-semibold" style="font-size: 0.8rem;">${t.woCount}</span></td>
        <td class="py-2 text-end">
          <div class="d-flex align-items-center justify-content-end gap-2">
            <div class="progress flex-grow-1 bg-light" style="height: 6px; min-width: 60px;">
              <div class="progress-bar" role="progressbar" style="width: ${Math.min(100, t.effectiveness)}%; background-color: ${barColor};"></div>
            </div>
            <span class="fw-bold" style="min-width: 35px; font-size: 0.8rem;">${t.effectiveness}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderLowStockMaterials(materials) {
  const tbody = document.getElementById('low-stock-table-body');
  if (!tbody) return;

  if (materials.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Semua stok material aman.</td></tr>`;
    return;
  }

  // Show only top 5 lowest
  materials.sort((a, b) => a.quantity - b.quantity);
  const displayMaterials = materials.slice(0, 5);

  tbody.innerHTML = displayMaterials.map(m => {
    const isCritical = m.quantity === 0 || m.quantity < (m.min_stock / 2);
    const statusLabel = isCritical ? 'Kritis' : 'Rendah';
    const badgeClass = isCritical ? 'text-danger bg-danger bg-opacity-10' : 'text-warning bg-warning bg-opacity-10';
    
    return `
      <tr>
        <td class="py-2"><span class="text-muted fw-semibold" style="font-size: 0.75rem;">${m.part_number}</span></td>
        <td class="py-2 fw-semibold" style="font-size: 0.75rem;">${m.name}</td>
        <td class="py-2 text-center fw-bold text-dark" style="font-size: 0.8rem;">${m.quantity}</td>
        <td class="py-2 text-center text-muted" style="font-size: 0.8rem;">${m.min_stock}</td>
        <td class="py-2 text-center">
          <span class="badge rounded-pill px-2 py-1 ${badgeClass}" style="border: 1px solid currentColor;">${statusLabel}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderEquipmentPerformance(equipments) {
  const tbody = document.getElementById('performance-table-body');
  if (!tbody) return;

  if (equipments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted">Belum ada data performance.</td></tr>`;
    return;
  }

  // Display top 5
  equipments.sort((a, b) => b.score - a.score);
  const displayEqs = equipments.slice(0, 5);

  tbody.innerHTML = displayEqs.map(eq => {
    const barColor = eq.score >= 80 ? '#198754' : eq.score >= 60 ? '#ffc107' : '#dc3545';
    // MOCK LOCATION for visual similarity to image, since we don't have location in the DB query
    const location = "Area Produksi"; 
    
    return `
      <tr>
        <td class="py-2">
          <div class="d-flex align-items-center">
            <i class="bi bi-gear text-secondary me-2"></i>
            <span class="fw-semibold" style="font-size: 0.75rem;">${eq.namaEquipment}</span>
          </div>
        </td>
        <td class="py-2 text-muted" style="font-size: 0.75rem;">${eq.idAset}</td>
        <td class="py-2 text-end">
          <div class="d-flex align-items-center justify-content-end gap-2">
            <div class="progress flex-grow-1 bg-light" style="height: 6px; min-width: 60px;">
              <div class="progress-bar" role="progressbar" style="width: ${Math.min(100, eq.score)}%; background-color: ${barColor};"></div>
            </div>
            <span class="fw-bold" style="min-width: 35px; font-size: 0.8rem;">${eq.score}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderTrendChart(data) {
  const ctx = document.getElementById('trend-line-chart');
  if (!ctx || !data || data.length === 0) return;

  if (trendChart) {
    trendChart.destroy();
  }

  // Extract labels and datasets
  const labels = data.map(d => d.label);
  const prevData = data.map(d => d.preventive);
  const corrData = data.map(d => d.corrective);

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Preventive',
          data: prevData,
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13, 110, 253, 0.1)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#0d6efd',
          tension: 0.3,
          fill: false
        },
        {
          label: 'Corrective',
          data: corrData,
          borderColor: '#ff9800',
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#ff9800',
          tension: 0.3,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 7, font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { borderDash: [4, 4] },
          ticks: { font: { size: 10 }, stepSize: 20 }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
}
