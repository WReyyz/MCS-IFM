import { renderTechShell } from '../components/tech-shell.js';
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { updateRow, supabase } from '../lib/supabase.js';
import { escapeHtml } from '../utils/helpers.js';

export async function renderTechWoChecklist() {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const woId = params.get('id');

  if (!woId) { window.location.hash = '/tech-wo-list'; return; }

  const { content, profile } = await renderTechShell('wo-list');
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const { data: wo, error } = await supabase
      .from('work_orders').select('*, equipment(*), preventive_maintenance(*)')
      .eq('id', woId).single();
    if (error || !wo) throw error || new Error('WO Not Found');

    const templateId = wo.mds_template_id || wo.preventive_maintenance?.mds_template_id;
    let checklist = [];
    if (wo.type === 'preventive' && templateId) {
      const { data: items, error: tiErr } = await supabase
        .from('mds_template_items').select('*')
        .eq('template_id', templateId).order('order_idx', { ascending: true });
      if (tiErr) console.warn('Template items error:', tiErr.message);
      if (items && items.length > 0) {
        checklist = items.map(ti => ({
          id: ti.id, task: ti.activity_title, category: ti.section,
          type: ti.needs_input ? 'measurement' : 'checkbox',
          unit: ti.expected_unit, desc: ti.description,
        }));
      }
    } else {
      checklist = wo.equipment?.checklist || [];
      if (!Array.isArray(checklist)) checklist = [];
    }

    // Fetch semua anggota tim dari wo_assignees
    let teamNames = [];
    try {
      const { data: rows } = await supabase
        .from('wo_assignees')
        .select('profiles!wo_assignees_technician_id_fkey(full_name)')
        .eq('wo_id', woId);
      if (rows && rows.length > 0) teamNames = rows.map(r => r.profiles?.full_name).filter(Boolean);
    } catch (_) {}
    if (teamNames.length === 0 && profile.full_name) teamNames = [profile.full_name];

    const groupedTasks = {};
    checklist.forEach(item => {
      const cat = item.category || 'General check';
      if (!groupedTasks[cat]) groupedTasks[cat] = [];
      groupedTasks[cat].push(item);
    });

    renderChecklistUI(content, wo, groupedTasks, profile, teamNames);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="tech-empty"><p>Gagal memuat form checklist</p></div>';
    showToast('Gagal memuat form checklist', 'error');
  }
}

