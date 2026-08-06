import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow, updateRow, deleteRow, bulkUpdateRows, getCurrentProfile } from '../lib/supabase.js';
import { WO_STATUS, WO_PRIORITY, WO_CATEGORY } from '../utils/constants.js';
import { formatDate, formatDateTime, debounce, escapeHtml, badge, generateWoNumber, setupBulkSelection } from '../utils/helpers.js';

let allWOs = [];
let technicianList = [];
let selectedWOIds = [];
let currentProfile = null;

function toDatetimeLocal(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function renderWorkOrder() {
  // Get current user profile to determine role
  currentProfile = await getCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';

  const content = renderAppShell('Work Order');

  content.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <h2>Work Order</h2>
        <div class="page-header-actions">
          ${isAdmin ? `<button class="btn btn-primary" id="add-wo-btn">${icons.plus} Buat Work Order</button>` : ''}
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          ${icons.search}
          <input type="text" class="form-input" id="wo-search" placeholder="Cari WO..." />
        </div>
        <div class="filter-group">
          <select class="form-select" id="filter-wo-status">
            <option value="">Semua Status</option>
            ${Object.entries(WO_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <select class="form-select" id="filter-wo-priority">
            <option value="">Semua Prioritas</option>
            ${Object.entries(WO_PRIORITY).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <select class="form-select" id="filter-wo-category">
            <option value="">Semua Kategori</option>
            ${Object.entries(WO_CATEGORY).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="wo-table-wrapper">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>

      <!-- BULK ACTION BAR (admin only) -->
      ${isAdmin ? `
      <div class="bulk-action-bar" id="bulk-action-bar">
        <div class="bulk-selected-count">
          <span class="badge" id="bulk-count-badge">0</span> item terpilih
        </div>
        <div class="bulk-actions">
          <select class="form-select form-select-sm" id="bulk-status-select" style="min-width: 150px; padding-top: 4px; padding-bottom: 4px;">
            <option value="">Ubah Status...</option>
            ${Object.entries(WO_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" id="btn-bulk-update" style="padding: 4px 12px">Update</button>
        </div>
      </div>
      ` : ''}
    </div>
  `;

  if (isAdmin) {
    document.getElementById('add-wo-btn').addEventListener('click', () => showWOForm());
    document.getElementById('btn-bulk-update')?.addEventListener('click', handleBulkUpdate);
  }

  document.getElementById('wo-search').addEventListener('input', debounce(filterAndRender));
  document.getElementById('filter-wo-status').addEventListener('change', filterAndRender);
  document.getElementById('filter-wo-priority').addEventListener('change', filterAndRender);
  document.getElementById('filter-wo-category').addEventListener('change', filterAndRender);

  await loadWOs();
}

async function handleBulkUpdate() {
  const newStatus = document.getElementById('bulk-status-select').value;
  if (!newStatus) return showToast('Pilih status terlebih dahulu', 'warning');
  if (selectedWOIds.length === 0) return;

  showConfirm({
    message: `Ubah status ${selectedWOIds.length} Work Order menjadi ${WO_STATUS[newStatus].label}?`,
    onConfirm: async () => {
      try {
        await bulkUpdateRows('work_orders', selectedWOIds, { status: newStatus });
        showToast('Berhasil update status massal', 'success');
        document.getElementById('bulk-status-select').value = '';
        selectedWOIds = [];
        updateBulkBar();
        await loadWOs();
      } catch (err) {
        showToast('Gagal update massal', 'error');
      }
    }
  });
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-action-bar');
  const badgeEl = document.getElementById('bulk-count-badge');
  if (!bar || !badgeEl) return;
  if (selectedWOIds.length > 0) {
    badgeEl.textContent = selectedWOIds.length;
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
  }
}

async function loadWOs() {
  try {
    const isAdmin = currentProfile?.role === 'admin';

    // Build fetch options
    const woOptions = {
      select: '*, profiles:assigned_to(full_name)',
      order: { column: 'created_at', ascending: false }
    };

    // Technician: only see WOs assigned to them
    if (!isAdmin && currentProfile?.id) {
      woOptions.filters = [{ column: 'assigned_to', value: currentProfile.id }];
    }

    [allWOs, technicianList] = await Promise.all([
      fetchAll('work_orders', woOptions),
      fetchAll('profiles', { filters: [{ column: 'role', value: 'technician' }], order: { column: 'full_name', ascending: true } }),
    ]);
    filterAndRender();
  } catch (err) {
    showToast('Gagal memuat data WO', 'error');
  }
}

function filterAndRender() {
  const search = (document.getElementById('wo-search')?.value || '').toLowerCase();
  const status = document.getElementById('filter-wo-status')?.value || '';
  const priority = document.getElementById('filter-wo-priority')?.value || '';
  const category = document.getElementById('filter-wo-category')?.value || '';

  let filtered = allWOs.filter(wo => {
    if (search && !`${wo.wo_number} ${wo.description} ${wo.category || ''}`.toLowerCase().includes(search)) return false;
    if (status && wo.status !== status) return false;
    if (priority && wo.priority !== priority) return false;
    if (category && wo.category !== category) return false;
    return true;
  });

  renderTable(filtered);
}

function renderTable(data) {
  const wrapper = document.getElementById('wo-table-wrapper');
  if (!wrapper) return;
  const isAdmin = currentProfile?.role === 'admin';

  if (data.length === 0) {
    wrapper.innerHTML = `<div class="empty-state">${icons.clipboardList}<h4>Tidak ada work order</h4><p>${isAdmin ? 'Buat work order baru untuk memulai' : 'Belum ada work order yang ditugaskan kepada Anda'}</p></div>`;
    updateBulkBar();
    return;
  }

  wrapper.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead><tr>
          ${isAdmin ? '<th class="col-checkbox"><input type="checkbox" class="form-checkbox" id="select-all" /></th>' : ''}
          <th>No. WO</th><th>Kategori</th><th>Prioritas</th><th>Status</th><th>Teknisi</th><th>Man Hours</th><th>Evidence</th><th>Tanggal</th><th>Aksi</th>
        </tr></thead>
        <tbody>
          ${data.map(wo => {
            const cat = WO_CATEGORY[wo.category] || WO_CATEGORY.OTHER;
            return `
            <tr>
              ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="form-checkbox row-checkbox" value="${wo.id}" ${selectedWOIds.includes(wo.id) ? 'checked' : ''} /></td>` : ''}
              <td><span class="wo-number">${escapeHtml(wo.wo_number)}</span></td>
              <td>${badge(cat.label, cat.color, cat.bg)}</td>
              <td>${badge(WO_PRIORITY[wo.priority]?.label, WO_PRIORITY[wo.priority]?.color, WO_PRIORITY[wo.priority]?.bg)}</td>
              <td>${badge(WO_STATUS[wo.status]?.label, WO_STATUS[wo.status]?.color, WO_STATUS[wo.status]?.bg)}</td>
              <td>${wo.profiles?.full_name || '-'}</td>
              <td><span class="wo-man-hours">${wo.man_hours_actual || 0} jam</span></td>
              <td>${wo.evidence_url ? `<img src="${wo.evidence_url}" style="width:36px;height:36px;border-radius:4px;cursor:pointer;object-fit:cover" class="wo-evidence-preview-trigger" data-img="${wo.id}" title="Klik untuk memperbesar" />` : '-'}</td>
              <td>${formatDate(wo.opened_at)}</td>
              <td>
                <div class="table-actions">
                  ${isAdmin ? `
                    <button class="btn btn-ghost btn-icon btn-sm" data-edit="${wo.id}" title="Edit">${icons.edit}</button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-delete="${wo.id}" title="Hapus">${icons.trash}</button>
                  ` : ''}
                  ${!isAdmin && wo.status === 'open' ? `
                    <button class="btn btn-ghost btn-icon btn-sm" data-hold="${wo.id}" title="Hold" style="color:#F59E0B">${icons.alertTriangle || icons.edit}</button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-close="${wo.id}" title="Close WO" style="color:#10B981">${icons.check}</button>
                  ` : ''}
                  ${!isAdmin && wo.status === 'hold' ? `
                    <button class="btn btn-ghost btn-icon btn-sm" data-close="${wo.id}" title="Close WO" style="color:#10B981">${icons.check}</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Setup bulk selection helper (admin only)
  if (isAdmin) {
    setupBulkSelection(wrapper, (selected) => {
      selectedWOIds = selected;
      updateBulkBar();
    });
  }

  // Admin: edit and delete
  wrapper.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wo = allWOs.find(w => w.id === btn.dataset.edit);
      if (wo) showWOForm(wo);
    });
  });

  wrapper.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wo = allWOs.find(w => w.id === btn.dataset.delete);
      if (wo) {
        showConfirm({
          message: `Hapus work order "${wo.wo_number}"?`,
          onConfirm: async () => {
            try {
              await deleteRow('work_orders', wo.id);
              showToast('WO berhasil dihapus', 'success');
              await loadWOs();
            } catch (err) {
              showToast('Gagal menghapus WO', 'error');
            }
          }
        });
      }
    });
  });

  // Technician: close WO
  wrapper.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wo = allWOs.find(w => w.id === btn.dataset.close);
      if (wo) showCloseForm(wo);
    });
  });

  // Technician: hold WO
  wrapper.querySelectorAll('[data-hold]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wo = allWOs.find(w => w.id === btn.dataset.hold);
      if (wo) showHoldForm(wo);
    });
  });

  // Evidence click preview trigger
  wrapper.querySelectorAll('.wo-evidence-preview-trigger').forEach(img => {
    img.addEventListener('click', () => {
      const wo = allWOs.find(w => w.id === img.dataset.img);
      if (wo && wo.evidence_url) {
        showModal({
          title: `Evidence Work Order - ${wo.wo_number}`,
          body: `
            <div style="text-align:center;">
              <img src="${wo.evidence_url}" style="max-width:100%; max-height:500px; border-radius:var(--radius-md); object-fit:contain;" />
            </div>
            <div style="margin-top:var(--sp-4); font-size:var(--fs-sm); color:var(--text-secondary);">
              <strong>Teknisi:</strong> ${wo.profiles?.full_name || '-'}<br>
              <strong>Waktu Mulai:</strong> ${formatDateTime(wo.started_at)}<br>
              <strong>Waktu Selesai:</strong> ${formatDateTime(wo.closed_at)}<br>
              <strong>Total Man Hours:</strong> ${wo.man_hours_actual || 0} jam
            </div>
          `,
          footer: `<button class="btn btn-secondary" id="evidence-close">Tutup</button>`,
          onMount: (overlay, close) => {
            overlay.querySelector('#evidence-close').addEventListener('click', close);
          }
        });
      }
    });
  });
}

