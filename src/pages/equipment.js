import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow, updateRow, deleteRow, bulkUpdateRows, supabase } from '../lib/supabase.js';
import { EQUIPMENT_STATUS, EQUIPMENT_CATEGORIES, INTERVAL_TYPES } from '../utils/constants.js';
import { formatDate, debounce, escapeHtml, badge, setupBulkSelection } from '../utils/helpers.js';

let technicianList = []; // cached for requirement PIC dropdown

let allEquipment = [];
let requirementCountsMap = {}; // { equipmentId: count }

export async function renderEquipment() {
  const content = renderAppShell('Daftar Equipment');

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <h2>Daftar Equipment</h2>
        <div class="page-header-actions">
          <button class="btn btn-primary d-flex align-items-center gap-2" id="add-equip-btn">${icons.plus} <span>Tambah Equipment</span></button>
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          ${icons.search}
          <input type="text" class="form-control form-control-sm" id="equip-search" placeholder="Cari equipment..." />
        </div>
        <div class="filter-group">
          <select class="form-select form-select-sm" id="filter-status" style="min-width:150px">
            <option value="">Semua Kondisi</option>
            ${Object.entries(EQUIPMENT_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <select class="form-select form-select-sm" id="filter-category" style="min-width:150px">
            <option value="">Semua Kategori</option>
            ${EQUIPMENT_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="equip-table-wrapper">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>

    </div>
  `;


  document.getElementById('add-equip-btn').addEventListener('click', () => showEquipmentForm());
  document.getElementById('equip-search').addEventListener('input', debounce(filterAndRender));
  document.getElementById('filter-status').addEventListener('change', filterAndRender);
  document.getElementById('filter-category').addEventListener('change', filterAndRender);

  await loadEquipment();
}


async function loadEquipment() {
  try {
    [allEquipment, technicianList] = await Promise.all([
      fetchAll('equipment', { order: { column: 'created_at', ascending: false } }),
      fetchAll('profiles', { filters: [{ column: 'role', value: 'technician' }], order: { column: 'full_name', ascending: true } }),
    ]);
    // Load requirement counts
    const reqs = await fetchAll('equipment_maintenance_requirements', { select: 'equipment_id' });
    requirementCountsMap = {};
    reqs.forEach(r => {
      requirementCountsMap[r.equipment_id] = (requirementCountsMap[r.equipment_id] || 0) + 1;
    });
    filterAndRender();
  } catch (err) {
    showToast('Gagal memuat data equipment', 'error');
    console.error(err);
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
    return;
  }

  wrapper.innerHTML = `
    <div class="table-container">
      <table class="table table-hover table-bordered mb-0">
        <thead>
          <tr>
            <th>ID SISTEM</th><th>NAMA EQUIPMENT</th><th>AREA</th><th>KATEGORI</th><th>NO INVENTORY</th><th>MANUFACTURE/VENDOR</th><th>TYPE</th><th>REQUIREMENTS</th><th>QR CODE</th><th>AKSI</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(e => {
            const reqCount = requirementCountsMap[e.idAset] || 0;
            return `
            <tr>
              <td><span class="equipment-code">${escapeHtml(e.idAset)}</span></td>
              <td class="fw-semibold">${escapeHtml(e.namaEquipment)}</td>
              <td>${escapeHtml(e.area || '-')}</td>
              <td>${escapeHtml(e.kategori || '-')}</td>
              <td>${escapeHtml(e.noInventory || '-')}</td>
              <td>${escapeHtml(e.manuf || '-')}</td>
              <td>${escapeHtml(e.type || '-')}</td>
              <td>
                ${reqCount > 0
                  ? `<span class="badge" style="background:var(--mcs-info-bg);color:var(--mcs-info)">${reqCount} req</span>`
                  : `<span class="text-muted" style="font-size:.7rem">—</span>`}
              </td>
              <td>
                <button class="btn btn-outline-secondary btn-sm btn-icon" data-qr="${e.idAset}" title="Show QR Code">${icons.qrCode}</button>
              </td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-outline-warning btn-sm btn-icon" data-edit="${e.idAset}" title="Edit">${icons.edit}</button>
                  <button class="btn btn-outline-danger btn-sm btn-icon" data-delete="${e.idAset}" title="Hapus">${icons.trash}</button>
                </div>
              </td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  `;


  wrapper.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const equip = allEquipment.find(e => e.idAset === btn.dataset.edit);
      if (equip) showEquipmentForm(equip);
    });
  });

  wrapper.querySelectorAll('[data-qr]').forEach(btn => {
    btn.addEventListener('click', () => showQRCode(btn.dataset.qr));
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

async function showEquipmentForm(existing = null) {
  const isEdit = !!existing;

  // Pre-load existing requirements if editing
  let existingReqs = [];
  if (isEdit) {
    try {
      existingReqs = await fetchAll('equipment_maintenance_requirements', {
        filters: [{ column: 'equipment_id', value: existing.idAset }],
        order: { column: 'created_at', ascending: true }
      });
    } catch (e) { /* silently ignore, requirements are optional */ }
  }

  showModal({
    title: isEdit ? 'Edit Equipment' : 'Tambah Equipment',
    size: 'modal-lg',
    body: `
      <div class="row g-3">
        <div class="col-6">
          <label class="form-label">ID Asset *</label>
          <input class="form-control" id="eq-idasset" value="${existing?.idAset || ''}" placeholder="ID Asset" required ${isEdit ? 'disabled' : ''} />
        </div>
        <div class="col-6">
          <label class="form-label">Nama Equipment *</label>
          <input class="form-control" id="eq-name" value="${existing?.namaEquipment || ''}" placeholder="Nama equipment" required />
        </div>
        <div class="col-6">
          <label class="form-label">No Inventory</label>
          <input class="form-control" id="eq-inventory" value="${existing?.noInventory || ''}" placeholder="No Inventory" />
        </div>
        <div class="col-6">
          <label class="form-label">Kategori</label>
          <select class="form-select" id="eq-category">
            <option value="">Pilih Kategori</option>
            ${EQUIPMENT_CATEGORIES.map(c => `<option value="${c}" ${existing?.kategori === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="col-6">
          <label class="form-label">Area</label>
          <input class="form-control" id="eq-location" value="${existing?.area || ''}" placeholder="Area/lokasi" />
        </div>
        <div class="col-6">
          <label class="form-label">Kondisi</label>
          <select class="form-select" id="eq-status">
            ${Object.entries(EQUIPMENT_STATUS).map(([k, v]) => `<option value="${k}" ${existing?.kondisi === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="col-6">
          <label class="form-label">Manufaktur</label>
          <input class="form-control" id="eq-manufacturer" value="${existing?.manuf || ''}" placeholder="Nama pabrikan" />
        </div>
        <div class="col-6">
          <label class="form-label">Tipe/Model</label>
          <input class="form-control" id="eq-model" value="${existing?.type || ''}" placeholder="Tipe" />
        </div>
      </div>

      <hr class="my-3" />
      <h6 class="mb-1 d-flex align-items-center gap-2">
        ${icons.clipboardList} Maintenance Requirements
        <small class="text-muted fw-normal">Kebutuhan jam per siklus pemeliharaan</small>
      </h6>
      <div id="req-container" class="mb-2"></div>
      <button class="btn btn-outline-secondary btn-sm" id="btn-add-req">${icons.plus} Tambah Requirement</button>

      <hr class="my-3" />
      <h6 class="mb-2">Checklist Tasks</h6>
      <div id="checklist-container" class="mb-2"></div>
      <button class="btn btn-outline-secondary btn-sm" id="btn-add-checklist">${icons.plus} Tambah Task</button>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="eq-cancel">Batal</button>
      <button class="btn btn-primary" id="eq-save">${isEdit ? 'Simpan Perubahan' : 'Tambah Equipment'}</button>
    `,
    onMount: (overlay, close) => {
      // ── Maintenance Requirements ─────────────────────────
      let reqItems = existingReqs.map(r => ({ ...r }));
      const reqContainer = overlay.querySelector('#req-container');

      const techOptions = technicianList.map(t => `<option value="${t.id}">${escapeHtml(t.full_name)}</option>`).join('');

      const renderReqs = () => {
        if (reqItems.length === 0) {
          reqContainer.innerHTML = '<div style="color:var(--text-muted);font-size:var(--fs-sm);padding:var(--sp-2) 0">Belum ada requirement. Tambahkan untuk mengaktifkan kalkulasi Load Man Hours otomatis.</div>';
          return;
        }
        reqContainer.innerHTML = reqItems.map((r, idx) => `
          <div class="row g-2 mb-2 p-2 bg-light border rounded align-items-end">
            <div class="col-auto flex-grow-1">
              <label class="form-label small">Interval</label>
              <select class="form-select" data-req-idx="${idx}" data-req-field="interval_type">
                ${Object.entries(INTERVAL_TYPES).map(([k, v]) => `<option value="${k}" ${r.interval_type === k ? 'selected' : ''}>${v.label}</option>`).join('')}
              </select>
            </div>
            <div class="col-auto req-custom-days" style="width:100px;${r.interval_type !== 'custom' ? 'display:none' : ''}">
              <label class="form-label small">Hari</label>
              <input type="number" class="form-control" data-req-idx="${idx}" data-req-field="interval_days" value="${r.interval_days || ''}" placeholder="30" min="1" />
            </div>
            <div class="col-auto" style="width:100px;">
              <label class="form-label small">Man Hrs</label>
              <input type="number" class="form-control" data-req-idx="${idx}" data-req-field="man_hours" value="${r.man_hours || ''}" placeholder="jam" min="0" step="0.5" />
            </div>
            <div class="col-auto">
              <button class="btn btn-outline-danger btn-sm btn-del-req" data-req-idx="${idx}">${icons.trash}</button>
            </div>
          </div>
        `).join('');



        // Bind change listeners
        reqContainer.querySelectorAll('[data-req-idx]').forEach(el => {
          el.addEventListener('change', e => {
            const idx = parseInt(e.target.dataset.reqIdx);
            const field = e.target.dataset.reqField;
            reqItems[idx][field] = e.target.value;
            if (field === 'interval_type') {
              const row = e.target.closest('.row');
              const customGroup = row?.querySelector('.req-custom-days');
              if (customGroup) customGroup.style.display = e.target.value === 'custom' ? '' : 'none';
            }
          });
          el.addEventListener('input', e => {
            const idx = parseInt(e.target.dataset.reqIdx);
            const field = e.target.dataset.reqField;
            if (field && field !== 'interval_type' && field !== 'assigned_to') {
              reqItems[idx][field] = e.target.value;
            }
          });
        });

        reqContainer.querySelectorAll('.btn-del-req').forEach(btn => {
          btn.addEventListener('click', e => {
            const idx = parseInt(e.currentTarget.dataset.reqIdx);
            reqItems.splice(idx, 1);
            renderReqs();
          });
        });
      };

      renderReqs();

      overlay.querySelector('#btn-add-req').addEventListener('click', () => {
        reqItems.push({ interval_type: 'monthly', interval_days: null, man_hours: 0, assigned_to: '', description: '' });
        renderReqs();
      });

      // ── Checklist ─────────────────────────────────────────
      let checklistItems = Array.isArray(existing?.checklist) ? [...existing.checklist] : [];
      const checklistContainer = overlay.querySelector('#checklist-container');
      
      const renderChecklist = () => {
        if (checklistItems.length === 0) {
          checklistContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">Belum ada task.</div>';
          return;
        }
        checklistContainer.innerHTML = checklistItems.map((item, index) => `
          <div class="d-flex gap-2 mb-2 align-items-center">
            <input type="text" class="form-control" style="width: 140px;" value="${escapeHtml(item.category || '')}" data-index="${index}" data-field="category" placeholder="Kategori" title="Kategori Task (misal: General check)" />
            <input type="text" class="form-control flex-grow-1" value="${escapeHtml(item.task || '')}" data-index="${index}" data-field="task" placeholder="Nama Task" />
            <select class="form-select w-auto" data-index="${index}" data-field="type">
              <option value="boolean" ${item.type === 'boolean' ? 'selected' : ''}>Ya/Tidak</option>
              <option value="number" ${item.type === 'number' ? 'selected' : ''}>Input Angka</option>
              <option value="image" ${item.type === 'image' ? 'selected' : ''}>Upload Foto</option>
            </select>
            ${item.type === 'number' ? `<input type="number" class="form-control w-auto" value="${item.standard || ''}" data-index="${index}" data-field="standard" placeholder="Standar (Angka)" style="max-width:120px;" />` : ''}
            <button class="btn btn-outline-danger btn-sm btn-del-task" data-index="${index}">${icons.trash}</button>
          </div>
        `).join('');
        
        checklistContainer.querySelectorAll('input, select').forEach(el => {
          el.addEventListener('change', (e) => {
            const idx = e.target.dataset.index;
            const field = e.target.dataset.field;
            checklistItems[idx][field] = e.target.value;
            if (field === 'type') {
              renderChecklist();
            }
          });
          el.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT') {
              const idx = e.target.dataset.index;
              const field = e.target.dataset.field;
              checklistItems[idx][field] = e.target.value;
            }
          });
        });
        
        checklistContainer.querySelectorAll('.btn-del-task').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.index;
            checklistItems.splice(idx, 1);
            renderChecklist();
          });
        });
      };
      
      renderChecklist();
      
      overlay.querySelector('#btn-add-checklist').addEventListener('click', () => {
        checklistItems.push({ category: '', task: '', type: 'boolean' });
        renderChecklist();
      });

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
          type: overlay.querySelector('#eq-model').value.trim(),
          checklist: checklistItems.filter(c => c.task.trim() !== '')
        };

        try {
          if (isEdit) {
            await updateRow('equipment', idAset, data, 'idAset');
          } else {
            await insertRow('equipment', data);
          }

          // Upsert maintenance requirements: delete old, insert new
          const validReqs = reqItems.filter(r => r.interval_type && parseFloat(r.man_hours) >= 0);
          if (isEdit) {
            // Delete all existing requirements for this equipment, then re-insert
            const { error: delErr } = await supabase
              .from('equipment_maintenance_requirements')
              .delete()
              .eq('equipment_id', idAset);
            if (delErr) throw delErr;
          }
          if (validReqs.length > 0) {
            const { error: insErr } = await supabase
              .from('equipment_maintenance_requirements')
              .insert(validReqs.map(r => ({
                equipment_id: idAset,
                interval_type: r.interval_type,
                interval_days: r.interval_type === 'custom' ? (parseInt(r.interval_days) || null) : null,
                man_hours: parseFloat(r.man_hours) || 0,
                assigned_to: r.assigned_to || null,
                description: r.description || '',
              })));
            if (insErr) throw insErr;
          }

          showToast(isEdit ? 'Equipment berhasil diperbarui' : 'Equipment berhasil ditambahkan', 'success');
          close();
          await loadEquipment();
        } catch (err) {
          showToast(err.message || 'Gagal menyimpan', 'error');
          console.error(err);
        }
      });
    }
  });
}

