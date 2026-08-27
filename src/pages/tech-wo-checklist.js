import { renderTechShell } from '../components/tech-shell.js';
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { updateRow, supabase } from '../lib/supabase.js';
import { escapeHtml } from '../utils/helpers.js';

export async function renderTechWoChecklist() {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const woId = params.get('id');

  if (!woId) {
    window.location.hash = '/tech-wo-list';
    return;
  }

  // We reuse tech shell but we can hide the bottom nav or just render content
  const { content, profile } = await renderTechShell('wo-list');
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const { data: wo, error } = await supabase
      .from('work_orders')
      .select('*, equipment(*), preventive_maintenance(*)')
      .eq('id', woId)
      .single();

    if (error || !wo) throw error || new Error('WO Not Found');

    let checklist = wo.equipment?.checklist || [];
    if (!Array.isArray(checklist)) checklist = [];

    // Filter tasks based on PM interval if this is a preventive WO
    if (wo.preventive_maintenance && wo.preventive_maintenance.interval_days) {
      const pmInterval = wo.preventive_maintenance.interval_days;
      checklist = checklist.filter(task => {
        // If task doesn't specify intervals, assume it applies to all
        if (!task.intervals || !Array.isArray(task.intervals) || task.intervals.length === 0) {
          return true;
        }
        return task.intervals.includes(pmInterval);
      });
    }

    const groupedTasks = {};
    checklist.forEach(item => {
      const cat = item.category || 'General check';
      if (!groupedTasks[cat]) groupedTasks[cat] = [];
      groupedTasks[cat].push(item);
    });

    renderChecklistUI(content, wo, groupedTasks, profile);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="tech-empty"><p>Gagal memuat form checklist</p></div>';
    showToast('Gagal memuat form checklist', 'error');
  }
}

