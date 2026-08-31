import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow, deleteRow, getCurrentProfile, supabase } from '../lib/supabase.js';

let currentProfile = null;
let templates = [];
let equipmentList = [];

export async function renderMdsTemplates() {
  currentProfile = await getCurrentProfile();
  
  // Hanya admin yang boleh akses menu ini
  if (currentProfile?.role !== 'admin') {
    const content = renderAppShell('Master Template MDS');
    content.innerHTML = `
      <div class="card p-5 text-center shadow-sm">
        <h3 class="text-danger mb-3">${icons.alertTriangle} Akses Ditolak</h3>
        <p class="text-secondary">Anda tidak memiliki izin untuk mengakses halaman Master Template MDS.</p>
      </div>
    `;
    return;
  }

  const content = renderAppShell('Master Template MDS');
  
  content.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h5 class="m-0 d-flex align-items-center gap-2">
        ${icons.clipboardCheck} Template MDS
      </h5>
      <button class="btn btn-primary d-flex align-items-center gap-2" id="btn-add-template">
        ${icons.plus} Buat Template Baru
      </button>
    </div>
    
    <div class="card shadow-sm">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Nama Equipment</th>
                <th>Interval (Hari)</th>
                <th>No. Form</th>
                <th>Revisi</th>
                <th class="text-end">Aksi</th>
              </tr>
            </thead>
            <tbody id="template-table-body">
              <tr><td colspan="5" class="text-center py-4"><div class="spinner"></div> Memuat data...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-add-template').addEventListener('click', () => openTemplateModal());
  
  await loadAll();
}

async function loadAll() {
  try {
    [templates, equipmentList] = await Promise.all([
      fetchAll('mds_templates', { order: { column: 'name', ascending: true } }),
      fetchAll('equipment',     { order: { column: 'namaEquipment', ascending: true } }),
    ]);
    renderTable();
  } catch (err) {
    console.error(err);
    showToast('Gagal memuat template', 'error');
  }
}

function renderTable() {
  const tbody = document.getElementById('template-table-body');
  if (templates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Belum ada template MDS. Silakan buat baru.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = templates.map(t => `
    <tr>
      <td class="fw-semibold">${t.name}</td>
      <td>${t.interval_days} hari</td>
      <td>${t.form_number || '-'}</td>
      <td>${t.revision || '0'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary me-1 btn-edit" data-id="${t.id}" title="Edit Detail">
          ${icons.edit}
        </button>
        <button class="btn btn-sm btn-outline-success me-1 btn-items" data-id="${t.id}" title="Kelola Item Checklist">
          ${icons.list} Item
        </button>
        <button class="btn btn-sm btn-outline-secondary me-1 btn-duplicate" data-id="${t.id}" title="Duplikat Template">
          📋 Duplikat
        </button>
        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${t.id}" title="Hapus Template">
          ${icons.trash}
        </button>
      </td>
    </tr>
  `).join('');
  
  document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => {
    const t = templates.find(x => x.id === btn.dataset.id);
    if (t) openTemplateModal(t);
  }));
  
  document.querySelectorAll('.btn-items').forEach(btn => btn.addEventListener('click', () => {
    const t = templates.find(x => x.id === btn.dataset.id);
    if (t) openTemplateItemsModal(t);
  }));

  document.querySelectorAll('.btn-duplicate').forEach(btn => btn.addEventListener('click', () => {
    const t = templates.find(x => x.id === btn.dataset.id);
    if (t) openDuplicateModal(t);
  }));
  
  document.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    showConfirm({
      message: 'Hapus template ini? Semua data checklist PM yang sudah menggunakan referensi ini mungkin terpengaruh.',
      onConfirm: async () => {
        try {
          await deleteRow('mds_templates', id);
          showToast('Template dihapus', 'success');
          loadAll();
        } catch (err) {
          showToast('Gagal menghapus template', 'error');
        }
      }
    });
  }));
}

// ─── Modal Buat / Edit Template ───────────────────────────────────────────────

