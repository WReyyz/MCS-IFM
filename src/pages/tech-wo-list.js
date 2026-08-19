import { renderTechShell } from '../components/tech-shell.js';
import { icons } from '../components/icons.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, updateRow } from '../lib/supabase.js';
import { WO_STATUS, WO_PRIORITY, WO_CATEGORY } from '../utils/constants.js';
import { formatDate, badge, escapeHtml } from '../utils/helpers.js';

let currentProfile = null;

export async function renderTechWoList() {
  const { content, profile } = await renderTechShell('wo-list');
  currentProfile = profile;

  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch all WOs assigned to this technician
    const allWOs = await fetchAll('work_orders', {
      select: '*, equipment(namaEquipment, idAset)',
      filters: [{ column: 'assigned_to', value: currentProfile.id }],
      order: { column: 'opened_at', ascending: true }
    });

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

  return `
    <div class="tech-wo-card type-${wo.type} ${wo.priority === 'critical' ? 'priority-critical' : ''}" data-wo-id="${wo.id}">
      <div class="tech-wo-card-top">
        <div>
          <div class="tech-wo-number">${escapeHtml(wo.wo_number)}</div>
          <div class="tech-wo-desc">${escapeHtml(wo.description || '-')}</div>
        </div>
        <div style="flex-shrink:0;">
          ${badge(statusInfo.label || wo.status, statusInfo.color || '#888', statusInfo.bg || '#eee')}
        </div>
      </div>
      <div class="tech-wo-meta">
        <span class="tech-wo-meta-item">${icons.clock} ${formatDate(wo.opened_at)}</span>
        <span class="tech-wo-meta-item">${icons.wrench} ${cat.label}</span>
        <span>${badge(priorityInfo.label || wo.priority, priorityInfo.color, priorityInfo.bg)}</span>
        ${isOverdue ? `<span class="badge" style="color:#EF4444;background:rgba(239,68,68,0.12)">OVERDUE</span>` : ''}
        ${equipName !== '-' ? `<span class="tech-wo-meta-item">${icons.cpu} ${escapeHtml(equipName)}</span>` : ''}
      </div>
    </div>
  `;
}

function renderWOContent(content, preventive, corrective, today) {
  const todayLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  content.innerHTML = `
    <div class="tech-today-badge">
      ${icons.calendar} ${todayLabel}
    </div>

    <!-- PREVENTIVE WOs -->
    <div class="tech-section-header">
      <span class="tech-section-title">WO Preventive Hari Ini</span>
      <span class="tech-section-count">${preventive.length}</span>
    </div>
    <div id="preventive-list">
      ${preventive.length === 0
        ? `<div class="tech-empty" style="padding:var(--sp-5) 0">
            ${icons.calendarCheck}
            <p>Tidak ada WO Preventive terjadwal hari ini</p>
           </div>`
        : preventive.map(wo => renderWOCard(wo)).join('')
      }
    </div>

    <div style="margin-bottom: var(--sp-4);"></div>

    <!-- CORRECTIVE WOs -->
    <div class="tech-section-header">
      <span class="tech-section-title">WO Corrective Aktif</span>
      <span class="tech-section-count">${corrective.length}</span>
    </div>
    <div id="corrective-list">
      ${corrective.length === 0
        ? `<div class="tech-empty" style="padding:var(--sp-5) 0">
            ${icons.checkCircle}
            <p>Tidak ada WO Corrective aktif</p>
           </div>`
        : corrective.map(wo => renderWOCard(wo)).join('')
      }
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
  const canClose = wo.status === 'open' || wo.status === 'hold';

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

        <div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:var(--sp-3);">
          <div style="font-size:var(--fs-sm);color:var(--text-secondary);margin-bottom:var(--sp-1)">Deskripsi</div>
          <div style="font-size:var(--fs-sm);color:var(--text-primary)">${escapeHtml(wo.description || '-')}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2)">
          <div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:var(--sp-3);">
            <div style="font-size:var(--fs-xs);color:var(--text-muted)">Prioritas</div>
            <div style="margin-top:4px">${badge(priorityInfo.label, priorityInfo.color, priorityInfo.bg)}</div>
          </div>
          <div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:var(--sp-3);">
            <div style="font-size:var(--fs-xs);color:var(--text-muted)">Kategori</div>
            <div style="margin-top:4px">${badge(cat.label, cat.color, cat.bg)}</div>
          </div>
          <div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:var(--sp-3);">
            <div style="font-size:var(--fs-xs);color:var(--text-muted)">Equipment</div>
            <div style="font-size:var(--fs-sm);color:var(--text-primary);margin-top:4px">${escapeHtml(equipName)}</div>
          </div>
          <div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:var(--sp-3);">
            <div style="font-size:var(--fs-xs);color:var(--text-muted)">Tgl Dibuka</div>
            <div style="font-size:var(--fs-sm);color:var(--text-primary);margin-top:4px">${formatDate(wo.opened_at)}</div>
          </div>
        </div>

        ${wo.notes ? `
        <div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:var(--sp-3);">
          <div style="font-size:var(--fs-sm);color:var(--text-secondary);margin-bottom:var(--sp-1)">Catatan</div>
          <div style="font-size:var(--fs-sm);color:var(--text-primary)">${escapeHtml(wo.notes)}</div>
        </div>` : ''}
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="detail-close">Tutup</button>
      ${canClose ? `<button class="btn btn-primary" id="detail-close-wo" style="background:#10B981">Selesaikan WO</button>` : ''}
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#detail-close').addEventListener('click', close);
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
      <p style="font-size:var(--fs-sm);color:var(--text-secondary);margin-bottom:var(--sp-4)">
        Pastikan pekerjaan sudah benar-benar selesai sebelum menutup WO ini.
      </p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Waktu Mulai *</label>
          <input type="datetime-local" class="form-input" id="cwo-start" value="${defaultDatetime}" />
        </div>
        <div class="form-group">
          <label class="form-label">Waktu Selesai *</label>
          <input type="datetime-local" class="form-input" id="cwo-finish" value="${defaultDatetime}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Durasi (jam) — otomatis</label>
        <input type="text" class="form-input" id="cwo-hours" readonly style="opacity:0.8;" value="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Upload Foto Evidence (Maks 1MB) *</label>
        <input type="file" class="form-input" id="cwo-evidence" accept="image/*" />
        <div id="cwo-preview-wrap" style="margin-top:var(--sp-2);display:none;text-align:center">
          <img id="cwo-preview" src="" style="max-width:100%;max-height:180px;border-radius:var(--radius-md);object-fit:cover;border:1px solid var(--border-color)" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Catatan Penyelesaian</label>
        <textarea class="form-textarea" id="cwo-notes" placeholder="Catatan hasil pekerjaan...">${wo.notes || ''}</textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="cwo-cancel">Batal</button>
      <button class="btn btn-primary" id="cwo-confirm" style="background:#10B981">Tutup WO</button>
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