function renderChecklistUI(content, wo, groupedTasks, profile) {
  const equip = wo.equipment || {};
  const pm = wo.preventive_maintenance || {};
  const today = new Date().toISOString().split('T')[0];

  let taskHtml = '';
  let categoryIndex = 1;

  for (const [category, tasks] of Object.entries(groupedTasks)) {
    taskHtml += `
      <div class="mb-4">
        <div class="d-flex align-items-center mb-3">
          <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold me-2" style="width: 28px; height: 28px; font-size: 14px;">${categoryIndex++}</div>
          <h6 class="m-0 fw-bold">${escapeHtml(category)}</h6>
        </div>
    `;

    tasks.forEach((task, idx) => {
      const letter = String.fromCharCode(97 + idx); // a, b, c...
      taskHtml += `
        <div class="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom checklist-row" data-task="${escapeHtml(task.task)}" data-type="${task.type}">
          <div class="me-3" style="flex: 1;">
            <div class="text-secondary small mb-1">${letter}. ${escapeHtml(task.task)}</div>
            ${task.type === 'number' ? `
              <div class="d-flex align-items-center gap-2">
                <input type="number" class="form-control form-control-sm cl-number-val" style="width: 80px;" placeholder="Nilai" />
                <span class="text-muted small">${escapeHtml(task.standard || '')}</span>
              </div>
            ` : ''}
            ${task.type === 'image' ? `
              <input type="file" class="form-control form-control-sm mt-2 cl-img-val" accept="image/*" />
              <img class="cl-img-preview mt-2 rounded border" style="display:none; max-height:80px; object-fit:cover;" />
            ` : ''}
          </div>
          <div class="d-flex gap-2 align-items-center">
            <button class="btn btn-outline-success rounded-circle d-flex align-items-center justify-content-center btn-cl-pass" style="width:36px; height:36px; padding:0;" title="PASS">
              ${icons.check}
            </button>
            <button class="btn btn-outline-danger rounded-circle d-flex align-items-center justify-content-center btn-cl-fail" style="width:36px; height:36px; padding:0;" title="FAILED">
              ${icons.x}
            </button>
          </div>
        </div>
      `;
    });

    taskHtml += `</div>`;
  }

  if (Object.keys(groupedTasks).length === 0) {
    taskHtml = '<div class="text-muted small my-3">Belum ada task diatur untuk equipment ini.</div>';
  }

  // Hide bottom nav if it exists to give full screen to this form
  const bottomNav = document.querySelector('.tech-bottom-nav');
  if (bottomNav) bottomNav.style.display = 'none';

  content.innerHTML = `
    <div style="background: #fff; min-height: 100vh; padding-bottom: 80px;">
      <!-- Header -->
      <div class="p-3 border-bottom d-flex align-items-center bg-white sticky-top shadow-sm">
        <a href="#/tech-wo-list" class="text-dark me-3" style="text-decoration:none;">${icons.chevronLeft}</a>
        <h5 class="m-0 fw-bold text-truncate">Form Task / MD Sheet</h5>
        <div class="ms-auto">
          <span class="badge bg-primary bg-opacity-10 text-primary">IN PROGRESS</span>
        </div>
      </div>

      <!-- Info Area -->
      <div class="p-3 bg-light border-bottom">
        <div class="text-muted small mb-2">Isi checklist task sesuai dengan pekerjaan yang dilakukan.</div>
        <div class="row g-2 small">
          <div class="col-6">
             <div class="text-muted">WO Number</div>
             <div class="fw-bold">${escapeHtml(wo.wo_number)}</div>
          </div>
          <div class="col-6">
             <div class="text-muted">Inventory No.</div>
             <div class="fw-bold">${escapeHtml(equip.noInventory || '-')}</div>
          </div>
          <div class="col-6">
             <div class="text-muted">Tipe / Model</div>
             <div class="fw-bold">${escapeHtml(equip.type || '-')}</div>
          </div>
          <div class="col-6">
             <div class="text-muted">Location</div>
             <div class="fw-bold">${escapeHtml(equip.area || '-')}</div>
          </div>
          <div class="col-12 mt-2">
             <div class="text-muted">Deskripsi Pekerjaan</div>
             <div class="fw-bold">${escapeHtml(wo.description || '-')}</div>
          </div>
        </div>
      </div>

      <!-- Checklist Area -->
      <div class="p-3">
        <div class="d-flex justify-content-end mb-3 border-bottom pb-2">
          <div class="text-center me-4" style="width:40px;"><small class="text-success fw-bold">PASS</small></div>
          <div class="text-center" style="width:40px;"><small class="text-danger fw-bold">FAILED</small></div>
        </div>
        
        ${taskHtml}

        <div class="mb-3 mt-4">
          <label class="form-label small fw-bold text-secondary">Catatan / Temuan (Opsional)</label>
          <textarea class="form-control" id="cl-notes" rows="3" placeholder="Tuliskan catatan atau temuan selama pekerjaan..."></textarea>
        </div>

        <div class="row g-2 mb-4">
          <div class="col-6">
            <label class="form-label small fw-bold text-secondary">Date of Complement *</label>
            <input type="date" class="form-control bg-light" id="cl-date" value="${today}" readonly />
          </div>
          <div class="col-6">
            <label class="form-label small fw-bold text-secondary">Technician</label>
            <input type="text" class="form-control bg-light" value="${escapeHtml(profile.full_name)}" readonly />
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="position-fixed bottom-0 start-0 w-100 bg-white border-top p-3 d-flex justify-content-between align-items-center shadow-lg" style="z-index:100;">
        <button class="btn btn-outline-primary bg-white d-flex align-items-center gap-2 px-4" onclick="window.history.back()">Batal</button>
        <button class="btn btn-success d-flex align-items-center gap-2 px-4" id="btn-submit-cl">${icons.checkCircle} Simpan & Selesai</button>
      </div>
    </div>
  `;

  // Attach events for PASS/FAIL toggle
  content.querySelectorAll('.checklist-row').forEach(row => {
    const btnPass = row.querySelector('.btn-cl-pass');
    const btnFail = row.querySelector('.btn-cl-fail');

    btnPass.addEventListener('click', () => {
      btnPass.classList.add('btn-success', 'text-white');
      btnPass.classList.remove('btn-outline-success');
      btnFail.classList.remove('btn-danger', 'text-white');
      btnFail.classList.add('btn-outline-danger');
      row.dataset.result = 'pass';
    });

    btnFail.addEventListener('click', () => {
      btnFail.classList.add('btn-danger', 'text-white');
      btnFail.classList.remove('btn-outline-danger');
      btnPass.classList.remove('btn-success', 'text-white');
      btnPass.classList.add('btn-outline-success');
      row.dataset.result = 'fail';
    });

    // Handle Image preview
    const imgInput = row.querySelector('.cl-img-val');
    const imgPreview = row.querySelector('.cl-img-preview');
    if (imgInput && imgPreview) {
      imgInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = ev => {
            imgPreview.src = ev.target.result;
            imgPreview.style.display = 'block';
            row.dataset.imgBase64 = ev.target.result;
          };
          reader.readAsDataURL(file);
        } else {
          imgPreview.src = '';
          imgPreview.style.display = 'none';
          row.dataset.imgBase64 = '';
        }
      });
    }
  });

  // Handle Submit
  content.querySelector('#btn-submit-cl').addEventListener('click', async () => {
    const rows = content.querySelectorAll('.checklist-row');
    const results = [];
    let allFilled = true;

    rows.forEach(row => {
      const taskName = row.dataset.task;
      const type = row.dataset.type;
      const result = row.dataset.result; // 'pass' or 'fail'
      
      let val = null;
      if (type === 'number') {
        const numInput = row.querySelector('.cl-number-val');
        val = numInput ? numInput.value.trim() : '';
        if (!val) allFilled = false;
      } else if (type === 'image') {
        val = row.dataset.imgBase64;
        if (!val) allFilled = false;
      }

      if (!result) allFilled = false;

      results.push({
        task: taskName,
        type: type,
        result: result, // pass/fail
        value: val
      });
    });

    if (!allFilled) {
      showToast('Harap lengkapi semua task (PASS/FAIL) dan isian yang wajib.', 'warning');
      return;
    }

    const notes = content.querySelector('#cl-notes').value.trim();

    try {
      // Update WO Status to pending_inspection
      await updateRow('work_orders', wo.id, {
        status: 'pending_inspection',
        assigned_to: profile.id, // Ensure tech is assigned
        checklist_result: results,
        notes: notes,
        closed_at: new Date().toISOString()
      });

      showToast('Task selesai, menunggu approval Inspector', 'success');
      window.location.hash = '/tech-wo-list';
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan hasil form task', 'error');
    }
  });
}
