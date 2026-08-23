import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow, updateRow, deleteRow, bulkUpdateRows, getCurrentProfile, supabase } from '../lib/supabase.js';
import { TOOL_STATUS } from '../utils/constants.js';
import { formatDate, debounce, escapeHtml, badge, setupBulkSelection } from '../utils/helpers.js';

let allTools = [];
let selectedToolIds = [];
let currentProfile = null;

export async function renderTools() {
  currentProfile = await getCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';

  const content = renderAppShell('Tools');

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h2 class="mb-1 d-flex align-items-center gap-2">
            ${icons.wrench} <span>Daftar Tools</span>
          </h2>
          <p class="text-muted small mb-0">Manajemen peralatan kerja, spesifikasi, dan sertifikasi kalibrasi</p>
        </div>
        <div class="page-header-actions d-flex gap-2">
          <button class="btn btn-outline-success d-flex align-items-center gap-2" id="export-excel-btn">
            ${icons.download} <span>Export Excel</span>
          </button>
          ${isAdmin ? `
            <button class="btn btn-primary d-flex align-items-center gap-2" id="add-tool-btn">
              ${icons.plus} <span>Tambah Tool</span>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- STATS OVERVIEW -->
      <div class="row g-3 mb-3" id="tools-stats">
        <div class="col-6 col-md-3">
          <div class="card border-0 shadow-sm p-3 bg-white">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Total Tools</div>
                <h4 class="fw-bold mb-0 text-dark" id="stat-total">0</h4>
              </div>
              <div class="p-2 rounded bg-primary bg-opacity-10 text-primary fs-4">${icons.wrench}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card border-0 shadow-sm p-3 bg-white">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Siap Pakai</div>
                <h4 class="fw-bold mb-0 text-success" id="stat-ready">0</h4>
              </div>
              <div class="p-2 rounded bg-success bg-opacity-10 text-success fs-4">${icons.checkCircle}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card border-0 shadow-sm p-3 bg-white">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Perlu Kalibrasi</div>
                <h4 class="fw-bold mb-0 text-warning" id="stat-calib">0</h4>
              </div>
              <div class="p-2 rounded bg-warning bg-opacity-10 text-warning fs-4">${icons.alertTriangle}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card border-0 shadow-sm p-3 bg-white">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted small">Rusak / Hilang</div>
                <h4 class="fw-bold mb-0 text-danger" id="stat-broken">0</h4>
              </div>
              <div class="p-2 rounded bg-danger bg-opacity-10 text-danger fs-4">${icons.xCircle}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- TOOLBAR & FILTERS -->
      <div class="toolbar">
        <div class="search-box">
          ${icons.search}
          <input type="text" class="form-control form-control-sm" id="tool-search" placeholder="Cari nama tool, merk, no seri, no sertifikat..." />
        </div>
        <div class="filter-group d-flex gap-2 flex-wrap">
          <select class="form-select form-select-sm" id="filter-tool-status" style="min-width:160px">
            <option value="">Semua Kondisi</option>
            ${Object.entries(TOOL_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <select class="form-select form-select-sm" id="filter-tool-brand" style="min-width:140px">
            <option value="">Semua Merk</option>
          </select>
        </div>
      </div>

      <!-- TABLE WRAPPER -->
      <div id="tool-table-wrapper">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>

      <!-- BULK ACTION BAR -->
      <div class="bulk-action-bar" id="bulk-action-bar">
        <div class="bulk-selected-count">
          <span class="badge bg-warning text-dark" id="bulk-count-badge">0</span> item terpilih
        </div>
        <div class="bulk-actions d-flex gap-2 align-items-center">
          <select class="form-select form-select-sm" id="bulk-status-select" style="min-width:150px">
            <option value="">Ubah Status...</option>
            ${Object.entries(TOOL_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" id="btn-bulk-update">Update</button>
          ${isAdmin ? `
            <button class="btn btn-danger btn-sm" id="btn-bulk-delete" title="Hapus">${icons.trash}</button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  if (isAdmin) {
    document.getElementById('add-tool-btn')?.addEventListener('click', () => showToolForm());
    document.getElementById('btn-bulk-delete')?.addEventListener('click', handleBulkDelete);
  }
  document.getElementById('export-excel-btn')?.addEventListener('click', exportToExcel);
  document.getElementById('tool-search')?.addEventListener('input', debounce(filterAndRender));
  document.getElementById('filter-tool-status')?.addEventListener('change', filterAndRender);
  document.getElementById('filter-tool-brand')?.addEventListener('change', filterAndRender);
  document.getElementById('btn-bulk-update')?.addEventListener('click', handleBulkUpdate);

  await loadTools();
}

async function loadTools() {
  try {
    allTools = await fetchAll('tools', { order: { column: 'created_at', ascending: false } });
    updateBrandFilterOptions();
    updateStats();
    filterAndRender();
  } catch (err) {
    console.error('Error loading tools:', err);
    showToast('Gagal memuat data tools. Pastikan tabel tools sudah dibuat di Supabase.', 'error');
    const wrapper = document.getElementById('tool-table-wrapper');
    if (wrapper) {
      wrapper.innerHTML = `
        <div class="empty-state">
          ${icons.alertTriangle}
          <h4>Tabel Tools Belum Tersedia</h4>
          <p class="text-muted">Jalankan migrasi <code>011_tools.sql</code> di Supabase SQL Editor terlebih dahulu.</p>
        </div>
      `;
    }
  }
}

function updateStats() {
  const total = allTools.length;
  const ready = allTools.filter(t => t.status === 'baik' || !t.status).length;
  const calib = allTools.filter(t => t.status === 'perlu_kalibrasi' || t.status === 'dalam_kalibrasi').length;
  const broken = allTools.filter(t => t.status === 'rusak' || t.status === 'hilang').length;

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('stat-total', total);
  setEl('stat-ready', ready);
  setEl('stat-calib', calib);
  setEl('stat-broken', broken);
}

function updateBrandFilterOptions() {
  const brandSelect = document.getElementById('filter-tool-brand');
  if (!brandSelect) return;
  
  const currentVal = brandSelect.value;
  const brands = [...new Set(allTools.map(t => t.brand?.trim()).filter(Boolean))].sort();

  brandSelect.innerHTML = `<option value="">Semua Merk</option>` +
    brands.map(b => `<option value="${escapeHtml(b)}" ${b === currentVal ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('');
}

function filterAndRender() {
  const search = (document.getElementById('tool-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('filter-tool-status')?.value || '';
  const brandFilter = document.getElementById('filter-tool-brand')?.value || '';

  const filtered = allTools.filter(t => {
    if (search) {
      const matchName = (t.name || '').toLowerCase().includes(search);
      const matchBrand = (t.brand || '').toLowerCase().includes(search);
      const matchSN = (t.serial_number || '').toLowerCase().includes(search);
      const matchCert = (t.calibration_cert_no || '').toLowerCase().includes(search);
      const matchLoc = (t.location || '').toLowerCase().includes(search);
      if (!matchName && !matchBrand && !matchSN && !matchCert && !matchLoc) return false;
    }
    if (statusFilter && t.status !== statusFilter) return false;
    if (brandFilter && t.brand !== brandFilter) return false;
    return true;
  });

  renderTable(filtered);
}

function renderTable(data) {
  const wrapper = document.getElementById('tool-table-wrapper');
  if (!wrapper) return;
  const isAdmin = currentProfile?.role === 'admin';

  if (data.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state">
        ${icons.wrench}
        <h4>Tidak ada tools</h4>
        <p class="text-muted">${isAdmin ? 'Tambahkan tool baru untuk memulai pendataan.' : 'Belum ada data tool yang terdaftar.'}</p>
      </div>
    `;
    updateBulkBar();
    return;
  }

  wrapper.innerHTML = `
    <div class="table-container">
      <table class="table table-hover table-bordered mb-0">
        <thead>
          <tr>
            ${isAdmin ? '<th class="col-checkbox"><input type="checkbox" class="form-check-input" id="select-all" /></th>' : ''}
            <th>Nama Tools</th>
            <th>Merk</th>
            <th>No. Seri</th>
            <th>No. Sertifikat Kalibrasi</th>
            <th>Masa Kalibrasi</th>
            <th>Status / Kondisi</th>
            <th>Lokasi / Catatan</th>
            ${isAdmin ? '<th>Aksi</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${data.map(tool => {
            const st = TOOL_STATUS[tool.status] || TOOL_STATUS.baik;
            const calibInfo = tool.calibration_expiry 
              ? `<span class="${new Date(tool.calibration_expiry) < new Date() ? 'text-danger fw-semibold' : 'text-muted'}">${formatDate(tool.calibration_expiry)}</span>` 
              : `<span class="text-muted small">—</span>`;

            return `
              <tr>
                ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="form-check-input row-checkbox" value="${tool.id}" ${selectedToolIds.includes(tool.id) ? 'checked' : ''} /></td>` : ''}
                <td>
                  <div class="fw-semibold text-dark">${escapeHtml(tool.name)}</div>
                  ${tool.created_at ? `<div class="text-muted" style="font-size:0.75rem;">Ditambahkan: ${formatDate(tool.created_at)}</div>` : ''}
                </td>
                <td><span class="fw-medium">${escapeHtml(tool.brand || '-')}</span></td>
                <td><code>${escapeHtml(tool.serial_number || '-')}</code></td>
                <td>
                  ${tool.calibration_cert_no ? `
                    <span class="badge bg-light text-dark border font-monospace">
                      ${escapeHtml(tool.calibration_cert_no)}
                    </span>
                  ` : '<span class="text-muted small">—</span>'}
                </td>
                <td>
                  ${tool.calibration_date ? `<div class="small text-muted">Tgl: ${formatDate(tool.calibration_date)}</div>` : ''}
                  <div class="small">Exp: ${calibInfo}</div>
                </td>
                <td>${badge(st.label, st.color, st.bg)}</td>
                <td>
                  <div>${escapeHtml(tool.location || '-')}</div>
                  ${tool.notes ? `<div class="text-muted small fst-italic">${escapeHtml(tool.notes)}</div>` : ''}
                </td>
                ${isAdmin ? `
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-outline-warning btn-sm btn-icon" data-edit-tool="${tool.id}" title="Edit Tool">${icons.edit}</button>
                      <button class="btn btn-outline-danger btn-sm btn-icon" data-delete-tool="${tool.id}" title="Hapus Tool">${icons.trash}</button>
                    </div>
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
    setupBulkSelection(wrapper, (selected) => {
      selectedToolIds = selected;
      updateBulkBar();
    });

    wrapper.querySelectorAll('[data-edit-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = allTools.find(t => t.id === btn.dataset.editTool);
        if (tool) showToolForm(tool);
      });
    });

    wrapper.querySelectorAll('[data-delete-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = allTools.find(t => t.id === btn.dataset.deleteTool);
        if (tool) handleDeleteSingle(tool);
      });
    });
  }
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-action-bar');
  const bdg = document.getElementById('bulk-count-badge');
  if (!bar || !bdg) return;
  if (selectedToolIds.length > 0) {
    bdg.textContent = selectedToolIds.length;
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
  }
}

