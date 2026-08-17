import { getCurrentUser, getCurrentProfile } from './lib/supabase.js';

const PUBLIC_ROUTES = ['/login'];
const ADMIN_ROUTES  = ['/user-controller'];

/**
 * Auth guard: redirects to /login if not authenticated.
 * Redirects to / if non-admin tries to access admin-only routes.
 */
export async function authGuard(path) {
  const user = await getCurrentUser();

  if (!user && !PUBLIC_ROUTES.includes(path)) {
    window.location.hash = '/login';
    return false;
  }

  if (user && path === '/login') {
    window.location.hash = '/';
    return false;
  }

  // Admin-only route guard
  if (user && ADMIN_ROUTES.includes(path)) {
    const profile = await getCurrentProfile();
    if (profile?.role !== 'admin') {
      window.location.hash = '/';
      return false;
    }
  }

  return true;
}
