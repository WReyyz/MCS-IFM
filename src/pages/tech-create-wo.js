import { renderTechShell } from '../components/tech-shell.js';
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { fetchAll, insertRow } from '../lib/supabase.js';
import { WO_CATEGORY, WO_PRIORITY } from '../utils/constants.js';
import { generateWoNumber, escapeHtml } from '../utils/helpers.js';

export async function renderTechCreateWo() {
  const { content, profile } = await renderTechShell('create-wo');
  const equipList = await fetchAll('equipment', { order: { column: 'namaEquipment', ascending: true } });

  const catOptions = Object.entries(WO_CATEGORY).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('');
  const prioOptions = Object.entries(WO_PRIORITY).map(([k,v]) => `<option value="${k}" ${k==='medium'?'selected':''}>${v.label}</option>`).join('');
  const equipOptions = equipList.map(e => `<option value="${e.idAset}">${e.idAset} — ${escapeHtml(e.namaEquipment)}</option>`).join('');

  content.innerHTML = `
    <div class="tech-create-header">
      <div class="tech-create-header-icon">${icons.plus}</div>
      <h3 style="color:var(--text-primary);margin-bottom:4px">Buat Work Order</h3>
      <p style="font-size:var(--fs-sm);color:var(--text-muted)">WO Corrective — ditugaskan ke Anda</p>
    </div>
    <div class="tech-form-card">
      <div class="tech-form-card-title">${icons.clipboardList} Informasi WO</div>
      <div class="form-group"><label class="form-label">Kategori *</label><select class="form-select" id="f-category">${catOptions}</select></div>
      <div class="form-group"><label class="form-label">Prioritas *</label><select class="form-select" id="f-priority">${prioOptions}</select></div>
      <div class="form-group"><label class="form-label">Equipment (opsional)</label>
        <select class="form-select" id="f-equip"><option value="">-- Tidak terkait equipment --</option>${equipOptions}</select>
      </div>
      <div class="form-group"><label class="form-label">Deskripsi Masalah *</label>
        <textarea class="form-textarea" id="f-desc" placeholder="Jelaskan masalah yang perlu ditangani..." style="min-height:100px"></textarea>
      </div>
      <div class="form-group"><label class="form-label">Catatan Tambahan</label>
        <textarea class="form-textarea" id="f-notes" placeholder="Catatan tambahan..."></textarea>
      </div>
    </div>
    <button class="btn btn-primary" id="f-submit" style="width:100%;padding:14px;font-size:var(--fs-base)">
      ${icons.send} Kirim Work Order
    </button>
  `;

  content.querySelector('#f-submit').addEventListener('click', async () => {
    const desc = content.querySelector('#f-desc').value.trim();
    if (!desc) { showToast('Deskripsi masalah wajib diisi', 'warning'); return; }
    const btn = content.querySelector('#f-submit');
    btn.disabled = true;
    btn.textContent = 'Mengirim...';
    try {
      const equipId = content.querySelector('#f-equip').value || null;
      await insertRow('work_orders', {
        wo_number: generateWoNumber(),
        type: 'corrective',
        category: content.querySelector('#f-category').value,
        priority: content.querySelector('#f-priority').value,
        status: 'open',
        assigned_to: profile.id,
        equipment_id: equipId,
        description: desc,
        notes: content.querySelector('#f-notes').value.trim(),
        opened_at: new Date().toISOString()
      });
      showToast('Work Order berhasil dibuat!', 'success');
      window.location.hash = '/tech-wo-list';
    } catch (err) {
      showToast('Gagal membuat WO', 'error');
      btn.disabled = false;
      btn.innerHTML = icons.send + ' Kirim Work Order';
    }
  });
}