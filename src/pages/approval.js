import { renderAppShell } from '../components/app-shell.js';
import { icons } from '../components/icons.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { updateRow, supabase, getCurrentProfile } from '../lib/supabase.js';
import { WO_PRIORITY, WO_CATEGORY } from '../utils/constants.js';
import { formatDate, badge, escapeHtml } from '../utils/helpers.js';

export async function renderApproval() {
  const content = renderAppShell('Approval Checklist');
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const profile = await getCurrentProfile();
    const { data: wos, error } = await supabase
      .from('work_orders')
      .select('*, equipment(namaEquipment, idAset), profiles:assigned_to(full_name)')
      .eq('status', 'pending_inspection')
      .order('closed_at', { ascending: false });

    if (error) throw error;
    
    renderList(content, wos || [], profile);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="alert alert-danger">Gagal memuat daftar WO.</div>';
    showToast('Gagal memuat data WO', 'error');
  }
}

function renderList(content, wos, profile) {
  if (wos.length === 0) {
    content.innerHTML = `
      <div class="card border-0 shadow-sm">
        <div class="card-body p-5 text-center text-muted">
          <div class="mb-3 text-success" style="font-size: 4rem; opacity: 0.5;">${icons.checkCircle}</div>
          <h4 class="fw-bold text-dark mb-2">Tidak ada WO yang perlu di-approve</h4>
          <p>Semua pekerjaan teknisi sudah diinspeksi.</p>
        </div>
      </div>
    `;
    return;
  }

  const tableRows = wos.map(wo => {
    const priorityInfo = WO_PRIORITY[wo.priority] || {};
    return `
      <tr>
        <td class="fw-bold">${escapeHtml(wo.wo_number)}</td>
        <td>${escapeHtml(wo.equipment?.namaEquipment || '-')}</td>
        <td>${escapeHtml(wo.profiles?.full_name || '-')}</td>
        <td>${formatDate(wo.closed_at)}</td>
        <td>${badge(priorityInfo.label || wo.priority, priorityInfo.color, priorityInfo.bg)}</td>
        <td><span class="badge bg-warning text-dark">Pending</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-primary btn-approve" data-id="${wo.id}">
            ${icons.eye} Periksa
          </button>
        </td>
      </tr>
    `;
  }).join('');

  content.innerHTML = `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white border-bottom p-3">
        <h5 class="m-0 fw-bold">Daftar Menunggu Persetujuan</h5>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>No. WO</th>
                <th>Equipment</th>
                <th>Teknisi</th>
                <th>Waktu Selesai</th>
                <th>Prioritas</th>
                <th>Status</th>
                <th class="text-end">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  content.querySelectorAll('.btn-approve').forEach(btn => {
    btn.addEventListener('click', () => {
      const wo = wos.find(w => w.id === btn.dataset.id);
      if (wo) showApprovalModal(wo, profile);
    });
  });
}

function showApprovalModal(wo, profile) {
  let checklistHtml = '';
  if (wo.checklist_result && Array.isArray(wo.checklist_result)) {
    checklistHtml = '<div class="table-responsive"><table class="table table-sm table-bordered mt-2 small"><thead><tr class="table-light"><th>Task</th><th>Nilai</th><th>Status</th></tr></thead><tbody>';
    wo.checklist_result.forEach(r => {
      let val = r.value || '-';
      if (r.type === 'image' && r.value) {
        val = `<img src="${r.value}" style="max-height:40px; border-radius:4px;" />`;
      }
      let statusBadge = r.result === 'pass' ? '<span class="badge bg-success">PASS</span>' : '<span class="badge bg-danger">FAIL</span>';
      checklistHtml += `<tr><td>${escapeHtml(r.task)}</td><td>${val}</td><td class="text-center">${statusBadge}</td></tr>`;
    });
    checklistHtml += '</tbody></table></div>';
  } else {
    checklistHtml = '<p class="text-muted small">Tidak ada form checklist tersimpan.</p>';
  }

  showModal({
    title: `Approve WO: ${wo.wo_number}`,
    size: 'modal-lg',
    body: `
      <div class="bg-light p-3 rounded mb-3 border">
        <div class="row g-3">
          <div class="col-md-4">
            <small class="text-muted d-block">Teknisi</small>
            <strong>${escapeHtml(wo.profiles?.full_name || '-')}</strong>
          </div>
          <div class="col-md-8">
            <small class="text-muted d-block">Equipment</small>
            <strong>${escapeHtml(wo.equipment?.namaEquipment || '-')}</strong>
          </div>
          <div class="col-12">
            <small class="text-muted d-block">Catatan Teknisi</small>
            <div>${escapeHtml(wo.notes || '-')}</div>
          </div>
        </div>
      </div>
      <h6 class="fw-bold border-bottom pb-2">Hasil Checklist</h6>
      ${checklistHtml}
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="btn-cancel">Tutup</button>
      <button class="btn btn-danger" id="btn-reject">Tolak (Kembalikan ke Teknisi)</button>
      <button class="btn btn-success" id="btn-approve">${icons.checkCircle} Approve & Selesai</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#btn-cancel').addEventListener('click', close);
      
      overlay.querySelector('#btn-reject').addEventListener('click', () => {
        showConfirm({
          message: 'Kembalikan status WO ini ke "In Progress" untuk dikerjakan ulang oleh teknisi?',
          onConfirm: async () => {
            try {
              await updateRow('work_orders', wo.id, {
                status: 'in_progress'
              });
              showToast('WO dikembalikan ke teknisi', 'success');
              close();
              renderApproval();
            } catch (err) {
              showToast('Gagal mengubah status', 'error');
            }
          }
        });
      });

      overlay.querySelector('#btn-approve').addEventListener('click', async () => {
        try {
          await updateRow('work_orders', wo.id, {
            status: 'closed',
            inspected_by: profile.id,
            inspected_at: new Date().toISOString()
          });
          showToast('WO berhasil di-approve dan ditutup', 'success');
          close();
          renderApproval();
        } catch (err) {
          showToast('Gagal menyetujui WO', 'error');
        }
      });
    }
  });
}
