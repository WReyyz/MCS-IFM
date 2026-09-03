import { getCurrentUser, getCurrentProfile } from './lib/supabase.js';

const PUBLIC_ROUTES = ['/login'];
const ADMIN_ONLY_ROUTES = ['/user-controller', '/admin-broadcast'];
// Planner can access /technician schedule in sidebar, so removing it from ADMIN_ONLY_ROUTES if planner can access. 
// Let's check sidebar.js: { path: '/technician', label: 'Jadwal & Teknisi', icon: 'calendarCheck', roles: ['admin', 'planner'] },
// Wait, I will define routes based on roles to be cleaner.
const TECH_ROUTES = ['/tech-wo-list', '/tech-create-wo', '/tech-inbox', '/tech-profile', '/tech-wo-checklist'];

/**
 * Auth guard: redirects appropriately based on role.
 */
export async function authGuard(path) {
  const user = await getCurrentUser();

  if (!user && !PUBLIC_ROUTES.includes(path)) {
    window.location.hash = '/login';
    return false;
  }

  if (user && path === '/login') {
    const profile = await getCurrentProfile();
    if (profile?.role === 'technician') window.location.hash = '/tech-wo-list';
    else window.location.hash = '/'; // admin, inspector, planner, manager go to dashboard
    return false;
  }

  if (user) {
    const profile = await getCurrentProfile();
    const role = profile?.role || 'user';
    const isTech = role === 'technician';
    const isAdmin = role === 'admin';

    // Technician constraints
    if (isTech && !TECH_ROUTES.includes(path) && !PUBLIC_ROUTES.includes(path)) {
      window.location.hash = '/tech-wo-list';
      return false;
    }

    // Non-Technician constraints
    if (!isTech && TECH_ROUTES.includes(path)) {
      window.location.hash = '/';
      return false;
    }

    // Admin only routes constraint
    if (!isAdmin && ADMIN_ONLY_ROUTES.includes(path)) {
      window.location.hash = '/';
      return false;
    }

    // Specific route restrictions based on sidebar.js definitions
    if (path === '/technician' && !['admin', 'planner'].includes(role)) {
      window.location.hash = '/';
      return false;
    }
    
    if (path === '/tools' && !['admin', 'planner'].includes(role)) {
      window.location.hash = '/';
      return false;
    }

    if (path === '/plan' && !['admin', 'planner'].includes(role)) {
      window.location.hash = '/';
      return false;
    }

    if (path === '/approval' && !['admin', 'inspector'].includes(role)) {
      window.location.hash = '/';
      return false;
    }
    
    if (path === '/mds-templates' && !['admin', 'planner'].includes(role)) {
      window.location.hash = '/';
      return false;
    }
  }

  return true;
}
