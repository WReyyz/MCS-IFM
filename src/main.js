import './style.css';
import { router } from './router.js';
import { authGuard } from './auth-guard.js';
import { onAuthStateChange } from './lib/supabase.js';

// Pages - Admin
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderEquipment } from './pages/equipment.js';
import { renderPreventiveMaintenance } from './pages/preventive-maintenance.js';
import { renderWorkOrder } from './pages/work-order.js';
import { renderMaterialStock } from './pages/material-stock.js';
import { renderTools } from './pages/tools.js';
import { renderTechnician } from './pages/technician.js';
import { renderUserController } from './pages/user-controller.js';
import { renderPlan } from './pages/plan.js';
import { renderAdminBroadcast } from './pages/admin-broadcast.js';

// Pages - Technician
import { renderTechWoList } from './pages/tech-wo-list.js';
import { renderTechCreateWo } from './pages/tech-create-wo.js';
import { renderTechInbox } from './pages/tech-inbox.js';
import { renderTechProfile } from './pages/tech-profile.js';

// Setup routes
router
  .guard(authGuard)
  .on('/login', renderLogin)
  .on('/', renderDashboard)
  .on('/dashboard', renderDashboard)
  .on('/equipment', renderEquipment)
  .on('/preventive-maintenance', renderPreventiveMaintenance)
  .on('/work-order', renderWorkOrder)
  .on('/material-stock', renderMaterialStock)
  .on('/tools', renderTools)
  .on('/plan', renderPlan)
  .on('/technician', renderTechnician)
  .on('/user-controller', renderUserController)
  .on('/admin-broadcast', renderAdminBroadcast)
  // Technician routes
  .on('/tech-wo-list', renderTechWoList)
  .on('/tech-create-wo', renderTechCreateWo)
  .on('/tech-inbox', renderTechInbox)
  .on('/tech-profile', renderTechProfile)
  .on('/404', () => {
    document.getElementById('app').innerHTML = `
      <div class="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <div class="card border-0 shadow-sm text-center p-5" style="max-width:400px; width:100%">
          <h2 class="display-1 fw-bold text-primary mb-3">404</h2>
          <p class="fs-5 text-muted mb-4">Halaman tidak ditemukan</p>
          <a href="#/" class="btn btn-primary px-4 py-2">Kembali ke Dashboard</a>
        </div>
      </div>`;
  });

// Listen for auth changes
onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    router.navigate('/login');
  }
});

// Start the app
router.start();