// ---- ADMIN: Create/Edit WO Form ----
function showWOForm(existing = null) {
  const isEdit = !!existing;
  showModal({
    title: isEdit ? 'Edit Work Order' : 'Buat Work Order Baru',
    size: 'modal-lg',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">No. WO</label>
          <input class="form-input" id="wo-number" value="${existing?.wo_number || generateWoNumber()}" ${isEdit ? 'readonly style="opacity:0.6"' : ''} />
        </div>
        <div class="form-group">
          <label class="form-label">Kategori *</label>
          <select class="form-select" id="wo-category">
            ${Object.entries(WO_CATEGORY).map(([k, v]) => `<option value="${k}" ${existing?.category === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Prioritas</label>
          <select class="form-select" id="wo-priority">
            ${Object.entries(WO_PRIORITY).map(([k, v]) => `<option value="${k}" ${existing?.priority === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ditugaskan Ke *</label>
          <select class="form-select" id="wo-assigned">
            <option value="">Pilih Teknisi</option>
            ${technicianList.map(t => `<option value="${t.id}" ${existing?.assigned_to === t.id ? 'selected' : ''}>${t.full_name}</option>`).join('')}
          </select>
        </div>
      </div>
      ${isEdit ? `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Status</label>
          <div style="padding: 8px 0;">
            ${badge(WO_STATUS[existing.status]?.label, WO_STATUS[existing.status]?.color, WO_STATUS[existing.status]?.bg)}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Aktual Man Hours</label>
          <input type="number" class="form-input" id="wo-act-hours" value="${existing?.man_hours_actual || ''}" placeholder="0" step="0.5" min="0" />
        </div>
      </div>
      ` : ''}
      ${!isEdit ? `
      <div class="form-row">
        <div class="form-group">
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            Status otomatis: <strong>Open</strong>
          </div>
        </div>
      </div>
      ` : ''}
      <div class="form-group">
        <label class="form-label">Deskripsi</label>
        <textarea class="form-textarea" id="wo-desc" placeholder="Detail pekerjaan...">${existing?.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Catatan</label>
        <textarea class="form-textarea" id="wo-notes" placeholder="Catatan tambahan...">${existing?.notes || ''}</textarea>
      </div>
      ${isEdit && existing?.evidence_url ? `
      <div class="form-group">
        <label class="form-label">Evidence Foto</label>
        <div style="margin-top:var(--sp-2);">
          <img src="${existing.evidence_url}" style="max-width:100%; max-height:200px; border-radius:var(--radius-md); object-fit:cover; border:1px solid var(--border-color);" />
        </div>
      </div>
      ` : ''}
    `,
    footer: `
      <button class="btn btn-secondary" id="wo-cancel">Batal</button>
      <button class="btn btn-primary" id="wo-save">${isEdit ? 'Simpan Perubahan' : 'Buat WO'}</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#wo-cancel').addEventListener('click', close);
      overlay.querySelector('#wo-save').addEventListener('click', async () => {
        const wo_number = overlay.querySelector('#wo-number').value.trim();
        const category = overlay.querySelector('#wo-category').value;
        const assigned_to = overlay.querySelector('#wo-assigned').value;

        if (!wo_number) {
          showToast('No. WO wajib diisi', 'warning');
          return;
        }
        if (!assigned_to) {
          showToast('Teknisi wajib dipilih', 'warning');
          return;
        }

        const data = {
          wo_number,
          category,
          type: 'corrective',
          priority: overlay.querySelector('#wo-priority').value,
          assigned_to,
          description: overlay.querySelector('#wo-desc').value.trim(),
          notes: overlay.querySelector('#wo-notes').value.trim(),
        };

        // New WO: always open
        if (!isEdit) {
          data.status = 'open';
        }

        // Edit mode: include actual hours
        if (isEdit) {
          data.man_hours_actual = parseFloat(overlay.querySelector('#wo-act-hours').value) || 0;
        }

        try {
          if (isEdit) {
            await updateRow('work_orders', existing.id, data);
            showToast('WO berhasil diperbarui', 'success');
          } else {
            await insertRow('work_orders', data);
            showToast('WO berhasil dibuat', 'success');
          }
          close();
          await loadWOs();
        } catch (err) {
          showToast(err.message || 'Gagal menyimpan', 'error');
        }
      });
    }
  });
}

// ---- TECHNICIAN: Close WO Form ----
function showCloseForm(wo) {
  showModal({
    title: `Close Work Order - ${wo.wo_number}`,
    size: 'modal-md',
    body: `
      <p style="margin-bottom: var(--sp-4); color: var(--text-secondary);">
        Pastikan pekerjaan sudah selesai sebelum menutup WO ini.
      </p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Actual Start *</label>
          <input type="datetime-local" class="form-input" id="close-start" value="${toDatetimeLocal(wo.started_at || wo.opened_at || new Date())}" />
        </div>
        <div class="form-group">
          <label class="form-label">Actual Finish *</label>
          <input type="datetime-local" class="form-input" id="close-finish" value="${toDatetimeLocal(new Date())}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Calculated Man Hours (Jam)</label>
          <input type="text" class="form-input" id="close-hours" readonly style="opacity:0.8; background: rgba(255,255,255,0.05);" value="0" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Upload Foto Evidence (Maks 1MB) *</label>
        <input type="file" class="form-input" id="close-evidence" accept="image/*" />
        <div id="evidence-preview-container" style="margin-top:var(--sp-2); display:none; text-align:center;">
          <img id="evidence-preview" src="" style="max-width:100%; max-height:180px; border-radius:var(--radius-md); object-fit:cover; border:1px solid var(--border-color);" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Catatan Penyelesaian</label>
        <textarea class="form-textarea" id="close-notes" placeholder="Catatan hasil pekerjaan...">${wo.notes || ''}</textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="close-cancel">Batal</button>
      <button class="btn btn-primary" id="close-confirm" style="background: var(--success);">Close WO</button>
    `,
    onMount: (overlay, close) => {
      const startInput = overlay.querySelector('#close-start');
      const finishInput = overlay.querySelector('#close-finish');
      const hoursInput = overlay.querySelector('#close-hours');
      const evidenceInput = overlay.querySelector('#close-evidence');
      const previewContainer = overlay.querySelector('#evidence-preview-container');
      const previewImg = overlay.querySelector('#evidence-preview');
      let evidenceBase64 = null;

      // Auto-calculate man hours
      const calculateHours = () => {
        const startVal = new Date(startInput.value);
        const finishVal = new Date(finishInput.value);
        if (!isNaN(startVal) && !isNaN(finishVal)) {
          const diffMs = finishVal - startVal;
          if (diffMs > 0) {
            const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(2);
            hoursInput.value = diffHrs;
          } else {
            hoursInput.value = '0';
          }
        } else {
          hoursInput.value = '0';
        }
      };

      startInput.addEventListener('change', calculateHours);
      finishInput.addEventListener('change', calculateHours);
      calculateHours();

      // Handle image upload and base64 conversion
      evidenceInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 1024 * 1024) {
            showToast('Ukuran foto maksimal 1MB', 'warning');
            evidenceInput.value = '';
            previewContainer.style.display = 'none';
            evidenceBase64 = null;
            return;
          }

          const reader = new FileReader();
          reader.onload = (event) => {
            evidenceBase64 = event.target.result;
            previewImg.src = evidenceBase64;
            previewContainer.style.display = 'block';
          };
          reader.readAsDataURL(file);
        } else {
          previewContainer.style.display = 'none';
          evidenceBase64 = null;
        }
      });

      overlay.querySelector('#close-cancel').addEventListener('click', close);
      overlay.querySelector('#close-confirm').addEventListener('click', async () => {
        const hours = parseFloat(hoursInput.value);
        if (isNaN(hours) || hours <= 0) {
          showToast('Waktu selesai harus setelah waktu mulai', 'warning');
          return;
        }
        if (!evidenceBase64) {
          showToast('Foto evidence wajib diunggah', 'warning');
          return;
        }

        try {
          await updateRow('work_orders', wo.id, {
            status: 'closed',
            man_hours_actual: hours,
            started_at: new Date(startInput.value).toISOString(),
            closed_at: new Date(finishInput.value).toISOString(),
            evidence_url: evidenceBase64,
            notes: overlay.querySelector('#close-notes').value.trim(),
          });
          showToast('Work Order berhasil ditutup', 'success');
          close();
          await loadWOs();
        } catch (err) {
          showToast('Gagal menutup WO', 'error');
        }
      });
    }
  });
}

