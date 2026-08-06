import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow, updateRow, deleteRow, bulkUpdateRows } from '../lib/supabase.js';
import { EQUIPMENT_STATUS, EQUIPMENT_CATEGORIES } from '../utils/constants.js';
import { formatDate, debounce, escapeHtml, badge, setupBulkSelection } from '../utils/helpers.js';

let allEquipment = [];
let selectedEquipmentIds = [];

export async function renderEquipment() {
  const content = renderAppShell('Daftar Equipment');

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <h2>Daftar Equipment</h2>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="add-equip-btn">${icons.plus} Tambah Equipment</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          ${icons.search}
          <input type="text" class="form-input" id="equip-search" placeholder="Cari equipment..." />
        </div>
        <div class="filter-group">
          <select class="form-select" id="filter-status">
            <option value="">Semua Kondisi</option>
            ${Object.entries(EQUIPMENT_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <select class="form-select" id="filter-category">
            <option value="">Semua Kategori</option>
            ${EQUIPMENT_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="equip-table-wrapper">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>

      <!-- BULK ACTION BAR -->
      <div class="bulk-action-bar" id="bulk-action-bar">
        <div class="bulk-selected-count">
          <span class="badge" id="bulk-count-badge">0</span> item terpilih
        </div>
        <div class="bulk-actions">
          <select class="form-select form-select-sm" id="bulk-status-select" style="min-width: 150px; padding-top: 4px; padding-bottom: 4px;">
            <option value="">Ubah Kondisi...</option>
            ${Object.entries(EQUIPMENT_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" id="btn-bulk-update" style="padding: 4px 12px">Update</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-equip-btn').addEventListener('click', () => showEquipmentForm());
  document.getElementById('equip-search').addEventListener('input', debounce(filterAndRender));
  document.getElementById('filter-status').addEventListener('change', filterAndRender);
  document.getElementById('filter-category').addEventListener('change', filterAndRender);
  
  document.getElementById('btn-bulk-update').addEventListener('click', handleBulkUpdate);

  await loadEquipment();
}

async function handleBulkUpdate() {
  const newStatus = document.getElementById('bulk-status-select').value;
  if (!newStatus) return showToast('Pilih kondisi terlebih dahulu', 'warning');
  if (selectedEquipmentIds.length === 0) return;

  showConfirm({
    message: `Ubah kondisi ${selectedEquipmentIds.length} equipment menjadi ${EQUIPMENT_STATUS[newStatus].label}?`,
    onConfirm: async () => {
      try {
        await bulkUpdateRows('equipment', selectedEquipmentIds, { kondisi: newStatus }, 'idAset');
        showToast('Berhasil update kondisi massal', 'success');
        document.getElementById('bulk-status-select').value = '';
        selectedEquipmentIds = [];
        updateBulkBar();
        await loadEquipment();
      } catch (err) {
        showToast('Gagal update massal', 'error');
      }
    }
  });
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-action-bar');
  const badge = document.getElementById('bulk-count-badge');
  if (selectedEquipmentIds.length > 0) {
    badge.textContent = selectedEquipmentIds.length;
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
  }
}

async function loadEquipment() {
  try {
    allEquipment = await fetchAll('equipment', { order: { column: 'created_at', ascending: false } });
    filterAndRender();
  } catch (err) {
    showToast('Gagal memuat data equipment', 'error');
  }
}

function filterAndRender() {
  const search = (document.getElementById('equip-search')?.value || '').toLowerCase();
  const status = document.getElementById('filter-status')?.value || '';
  const category = document.getElementById('filter-category')?.value || '';

  let filtered = allEquipment.filter(e => {
    if (search && !`${e.namaEquipment} ${e.noInventory} ${e.idAset} ${e.area}`.toLowerCase().includes(search)) return false;
    if (status && e.kondisi !== status) return false;
    if (category && e.kategori !== category) return false;
    return true;
  });

  renderTable(filtered);
}

function renderTable(data) {
  const wrapper = document.getElementById('equip-table-wrapper');
  if (!wrapper) return;

  if (data.length === 0) {
    wrapper.innerHTML = `<div class="empty-state">${icons.hardDrive}<h4>Tidak ada equipment</h4><p>Tambahkan equipment baru untuk memulai</p></div>`;
    updateBulkBar();
    return;
  }

  wrapper.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead><tr>
          <th class="col-checkbox"><input type="checkbox" class="form-checkbox" id="select-all" /></th>
          <th>ID Asset</th><th>No Inventory</th><th>Nama</th><th>Kategori</th><th>Area</th><th>Kondisi</th><th>Aksi</th>
        </tr></thead>
        <tbody>
          ${data.map(e => `
            <tr>
              <td class="col-checkbox"><input type="checkbox" class="form-checkbox row-checkbox" value="${e.idAset}" ${selectedEquipmentIds.includes(e.idAset) ? 'checked' : ''} /></td>
              <td><span class="equipment-code">${escapeHtml(e.idAset)}</span></td>
              <td>${escapeHtml(e.noInventory || '-')}</td>
              <td>${escapeHtml(e.namaEquipment)}</td>
              <td>${escapeHtml(e.kategori || '-')}</td>
              <td>${escapeHtml(e.area || '-')}</td>
              <td>${badge(EQUIPMENT_STATUS[e.kondisi]?.label || e.kondisi, EQUIPMENT_STATUS[e.kondisi]?.color, EQUIPMENT_STATUS[e.kondisi]?.bg)}</td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-ghost btn-icon btn-sm" data-edit="${e.idAset}" title="Edit">${icons.edit}</button>
                  <button class="btn btn-ghost btn-icon btn-sm" data-delete="${e.idAset}" title="Hapus">${icons.trash}</button>
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
    selectedEquipmentIds = selected;
    updateBulkBar();
  });

  wrapper.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const equip = allEquipment.find(e => e.idAset === btn.dataset.edit);
      if (equip) showEquipmentForm(equip);
    });
  });

  wrapper.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const equip = allEquipment.find(e => e.idAset === btn.dataset.delete);
      if (equip) {
        showConfirm({
          message: `Hapus equipment "${equip.namaEquipment}"?`,
          onConfirm: async () => {
            try {
              // Note: deleteRow might expect 'id' as column, so we might need a custom delete if PK is idAset
              await deleteRow('equipment', equip.idAset, 'idAset');
              showToast('Equipment berhasil dihapus', 'success');
              await loadEquipment();
            } catch (err) {
              showToast('Gagal menghapus equipment', 'error');
            }
          }
        });
      }
    });
  });
}

function showEquipmentForm(existing = null) {
  const isEdit = !!existing;
  showModal({
    title: isEdit ? 'Edit Equipment' : 'Tambah Equipment',
    size: 'modal-lg',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">ID Asset *</label>
          <input class="form-input" id="eq-idasset" value="${existing?.idAset || ''}" placeholder="ID Asset" required ${isEdit ? 'disabled' : ''} />
        </div>
        <div class="form-group">
          <label class="form-label">Nama Equipment *</label>
          <input class="form-input" id="eq-name" value="${existing?.namaEquipment || ''}" placeholder="Nama equipment" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">No Inventory</label>
          <input class="form-input" id="eq-inventory" value="${existing?.noInventory || ''}" placeholder="No Inventory" />
        </div>
        <div class="form-group">
          <label class="form-label">Kategori</label>
          <select class="form-select" id="eq-category">
            <option value="">Pilih Kategori</option>
            ${EQUIPMENT_CATEGORIES.map(c => `<option value="${c}" ${existing?.kategori === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Area</label>
          <input class="form-input" id="eq-location" value="${existing?.area || ''}" placeholder="Area/lokasi" />
        </div>
        <div class="form-group">
          <label class="form-label">Kondisi</label>
          <select class="form-select" id="eq-status">
            ${Object.entries(EQUIPMENT_STATUS).map(([k, v]) => `<option value="${k}" ${existing?.kondisi === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Manufaktur</label>
          <input class="form-input" id="eq-manufacturer" value="${existing?.manuf || ''}" placeholder="Nama pabrikan" />
        </div>
        <div class="form-group">
          <label class="form-label">Tipe/Model</label>
          <input class="form-input" id="eq-model" value="${existing?.type || ''}" placeholder="Tipe" />
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="eq-cancel">Batal</button>
      <button class="btn btn-primary" id="eq-save">${isEdit ? 'Simpan Perubahan' : 'Tambah Equipment'}</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#eq-cancel').addEventListener('click', close);
      overlay.querySelector('#eq-save').addEventListener('click', async () => {
        const idAset = overlay.querySelector('#eq-idasset').value.trim();
        const namaEquipment = overlay.querySelector('#eq-name').value.trim();
        
        if (!idAset || !namaEquipment) {
          showToast('ID Asset dan Nama wajib diisi', 'warning');
          return;
        }

        const data = {
          idAset,
          namaEquipment,
          noInventory: overlay.querySelector('#eq-inventory').value.trim(),
          kategori: overlay.querySelector('#eq-category').value,
          area: overlay.querySelector('#eq-location').value.trim(),
          kondisi: overlay.querySelector('#eq-status').value,
          manuf: overlay.querySelector('#eq-manufacturer').value.trim(),
          type: overlay.querySelector('#eq-model').value.trim()
        };

        try {
          if (isEdit) {
            await updateRow('equipment', idAset, data, 'idAset');
            showToast('Equipment berhasil diperbarui', 'success');
          } else {
            await insertRow('equipment', data);
            showToast('Equipment berhasil ditambahkan', 'success');
          }
          close();
          await loadEquipment();
        } catch (err) {
          showToast(err.message || 'Gagal menyimpan', 'error');
        }
      });
    }
  });
}
