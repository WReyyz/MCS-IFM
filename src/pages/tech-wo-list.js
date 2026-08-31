import { renderTechShell } from '../components/tech-shell.js';
import { icons } from '../components/icons.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, updateRow, supabase } from '../lib/supabase.js';
import { WO_STATUS, WO_PRIORITY, WO_CATEGORY } from '../utils/constants.js';
import { formatDate, badge, escapeHtml } from '../utils/helpers.js';

let currentProfile = null;

export async function renderTechWoList() {
  const { content, profile } = await renderTechShell('wo-list');
  currentProfile = profile;

  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch WOs assigned to this tech, OR unassigned corrective WOs
    const { data: allWOsData, error } = await supabase
      .from('work_orders')
      .select('*, equipment(namaEquipment, idAset), profiles:requested_by(full_name)')
      .or(`assigned_to.eq.${currentProfile.id},and(assigned_to.is.null,type.eq.corrective)`)
      .order('opened_at', { ascending: true });

    if (error) throw error;
    const allWOs = allWOsData || [];

    // WO Preventive scheduled for today
    const preventiveToday = allWOs.filter(wo =>
      wo.type === 'preventive' &&
      wo.status !== 'closed' &&
      wo.opened_at?.startsWith(today)
    );

    // WO Corrective active (open / hold)
    const correctiveActive = allWOs.filter(wo =>
      wo.type === 'corrective' &&
      (wo.status === 'open' || wo.status === 'hold')
    );

    renderWOContent(content, preventiveToday, correctiveActive, today);
  } catch (err) {
    content.innerHTML = '<div class="tech-empty"><p>Gagal memuat Work Order</p></div>';
    showToast('Gagal memuat data WO', 'error');
  }
}

