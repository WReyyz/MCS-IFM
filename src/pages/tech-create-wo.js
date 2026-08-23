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

  content.innerHTML = `
    <div class="tech-create-header mb-4 text-center">
      <div class="tech-create-header-icon text-primary fs-1 mb-2">${icons.plus}</div>
      <h3 class="text-dark mb-1">Buat Work Order</h3>
      <p class="text-muted small">WO Corrective — Terbuka untuk semua teknisi</p>
    </div>
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body p-4">
        <div class="d-flex align-items-center gap-2 mb-4 fw-semibold text-primary">
          ${icons.clipboardList} Informasi WO
        </div>
        <div class="mb-3"><label class="form-label">Kategori *</label><select class="form-select" id="f-category">${catOptions}</select></div>
        <div class="mb-3"><label class="form-label">Area *</label>
          <input type="text" class="form-control" id="f-area" placeholder="Contoh: Gedung A, Lantai 1..." required />
        </div>
        <div class="mb-3"><label class="form-label">Deskripsi Masalah *</label>
          <textarea class="form-control" id="f-desc" placeholder="Jelaskan masalah yang perlu ditangani..." style="min-height:100px"></textarea>
        </div>
        <div class="mb-3">
          <label class="form-label">Foto Detail/Lokasi (Opsional) - Maks 1MB</label>
          <input type="file" class="form-control" id="f-photo" accept="image/*" />
          <div id="f-photo-preview-wrap" class="mt-2 text-center" style="display:none;">
            <img id="f-photo-preview" src="" class="img-fluid rounded border" style="max-height:180px; object-fit:cover;" />
          </div>
        </div>
      </div>
    </div>
    <button class="btn btn-primary w-100 py-3 fw-medium d-flex align-items-center justify-content-center gap-2" id="f-submit">
      ${icons.send} Kirim Work Order
    </button>
  `;

  let photoBase64 = null;
  const photoEl = content.querySelector('#f-photo');
  const previewWrap = content.querySelector('#f-photo-preview-wrap');
  const previewImg = content.querySelector('#f-photo-preview');

  photoEl.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) { previewWrap.style.display = 'none'; photoBase64 = null; return; }
    if (file.size > 1024 * 1024) {
      showToast('Ukuran foto maks 1MB', 'warning');
      photoEl.value = '';
      previewWrap.style.display = 'none';
      photoBase64 = null;
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      photoBase64 = ev.target.result;
      previewImg.src = photoBase64;
      previewWrap.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  content.querySelector('#f-submit').addEventListener('click', async () => {
    const area = content.querySelector('#f-area').value.trim();
    const desc = content.querySelector('#f-desc').value.trim();
    
    if (!area) { showToast('Area wajib diisi', 'warning'); return; }
    if (!desc) { showToast('Deskripsi masalah wajib diisi', 'warning'); return; }
    
    const btn = content.querySelector('#f-submit');
    btn.disabled = true;
    btn.textContent = 'Mengirim...';
    try {
      // Area disimpan di notes atau diawal description karena tidak ada kolom area di work_orders
      const fullDesc = `[Area: ${area}]\n${desc}`;

      await insertRow('work_orders', {
        wo_number: generateWoNumber(),
        type: 'corrective',
        category: content.querySelector('#f-category').value,
        priority: 'medium', // Default priority, admin can change later
        status: 'open',
        assigned_to: null, // Terbuka untuk semua teknisi
        requested_by: profile.id, // Menyimpan siapa yang buat WO
        equipment_id: null,
        description: fullDesc,
        notes: '',
        problem_photo_url: photoBase64,
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