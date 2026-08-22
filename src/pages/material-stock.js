import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow, updateRow, deleteRow } from '../lib/supabase.js';
import { MATERIAL_CATEGORIES, UNITS } from '../utils/constants.js';
import { formatNumber, debounce, escapeHtml } from '../utils/helpers.js';

let allMaterials = [];

export async function renderMaterialStock() {
  const content = renderAppShell('Stok Material');

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <h2>Stok Material</h2>
        <div class="page-header-actions">
          <button class="btn btn-primary d-flex align-items-center gap-2" id="add-mat-btn">${icons.plus} <span>Tambah Material</span></button>
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          ${icons.search}
          <input type="text" class="form-control form-control-sm" id="mat-search" placeholder="Cari material..." />
        </div>
        <div class="filter-group">
          <select class="form-select form-select-sm" id="filter-mat-category" style="min-width:150px">
            <option value="">Semua Kategori</option>
            ${MATERIAL_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <select class="form-select form-select-sm" id="filter-mat-stock" style="min-width:130px">
            <option value="">Semua Stok</option>
            <option value="low">Stok Rendah</option>
            <option value="ok">Stok Aman</option>
          </select>
        </div>
      </div>
      <div id="mat-table-wrapper">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  document.getElementById('add-mat-btn').addEventListener('click', () => showMaterialForm());
  document.getElementById('mat-search').addEventListener('input', debounce(filterAndRender));
  document.getElementById('filter-mat-category').addEventListener('change', filterAndRender);
  document.getElementById('filter-mat-stock').addEventListener('change', filterAndRender);

  await loadMaterials();
}

async function loadMaterials() {
  try {
    allMaterials = await fetchAll('material_stock', { order: { column: 'name', ascending: true } });
    filterAndRender();
  } catch (err) {
    showToast('Gagal memuat data material', 'error');
  }
}

function filterAndRender() {
  const search = (document.getElementById('mat-search')?.value || '').toLowerCase();
  const category = document.getElementById('filter-mat-category')?.value || '';
  const stockFilter = document.getElementById('filter-mat-stock')?.value || '';

  let filtered = allMaterials.filter(m => {
    if (search && !`${m.name} ${m.part_number}`.toLowerCase().includes(search)) return false;
    if (category && m.category !== category) return false;
    if (stockFilter === 'low' && m.quantity >= m.min_stock) return false;
    if (stockFilter === 'ok' && m.quantity < m.min_stock) return false;
    return true;
  });

  renderTable(filtered);
}

function renderTable(data) {
  const wrapper = document.getElementById('mat-table-wrapper');
  if (!wrapper) return;

  if (data.length === 0) {
    wrapper.innerHTML = `<div class="empty-state">${icons.package}<h4>Tidak ada material</h4><p>Tambahkan material baru untuk memulai</p></div>`;
    return;
  }

  const lowCount = data.filter(m => m.quantity < m.min_stock).length;

  wrapper.innerHTML = `
    ${lowCount > 0 ? `<div class="alert alert-warning d-flex align-items-center gap-2 mb-3">
      ${icons.alertTriangle} <strong>${lowCount} material</strong> stok di bawah minimum!
    </div>` : ''}
    <div class="table-container">
      <table class="table table-hover table-bordered mb-0">
        <thead>
          <tr>
            <th>Part No.</th><th>Nama</th><th>Kategori</th><th>Stok</th><th>Min. Stok</th><th>Satuan</th><th>Lokasi</th><th>Supplier</th><th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(m => {
            const isLow = m.quantity < m.min_stock;
            return `
            <tr${isLow ? ' class="table-danger"' : ''}>
              <td><span class="equipment-code">${escapeHtml(m.part_number)}</span></td>
              <td>${escapeHtml(m.name)}</td>
              <td>${escapeHtml(m.category || '-')}</td>
              <td><span class="${isLow ? 'low-stock' : 'stock-ok'}">${formatNumber(m.quantity)}</span></td>
              <td>${formatNumber(m.min_stock)}</td>
              <td>${m.unit}</td>
              <td>${escapeHtml(m.location || '-')}</td>
              <td>${escapeHtml(m.supplier || '-')}</td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-outline-warning btn-sm btn-icon" data-edit="${m.id}" title="Edit">${icons.edit}</button>
                  <button class="btn btn-outline-danger btn-sm btn-icon" data-delete="${m.id}" title="Hapus">${icons.trash}</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  wrapper.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mat = allMaterials.find(m => m.id === btn.dataset.edit);
      if (mat) showMaterialForm(mat);
    });
  });

  wrapper.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mat = allMaterials.find(m => m.id === btn.dataset.delete);
      if (mat) {
        showConfirm({
          message: `Hapus material "${mat.name}"?`,
          onConfirm: async () => {
            try {
              await deleteRow('material_stock', mat.id);
              showToast('Material berhasil dihapus', 'success');
              await loadMaterials();
            } catch (err) {
              showToast('Gagal menghapus material', 'error');
            }
          }
        });
      }
    });
  });
}

