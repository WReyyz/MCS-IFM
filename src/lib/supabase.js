import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---- AUTH HELPERS ----
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Login menggunakan ID Pegawai.
 * Mencari email yang terkait via RPC, lalu login dengan email tersebut.
 */
export async function signInWithEmployeeId(employeeId, password) {
  const { data: email, error: rpcError } = await supabase.rpc('get_email_by_employee_id', {
    emp_id: employeeId.trim(),
  });
  if (rpcError) throw rpcError;
  if (!email) throw new Error('ID Pegawai tidak ditemukan');
  return signIn(email, password);
}

export async function signUp(email, password, metadata = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  cachedProfile = null;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

let cachedProfile = null;

export async function getCurrentProfile(forceRefresh = false) {
  if (cachedProfile && !forceRefresh) return cachedProfile;
  const user = await getCurrentUser();
  if (!user) {
    cachedProfile = null;
    return null;
  }
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  cachedProfile = data;
  return cachedProfile;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      cachedProfile = null;
    }
    callback(event, session);
  });
}

// ---- GENERIC CRUD ----
export async function fetchAll(table, options = {}) {
  let query = supabase.from(table).select(options.select || '*');
  if (options.filters) {
    options.filters.forEach(f => {
      query = query[f.op || 'eq'](f.column, f.value);
    });
  }
  if (options.order) {
    query = query.order(options.order.column, { ascending: options.order.ascending ?? false });
  }
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchById(table, id, pkField = 'id') {
  const { data, error } = await supabase.from(table).select('*').eq(pkField, id).single();
  if (error) throw error;
  return data;
}

export async function insertRow(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateRow(table, id, updates, pkField = 'id') {
  const { data, error } = await supabase.from(table).update(updates).eq(pkField, id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table, id, pkField = 'id') {
  const { error } = await supabase.from(table).delete().eq(pkField, id);
  if (error) throw error;
}

export async function bulkUpdateRows(table, ids, updates, pkField = 'id') {
  const { data, error } = await supabase.from(table).update(updates).in(pkField, ids);
  if (error) throw error;
  return data;
}

// ---- DASHBOARD AGGREGATIONS ----
export async function getDashboardStats() {
  const [equipRes, woRes, schedRes, profilesRes] = await Promise.all([
    supabase.from('equipment').select('idAset, kondisi'),
    supabase.from('work_orders').select('id, category, status, man_hours_estimated, man_hours_actual, opened_at, closed_at'),
    supabase.from('technician_schedule').select('id, profile_id, status, schedule_date').eq('schedule_date', new Date().toISOString().split('T')[0]),
    supabase.from('profiles').select('id, role').eq('role', 'technician'),
  ]);

  const equipment = equipRes.data || [];
  const workOrders = woRes.data || [];
  const schedules = schedRes.data || [];
  const technicians = profilesRes.data || [];

  const allWorkOrders = workOrders;

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const woThisMonth = allWorkOrders.filter(wo => {
    if (!wo.opened_at) return false;
    const d = new Date(wo.opened_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const todayStr = now.toISOString().split('T')[0];
  const woCorrectiveToday = allWorkOrders.filter(wo => wo.category === 'corrective' && wo.opened_at && wo.opened_at.startsWith(todayStr)).length;
  const woPreventiveToday = allWorkOrders.filter(wo => wo.category === 'preventive' && wo.opened_at && wo.opened_at.startsWith(todayStr)).length;
  const woHoldActive = allWorkOrders.filter(wo => wo.status === 'hold').length;
  const woClosedToday = allWorkOrders.filter(wo => wo.status === 'closed' && wo.closed_at && wo.closed_at.startsWith(todayStr)).length;

  const totalEquipment = equipment.length;
  const activeEquipment = equipment.filter(e => e.kondisi === 'operational').length;
  const woOpen = allWorkOrders.filter(wo => wo.status !== 'closed').length;
  const woClosed = woThisMonth.filter(wo => wo.status === 'closed').length;
  const woOpenMonth = woThisMonth.filter(wo => wo.status !== 'closed').length;

  const totalEstimated = allWorkOrders.reduce((s, wo) => s + (parseFloat(wo.man_hours_estimated) || 0), 0);
  const totalActual = allWorkOrders.reduce((s, wo) => s + (parseFloat(wo.man_hours_actual) || 0), 0);
  const manHoursEffectiveness = totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0;

  const onDuty = schedules.filter(s => s.status === 'on_duty').length;
  const offDuty = technicians.length - onDuty;

  return {
    totalEquipment,
    activeEquipment,
    woOpen,
    woClosed,
    woOpenMonth,
    woCorrectiveToday,
    woPreventiveToday,
    woHoldActive,
    woClosedToday,
    manHoursEffectiveness,
    totalEstimated,
    totalActual,
    onDuty,
    offDuty: Math.max(0, offDuty),
    totalTechnicians: technicians.length,
    equipmentByStatus: {
      operational: equipment.filter(e => e.kondisi === 'operational').length,
      maintenance: equipment.filter(e => e.kondisi === 'maintenance').length,
      breakdown: equipment.filter(e => e.kondisi === 'breakdown').length,
      decommissioned: equipment.filter(e => e.kondisi === 'decommissioned').length,
    },
  };
}

export async function getWoMonthlyTrend() {
  const [woRes] = await Promise.all([
    supabase.from('work_orders').select('status, opened_at, closed_at')
  ]);

  const wos = woRes.data || [];
  const allWos = wos;

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const monthWos = allWos.filter(wo => {
      if (!wo.opened_at) return false;
      const od = new Date(wo.opened_at);
      return od.getMonth() === m && od.getFullYear() === y;
    });
    months.push({
      label: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      open: monthWos.filter(w => w.status !== 'closed').length,
      closed: monthWos.filter(w => w.status === 'closed').length,
    });
  }
  return months;
}

export async function getWoDailyStats() {
  const [woRes] = await Promise.all([
    supabase.from('work_orders').select('status, opened_at, closed_at')
  ]);

  const wos = woRes.data || [];
  const allWos = wos;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // WOs opened on this day
    const relevantWOs = allWos.filter(wo => {
      if (!wo.opened_at) return false;
      const opened = new Date(wo.opened_at);
      return opened.toISOString().split('T')[0] === dateStr;
    });

    // WOs closed on this day
    const closedOnDay = allWos.filter(wo => {
      if (!wo.closed_at) return false;
      return new Date(wo.closed_at).toISOString().split('T')[0] === dateStr;
    });

    const openCount = relevantWOs.filter(wo => wo.status === 'open' || wo.status === 'in_progress').length;
    const holdCount = relevantWOs.filter(wo => wo.status === 'hold').length;
    const closedCount = closedOnDay.length; // Count actual closures on this day
    const totalPlanned = relevantWOs.length;

    days.push({
      label: String(d),
      date: dateStr,
      open: openCount,
      closed: closedCount,
      hold: holdCount,
      totalPlanned: totalPlanned,
      isPast: d <= today,
    });
  }
  return days;
}

export async function resetPassword(email, newPassword) {
  const { data, error } = await supabase.rpc('reset_user_password', {
    user_email: email,
    new_password: newPassword
  });
  if (error) throw error;
  return data;
}

/**
 * Reset kata sandi berdasarkan ID Pegawai (bukan email).
 */
export async function resetPasswordByEmployeeId(employeeId, newPassword) {
  const { data, error } = await supabase.rpc('reset_password_by_employee_id', {
    emp_id: employeeId.trim(),
    new_password: newPassword,
  });
  if (error) throw error;
  return data;
}

// ---- TECHNICIAN NOTIFICATIONS ----
export async function getNotifications() {
  const { data, error } = await supabase
    .from('technician_notifications')
    .select('*, profiles:created_by(full_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function sendNotification(title, body, image_url = null) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('technician_notifications')
    .insert({ title, body, image_url, created_by: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNotification(id) {
  const { error } = await supabase
    .from('technician_notifications')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---- TECHNICIAN HISTORY ----
export async function getTechWOHistory(profileId) {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('assigned_to', profileId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ---- PROFILE UPDATE ----
export async function updateProfile(id, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  // Invalidate cache
  cachedProfile = null;
  return data;
}

export async function updateUserEmail(newEmail) {
  const { data, error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
  return data;
}

export async function updateUserPassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}
