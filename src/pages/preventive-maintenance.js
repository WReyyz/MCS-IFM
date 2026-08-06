import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow, updateRow, deleteRow, bulkUpdateRows } from '../lib/supabase.js';
import { PM_STATUS } from '../utils/constants.js';
import { formatDate, debounce, escapeHtml, badge, isOverdue, setupBulkSelection } from '../utils/helpers.js';

let allPMs = [];
let equipmentList = [];
let technicianList = [];
let selectedPMIds = [];

export async function renderPreventiveMaintenance() {
  const content = renderAppShell('Preventive Maintenance');

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <h2>Preventive Maintenance</h2>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="add-pm-btn">${icons.plus} Tambah Jadwal PM</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          ${icons.search}
          <input type="text" class="form-input" id="pm-search" placeholder="Cari PM..." />
        </div>
        <div class="filter-group">
          <select class="form-select" id="filter-pm-status">
            <option value="">Semua Status</option>
            ${Object.entries(PM_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="pm-table-wrapper">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>

      <!-- BULK ACTION BAR -->
      <div class="bulk-action-bar" id="bulk-action-bar">
        <div class="bulk-selected-count">
          <span class="badge" id="bulk-count-badge">0</span> item terpilih
        </div>
        <div class="bulk-actions">
          <select class="form-select form-select-sm" id="bulk-status-select" style="min-width: 150px; padding-top: 4px; padding-bottom: 4px;">
            <option value="">Ubah Status...</option>
            ${Object.entries(PM_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" id="btn-bulk-update" style="padding: 4px 12px">Update</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-pm-btn').addEventListener('click', () => showPMForm());
  document.getElementById('pm-search').addEventListener('input', debounce(filterAndRender));
  document.getElementById('filter-pm-status').addEventListener('change', filterAndRender);
  
  document.getElementById('btn-bulk-update').addEventListener('click', handleBulkUpdate);

  await loadPMs();
}

async function handleBulkUpdate() {
  const newStatus = document.getElementById('bulk-status-select').value;
  if (!newStatus) return showToast('Pilih status terlebih dahulu', 'warning');
  if (selectedPMIds.length === 0) return;

  showConfirm({
    message: `Ubah status ${selectedPMIds.length} jadwal PM menjadi ${PM_STATUS[newStatus].label}?`,
    onConfirm: async () => {
      try {
        await bulkUpdateRows('preventive_maintenance', selectedPMIds, { status: newStatus });
        showToast('Berhasil update status massal', 'success');
        document.getElementById('bulk-status-select').value = '';
        selectedPMIds = [];
        updateBulkBar();
        await loadPMs();
      } catch (err) {
        showToast('Gagal update massal', 'error');
      }
    }
  });
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-action-bar');
  const badge = document.getElementById('bulk-count-badge');
  if (selectedPMIds.length > 0) {
    badge.textContent = selectedPMIds.length;
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
  }
}

async function loadPMs() {
  try {
    [allPMs, equipmentList, technicianList] = await Promise.all([
      fetchAll('preventive_maintenance', { select: '*, equipment(namaEquipment, idAset), profiles:assigned_to(full_name)', order: { column: 'next_due', ascending: true } }),
      fetchAll('equipment', { order: { column: 'namaEquipment', ascending: true } }),
      fetchAll('profiles', { filters: [{ column: 'role', value: 'technician' }], order: { column: 'full_name', ascending: true } }),
    ]);
    filterAndRender();
  } catch (err) {
    showToast('Gagal memuat data PM', 'error');
  }
}

function filterAndRender() {
  const search = (document.getElementById('pm-search')?.value || '').toLowerCase();
  const status = document.getElementById('filter-pm-status')?.value || '';

  let filtered = allPMs.filter(pm => {
    if (search && !`${pm.title} ${pm.equipment?.namaEquipment || ''}`.toLowerCase().includes(search)) return false;
    if (status && pm.status !== status) return false;
    return true;
  });

  renderTable(filtered);
}

function renderTable(data) {
  const wrapper = document.getElementById('pm-table-wrapper');
  if (!wrapper) return;

  if (data.length === 0) {
    wrapper.innerHTML = `<div class="empty-state">${icons.calendarCheck}<h4>Tidak ada jadwal PM</h4><p>Tambahkan jadwal PM untuk memulai</p></div>`;
    updateBulkBar();
    return;
  }

  wrapper.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead><tr>
          <th class="col-checkbox"><input type="checkbox" class="form-checkbox" id="select-all" /></th>
          <th>Judul</th><th>Equipment</th><th>Interval</th><th>Terakhir</th><th>Berikutnya</th><th>Teknisi</th><th>Status</th><th>Aksi</th>
        </tr></thead>
        <tbody>
          ${data.map(pm => {
            const overdue = pm.status === 'scheduled' && isOverdue(pm.next_due);
            const statusKey = overdue ? 'overdue' : pm.status;
            return `
            <tr class="${overdue ? 'pm-overdue' : ''}">
              <td class="col-checkbox"><input type="checkbox" class="form-checkbox row-checkbox" value="${pm.id}" ${selectedPMIds.includes(pm.id) ? 'checked' : ''} /></td>
              <td>${escapeHtml(pm.title)}</td>
              <td>${pm.equipment?.namaEquipment || '-'}</td>
              <td>${pm.interval_days} hari</td>
              <td>${formatDate(pm.last_done)}</td>
              <td>${formatDate(pm.next_due)}</td>
              <td>${pm.profiles?.full_name || '-'}</td>
              <td>${badge(PM_STATUS[statusKey]?.label || statusKey, PM_STATUS[statusKey]?.color, PM_STATUS[statusKey]?.bg)}</td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-ghost btn-icon btn-sm" data-edit="${pm.id}" title="Edit">${icons.edit}</button>
                  <button class="btn btn-ghost btn-icon btn-sm" data-delete="${pm.id}" title="Hapus">${icons.trash}</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  setupBulkSelection(wrapper, (selected) => {
    selectedPMIds = selected;
    updateBulkBar();
  });

  wrapper.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pm = allPMs.find(p => p.id === btn.dataset.edit);
      if (pm) showPMForm(pm);
    });
  });

  wrapper.querySelectorAll('[data-complete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const pm = allPMs.find(p => p.id === btn.dataset.complete);
        if (!pm) return;
        const today = new Date().toISOString().split('T')[0];
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + pm.interval_days);
        await updateRow('preventive_maintenance', pm.id, {
          status: 'completed',
          last_done: today,
          next_due: nextDate.toISOString().split('T')[0],
        });
        showToast('PM ditandai selesai', 'success');
        await loadPMs();
      } catch (err) {
        showToast('Gagal memperbarui PM', 'error');
      }
    });
  });

  wrapper.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pm = allPMs.find(p => p.id === btn.dataset.delete);
      if (pm) {
        showConfirm({
          message: `Hapus jadwal PM "${pm.title}"?`,
          onConfirm: async () => {
            try {
              await deleteRow('preventive_maintenance', pm.id);
              showToast('PM berhasil dihapus', 'success');
              await loadPMs();
            } catch (err) {
              showToast('Gagal menghapus PM', 'error');
            }
          }
        });
      }
    });
  });
}

function showPMForm(existing = null) {
  const isEdit = !!existing;
  showModal({
    title: isEdit ? 'Edit Jadwal PM' : 'Tambah Jadwal PM',
    size: 'modal-lg',
    body: `
      <div class="form-group">
        <label class="form-label">Judul PM *</label>
        <input class="form-input" id="pm-title" value="${existing?.title || ''}" placeholder="Contoh: Ganti oli mesin press" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Equipment *</label>
          <select class="form-select" id="pm-equip">
            <option value="">Pilih Equipment</option>
            ${equipmentList.map(e => `<option value="${e.idAset}" ${existing?.equipment_id === e.idAset ? 'selected' : ''}>${e.idAset} - ${e.namaEquipment}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Interval (hari) *</label>
          <input type="number" class="form-input" id="pm-interval" value="${existing?.interval_days || 30}" min="1" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tanggal Jatuh Tempo</label>
          <input type="date" class="form-input" id="pm-next-due" value="${existing?.next_due || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Ditugaskan Ke</label>
          <select class="form-select" id="pm-assigned">
            <option value="">Pilih Teknisi</option>
            ${technicianList.map(t => `<option value="${t.id}" ${existing?.assigned_to === t.id ? 'selected' : ''}>${t.full_name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="pm-status">
          ${Object.entries(PM_STATUS).map(([k, v]) => `<option value="${k}" ${existing?.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Deskripsi</label>
        <textarea class="form-textarea" id="pm-desc" placeholder="Detail pekerjaan PM...">${existing?.description || ''}</textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="pm-cancel">Batal</button>
      <button class="btn btn-primary" id="pm-save">${isEdit ? 'Simpan Perubahan' : 'Tambah PM'}</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#pm-cancel').addEventListener('click', close);
      overlay.querySelector('#pm-save').addEventListener('click', async () => {
        const title = overlay.querySelector('#pm-title').value.trim();
        const equipment_id = overlay.querySelector('#pm-equip').value;
        if (!title || !equipment_id) {
          showToast('Judul dan Equipment wajib diisi', 'warning');
          return;
        }

        const data = {
          title,
          equipment_id,
          interval_days: parseInt(overlay.querySelector('#pm-interval').value) || 30,
          next_due: overlay.querySelector('#pm-next-due').value || null,
          assigned_to: overlay.querySelector('#pm-assigned').value || null,
          status: overlay.querySelector('#pm-status').value,
          description: overlay.querySelector('#pm-desc').value.trim(),
        };

        try {
          if (isEdit) {
            await updateRow('preventive_maintenance', existing.id, data);
            showToast('PM berhasil diperbarui', 'success');
          } else {
            await insertRow('preventive_maintenance', data);
            showToast('PM berhasil ditambahkan', 'success');
          }
          close();
          await loadPMs();
        } catch (err) {
          showToast(err.message || 'Gagal menyimpan', 'error');
        }
      });
    }
  });
}