function renderWOCard(wo) {
  const statusInfo = WO_STATUS[wo.status] || {};
  const priorityInfo = WO_PRIORITY[wo.priority] || {};
  const cat = WO_CATEGORY[wo.category] || WO_CATEGORY.OTHER;
  const equipName = wo.equipment?.namaEquipment || '-';

  const today = new Date().toISOString().split('T')[0];
  const openedDate = wo.opened_at?.split('T')[0];
  const isOverdue = wo.status !== 'closed' && openedDate && openedDate < today;
  const creatorName = wo.profiles?.full_name || 'Admin';

  let borderColor = wo.type === 'preventive' ? 'border-success' : 'border-warning';
  
  return `
    <div class="card mb-3 shadow-sm border-0 border-start border-4 ${borderColor} tech-wo-card" data-wo-id="${wo.id}" style="cursor: pointer; transition: transform 0.2s;">
      <div class="card-body p-3">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <div class="fw-bold fs-6 text-dark">${escapeHtml(wo.wo_number)}</div>
            <div class="text-muted small">${escapeHtml(wo.description || '-')}</div>
          </div>
          <div style="flex-shrink: 0; margin-left: 12px;">
            ${badge(statusInfo.label || wo.status, statusInfo.color || '#888', statusInfo.bg || '#eee')}
          </div>
        </div>
        <hr class="my-2 opacity-25" />
        <div class="d-flex flex-wrap gap-2 mt-2 small text-secondary align-items-center">
          <span class="d-flex align-items-center gap-1">${icons.clock} ${formatDate(wo.opened_at)}</span>
          <span class="d-flex align-items-center gap-1">${icons.wrench} ${cat.label}</span>
          <span class="d-flex align-items-center gap-1" title="Dibuat oleh">${icons.user} ${escapeHtml(creatorName)}</span>
          <span>${badge(priorityInfo.label || wo.priority, priorityInfo.color, priorityInfo.bg)}</span>
          ${isOverdue ? `<span class="badge bg-danger text-white px-2 py-1">OVERDUE</span>` : ''}
          ${equipName !== '-' ? `<span class="d-flex align-items-center gap-1 text-truncate" style="max-width: 140px;">${icons.cpu} ${escapeHtml(equipName)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderWOContent(content, preventive, corrective, today) {
  const todayLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  content.innerHTML = `
    <div class="px-3 py-4" style="background-color: var(--bs-light); min-height: 100%;">
      <div class="d-flex align-items-center gap-2 mb-4 text-primary fw-bold bg-white p-3 rounded shadow-sm border" style="font-size: 1.05rem;">
        ${icons.calendar} <span>${todayLabel}</span>
      </div>

      <!-- PREVENTIVE WOs -->
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="fw-bold m-0 text-secondary" style="letter-spacing: 0.5px; font-size: 0.85rem;">WO PREVENTIVE HARI INI</h6>
        <span class="badge bg-success rounded-pill px-2 py-1">${preventive.length}</span>
      </div>
      <div id="preventive-list" class="mb-4">
        ${preventive.length === 0
          ? `<div class="bg-white rounded p-4 text-center shadow-sm text-muted border">
              <div class="mb-3 text-success" style="font-size: 2.5rem; opacity: 0.7;">${icons.calendarCheck}</div>
              <p class="m-0 fw-medium">Tidak ada WO Preventive terjadwal hari ini</p>
             </div>`
          : preventive.map(wo => renderWOCard(wo)).join('')
        }
      </div>

      <!-- CORRECTIVE WOs -->
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="fw-bold m-0 text-secondary" style="letter-spacing: 0.5px; font-size: 0.85rem;">WO CORRECTIVE AKTIF</h6>
        <span class="badge bg-warning text-dark rounded-pill px-2 py-1">${corrective.length}</span>
      </div>
      <div id="corrective-list" class="mb-4">
        ${corrective.length === 0
          ? `<div class="bg-white rounded p-4 text-center shadow-sm text-muted border">
              <div class="mb-3 text-warning" style="font-size: 2.5rem; opacity: 0.8;">${icons.checkCircle}</div>
              <p class="m-0 fw-medium">Tidak ada WO Corrective aktif</p>
             </div>`
          : corrective.map(wo => renderWOCard(wo)).join('')
        }
      </div>
    </div>
  `;

  const allWOs = [...preventive, ...corrective];
  content.querySelectorAll('.tech-wo-card').forEach(card => {
    card.addEventListener('click', () => {
      const woId = card.dataset.woId;
      const wo = allWOs.find(w => w.id === woId);
      if (wo) showWODetail(wo);
    });
  });
}

function showWODetail(wo) {
  const statusInfo = WO_STATUS[wo.status] || {};
  const priorityInfo = WO_PRIORITY[wo.priority] || {};
  const cat = WO_CATEGORY[wo.category] || WO_CATEGORY.OTHER;
  const equipName = wo.equipment?.namaEquipment || wo.equipment_id || '-';
  const creatorName = wo.profiles?.full_name || 'Admin';

  // WO PM: bisa isi MDS jika status diploting atau menunggu_approval (untuk revisi)
  const isPreventive = wo.type === 'preventive';
  const canFillMDS   = isPreventive && ['diploting', 'revisi', 'menunggu_approval'].includes(wo.status);
  // WO Corrective: bisa di-close jika open / hold
  const canClose     = !isPreventive && (wo.status === 'open' || wo.status === 'hold');

  showModal({
    title: `Detail Work Order`,
    size: 'modal-md',
    body: `
      <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div style="display:flex;align-items:center;gap:var(--sp-3)">
          <span style="font-family:monospace;font-size:1.1rem;font-weight:700;color:var(--accent)">${escapeHtml(wo.wo_number)}</span>
          ${badge(statusInfo.label, statusInfo.color, statusInfo.bg)}
          ${badge(wo.type === 'preventive' ? 'Preventive' : 'Corrective', wo.type === 'preventive' ? '#8CC63F' : '#F59E0B', wo.type === 'preventive' ? 'rgba(140,198,63,0.12)' : 'rgba(245,158,11,0.12)')}
        </div>

        <div class="bg-light border rounded p-3">
          <div class="small text-secondary mb-1">Deskripsi</div>
          <div class="small text-dark">${escapeHtml(wo.description || '-')}</div>
        </div>

        <div class="row g-2">
          <div class="col-6">
            <div class="bg-light border rounded p-3 h-100">
              <div class="small text-muted">Prioritas</div>
              <div class="mt-1">${badge(priorityInfo.label, priorityInfo.color, priorityInfo.bg)}</div>
            </div>
          </div>
          <div class="col-6">
            <div class="bg-light border rounded p-3 h-100">
              <div class="small text-muted">Kategori</div>
              <div class="mt-1">${badge(cat.label, cat.color, cat.bg)}</div>
            </div>
          </div>
          <div class="col-6">
            <div class="bg-light border rounded p-3 h-100">
              <div class="small text-muted">Equipment</div>
              <div class="small text-dark mt-1">${escapeHtml(equipName)}</div>
            </div>
          </div>
          <div class="col-6">
            <div class="bg-light border rounded p-3 h-100">
              <div class="small text-muted">Tgl Dibuka</div>
              <div class="small text-dark mt-1">${formatDate(wo.opened_at)}</div>
            </div>
          </div>
          <div class="col-6">
            <div class="bg-light border rounded p-3 h-100">
              <div class="small text-muted">Dibuat Oleh</div>
              <div class="small text-dark mt-1">${escapeHtml(creatorName)}</div>
            </div>
          </div>
        </div>

        ${wo.problem_photo_url ? `
        <div class="bg-light border rounded p-3">
          <div class="small text-secondary mb-2">Foto Detail / Lokasi</div>
          <img src="${wo.problem_photo_url}" class="img-fluid rounded border" style="max-height: 240px; width: 100%; object-fit: cover;" alt="Problem Photo" />
        </div>` : ''}

        ${wo.notes ? `
        <div class="bg-light border rounded p-3">
          <div class="small text-secondary mb-1">Catatan</div>
          <div class="small text-dark">${escapeHtml(wo.notes)}</div>
        </div>` : ''}

        ${canFillMDS ? `
        <div class="alert alert-success py-2 px-3 mb-0" style="border-radius:8px;font-size:0.85rem;">
          📋 WO ini memiliki form MDS yang perlu diisi. Klik tombol di bawah untuk memulai.
        </div>` : ''}
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="detail-close">Tutup</button>
      ${canFillMDS  ? `<button class="btn btn-success" id="detail-mds">📋 Isi Form MDS</button>` : ''}
      ${canClose    ? `<button class="btn btn-success" id="detail-close-wo">Selesaikan WO</button>` : ''}
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#detail-close').addEventListener('click', close);

      overlay.querySelector('#detail-mds')?.addEventListener('click', () => {
        close();
        window.location.hash = `/tech-wo-checklist?id=${wo.id}`;
      });

      overlay.querySelector('#detail-close-wo')?.addEventListener('click', () => {
        close();
        showCloseWOForm(wo);
      });
    }
  });
}

function showCloseWOForm(wo) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const defaultDatetime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  showModal({
    title: `Selesaikan WO — ${wo.wo_number}`,
    size: 'modal-md',
    body: `
      <p class="text-secondary small mb-4">
        Pastikan pekerjaan sudah benar-benar selesai sebelum menutup WO ini.
      </p>
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <label class="form-label">Waktu Mulai *</label>
          <input type="datetime-local" class="form-control" id="cwo-start" value="${defaultDatetime}" />
        </div>
        <div class="col-md-6">
          <label class="form-label">Waktu Selesai *</label>
          <input type="datetime-local" class="form-control" id="cwo-finish" value="${defaultDatetime}" />
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Durasi (jam) — otomatis</label>
        <input type="text" class="form-control bg-light" id="cwo-hours" readonly value="0" />
      </div>
      <div class="mb-3">
        <label class="form-label">Upload Foto Evidence (Maks 1MB) *</label>
        <input type="file" class="form-control" id="cwo-evidence" accept="image/*" />
        <div id="cwo-preview-wrap" class="mt-2 text-center" style="display:none;">
          <img id="cwo-preview" src="" class="img-fluid rounded border" style="max-height:180px; object-fit:cover;" />
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Catatan Penyelesaian</label>
        <textarea class="form-control" id="cwo-notes" placeholder="Catatan hasil pekerjaan..." style="min-height:80px;">${wo.notes || ''}</textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="cwo-cancel">Batal</button>
      <button class="btn btn-success" id="cwo-confirm">Tutup WO</button>
    `,
    onMount: (overlay, close) => {
      const startEl = overlay.querySelector('#cwo-start');
      const finishEl = overlay.querySelector('#cwo-finish');
      const hoursEl = overlay.querySelector('#cwo-hours');
      const evidenceEl = overlay.querySelector('#cwo-evidence');
      const previewWrap = overlay.querySelector('#cwo-preview-wrap');
      const previewImg = overlay.querySelector('#cwo-preview');
      let evidenceBase64 = null;

      const calcHours = () => {
        const s = new Date(startEl.value);
        const f = new Date(finishEl.value);
        const diff = (f - s) / 3600000;
        hoursEl.value = diff > 0 ? diff.toFixed(2) : '0';
      };
      startEl.addEventListener('change', calcHours);
      finishEl.addEventListener('change', calcHours);
      calcHours();

      evidenceEl.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) { previewWrap.style.display = 'none'; evidenceBase64 = null; return; }
        if (file.size > 1024 * 1024) {
          showToast('Ukuran foto maks 1MB', 'warning');
          evidenceEl.value = '';
          previewWrap.style.display = 'none';
          evidenceBase64 = null;
          return;
        }
        const reader = new FileReader();
        reader.onload = ev => {
          evidenceBase64 = ev.target.result;
          previewImg.src = evidenceBase64;
          previewWrap.style.display = 'block';
        };
        reader.readAsDataURL(file);
      });

      overlay.querySelector('#cwo-cancel').addEventListener('click', close);
      overlay.querySelector('#cwo-confirm').addEventListener('click', async () => {
        const hours = parseFloat(hoursEl.value);
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
            assigned_to: currentProfile.id, // Set assignee to tech who closed it
            man_hours_actual: hours,
            started_at: new Date(startEl.value).toISOString(),
            closed_at: new Date(finishEl.value).toISOString(),
            evidence_url: evidenceBase64,
            notes: overlay.querySelector('#cwo-notes').value.trim()
          });
          showToast('Work Order berhasil diselesaikan!', 'success');
          close();
          renderTechWoList();
        } catch (err) {
          showToast('Gagal menutup WO', 'error');
        }
      });
    }
  });
}