function openTemplateModal(template = null) {
  const isEdit = !!template?.id;

  // Buat daftar option equipment yang belum punya template (kecuali template sedang di-edit)
  const usedNames = templates.map(t => t.name).filter(n => isEdit ? n !== template.name : true);
  const availableEquipment = equipmentList.filter(e => !usedNames.includes(e.namaEquipment));

  // Tambah semua equipment ke datalist (untuk datalist autocomplete)
  const allNames = [...new Set(equipmentList.map(e => e.namaEquipment))].sort();

  showModal({
    title: isEdit ? 'Edit Template MDS' : 'Buat Template MDS Baru',
    body: `
      <form id="template-form">
        <div class="mb-3">
          <label class="form-label fw-semibold">Nama Equipment <span class="text-danger">*</span></label>
          <input 
            type="text" class="form-control" id="t-name" 
            value="${template?.name || ''}" 
            list="equip-name-list"
            placeholder="Ketik atau pilih nama equipment..."
            required
            ${isEdit ? '' : ''}
          >
          <datalist id="equip-name-list">
            ${allNames.map(n => `<option value="${n}"></option>`).join('')}
          </datalist>
          <small class="text-muted">Ketik nama equipment. 1 nama equipment = 1 template MDS.</small>
        </div>
        <div class="mb-3">
          <label class="form-label fw-semibold">Interval PM (Hari) <span class="text-danger">*</span></label>
          <input type="number" class="form-control" id="t-interval" value="${template?.interval_days || 30}" required>
          <small class="text-muted">Mis: 30 untuk Bulanan, 90 untuk 3 Bulanan, 365 untuk Tahunan</small>
        </div>
        <div class="row mb-3">
          <div class="col-6">
            <label class="form-label fw-semibold">Nomor Form Referensi</label>
            <input type="text" class="form-control" id="t-form-no" value="${template?.form_number || ''}" placeholder="mis: GMF/F-003.R2">
          </div>
          <div class="col-6">
            <label class="form-label fw-semibold">Revisi</label>
            <input type="text" class="form-control" id="t-revision" value="${template?.revision || '0'}">
          </div>
        </div>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" id="btn-cancel">Batal</button>
      <button type="button" class="btn btn-primary" id="btn-save">${isEdit ? 'Simpan Perubahan' : 'Buat Template'}</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#btn-cancel').addEventListener('click', close);
      overlay.querySelector('#btn-save').addEventListener('click', async () => {
        const name     = document.getElementById('t-name').value.trim();
        const interval = document.getElementById('t-interval').value;
        const formNo   = document.getElementById('t-form-no').value;
        const rev      = document.getElementById('t-revision').value;
        
        if (!name || !interval) {
          showToast('Harap isi Nama Equipment dan Interval', 'warning');
          return;
        }

        // Cek duplikat nama (kecuali edit template sendiri)
        const isDuplicate = templates.some(t => t.name === name && t.id !== template?.id);
        if (isDuplicate) {
          showToast(`Template untuk "${name}" sudah ada. Gunakan tombol Duplikat untuk menyalin.`, 'warning');
          return;
        }
        
        try {
          const payload = {
            name,
            kategori_equipment: name, // backward compat
            interval_days: parseInt(interval),
            form_number: formNo,
            revision: rev,
          };
          
          if (isEdit) {
            const { error } = await supabase.from('mds_templates').update(payload).eq('id', template.id);
            if (error) throw error;
            showToast('Template diperbarui', 'success');
          } else {
            await insertRow('mds_templates', payload);
            showToast('Template dibuat', 'success');
          }
          
          close();
          loadAll();
        } catch (err) {
          console.error(err);
          showToast('Terjadi kesalahan: ' + (err.message || ''), 'error');
        }
      });
    }
  });
}

// ─── Modal Duplikat Template ──────────────────────────────────────────────────

function openDuplicateModal(sourceTemplate) {
  // Nama yang sudah terpakai
  const usedNames = templates.map(t => t.name);
  const allNames  = [...new Set(equipmentList.map(e => e.namaEquipment))].sort();

  showModal({
    title: `Duplikat Template — ${sourceTemplate.name}`,
    body: `
      <div class="alert alert-info mb-3" style="font-size:0.85rem;">
        Semua item checklist dari template <strong>${sourceTemplate.name}</strong> akan disalin. 
        Ganti nama equipment di bawah untuk template baru.
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Nama Equipment Baru <span class="text-danger">*</span></label>
        <input 
          type="text" class="form-control" id="dup-name" 
          list="dup-equip-list"
          placeholder="Pilih atau ketik nama equipment tujuan..."
        >
        <datalist id="dup-equip-list">
          ${allNames.filter(n => !usedNames.includes(n)).map(n => `<option value="${n}"></option>`).join('')}
        </datalist>
        <small class="text-muted">Equipment yang namanya sudah ada template tidak ditampilkan.</small>
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Interval PM (Hari)</label>
        <input type="number" class="form-control" id="dup-interval" value="${sourceTemplate.interval_days}">
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="dup-cancel">Batal</button>
      <button class="btn btn-success" id="dup-save">📋 Duplikat Sekarang</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#dup-cancel').addEventListener('click', close);
      overlay.querySelector('#dup-save').addEventListener('click', async () => {
        const newName  = overlay.querySelector('#dup-name').value.trim();
        const interval = parseInt(overlay.querySelector('#dup-interval').value) || sourceTemplate.interval_days;

        if (!newName) {
          showToast('Isi nama equipment tujuan', 'warning');
          return;
        }
        if (templates.some(t => t.name === newName)) {
          showToast(`Template untuk "${newName}" sudah ada`, 'warning');
          return;
        }

        const btn = overlay.querySelector('#dup-save');
        btn.disabled = true;
        btn.textContent = 'Menyalin...';

        try {
          // 1. Buat template baru
          const { data: newTpl, error: tplErr } = await supabase
            .from('mds_templates')
            .insert({
              name: newName,
              kategori_equipment: newName,
              interval_days: interval,
              form_number: sourceTemplate.form_number || '',
              revision: sourceTemplate.revision || '0',
            })
            .select()
            .single();
          if (tplErr) throw tplErr;

          // 2. Ambil semua item dari template sumber
          const { data: sourceItems } = await supabase
            .from('mds_template_items')
            .select('*')
            .eq('template_id', sourceTemplate.id)
            .order('order_idx', { ascending: true });

          // 3. Salin item ke template baru
          if (sourceItems && sourceItems.length > 0) {
            const newItems = sourceItems.map(item => ({
              template_id: newTpl.id,
              section: item.section,
              activity_title: item.activity_title,
              description: item.description || '',
              needs_input: item.needs_input,
              expected_unit: item.expected_unit || '',
              order_idx: item.order_idx,
            }));
            const { error: itemErr } = await supabase.from('mds_template_items').insert(newItems);
            if (itemErr) throw itemErr;
          }

          showToast(`Template "${newName}" berhasil dibuat dengan ${sourceItems?.length || 0} item checklist`, 'success');
          close();
          loadAll();
        } catch (err) {
          console.error(err);
          showToast('Gagal duplikat: ' + (err.message || ''), 'error');
          btn.disabled = false;
          btn.textContent = '📋 Duplikat Sekarang';
        }
      });
    }
  });
}