function showMaterialForm(existing = null) {
  const isEdit = !!existing;
  showModal({
    title: isEdit ? 'Edit Material' : 'Tambah Material',
    size: 'modal-lg',
    body: `
      <div class="row g-3">
        <div class="col-6">
          <label class="form-label">Part Number *</label>
          <input class="form-control" id="mat-part" value="${existing?.part_number || ''}" placeholder="SPR-001" required />
        </div>
        <div class="col-6">
          <label class="form-label">Nama Material *</label>
          <input class="form-control" id="mat-name" value="${existing?.name || ''}" placeholder="Nama material" required />
        </div>
        <div class="col-6">
          <label class="form-label">Kategori</label>
          <select class="form-select" id="mat-category">
            <option value="">Pilih Kategori</option>
            ${MATERIAL_CATEGORIES.map(c => `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="col-6">
          <label class="form-label">Satuan</label>
          <select class="form-select" id="mat-unit">
            ${UNITS.map(u => `<option value="${u}" ${existing?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </div>
        <div class="col-4">
          <label class="form-label">Jumlah Stok</label>
          <input type="number" class="form-control" id="mat-qty" value="${existing?.quantity ?? 0}" min="0" />
        </div>
        <div class="col-4">
          <label class="form-label">Minimum Stok</label>
          <input type="number" class="form-control" id="mat-min" value="${existing?.min_stock ?? 5}" min="0" />
        </div>
        <div class="col-4">
          <label class="form-label">Harga (Rp)</label>
          <input type="number" class="form-control" id="mat-price" value="${existing?.price ?? 0}" min="0" step="100" />
        </div>
        <div class="col-6">
          <label class="form-label">Lokasi Penyimpanan</label>
          <input class="form-control" id="mat-location" value="${existing?.location || ''}" placeholder="Gudang A, Rak 3" />
        </div>
        <div class="col-6">
          <label class="form-label">Supplier</label>
          <input class="form-control" id="mat-supplier" value="${existing?.supplier || ''}" placeholder="Nama supplier" />
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="mat-cancel">Batal</button>
      <button class="btn btn-primary" id="mat-save">${isEdit ? 'Simpan Perubahan' : 'Tambah Material'}</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#mat-cancel').addEventListener('click', close);
      overlay.querySelector('#mat-save').addEventListener('click', async () => {
        const part_number = overlay.querySelector('#mat-part').value.trim();
        const name = overlay.querySelector('#mat-name').value.trim();
        if (!part_number || !name) {
          showToast('Part Number dan Nama wajib diisi', 'warning');
          return;
        }

        const data = {
          part_number,
          name,
          category: overlay.querySelector('#mat-category').value,
          unit: overlay.querySelector('#mat-unit').value,
          quantity: parseInt(overlay.querySelector('#mat-qty').value) || 0,
          min_stock: parseInt(overlay.querySelector('#mat-min').value) || 5,
          location: overlay.querySelector('#mat-location').value.trim(),
          supplier: overlay.querySelector('#mat-supplier').value.trim(),
          price: parseFloat(overlay.querySelector('#mat-price').value) || 0,
        };

        try {
          if (isEdit) {
            await updateRow('material_stock', existing.id, data);
            showToast('Material berhasil diperbarui', 'success');
          } else {
            await insertRow('material_stock', data);
            showToast('Material berhasil ditambahkan', 'success');
          }
          close();
          await loadMaterials();
        } catch (err) {
          showToast(err.message || 'Gagal menyimpan', 'error');
        }
      });
    }
  });
}