async function handleBulkUpdate() {
  const newStatus = document.getElementById('bulk-status-select').value;
  if (!newStatus) return showToast('Pilih status terlebih dahulu', 'warning');
  if (selectedToolIds.length === 0) return;

  const st = TOOL_STATUS[newStatus];
  showConfirm({
    message: `Ubah status ${selectedToolIds.length} tool menjadi "${st.label}"?`,
    onConfirm: async () => {
      try {
        await bulkUpdateRows('tools', selectedToolIds, { status: newStatus });
        showToast('Berhasil update status massal', 'success');
        document.getElementById('bulk-status-select').value = '';
        selectedToolIds = [];
        updateBulkBar();
        await loadTools();
      } catch (err) {
        showToast('Gagal update massal', 'error');
      }
    }
  });
}

async function handleBulkDelete() {
  if (selectedToolIds.length === 0) return;
  showConfirm({
    message: `Hapus ${selectedToolIds.length} tool terpilih secara permanen? Tindakan ini tidak dapat dibatalkan.`,
    onConfirm: async () => {
      try {
        const { error } = await supabase.from('tools').delete().in('id', selectedToolIds);
        if (error) throw error;
        showToast('Berhasil menghapus tools', 'success');
        selectedToolIds = [];
        updateBulkBar();
        await loadTools();
      } catch (err) {
        showToast('Gagal menghapus tools', 'error');
      }
    }
  });
}

