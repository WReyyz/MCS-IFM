import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow, updateRow, deleteRow, bulkUpdateRows } from '../lib/supabase.js';
import { SHIFTS, SCHEDULE_STATUS, ROLES } from '../utils/constants.js';
import { formatDate, escapeHtml, badge, setupBulkSelection } from '../utils/helpers.js';

let technicianList = [];
let scheduleData = [];
let selectedScheduleIds = [];

export async function renderTechnician() {
  const content = renderAppShell('Manajemen Teknisi');

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <h2>Manajemen Teknisi</h2>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="add-schedule-btn">${icons.plus} Atur Jadwal</button>
        </div>
      </div>

      <div class="stat-cards" style="grid-template-columns: repeat(3, 1fr); margin-bottom: var(--sp-6)">
        <div class="stat-card animate-fade-in-up" style="--stat-accent:linear-gradient(135deg,#10b981,#059669)">
          <div class="stat-icon" style="background:rgba(16,185,129,0.15);color:#10b981">${icons.userCheck}</div>
          <div class="stat-value" id="stat-on-duty">-</div>
          <div class="stat-label">Bertugas Hari Ini</div>
        </div>
        <div class="stat-card animate-fade-in-up" style="--stat-accent:linear-gradient(135deg,#6b7280,#4b5563)">
          <div class="stat-icon" style="background:rgba(107,114,128,0.15);color:#6b7280">${icons.userX}</div>
          <div class="stat-value" id="stat-off-duty">-</div>
          <div class="stat-label">Libur Hari Ini</div>
        </div>
        <div class="stat-card animate-fade-in-up" style="--stat-accent:linear-gradient(135deg,#8b5cf6,#a855f7)">
          <div class="stat-icon" style="background:rgba(139,92,246,0.15);color:#8b5cf6">${icons.users}</div>
          <div class="stat-value" id="stat-total-tech">-</div>
          <div class="stat-label">Total Teknisi</div>
        </div>
      </div>

      <div class="card animate-fade-in-up" style="margin-bottom:var(--sp-6)">
        <div class="card-header">
          <h3 class="card-title">Daftar Teknisi</h3>
        </div>
        <div id="tech-table-wrapper">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>

      <div class="card animate-fade-in-up">
        <div class="card-header">
          <h3 class="card-title">Jadwal Hari Ini</h3>
        </div>
        <div id="schedule-wrapper">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>

      <!-- BULK ACTION BAR -->
      <div class="bulk-action-bar" id="bulk-action-bar">
        <div class="bulk-selected-count">
          <span class="badge" id="bulk-count-badge">0</span> item terpilih
        </div>
        <div class="bulk-actions">
          <select class="form-select form-select-sm" id="bulk-status-select" style="min-width: 150px; padding-top: 4px; padding-bottom: 4px;">
            <option value="">Ubah Status...</option>
            ${Object.entries(SCHEDULE_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" id="btn-bulk-update" style="padding: 4px 12px">Update</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-schedule-btn').addEventListener('click', () => showScheduleForm());
  document.getElementById('btn-bulk-update').addEventListener('click', handleBulkUpdate);

  await loadTechData();
}

async function handleBulkUpdate() {
  const newStatus = document.getElementById('bulk-status-select').value;
  if (!newStatus) return showToast('Pilih status terlebih dahulu', 'warning');
  if (selectedScheduleIds.length === 0) return;

  // We need to use standard confirm since showConfirm is for app modal, but we'll import it correctly later if needed.
  if (confirm(`Ubah status ${selectedScheduleIds.length} jadwal menjadi ${SCHEDULE_STATUS[newStatus].label}?`)) {
    try {
      await bulkUpdateRows('technician_schedule', selectedScheduleIds, { status: newStatus });
      showToast('Berhasil update status massal', 'success');
      document.getElementById('bulk-status-select').value = '';
      selectedScheduleIds = [];
      updateBulkBar();
      await loadTechData();
    } catch (err) {
      showToast('Gagal update massal', 'error');
    }
  }
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-action-bar');
  const badge = document.getElementById('bulk-count-badge');
  if (selectedScheduleIds.length > 0) {
    badge.textContent = selectedScheduleIds.length;
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
  }
}


async function loadTechData() {
  try {
    const today = new Date().toISOString().split('T')[0];
    [technicianList, scheduleData] = await Promise.all([
      fetchAll('profiles', { filters: [{ column: 'role', value: 'technician' }], order: { column: 'full_name', ascending: true } }),
      fetchAll('technician_schedule', {
        select: '*, profiles:profile_id(full_name)',
        filters: [{ column: 'schedule_date', value: today }],
        order: { column: 'created_at', ascending: false }
      }),
    ]);

    const onDuty = scheduleData.filter(s => s.status === 'on_duty').length;
    const offDuty = scheduleData.filter(s => s.status !== 'on_duty').length;

    document.getElementById('stat-on-duty').textContent = onDuty;
    document.getElementById('stat-off-duty').textContent = offDuty;
    document.getElementById('stat-total-tech').textContent = technicianList.length;

    renderTechTable();
    renderScheduleTable();
  } catch (err) {
    showToast('Gagal memuat data teknisi', 'error');
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
    <div class="table-container" style="border:none">
      <table class="data-table">
        <thead><tr>
          <th>Nama</th><th>Departemen</th><th>Telepon</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${technicianList.map(t => {
            const todaySchedule = scheduleData.find(s => s.profile_id === t.id);
            const statusKey = todaySchedule?.status || 'off_duty';
            return `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:var(--sp-3)">
                  <div class="sidebar-avatar" style="width:32px;height:32px;font-size:var(--fs-xs)">${(t.full_name || 'T').charAt(0).toUpperCase()}</div>
                  <span>${escapeHtml(t.full_name || '-')}</span>
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
    <div class="table-container" style="border:none">
      <table class="data-table">
        <thead><tr>
          <th class="col-checkbox"><input type="checkbox" class="form-checkbox" id="select-all" /></th>
          <th>Teknisi</th><th>Shift</th><th>Status</th><th>Catatan</th><th>Aksi</th>
        </tr></thead>
        <tbody>
          ${scheduleData.map(s => `
            <tr>
              <td class="col-checkbox"><input type="checkbox" class="form-checkbox row-checkbox" value="${s.id}" ${selectedScheduleIds.includes(s.id) ? 'checked' : ''} /></td>
              <td>${s.profiles?.full_name || '-'}</td>
              <td>${badge(SHIFTS[s.shift]?.label || s.shift, SHIFTS[s.shift]?.color || '#9ca3af', 'rgba(156,163,175,0.15)')}</td>
              <td>${badge(SCHEDULE_STATUS[s.status]?.label, SCHEDULE_STATUS[s.status]?.color, SCHEDULE_STATUS[s.status]?.bg)}</td>
              <td>${escapeHtml(s.notes || '-')}</td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-ghost btn-icon btn-sm" data-edit-schedule="${s.id}" title="Edit">${icons.edit}</button>
                  <button class="btn btn-ghost btn-icon btn-sm" data-del-schedule="${s.id}" title="Hapus">${icons.trash}</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Setup bulk selection helper
  setupBulkSelection(wrapper, (selected) => {
    selectedScheduleIds = selected;
    updateBulkBar();
  });

  wrapper.querySelectorAll('[data-edit-schedule]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sched = scheduleData.find(s => s.id === btn.dataset.editSchedule);
      if (sched) showScheduleForm(sched);
    });
  });

  wrapper.querySelectorAll('[data-del-schedule]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await deleteRow('technician_schedule', btn.dataset.delSchedule);
        showToast('Jadwal dihapus', 'success');
        await loadTechData();
      } catch (err) {
        showToast('Gagal menghapus jadwal', 'error');
      }
    });
  });
}

