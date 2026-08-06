import { getCurrentUser } from './lib/supabase.js';

const PUBLIC_ROUTES = ['/login'];

/**
 * Auth guard: redirects to /login if not authenticated
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

  return true;
}
