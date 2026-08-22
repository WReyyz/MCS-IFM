import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow, deleteRow, getCurrentProfile } from '../lib/supabase.js';
import { formatDate, escapeHtml, generateWoNumber } from '../utils/helpers.js';

let allPMs = [];
let allWOs = [];
let equipmentList = [];
let technicianList = [];
let currentProfile = null;

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

export async function renderPreventiveMaintenance() {
  currentProfile = await getCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';

  // Inject styles if not present
  if (!document.getElementById('pm-dashboard-styles')) {
    const style = document.createElement('style');
    style.id = 'pm-dashboard-styles';
    style.textContent = `
      .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; text-align: center; }
      .calendar-day-header { font-weight: 600; font-size: 0.8rem; color: var(--text-secondary); padding-bottom: 8px; border-bottom: 1px solid var(--border-color); margin-bottom: 8px; }
      .calendar-day { padding: 12px 4px; border-radius: 8px; background: rgba(0,0,0,0.02); border: 1px solid transparent; cursor: pointer; transition: all 0.2s; position: relative; min-height: 50px; }
      .calendar-day:hover { background: rgba(0,0,0,0.05); border-color: var(--border-color); }
      .calendar-day.has-pm { background: rgba(0,0,0,0.04); font-weight: 600; border: 1px solid rgba(0,0,0,0.1); }
      .calendar-day.empty { background: transparent; cursor: default; border: none; }
      .calendar-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--bs-warning); display: inline-block; position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); }
    `;
    document.head.appendChild(style);
  }

  const content = renderAppShell('Preventive Maintenance Planning');

  content.innerHTML = `
    <div class="animate-fade-in row g-4">
      <!-- KOLOM KIRI: FORM JADWAL (Admin Only) -->
      <div class="col-lg-4">
        ${isAdmin ? `
        <div class="card h-100">
          <div class="card-body">
            <h6 class="card-title d-flex align-items-center gap-2 mb-4">${icons.calendarCheck} RENCANA JADWAL PREVENTIF</h6>
            <div class="mb-3">
              <label class="form-label">Equipment *</label>
              <select class="form-select" id="form-equip">
                <option value="">Pilih Equipment...</option>
              </select>
            </div>
            <div class="row g-3 mb-3">
              <div class="col-6">
                <label class="form-label">Frekuensi</label>
                <select class="form-select" id="form-freq">
                  <option value="7">Weekly</option>
                  <option value="30" selected>Monthly</option>
                  <option value="90">Quarterly</option>
                  <option value="180">Half-Yearly</option>
                  <option value="365">Yearly</option>
                </select>
              </div>
              <div class="col-6">
                <label class="form-label">Tanggal Ploting *</label>
                <input type="date" class="form-control" id="form-next-due" />
              </div>
            </div>
            <div class="mb-4">
              <label class="form-label">Teknisi Ditugaskan</label>
              <select class="form-select" id="form-assigned">
                <option value="">... Pilih Teknisi ...</option>
              </select>
            </div>
            <button class="btn btn-success w-100" id="btn-save-schedule">SIMPAN JADWAL</button>
          </div>
        </div>
        ` : `
        <div class="card h-100">
          <div class="card-body">
            <h6 class="card-title d-flex align-items-center gap-2 mb-3">${icons.calendarCheck} PREVENTIVE MAINTENANCE</h6>
            <p class="text-secondary small mb-0">Hanya admin yang dapat membuat jadwal PM baru. Silakan pilih jadwal dari kalender untuk melihat detail tugas Anda.</p>
          </div>
        </div>
        `}
      </div>

      <!-- KOLOM KANAN: KALENDER & MONITORING -->
      <div class="col-lg-8">
        <div class="card mb-4">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-4">
              <h6 class="card-title d-flex align-items-center gap-2 m-0">${icons.calendarCheck} PM JADWAL KALENDER</h6>
              <div class="d-flex align-items-center gap-2">
                <button class="btn btn-outline-secondary btn-sm" id="cal-prev">&lt;</button>
                <span id="cal-month-label" class="fw-semibold text-uppercase text-center" style="min-width:120px">BULAN TAHUN</span>
                <button class="btn btn-outline-secondary btn-sm" id="cal-next">&gt;</button>
              </div>
            </div>
            <div id="calendar-container">
              <!-- Calendar Grid goes here -->
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <h6 class="card-title mb-4">MONITORING JADWAL PM</h6>
            <div id="monitoring-table-container">
              <div class="page-loading"><div class="spinner"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  if (isAdmin) {
    document.getElementById('btn-save-schedule').addEventListener('click', saveNewSchedule);
  }

  document.getElementById('cal-prev').addEventListener('click', () => changeMonth(-1));
  document.getElementById('cal-next').addEventListener('click', () => changeMonth(1));

  await loadData();
}

async function loadData() {
  try {
    const isAdmin = currentProfile?.role === 'admin';
    const pmOptions = { select: '*, equipment(namaEquipment, idAset), profiles:assigned_to(full_name)', order: { column: 'next_due', ascending: true } };
    
    // Technician constraint applied only on Monitoring table if needed, 
    // but typically PM calendar shows all or just assigned. We'll fetch all and filter client-side if needed, 
    // or just fetch assigned for technician.
    if (!isAdmin && currentProfile?.id) {
      pmOptions.filters = [{ column: 'assigned_to', value: currentProfile.id }];
    }

    const [pmRes, woRes, eqRes, techRes] = await Promise.all([
      fetchAll('preventive_maintenance', pmOptions),
      fetchAll('work_orders', { filters: [{column: 'type', value: 'preventive'}], select: '*, equipment(namaEquipment)' }),
      fetchAll('equipment', { order: { column: 'namaEquipment', ascending: true } }),
      fetchAll('profiles', { filters: [{ column: 'role', value: 'technician' }], order: { column: 'full_name', ascending: true } }),
    ]);

    allPMs = pmRes;
    allWOs = woRes;
    equipmentList = eqRes;
    technicianList = techRes;

    populateSelects();
    renderCalendar();
    renderMonitoringTable();
  } catch (err) {
    showToast('Gagal memuat data', 'error');
    console.error(err);
  }
}

function populateSelects() {
  if (currentProfile?.role !== 'admin') return;
  const eqSelect = document.getElementById('form-equip');
  if (eqSelect) {
    eqSelect.innerHTML = '<option value="">Pilih Equipment...</option>' + 
      equipmentList.map(e => `<option value="${e.idAset}">${e.idAset} - ${e.namaEquipment}</option>`).join('');
  }
  const techSelect = document.getElementById('form-assigned');
  if (techSelect) {
    techSelect.innerHTML = '<option value="">... Pilih Teknisi ...</option>' + 
      technicianList.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('');
  }
}

function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  } else if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
}

function renderCalendar() {
  const container = document.getElementById('calendar-container');
  const label = document.getElementById('cal-month-label');
  if (!container || !label) return;

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  label.textContent = `${monthNames[currentMonth]} ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const daysOfWeek = ['M', 'S', 'S', 'R', 'K', 'J', 'S']; // Minggu, Senin, Selasa...
  
  let html = '<div class="calendar-grid">';
  
  // Headers
  daysOfWeek.forEach(d => {
    html += `<div class="calendar-day-header">${d}</div>`;
  });

  // Empty cells for first week padding
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    // Check if there's any PM for this date
    // 1. Check existing WOs
    const hasWO = allWOs.some(wo => wo.opened_at && wo.opened_at.startsWith(dateStr));
    
    // 2. Project future PMs
    let hasProjected = false;
    const targetTime = new Date(dateStr).getTime();
    
    for (const pm of allPMs) {
      if (!pm.next_due) continue;
      const baseTime = new Date(pm.next_due).getTime();
      
      // If the target date is on or after the base next_due date
      if (targetTime >= baseTime) {
         // Calculate the difference in days
         const diffTime = targetTime - baseTime;
         const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
         // If diffDays is exactly divisible by interval, it falls on this day
         if (diffDays % pm.interval_days === 0) {
            hasProjected = true;
            break;
         }
      }
    }

    const hasPM = hasWO || hasProjected;
    
    html += `
      <div class="calendar-day ${hasPM ? 'has-pm' : ''}" data-date="${dateStr}">
        ${d}
        ${hasPM ? '<span class="calendar-dot"></span>' : ''}
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.calendar-day').forEach(el => {
    if (!el.classList.contains('empty')) {
      el.addEventListener('click', () => {
        const dateStr = el.dataset.date;
        showDayDetail(dateStr);
      });
    }
  });
}

function showDayDetail(dateStr) {
  // 1. Find existing WOs for this date
  const dayWOs = allWOs.filter(wo => wo.opened_at && wo.opened_at.startsWith(dateStr));
  
  // 2. Find Projected PMs for this date
  const projectedPMs = [];
  const targetTime = new Date(dateStr).getTime();
  
  for (const pm of allPMs) {
    if (!pm.next_due) continue;
    const baseTime = new Date(pm.next_due).getTime();
    if (targetTime > baseTime) { // strictly greater because exact match might have a WO already
       const diffTime = targetTime - baseTime;
       const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
       if (diffDays % pm.interval_days === 0) {
          // ensure it doesn't already have a WO on this day
          const alreadyHasWO = dayWOs.some(wo => wo.pm_id === pm.id);
          if (!alreadyHasWO) {
             projectedPMs.push(pm);
          }
       }
    }
  }

  const isAdmin = currentProfile?.role === 'admin';

  if (dayWOs.length === 0 && projectedPMs.length === 0) {
    showToast('Tidak ada jadwal PM pada tanggal ini', 'info');
    return;
  }

  showModal({
    title: `Detail Jadwal PM - ${formatDate(dateStr)}`,
    size: 'modal-lg',
    body: `
      <div class="table-responsive">
        <table class="table table-hover table-bordered mb-0">
          <thead>
            <tr>
              <th>MESIN / EQUIPMENT</th>
              <th>AKTIVITAS MAINT.</th>
              <th>STATUS</th>
              ${isAdmin ? '<th>AKSI</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${dayWOs.map(wo => {
              const eqName = wo.equipment?.namaEquipment || wo.equipment_id || '-';
              const activity = escapeHtml(wo.description.replace('[PM] ', ''));
              
              let statusHtml = '';
              const todayStr = new Date().toISOString().split('T')[0];
              const openedAtStr = wo.opened_at.split('T')[0];

              if (wo.status === 'open' || wo.status === 'in_progress' || wo.status === 'hold') {
                if (todayStr > openedAtStr) {
                  statusHtml = `<span class="badge bg-danger">OVERDUE</span>`;
                } else {
                  statusHtml = `<span class="badge bg-warning text-dark">WO AKTIF</span>`;
                }
              } else if (wo.status === 'closed') {
                const closedAtStr = wo.closed_at ? wo.closed_at.split('T')[0] : '';
                if (closedAtStr < openedAtStr) {
                  statusHtml = `<span class="badge bg-primary">SELESAI (LEBIH AWAL)</span>`;
                } else if (closedAtStr === openedAtStr) {
                  statusHtml = `<span class="badge bg-success">SELESAI (TEPAT WAKTU)</span>`;
                } else {
                  statusHtml = `<span class="badge bg-danger">SELESAI (TERLAMBAT)</span>`;
                }
              }

              return `
                <tr>
                  <td>${eqName}</td>
                  <td>${activity}</td>
                  <td>${statusHtml}</td>
                  ${isAdmin ? `
                    <td>
                      <button class="btn btn-outline-danger btn-sm btn-icon" data-delete-wo="${wo.id}" title="Hapus WO">${icons.trash}</button>
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('')}
            ${projectedPMs.map(pm => {
              const eqName = pm.equipment?.namaEquipment || pm.equipment_id || '-';
              const activity = escapeHtml(pm.title);
              const statusHtml = `<span class="badge border text-secondary border-secondary bg-light">TERJADWAL (MASA DEPAN)</span>`;
              
              return `
                <tr>
                  <td>${eqName}</td>
                  <td>${activity}</td>
                  <td>${statusHtml}</td>
                  ${isAdmin ? `<td>-</td>` : ''}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `,
    footer: `<button class="btn btn-secondary" id="close-detail">Tutup Kembali</button>`,
    onMount: (overlay, close) => {
      overlay.querySelector('#close-detail').addEventListener('click', close);
      
      if (isAdmin) {
        overlay.querySelectorAll('[data-delete-wo]').forEach(btn => {
          btn.addEventListener('click', () => {
            const woId = btn.dataset.deleteWo;
            showConfirm({
              message: 'Hapus Work Order Preventive ini?',
              onConfirm: async () => {
                try {
                  await deleteRow('work_orders', woId);
                  showToast('WO terhapus', 'success');
                  close();
                  await loadData();
                } catch (e) {
                  showToast('Gagal menghapus', 'error');
                }
              }
            });
          });
        });
      }
    }
  });
}

function renderMonitoringTable() {
  const container = document.getElementById('monitoring-table-container');
  if (!container) return;
  const isAdmin = currentProfile?.role === 'admin';

  if (allPMs.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:24px 0;"><p>Belum ada jadwal monitoring PM</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-responsive" style="max-height: 400px;">
      <table class="table table-hover table-bordered mb-0">
        <thead>
          <tr>
            <th>ID PM</th>
            <th>ASSET ID</th>
            <th>TGL PLOTING</th>
            <th>NEXT DUE</th>
            <th>EST. JAM</th>
            ${isAdmin ? '<th>AKSI</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${allPMs.map(pm => {
            const shortId = 'PM-' + (pm.id.split('-')[0].toUpperCase());
            return `
              <tr>
                <td><span class="font-monospace small">${shortId}</span></td>
                <td>${pm.equipment_id || '-'}</td>
                <td>${pm.last_done ? formatDate(pm.last_done) : '<span class="text-muted small">Belum ada</span>'}</td>
                <td>${formatDate(pm.next_due)}<br><small class="text-muted">(${pm.interval_days} hari)</small></td>
                <td><small class="text-secondary">${pm.estimated_hours || 0} jam</small></td>
                ${isAdmin ? `
                  <td>
                    <button class="btn btn-outline-danger btn-sm btn-icon" data-delete-pm="${pm.id}" title="Hapus Jadwal PM">
                      ${icons.trash}
                    </button>
                  </td>
                ` : ''}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (isAdmin) {
    container.querySelectorAll('[data-delete-pm]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pmId = btn.dataset.deletePm;
        showConfirm({
          message: 'Hapus Master Jadwal PM ini secara permanen?',
          onConfirm: async () => {
            try {
              await deleteRow('preventive_maintenance', pmId);
              showToast('Jadwal PM terhapus', 'success');
              await loadData();
            } catch (e) {
              showToast('Gagal menghapus', 'error');
            }
          }
        });
      });
    });
  }
}

async function saveNewSchedule() {
  const equipId  = document.getElementById('form-equip').value;
  const freq     = parseInt(document.getElementById('form-freq').value) || 30;
  const plotDate = document.getElementById('form-next-due').value; // Tanggal Ploting
  const assigned = document.getElementById('form-assigned').value || null;

  // Title selalu PREVENTIVE — tidak perlu input
  const title = 'PREVENTIVE';

  if (!equipId || !plotDate) {
    showToast('Equipment dan Tanggal Ploting wajib diisi!', 'warning');
    return;
  }

  // next_due awal = Tanggal Ploting (akan berubah otomatis saat WO di-close)
  const pmData = {
    title,
    equipment_id: equipId,
    interval_days: freq,
    next_due: plotDate,
    assigned_to: assigned,
    estimated_hours: equipmentList.find(e => e.idAset === equipId)?.estimated_hours || 0,
    status: 'scheduled',
    description: ''
  };

  try {
    const newPM = await insertRow('preventive_maintenance', pmData);
    
    // Auto Generate the corresponding WO for this cycle
    const woData = {
      wo_number: generateWoNumber(),
      equipment_id: equipId,
      pm_id: newPM.id,
      type: 'preventive',
      priority: 'medium',
      status: 'open',
      assigned_to: assigned,
      description: `[PM] ${title} — ${equipId}`,
      opened_at: new Date(plotDate).toISOString()
    };
    await insertRow('work_orders', woData);

    showToast('Jadwal PM & WO berhasil dibuat', 'success');
    
    // Reset form
    document.getElementById('form-equip').value = '';
    document.getElementById('form-next-due').value = '';
    document.getElementById('form-assigned').value = '';

    await loadData();
  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan jadwal PM', 'error');
  }
}