function showScheduleForm(existing = null) {
  const isEdit = !!existing;
  const today = new Date().toISOString().split('T')[0];

  showModal({
    title: isEdit ? 'Edit Jadwal' : 'Atur Jadwal Teknisi',
    body: `
      <div class="form-group">
        <label class="form-label">Teknisi *</label>
        <select class="form-select" id="sched-tech">
          <option value="">Pilih Teknisi</option>
          ${technicianList.map(t => `<option value="${t.id}" ${existing?.profile_id === t.id ? 'selected' : ''}>${t.full_name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tanggal *</label>
          <input type="date" class="form-input" id="sched-date" value="${existing?.schedule_date || today}" />
        </div>
        <div class="form-group">
          <label class="form-label">Shift</label>
          <select class="form-select" id="sched-shift">
            ${Object.entries(SHIFTS).map(([k, v]) => `<option value="${k}" ${existing?.shift === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="sched-status">
          ${Object.entries(SCHEDULE_STATUS).map(([k, v]) => `<option value="${k}" ${existing?.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Catatan</label>
        <input class="form-input" id="sched-notes" value="${existing?.notes || ''}" placeholder="Catatan opsional" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="sched-cancel">Batal</button>
      <button class="btn btn-primary" id="sched-save">${isEdit ? 'Simpan' : 'Tambah Jadwal'}</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#sched-cancel').addEventListener('click', close);
      overlay.querySelector('#sched-save').addEventListener('click', async () => {
        const profile_id = overlay.querySelector('#sched-tech').value;
        const schedule_date = overlay.querySelector('#sched-date').value;
        if (!profile_id || !schedule_date) {
          showToast('Teknisi dan Tanggal wajib diisi', 'warning');
          return;
        }

        const data = {
          profile_id,
          schedule_date,
          shift: overlay.querySelector('#sched-shift').value,
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
        } catch (err) {
          showToast(err.message || 'Gagal menyimpan', 'error');
        }
      });
    }
  });
}