function showQRCode(idAset) {
  showModal({
    title: 'QR Code Scanner',
    body: `
      <div style="text-align: center; padding: 16px 0;">
        <p style="color: var(--success); font-weight: 600; margin-bottom: 24px;">${idAset}</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(idAset)}" alt="QR Code" style="border-radius: 8px; display: inline-block;" />
      </div>
    `,
    footer: `<button class="btn btn-secondary" style="width: 100%; background: #1a2332; color: #fff; border-color: #1a2332;" id="btn-close-qr">TUTUP</button>`,
    onMount: (overlay, close) => {
      overlay.querySelector('#btn-close-qr').addEventListener('click', close);
    }
  });
}

async function showHistory(idAset) {
  const equip = allEquipment.find(e => e.idAset === idAset);
  if (!equip) return;
  
  try {
    const wos = await fetchAll('work_orders', { filters: [{column: 'equipment_id', value: idAset}], select: '*, profiles:assigned_to(full_name)', order: { column: 'created_at', ascending: false } });
    
    const woSelesai = wos.filter(w => w.status === 'closed').length;
    const totalDowntime = wos.reduce((acc, curr) => acc + (curr.man_hours_actual || 0), 0);
    
    showModal({
      title: 'Asset Detail & History Timeline',
      size: 'modal-lg',
      body: `
        <div class="mb-4">
          <p class="text-success fw-bold mb-3">ID ASET: ${equip.idAset} | ${equip.namaEquipment}</p>
          <div class="row g-3 mb-3">
            <div class="col-md-3 col-6">
              <div class="p-3 bg-light border rounded h-100">
                <div class="small text-muted">Pabrikan</div>
                <div class="fw-bold mt-1 text-dark">${equip.manuf || '-'}</div>
              </div>
            </div>
            <div class="col-md-3 col-6">
              <div class="p-3 bg-light border rounded h-100">
                <div class="small text-muted">Tipe</div>
                <div class="fw-bold mt-1 text-dark">${equip.type || '-'}</div>
              </div>
            </div>
            <div class="col-md-3 col-6">
              <div class="p-3 bg-light border rounded h-100">
                <div class="small text-muted">Area</div>
                <div class="fw-bold mt-1 text-dark">${equip.area || '-'}</div>
              </div>
            </div>
            <div class="col-md-3 col-6">
              <div class="p-3 bg-light border rounded h-100">
                <div class="small text-muted">No Inventory</div>
                <div class="fw-bold mt-1 text-dark">${equip.noInventory || '-'}</div>
              </div>
            </div>
          </div>
          
          <div class="row g-3 text-center">
             <div class="col-md-4">
               <div class="p-3 bg-light border rounded h-100">
                <div class="small text-muted fw-bold">WO SELESAI</div>
                <div class="fs-4 fw-bold text-dark mt-1">${woSelesai}</div>
               </div>
            </div>
            <div class="col-md-4">
               <div class="p-3 bg-light border rounded h-100">
                <div class="small text-muted fw-bold">DOWNTIME</div>
                <div class="fs-4 fw-bold text-danger mt-1">${totalDowntime} Jam</div>
               </div>
            </div>
            <div class="col-md-4">
               <div class="p-3 bg-light border rounded h-100">
                <div class="small text-muted fw-bold">BIAYA MAINT.</div>
                <div class="fs-4 fw-bold text-success mt-1">IDR 0</div>
               </div>
            </div>
          </div>
        </div>
        
        <h6 class="mb-3 d-flex align-items-center gap-2 text-secondary fw-bold">${icons.activity} REKAMAN LOG KEJADIAN</h6>
        <div class="table-responsive" style="max-height: 250px;">
          <table class="table table-hover table-bordered mb-0">
            <thead class="table-light">
              <tr>
                <th>TANGGAL</th>
                <th>JENIS</th>
                <th>CATATAN DESKRIPSI</th>
                <th>TEKNISI</th>
              </tr>
            </thead>
            <tbody>
              ${wos.length === 0 ? `<tr><td colspan="4" style="text-align:center;">Belum ada log kejadian</td></tr>` : 
                wos.map(wo => `
                  <tr>
                    <td>${formatDate(wo.created_at)}</td>
                    <td style="text-transform: capitalize;">${wo.type}</td>
                    <td>${escapeHtml(wo.description)}</td>
                    <td>${wo.profiles?.full_name || '-'}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      `
    });
  } catch (err) {
    showToast('Gagal memuat history', 'error');
  }
}
