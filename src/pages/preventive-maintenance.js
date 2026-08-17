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
      .pm-dashboard { display: grid; grid-template-columns: 350px 1fr; gap: var(--sp-4); }
      @media (max-width: 992px) { .pm-dashboard { grid-template-columns: 1fr; } }
      .pm-sidebar .card { background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--sp-4); }
      .pm-main .card { background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--sp-4); margin-bottom: var(--sp-4); }
      .pm-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-4); }
      .pm-header h4 { display: flex; align-items: center; gap: 8px; font-size: 1rem; color: var(--text-primary); margin: 0; }
      
      .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; text-align: center; }
      .calendar-day-header { font-weight: 600; font-size: 0.8rem; color: var(--text-secondary); padding-bottom: 8px; border-bottom: 1px solid var(--border-color); margin-bottom: 8px; }
      .calendar-day { padding: 12px 4px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid transparent; cursor: pointer; transition: all 0.2s; position: relative; min-height: 50px; }
      .calendar-day:hover { background: rgba(255,255,255,0.05); border-color: var(--border-color); }
      .calendar-day.has-pm { background: rgba(255,255,255,0.04); font-weight: 600; border: 1px solid rgba(255,255,255,0.1); }
      .calendar-day.empty { background: transparent; cursor: default; }
      .calendar-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--warning); display: inline-block; position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); }
      
      .cal-nav-btn { background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; padding: 4px 8px; cursor: pointer; }
      .cal-nav-btn:hover { background: rgba(255,255,255,0.1); }
    `;
    document.head.appendChild(style);
  }

  const content = renderAppShell('Preventive Maintenance Planning');

  content.innerHTML = `
    <div class="animate-fade-in pm-dashboard">
      <!-- KOLOM KIRI: FORM JADWAL (Admin Only) -->
      <div class="pm-sidebar">
        ${isAdmin ? `
        <div class="card">
          <div class="pm-header">
            <h4>${icons.calendarCheck} RENCANA JADWAL PREVENTIF</h4>
          </div>
          <div class="form-group">
            <label class="form-label">Equipment *</label>
            <select class="form-select" id="form-equip">
              <option value="">Pilih Equipment...</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Frekuensi</label>
              <select class="form-select" id="form-freq">
                <option value="7">Weekly</option>
                <option value="30" selected>Monthly</option>
                <option value="90">Quarterly</option>
                <option value="180">Half-Yearly</option>
                <option value="365">Yearly</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tanggal Ploting *</label>
              <input type="date" class="form-input" id="form-next-due" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Teknisi Ditugaskan</label>
            <div style="display:flex; gap:8px;">
              <select class="form-select" id="form-assigned" style="flex:1;">
                <option value="">... Pilih Teknisi ...</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Estimasi Jam Kerja (jam)</label>
            <input type="number" class="form-input" id="form-est-hours" placeholder="Contoh: 4" step="0.5" min="0" />
          </div>
          <button class="btn btn-primary" id="btn-save-schedule" style="width:100%; margin-top:16px; background:#4CAF50;">SIMPAN JADWAL</button>
        </div>
        ` : `
        <div class="card">
          <div class="pm-header">
            <h4>${icons.calendarCheck} PREVENTIVE MAINTENANCE</h4>
          </div>
          <p class="text-secondary" style="font-size:0.9rem;">Hanya admin yang dapat membuat jadwal PM baru. Silakan pilih jadwal dari kalender untuk melihat detail tugas Anda.</p>
        </div>
        `}
      </div>

      <!-- KOLOM KANAN: KALENDER & MONITORING -->
      <div class="pm-main">
        <div class="card">
          <div class="pm-header" style="margin-bottom:24px;">
            <h4>${icons.calendarCheck} PM JADWAL KALENDER</h4>
            <div style="display:flex; align-items:center; gap:12px;">
              <button class="cal-nav-btn" id="cal-prev">&lt;</button>
              <span id="cal-month-label" style="font-weight:600; text-transform:uppercase; min-width:120px; text-align:center;">BULAN TAHUN</span>
              <button class="cal-nav-btn" id="cal-next">&gt;</button>
            </div>
          </div>
          <div id="calendar-container">
            <!-- Calendar Grid goes here -->
          </div>
        </div>

        <div class="card">
          <div class="pm-header">
            <h4>MONITORING JADWAL PM</h4>
          </div>
          <div id="monitoring-table-container">
            <div class="page-loading"><div class="spinner"></div></div>
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
      <div class="table-container">
        <table class="data-table">
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
                  statusHtml = `<span class="badge" style="background:var(--danger); color:#fff;">OVERDUE</span>`;
                } else {
                  statusHtml = `<span class="badge" style="background:var(--warning); color:#000;">WO AKTIF</span>`;
                }
              } else if (wo.status === 'closed') {
                const closedAtStr = wo.closed_at ? wo.closed_at.split('T')[0] : '';
                if (closedAtStr < openedAtStr) {
                  statusHtml = `<span class="badge" style="background:var(--primary); color:#fff;">SELESAI (LEBIH AWAL)</span>`;
                } else if (closedAtStr === openedAtStr) {
                  statusHtml = `<span class="badge" style="background:var(--success); color:#fff;">SELESAI (TEPAT WAKTU)</span>`;
                } else {
                  statusHtml = `<span class="badge" style="background:var(--danger); color:#fff;">SELESAI (TERLAMBAT)</span>`;
                }
              }

              return `
                <tr>
                  <td>${eqName}</td>
                  <td>${activity}</td>
                  <td>${statusHtml}</td>
                  ${isAdmin ? `
                    <td>
                      <div class="table-actions">
                        <button class="btn btn-ghost btn-icon btn-sm" data-delete-wo="${wo.id}" title="Hapus WO"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('')}
            ${projectedPMs.map(pm => {
              const eqName = pm.equipment?.namaEquipment || pm.equipment_id || '-';
              const activity = escapeHtml(pm.title);
              const statusHtml = `<span class="badge" style="background:var(--bg-surface); color:var(--text-secondary); border: 1px solid var(--border-color);">TERJADWAL (MASA DEPAN)</span>`;
              
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
    <div class="table-container" style="max-height: 400px; overflow-y: auto;">
      <table class="data-table">
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
                <td style="font-family:monospace; font-size:0.9rem;">${shortId}</td>
                <td>${pm.equipment_id || '-'}</td>
                <td>${pm.last_done ? formatDate(pm.last_done) : '<span style="color:var(--text-muted);font-size:var(--fs-xs)">Belum ada</span>'}</td>
                <td>${formatDate(pm.next_due)}<br><small class="text-muted">(${pm.interval_days} hari)</small></td>
                <td><span style="font-size:var(--fs-xs);color:var(--text-secondary)">${pm.estimated_hours || 0} jam</span></td>
                ${isAdmin ? `
                  <td>
                    <button class="btn btn-ghost btn-icon btn-sm" data-delete-pm="${pm.id}" title="Hapus Jadwal PM" style="color:var(--danger);">
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
    estimated_hours: parseFloat(document.getElementById('form-est-hours').value) || 0,
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
    document.getElementById('form-est-hours').value = '';

    await loadData();
  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan jadwal PM', 'error');
  }
}