// ─── KELOLA ITEM CHECKLIST ────────────────────────────────────────────────────

async function openTemplateItemsModal(template) {
  showModal({
    title: `Kelola Item Checklist — ${template.name}`,
    size: 'modal-xl',
    body: `
      <div class="row">
        <div class="col-md-4 border-end">
          <h6>Tambah Aktivitas Baru</h6>
          <form id="item-form" class="mt-3">
            <input type="hidden" id="i-id" value="">
            <div class="mb-3">
              <label class="form-label">Section / Group *</label>
              <input type="text" class="form-control" id="i-section" placeholder="mis: General Check, Panel Elektrikal" required>
            </div>
            <div class="mb-3">
              <label class="form-label">Aktivitas Maint. *</label>
              <input type="text" class="form-control" id="i-title" placeholder="mis: Ukur tegangan R-S" required>
            </div>
            <div class="mb-3">
              <label class="form-label">Deskripsi Opsional</label>
              <textarea class="form-control" id="i-desc" rows="2"></textarea>
            </div>
            <div class="mb-3 form-check">
              <input type="checkbox" class="form-check-input" id="i-needs-input">
              <label class="form-check-label" for="i-needs-input">Butuh input nilai ukur angka?</label>
            </div>
            <div class="mb-3 d-none" id="i-unit-wrapper">
              <label class="form-label">Satuan Ukur</label>
              <input type="text" class="form-control" id="i-unit" placeholder="mis: Volt, Ampere, Celcius">
            </div>
            <button type="button" class="btn btn-primary w-100" id="btn-save-item">Tambah Item</button>
            <button type="button" class="btn btn-outline-secondary w-100 mt-2 d-none" id="btn-cancel-edit">Batal Edit</button>
          </form>
        </div>
        <div class="col-md-8">
          <h6>Daftar Aktivitas (${template.interval_days} Hari)</h6>
          <div class="table-responsive mt-3" style="max-height: 400px; overflow-y: auto;">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr>
                  <th>Section</th>
                  <th>Aktivitas</th>
                  <th>Input Nilai</th>
                  <th width="80">Aksi</th>
                </tr>
              </thead>
              <tbody id="items-table-body">
                <tr><td colspan="4" class="text-center">Memuat...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
    footer: `<button class="btn btn-secondary" id="btn-close-items">Tutup</button>`,
    onMount: (overlay, close) => {
      overlay.querySelector('#btn-close-items').addEventListener('click', close);
      
      const unitWrapper  = overlay.querySelector('#i-unit-wrapper');
      const needsInputCb = overlay.querySelector('#i-needs-input');
      needsInputCb.addEventListener('change', (e) => {
        if (e.target.checked) unitWrapper.classList.remove('d-none');
        else unitWrapper.classList.add('d-none');
      });
      
      const btnSave   = overlay.querySelector('#btn-save-item');
      const btnCancel = overlay.querySelector('#btn-cancel-edit');
      
      let currentItems = [];
      
      const loadItems = async () => {
        try {
          const { data } = await supabase
            .from('mds_template_items')
            .select('*')
            .eq('template_id', template.id)
            .order('order_idx', { ascending: true });
          currentItems = data || [];
          renderItems();
        } catch (e) {
          console.error(e);
          overlay.querySelector('#items-table-body').innerHTML = `<tr><td colspan="4" class="text-danger">Gagal memuat item</td></tr>`;
        }
      };
      
      const renderItems = () => {
        const tbody = overlay.querySelector('#items-table-body');
        if (currentItems.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Belum ada item aktivitas</td></tr>`;
          return;
        }
        
        let html = '';
        let currentSection = '';
        
        const sortedItems = [...currentItems].sort((a, b) => {
          if (a.section === b.section) return (a.order_idx || 0) - (b.order_idx || 0);
          return a.section.localeCompare(b.section);
        });
        
        sortedItems.forEach(item => {
          if (item.section !== currentSection) {
            html += `<tr class="table-secondary"><td colspan="4" class="fw-bold">${item.section}</td></tr>`;
            currentSection = item.section;
          }
          html += `
            <tr>
              <td></td>
              <td>
                <div class="fw-semibold">${item.activity_title}</div>
                ${item.description ? `<small class="text-muted">${item.description}</small>` : ''}
              </td>
              <td>${item.needs_input ? `<span class="badge bg-info text-dark">Ya (${item.expected_unit})</span>` : '-'}</td>
              <td>
                <button class="btn btn-sm text-primary p-0 me-2 btn-edit-item" data-id="${item.id}">${icons.edit}</button>
                <button class="btn btn-sm text-danger p-0 btn-delete-item" data-id="${item.id}">${icons.trash}</button>
              </td>
            </tr>
          `;
        });
        tbody.innerHTML = html;
        
        tbody.querySelectorAll('.btn-edit-item').forEach(btn => btn.addEventListener('click', () => {
          const it = currentItems.find(x => x.id === btn.dataset.id);
          if (it) {
            overlay.querySelector('#i-id').value       = it.id;
            overlay.querySelector('#i-section').value  = it.section;
            overlay.querySelector('#i-title').value    = it.activity_title;
            overlay.querySelector('#i-desc').value     = it.description || '';
            needsInputCb.checked = it.needs_input;
            if (it.needs_input) unitWrapper.classList.remove('d-none');
            else unitWrapper.classList.add('d-none');
            overlay.querySelector('#i-unit').value = it.expected_unit || '';
            btnSave.textContent = 'Simpan Edit';
            btnCancel.classList.remove('d-none');
          }
        }));
        
        tbody.querySelectorAll('.btn-delete-item').forEach(btn => btn.addEventListener('click', () => {
          showConfirm({
            message: 'Hapus item ini?',
            onConfirm: async () => {
              await deleteRow('mds_template_items', btn.dataset.id);
              loadItems();
            }
          });
        }));
      };
      
      const resetForm = () => {
        overlay.querySelector('#i-id').value      = '';
        overlay.querySelector('#i-title').value   = '';
        overlay.querySelector('#i-desc').value    = '';
        needsInputCb.checked = false;
        unitWrapper.classList.add('d-none');
        overlay.querySelector('#i-unit').value    = '';
        btnSave.textContent = 'Tambah Item';
        btnCancel.classList.add('d-none');
      };
      
      btnCancel.addEventListener('click', resetForm);
      
      btnSave.addEventListener('click', async () => {
        const id        = overlay.querySelector('#i-id').value;
        const section   = overlay.querySelector('#i-section').value;
        const title     = overlay.querySelector('#i-title').value;
        const desc      = overlay.querySelector('#i-desc').value;
        const needsInput = needsInputCb.checked;
        const unit      = overlay.querySelector('#i-unit').value;
        
        if (!section || !title) {
          showToast('Section dan Judul Aktivitas wajib diisi', 'warning');
          return;
        }
        
        const payload = {
          template_id: template.id,
          section,
          activity_title: title,
          description: desc,
          needs_input: needsInput,
          expected_unit: needsInput ? unit : null,
        };
        
        try {
          if (id) {
            await supabase.from('mds_template_items').update(payload).eq('id', id);
            showToast('Item diperbarui', 'success');
          } else {
            payload.order_idx = currentItems.length + 1;
            await insertRow('mds_template_items', payload);
            showToast('Item ditambahkan', 'success');
          }
          resetForm();
          loadItems();
        } catch (e) {
          showToast('Terjadi kesalahan', 'error');
        }
      });
      
      loadItems();
    }
  });
}
