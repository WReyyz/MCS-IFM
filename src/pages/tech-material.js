import { renderTechShell } from '../components/tech-shell.js';
import { icons } from '../components/icons.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchAll, updateRow, insertRow } from '../lib/supabase.js';
import { escapeHtml, formatNumber, debounce } from '../utils/helpers.js';

let allMaterials = [];
let currentProfile = null;

export async function renderTechMaterial() {
  const { content, profile } = await renderTechShell('material');
  currentProfile = profile;
  
  content.innerHTML = `
    <div class="animate-fade-in pb-5">
      <div class="mb-3 d-flex justify-content-between align-items-center">
        <h5 class="mb-0 fw-semibold text-dark">Stok Material</h5>
      </div>
      <div class="toolbar mb-3">
        <div class="search-box w-100">
          ${icons.search}
          <input type="text" class="form-control form-control-sm" id="tech-mat-search" placeholder="Cari material (nama/part number)..." />
        </div>
      </div>
      <div id="tech-mat-list">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  document.getElementById('tech-mat-search').addEventListener('input', debounce(filterAndRender, 300));

  await loadMaterials();
}

async function loadMaterials() {
  try {
    allMaterials = await fetchAll('material_stock', { order: { column: 'name', ascending: true } });
    filterAndRender();
  } catch (err) {
    showToast('Gagal memuat stok material', 'error');
  }
}

function filterAndRender() {
  const search = (document.getElementById('tech-mat-search')?.value || '').toLowerCase();
  
  let filtered = allMaterials;
  if (search) {
    filtered = allMaterials.filter(m => `${m.name} ${m.part_number}`.toLowerCase().includes(search));
  }

  const wrapper = document.getElementById('tech-mat-list');
  if (!wrapper) return;

  if (filtered.length === 0) {
    wrapper.innerHTML = `
      <div class="text-center p-5 text-muted bg-light rounded border border-dashed">
        <div class="fs-1 mb-2">${icons.package}</div>
        <p class="mb-0">Material tidak ditemukan</p>
      </div>`;
    return;
  }

  wrapper.innerHTML = filtered.map(m => {
    const isLow = m.quantity < m.min_stock;
    return `
      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h6 class="mb-1 fw-bold">${escapeHtml(m.name)}</h6>
              <div class="small text-muted">${escapeHtml(m.part_number)}</div>
            </div>
            <span class="badge ${isLow ? 'bg-danger' : 'bg-success'} rounded-pill">
              Stok: ${formatNumber(m.quantity)} ${m.unit}
            </span>
          </div>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <div class="small text-muted">Rak/Lokasi: ${escapeHtml(m.location || '-')}</div>
            <button class="btn btn-primary btn-sm px-3 catat-keluar-btn" data-id="${m.id}">
              Catat Keluar
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  wrapper.querySelectorAll('.catat-keluar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mat = allMaterials.find(m => m.id === btn.dataset.id);
      if (mat) showTakeOutModal(mat);
    });
  });
}

function showTakeOutModal(mat) {
  showModal({
    title: 'Pencatatan Material Keluar',
    body: `
      <div class="mb-3">
        <strong>${escapeHtml(mat.name)}</strong> (${escapeHtml(mat.part_number)})<br/>
        Stok Tersedia: ${formatNumber(mat.quantity)} ${mat.unit}
      </div>
      <div class="form-group mb-3">
        <label class="form-label">Jumlah Diambil</label>
        <input type="number" class="form-control" id="takeout-qty" min="1" max="${mat.quantity}" value="1" />
      </div>
      <div class="form-group">
        <label class="form-label">Keterangan / Keperluan (Opsional)</label>
        <textarea class="form-control" id="takeout-notes" rows="2" placeholder="Contoh: Untuk WO-1234"></textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-outline-secondary" id="cancel-takeout">Batal</button>
      <button class="btn btn-primary" id="save-takeout">Konfirmasi</button>
    `,
    onMount: (overlay, close) => {
      overlay.querySelector('#cancel-takeout').addEventListener('click', close);
      overlay.querySelector('#save-takeout').addEventListener('click', async () => {
        const qtyInput = overlay.querySelector('#takeout-qty');
        const takeQty = parseInt(qtyInput.value) || 0;
        
        if (takeQty <= 0) {
          showToast('Jumlah tidak valid', 'warning');
          return;
        }
        if (takeQty > mat.quantity) {
          showToast('Jumlah melebihi stok tersedia', 'warning');
          return;
        }

        const newQty = mat.quantity - takeQty;
        const notes = overlay.querySelector('#takeout-notes').value.trim();
        
        try {
          // Update stok di material_stock
          await updateRow('material_stock', mat.id, { quantity: newQty });
          
          // Catat ke material_logs
          if (currentProfile) {
            await insertRow('material_logs', {
              material_id: mat.id,
              technician_id: currentProfile.id,
              quantity: takeQty,
              notes: notes
            });
          }

          close();
          showSuccessAnimation();
          await loadMaterials();
        } catch (err) {
          console.error(err);
          showToast('Gagal mencatat', 'error');
        }
      });
    }
  });
}

function showSuccessAnimation() {
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.8);
    background: white; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    z-index: 9999; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 32px;
    opacity: 0; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    min-width: 250px; text-align: center; border: 1px solid #f1f5f9;
  `;

  popup.innerHTML = `
    <div style="
      width: 64px; height: 64px; background: #22c55e;
      border-radius: 50%; display: flex; align-items: center;
      justify-content: center; color: white; margin-bottom: 16px;
    ">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <h5 style="color: #16a34a; font-weight: bold; margin: 0;">
      Pengambilan Material Berhasil!
    </h5>
  `;

  document.body.appendChild(popup);

  // Trigger animations
  requestAnimationFrame(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  // Remove after 2 seconds
  setTimeout(() => {
    popup.style.opacity = '0';
    popup.style.transform = 'translate(-50%, -50%) scale(0.8)';
    setTimeout(() => {
      popup.remove();
    }, 300);
  }, 2000);
}
