import { getCurrentUser, getCurrentProfile } from './lib/supabase.js';

const PUBLIC_ROUTES = ['/login'];
const ADMIN_ROUTES  = ['/user-controller', '/admin-broadcast'];
const TECH_ROUTES   = ['/tech-wo-list', '/tech-create-wo', '/tech-inbox', '/tech-profile'];

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
    window.location.hash = profile?.role === 'technician' ? '/tech-wo-list' : '/';
    return false;
  }

  if (user) {
    const profile = await getCurrentProfile();
    const isTech = profile?.role === 'technician';
    const isAdmin = profile?.role === 'admin';

    // Admin trying to access technician routes
    if (isAdmin && TECH_ROUTES.includes(path)) {
      window.location.hash = '/';
      return false;
    }

    // Technician trying to access admin routes or any non-tech route
    if (isTech && !TECH_ROUTES.includes(path) && !PUBLIC_ROUTES.includes(path)) {
      window.location.hash = '/tech-wo-list';
      return false;
    }

    // Admin-only route guard
    if (isAdmin && ADMIN_ROUTES.includes(path)) {
      return true;
    }
  }

  return true;
}
