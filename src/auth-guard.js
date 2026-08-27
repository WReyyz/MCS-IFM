import { getCurrentUser, getCurrentProfile } from './lib/supabase.js';

const PUBLIC_ROUTES = ['/login'];
const ADMIN_ONLY_ROUTES = ['/user-controller', '/admin-broadcast', '/technician'];
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
    else window.location.hash = '/'; // admin and inspector go to dashboard
    return false;
  }

  if (user) {
    const profile = await getCurrentProfile();
    const isTech = profile?.role === 'technician';
    const isAdmin = profile?.role === 'admin';
    const isInspector = profile?.role === 'inspector';

    // Technician constraints
    if (isTech && !TECH_ROUTES.includes(path) && !PUBLIC_ROUTES.includes(path)) {
      window.location.hash = '/tech-wo-list';
      return false;
    }

    // Admin & Inspector constraints (they share the app-shell, but some are admin only)
    if (!isTech && TECH_ROUTES.includes(path)) {
      window.location.hash = '/';
      return false;
    }

    // Inspector cannot access admin only routes
    if (isInspector && ADMIN_ONLY_ROUTES.includes(path)) {
      window.location.hash = '/';
      return false;
    }
  }

  return true;
}