function renderChecklistUI(content, wo, groupedTasks, profile, teamNames) {
  const equip = wo.equipment || {};
  const now   = new Date();
  const pad   = n => String(n).padStart(2, '0');
  const today = now.toISOString().split('T')[0];
  const defaultDT = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let taskHtml = '';
  let catIdx = 1;
  for (const [category, tasks] of Object.entries(groupedTasks)) {
    taskHtml += `<div class="mb-4">
      <div class="d-flex align-items-center mb-3">
        <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold me-2"
             style="width:28px;height:28px;font-size:14px;">${catIdx++}</div>
        <h6 class="m-0 fw-bold">${escapeHtml(category)}</h6>
      </div>`;
    tasks.forEach((task, idx) => {
      const letter = String.fromCharCode(97 + idx);
      taskHtml += `
      <div class="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom checklist-row"
           data-task="${escapeHtml(task.task)}" data-type="${task.type}">
        <div class="me-3" style="flex:1;">
          <div class="text-secondary small mb-1">${letter}. ${escapeHtml(task.task)}</div>
          <input type="hidden" class="cl-item-id" value="${task.id || ''}">
          ${task.type === 'number' ? `<div class="d-flex align-items-center gap-2">
            <input type="number" class="form-control form-control-sm cl-number-val" style="width:80px;" placeholder="Nilai" />
            <span class="text-muted small">${escapeHtml(task.standard || '')}</span></div>` : ''}
          ${task.type === 'image' ? `
            <input type="file" class="form-control form-control-sm mt-2 cl-img-val" accept="image/*" />
            <img class="cl-img-preview mt-2 rounded border" style="display:none;max-height:80px;object-fit:cover;" />` : ''}
        </div>
        <div class="d-flex gap-2 align-items-center">
          <button class="btn btn-outline-success rounded-circle d-flex align-items-center justify-content-center btn-cl-pass"
                  style="width:36px;height:36px;padding:0;" title="PASS">${icons.check}</button>
          <button class="btn btn-outline-danger rounded-circle d-flex align-items-center justify-content-center btn-cl-fail"
                  style="width:36px;height:36px;padding:0;" title="FAILED">${icons.x}</button>
        </div>
      </div>`;
    });
    taskHtml += '</div>';
  }
  if (Object.keys(groupedTasks).length === 0)
    taskHtml = '<div class="text-muted small my-3">Belum ada task diatur untuk equipment ini.</div>';

  const bottomNav = document.querySelector('.tech-bottom-nav');
  if (bottomNav) bottomNav.style.display = 'none';

  const teamBadgesHtml = teamNames
    .map(n => `<span class="badge me-1 mb-1" style="background:#dbeafe;color:#1e40af;font-weight:500;font-size:.8rem;">${escapeHtml(n)}</span>`)
    .join('');

  content.innerHTML = `
<div style="background:#fff;min-height:100vh;padding-bottom:80px;">

  <!-- Header -->
  <div class="p-3 border-bottom d-flex align-items-center bg-white sticky-top shadow-sm">
    <a href="#/tech-wo-list" class="text-dark me-3" style="text-decoration:none;">${icons.chevronLeft}</a>
    <h5 class="m-0 fw-bold text-truncate">Form Task / MD Sheet</h5>
    <div class="ms-auto"><span class="badge bg-primary bg-opacity-10 text-primary">IN PROGRESS</span></div>
  </div>

  <!-- Info WO -->
  <div class="p-3 bg-light border-bottom">
    <div class="text-muted small mb-2">Isi checklist task sesuai dengan pekerjaan yang dilakukan.</div>
    <div class="row g-2 small">
      <div class="col-6"><div class="text-muted">WO Number</div><div class="fw-bold">${escapeHtml(wo.wo_number)}</div></div>
      <div class="col-6"><div class="text-muted">Inventory No.</div><div class="fw-bold">${escapeHtml(equip.noInventory || '-')}</div></div>
      <div class="col-6"><div class="text-muted">Tipe / Model</div><div class="fw-bold">${escapeHtml(equip.type || '-')}</div></div>
      <div class="col-6"><div class="text-muted">Location</div><div class="fw-bold">${escapeHtml(equip.area || '-')}</div></div>
      <div class="col-12 mt-2"><div class="text-muted">Deskripsi Pekerjaan</div><div class="fw-bold">${escapeHtml(wo.description || '-')}</div></div>
    </div>
  </div>

  <!-- Checklist -->
  <div class="p-3">
    <div class="d-flex justify-content-end mb-3 border-bottom pb-2">
      <div class="text-center me-4" style="width:40px;"><small class="text-success fw-bold">PASS</small></div>
      <div class="text-center" style="width:40px;"><small class="text-danger fw-bold">FAILED</small></div>
    </div>
    ${taskHtml}

    <!-- Catatan -->
    <div class="mb-4 mt-2">
      <label class="form-label small fw-bold text-secondary">Catatan / Temuan (Opsional)</label>
      <textarea class="form-control" id="cl-notes" rows="3" placeholder="Tuliskan catatan atau temuan selama pekerjaan..."></textarea>
    </div>

    <!-- PERFORMANCE EQUIPMENT -->
    <div class="border rounded-3 p-3 mb-4" style="background:#f8fafc;border-color:#cbd5e1!important;">
      <div class="fw-bold text-uppercase mb-3" style="font-size:.75rem;letter-spacing:.9px;color:#64748b;">
        📊 Performance Equipment
      </div>

      <!-- Status Equipment -->
      <div class="mb-3">
        <div class="small fw-bold text-secondary mb-2">Status Equipment <span class="text-danger">*</span></div>
        <div class="d-flex gap-2">
          <label id="wrap-serviceable" class="d-flex align-items-center gap-2 px-3 py-2 rounded-2 border flex-fill"
                 style="cursor:pointer;background:#fff;transition:all .15s;">
            <input type="radio" name="equip-status" id="status-serviceable" value="serviceable"
                   class="form-check-input m-0" style="width:18px;height:18px;">
            <span class="fw-semibold small" style="color:#16a34a;">✅ Serviceable</span>
          </label>
          <label id="wrap-unserviceable" class="d-flex align-items-center gap-2 px-3 py-2 rounded-2 border flex-fill"
                 style="cursor:pointer;background:#fff;transition:all .15s;">
            <input type="radio" name="equip-status" id="status-unserviceable" value="unserviceable"
                   class="form-check-input m-0" style="width:18px;height:18px;">
            <span class="fw-semibold small" style="color:#dc2626;">❌ Unserviceable</span>
          </label>
        </div>
      </div>

      <!-- Waktu Pengerjaan -->
      <div class="mb-3">
        <div class="small fw-bold text-secondary mb-2">Waktu Pengerjaan <span class="text-danger">*</span></div>
        <div class="row g-2">
          <div class="col-6">
            <label class="small text-muted mb-1 d-block">Mulai</label>
            <input type="datetime-local" class="form-control form-control-sm" id="cl-start-time" value="${defaultDT}" />
          </div>
          <div class="col-6">
            <label class="small text-muted mb-1 d-block">Selesai</label>
            <input type="datetime-local" class="form-control form-control-sm" id="cl-finish-time" value="${defaultDT}" />
          </div>
          <div class="col-12">
            <div class="d-flex align-items-center gap-2 mt-1 px-3 py-2 rounded-2"
                 style="background:#fff;border:1px solid #e2e8f0;">
              <span class="text-muted small">⏱ Durasi Aktual:</span>
              <span class="fw-bold small text-primary" id="cl-duration-display">0 jam 0 menit</span>
              <input type="hidden" id="cl-hours-actual" value="0" />
            </div>
          </div>
        </div>
      </div>

      <!-- Teknisi Tim -->
      <div>
        <div class="small fw-bold text-secondary mb-2">Teknisi Pelaksana (Tim)</div>
        <div class="px-3 py-2 rounded-2" style="background:#fff;border:1px solid #e2e8f0;min-height:38px;">
          ${teamBadgesHtml || '<span class="text-muted small">-</span>'}
        </div>
      </div>
    </div>

    <!-- Date & diisi oleh -->
    <div class="row g-2 mb-4">
      <div class="col-6">
        <label class="form-label small fw-bold text-secondary">Date of Complement</label>
        <input type="date" class="form-control bg-light" id="cl-date" value="${today}" readonly />
      </div>
      <div class="col-6">
        <label class="form-label small fw-bold text-secondary">Diisi oleh</label>
        <input type="text" class="form-control bg-light" value="${escapeHtml(profile.full_name)}" readonly />
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="position-fixed bottom-0 start-0 w-100 bg-white border-top p-3 d-flex justify-content-between align-items-center shadow-lg" style="z-index:100;">
    <button class="btn btn-outline-primary bg-white px-4" onclick="window.history.back()">Batal</button>
    <button class="btn btn-success d-flex align-items-center gap-2 px-4" id="btn-submit-cl">
      ${icons.checkCircle} Simpan &amp; Selesai
    </button>
  </div>
</div>`;

  // Equipment status visual
  const radioSvc  = content.querySelector('#status-serviceable');
  const radioUnsvc= content.querySelector('#status-unserviceable');
  const wrapSvc   = content.querySelector('#wrap-serviceable');
  const wrapUnsvc = content.querySelector('#wrap-unserviceable');
  const applyStyle = () => {
    if (radioSvc.checked) {
      wrapSvc.style.cssText  += ';background:#f0fdf4;border-color:#22c55e;';
      wrapUnsvc.style.cssText += ';background:#fff;border-color:#e2e8f0;';
    } else if (radioUnsvc.checked) {
      wrapUnsvc.style.cssText += ';background:#fef2f2;border-color:#ef4444;';
      wrapSvc.style.cssText   += ';background:#fff;border-color:#e2e8f0;';
    }
  };
  radioSvc.addEventListener('change', applyStyle);
  radioUnsvc.addEventListener('change', applyStyle);

  // Durasi auto-calc
  const startEl    = content.querySelector('#cl-start-time');
  const finishEl   = content.querySelector('#cl-finish-time');
  const durationEl = content.querySelector('#cl-duration-display');
  const hoursEl    = content.querySelector('#cl-hours-actual');
  const calcDuration = () => {
    const diffMs = new Date(finishEl.value) - new Date(startEl.value);
    if (diffMs > 0) {
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      durationEl.textContent = `${h} jam ${m} menit`;
      hoursEl.value = (diffMs / 3600000).toFixed(2);
    } else {
      durationEl.textContent = '0 jam 0 menit';
      hoursEl.value = '0';
    }
  };
  startEl.addEventListener('change', calcDuration);
  finishEl.addEventListener('change', calcDuration);

  // PASS/FAIL toggle
  content.querySelectorAll('.checklist-row').forEach(row => {
    const btnPass = row.querySelector('.btn-cl-pass');
    const btnFail = row.querySelector('.btn-cl-fail');
    btnPass.addEventListener('click', () => {
      btnPass.classList.replace('btn-outline-success','btn-success'); btnPass.classList.add('text-white');
      btnFail.classList.replace('btn-danger','btn-outline-danger');   btnFail.classList.remove('text-white');
      row.dataset.result = 'pass';
    });
    btnFail.addEventListener('click', () => {
      btnFail.classList.replace('btn-outline-danger','btn-danger');  btnFail.classList.add('text-white');
      btnPass.classList.replace('btn-success','btn-outline-success'); btnPass.classList.remove('text-white');
      row.dataset.result = 'fail';
    });
    const imgInput = row.querySelector('.cl-img-val');
    const imgPrev  = row.querySelector('.cl-img-preview');
    if (imgInput && imgPrev) {
      imgInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
          const r = new FileReader();
          r.onload = ev => { imgPrev.src = ev.target.result; imgPrev.style.display = 'block'; row.dataset.imgBase64 = ev.target.result; };
          r.readAsDataURL(file);
        } else { imgPrev.src=''; imgPrev.style.display='none'; row.dataset.imgBase64=''; }
      });
    }
  });

  // Submit
  content.querySelector('#btn-submit-cl').addEventListener('click', async () => {
    const equipStatus = content.querySelector('input[name="equip-status"]:checked')?.value;
    if (!equipStatus) { showToast('Pilih status equipment: Serviceable atau Unserviceable', 'warning'); return; }

    const hours = parseFloat(hoursEl.value);
    if (isNaN(hours) || hours <= 0) { showToast('Waktu selesai harus setelah waktu mulai', 'warning'); return; }

    const rows = content.querySelectorAll('.checklist-row');
    const results = [];
    let allFilled = true;
    rows.forEach(row => {
      const taskName = row.dataset.task; const type = row.dataset.type; const result = row.dataset.result;
      let val = null;
      if (type === 'number') { const ni = row.querySelector('.cl-number-val'); val = ni ? ni.value.trim() : ''; if (!val) allFilled = false; }
      else if (type === 'image') { val = row.dataset.imgBase64; if (!val) allFilled = false; }
      if (!result) allFilled = false;
      const itemId = row.querySelector('.cl-item-id')?.value || null;
      results.push({ item_id: itemId, task: taskName, type, result, value: val,
        category: row.closest('.mb-4').querySelector('h6').textContent });
    });
    if (!allFilled) { showToast('Harap lengkapi semua task (PASS/FAIL) dan isian yang wajib.', 'warning'); return; }

    const notes = content.querySelector('#cl-notes').value.trim();
    const btn = content.querySelector('#btn-submit-cl');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Menyimpan...';

    try {
      if (wo.type === 'preventive') {
        const dbR = results.map(r => ({ wo_id: wo.id, item_id: r.item_id, task_name: r.task, category: r.category,
          task_type: r.type, result: r.value || r.result, evidence_url: r.type === 'image' ? r.value : null }));
        const { error: insErr } = await supabase.from('wo_checklist_results').insert(dbR);
        if (insErr) console.warn('wo_checklist_results error:', insErr);
      }

      await updateRow('work_orders', wo.id, {
        status:           'menunggu_approval',
        equipment_status: equipStatus,
        started_at:       new Date(startEl.value).toISOString(),
        closed_at:        new Date(finishEl.value).toISOString(),
        man_hours_actual: hours,
        checklist_result: results,
        notes,
      });

      showToast('Task selesai, menunggu approval Inspector', 'success');
      window.location.hash = '/tech-wo-list';
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan: ' + (err.message || ''), 'error');
      btn.disabled = false;
      btn.innerHTML = `${icons.checkCircle} Simpan &amp; Selesai`;
    }
  });
}
