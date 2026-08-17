import './style.css';
import { router } from './router.js';
import { authGuard } from './auth-guard.js';
import { onAuthStateChange } from './lib/supabase.js';

// Pages
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderEquipment } from './pages/equipment.js';
import { renderPreventiveMaintenance } from './pages/preventive-maintenance.js';
import { renderWorkOrder } from './pages/work-order.js';
import { renderMaterialStock } from './pages/material-stock.js';
import { renderTechnician } from './pages/technician.js';
import { renderUserController } from './pages/user-controller.js';
import { renderPlan } from './pages/plan.js';

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
  .on('/plan', renderPlan)
  .on('/technician', renderTechnician)
  .on('/user-controller', renderUserController)
  .on('/404', () => {
    document.getElementById('app').innerHTML = `
      <div class="login-page">
        <div class="login-card" style="text-align:center">
          <h2 style="margin-bottom:var(--sp-4)">404</h2>
          <p>Halaman tidak ditemukan</p>
          <a href="#/" class="btn btn-primary" style="margin-top:var(--sp-4)">Kembali ke Dashboard</a>
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