function handleDeleteSingle(tool) {
  showConfirm({
    message: `Hapus tool "${tool.name}" (${tool.brand || 'No Brand'})?`,
    onConfirm: async () => {
      try {
        await deleteRow('tools', tool.id);
        showToast('Tool berhasil dihapus', 'success');
        await loadTools();
      } catch (err) {
        showToast('Gagal menghapus tool', 'error');
      }
    }
  });
}

// ---- ADD / EDIT MODAL FORM ----
function showToolForm(existing = null) {
  const isEdit = !!existing;

  showModal({
    title: isEdit ? 'Edit Data Tool' : 'Tambah Tool Baru',
    size: 'modal-lg',
    body: `
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <label class="form-label">Nama Tools *</label>
          <input class="form-control" id="tool-name" value="${escapeHtml(existing?.name || '')}" placeholder="Cth: Digital Multimeter, Torsi Wrench" required />
        </div>
        <div class="col-md-6">
          <label class="form-label">Merk / Brand *</label>
          <input class="form-control" id="tool-brand" value="${escapeHtml(existing?.brand || '')}" placeholder="Cth: Fluke, Bosch, Mitutoyo" required />
        </div>
      </div>
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <label class="form-label">No. Seri (Serial Number) *</label>
          <input class="form-control" id="tool-serial" value="${escapeHtml(existing?.serial_number || '')}" placeholder="Cth: SN-84920489" required />
        </div>
        <div class="col-md-6">
          <label class="form-label">No. Sertifikat Kalibrasi</label>
          <input class="form-control" id="tool-cert" value="${escapeHtml(existing?.calibration_cert_no || '')}" placeholder="Cth: CAL/2026/VIII/049" />
        </div>
      </div>
      <div class="row g-3 mb-3">
        <div class="col-md-4">
          <label class="form-label">Tanggal Kalibrasi Terakhir</label>
          <input type="date" class="form-control" id="tool-calib-date" value="${existing?.calibration_date || ''}" />
        </div>
        <div class="col-md-4">
          <label class="form-label">Masa Berlaku Kalibrasi / Expired</label>
          <input type="date" class="form-control" id="tool-calib-expiry" value="${existing?.calibration_expiry || ''}" />
        </div>
        <div class="col-md-4">
          <label class="form-label">Status / Kondisi</label>
          <select class="form-select" id="tool-status">
            ${Object.entries(TOOL_STATUS).map(([k, v]) => `
              <option value="${k}" ${existing?.status === k ? 'selected' : ''}>${v.label}</option>
            `).join('')}
          </select>
        </div>
      </div>
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <label class="form-label">Lokasi Penyimpanan</label>
          <input class="form-control" id="tool-location" value="${escapeHtml(existing?.location || '')}" placeholder="Cth: Tool Cabinet 02, Rak B-3" />
        </div>
        <div class="col-md-6">
          <label class="form-label">Catatan / Spesifikasi Tambahan</label>
          <input class="form-control" id="tool-notes" value="${escapeHtml(existing?.notes || '')}" placeholder="Cth: Akurasi ±0.5%, Range 0-1000V" />
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="tool-form-cancel">Batal</button>
      <button class="btn btn-primary" id="tool-form-save">${isEdit ? 'Simpan Perubahan' : 'Tambah Tool'}</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#tool-form-cancel').addEventListener('click', close);
      overlay.querySelector('#tool-form-save').addEventListener('click', async () => {
        const name = overlay.querySelector('#tool-name').value.trim();
        const brand = overlay.querySelector('#tool-brand').value.trim();
        const serial_number = overlay.querySelector('#tool-serial').value.trim();
        const calibration_cert_no = overlay.querySelector('#tool-cert').value.trim();
        const calibration_date = overlay.querySelector('#tool-calib-date').value || null;
        const calibration_expiry = overlay.querySelector('#tool-calib-expiry').value || null;
        const status = overlay.querySelector('#tool-status').value;
        const location = overlay.querySelector('#tool-location').value.trim();
        const notes = overlay.querySelector('#tool-notes').value.trim();

        if (!name) {
          showToast('Nama tools wajib diisi', 'warning');
          return;
        }

        const payload = {
          name,
          brand,
          serial_number,
          calibration_cert_no,
          calibration_date,
          calibration_expiry,
          status,
          location,
          notes,
        };

        const saveBtn = overlay.querySelector('#tool-form-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Menyimpan...';

        try {
          if (isEdit) {
            await updateRow('tools', existing.id, payload);
            showToast('Data tool berhasil diperbarui', 'success');
          } else {
            await insertRow('tools', payload);
            showToast('Tool baru berhasil ditambahkan', 'success');
          }
          close();
          await loadTools();
        } catch (err) {
          console.error('Error saving tool:', err);
          showToast(err.message || 'Gagal menyimpan data tool', 'error');
          saveBtn.disabled = false;
          saveBtn.textContent = isEdit ? 'Simpan Perubahan' : 'Tambah Tool';
        }
      });
    }
  });
}

// ---- EXPORT TO EXCEL ----
async function exportToExcel() {
  try {
    const btn = document.getElementById('export-excel-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Mengekspor...';
    btn.disabled = true;

    const ExcelJS = (await import('exceljs')).default;
    const { saveAs } = await import('file-saver');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daftar Tools');

    worksheet.columns = [
      { header: 'No.', key: 'no', width: 6 },
      { header: 'Nama Tools', key: 'name', width: 28 },
      { header: 'Merk', key: 'brand', width: 18 },
      { header: 'No. Seri', key: 'serial_number', width: 22 },
      { header: 'No. Sertifikat Kalibrasi', key: 'calibration_cert_no', width: 26 },
      { header: 'Tgl Kalibrasi', key: 'calib_date', width: 16 },
      { header: 'Masa Berlaku Exp', key: 'calib_exp', width: 16 },
      { header: 'Kondisi / Status', key: 'status', width: 20 },
      { header: 'Lokasi Penyimpanan', key: 'location', width: 22 },
      { header: 'Catatan', key: 'notes', width: 30 },
    ];

    // Header Styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    allTools.forEach((tool, index) => {
      const st = TOOL_STATUS[tool.status] || TOOL_STATUS.baik;
      const row = worksheet.addRow({
        no: index + 1,
        name: tool.name || '-',
        brand: tool.brand || '-',
        serial_number: tool.serial_number || '-',
        calibration_cert_no: tool.calibration_cert_no || '-',
        calib_date: tool.calibration_date ? formatDate(tool.calibration_date) : '-',
        calib_exp: tool.calibration_expiry ? formatDate(tool.calibration_expiry) : '-',
        status: st.label,
        location: tool.location || '-',
        notes: tool.notes || '-',
      });

      row.height = 22;
      row.alignment = { vertical: 'middle' };
      row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('calib_date').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('calib_exp').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('status').alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Generate buffer & download
    const buffer = await workbook.xlsx.writeBuffer();
    const todayStr = new Date().toISOString().split('T')[0];
    saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `Daftar_Tools_${todayStr}.xlsx`);

    showToast('Export Excel berhasil!', 'success');
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  } catch (err) {
    console.error('Export excel error:', err);
    showToast('Gagal mengekspor data ke Excel', 'error');
    const btn = document.getElementById('export-excel-btn');
    if (btn) {
      btn.innerHTML = `${icons.download} <span>Export Excel</span>`;
      btn.disabled = false;
    }
  }
}