// ---- TECHNICIAN: Hold WO Form ----
function showHoldForm(wo) {
  showModal({
    title: `Hold Work Order - ${wo.wo_number}`,
    body: `
      <p style="margin-bottom: var(--sp-4); color: var(--text-secondary);">
        Berikan alasan mengapa WO ini perlu di-hold (contoh: butuh material, area tidak bisa diakses, dll).
      </p>
      <div class="form-group">
        <label class="form-label">Alasan Hold *</label>
        <textarea class="form-textarea" id="hold-notes" placeholder="Jelaskan alasan hold..." required></textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="hold-cancel">Batal</button>
      <button class="btn btn-primary" id="hold-confirm" style="background: var(--warning); color: #000;">Hold WO</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#hold-cancel').addEventListener('click', close);
      overlay.querySelector('#hold-confirm').addEventListener('click', async () => {
        const notes = overlay.querySelector('#hold-notes').value.trim();
        if (!notes) {
          showToast('Alasan hold wajib diisi', 'warning');
          return;
        }

        try {
          await updateRow('work_orders', wo.id, {
            status: 'hold',
            notes: `[HOLD] ${notes}`,
          });
          showToast('Work Order di-hold', 'success');
          close();
          await loadWOs();
        } catch (err) {
          showToast('Gagal mengubah status WO', 'error');
        }
      });
    }
  });
}
