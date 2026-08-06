// Equipment statuses
export const EQUIPMENT_STATUS = {
  operational: { label: 'Operasional', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  maintenance: { label: 'Perawatan', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  breakdown: { label: 'Rusak', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  decommissioned: { label: 'Non-Aktif', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
};

// Work Order statuses
export const WO_STATUS = {
  open: { label: 'Open', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  hold: { label: 'Hold', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  closed: { label: 'Closed', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
};

// WO Priority
export const WO_PRIORITY = {
  low: { label: 'Rendah', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
  medium: { label: 'Sedang', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  high: { label: 'Tinggi', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  critical: { label: 'Kritis', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

// WO Types
export const WO_TYPE = {
  corrective: { label: 'Korektif' },
  preventive: { label: 'Preventif' },
};

// WO Categories (General Maintenance)
export const WO_CATEGORY = {
  HVAC: { label: 'HVAC', color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' },
  ELECTRICAL: { label: 'Electrical', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  MECHANICAL: { label: 'Mechanical', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  CIVIL: { label: 'Civil', color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
  OTHER: { label: 'Other', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
};

// PM Status
export const PM_STATUS = {
  scheduled: { label: 'Terjadwal', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  overdue: { label: 'Terlambat', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  completed: { label: 'Selesai', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  cancelled: { label: 'Dibatalkan', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
};

// Shifts
export const SHIFTS = {
  pagi: { label: 'Pagi (06:00 - 14:00)', color: '#F59E0B' },
  siang: { label: 'Siang (14:00 - 22:00)', color: '#3B82F6' },
  malam: { label: 'Malam (22:00 - 06:00)', color: '#8B5CF6' },
};

// Schedule status
export const SCHEDULE_STATUS = {
  on_duty: { label: 'Bertugas', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  off_duty: { label: 'Libur', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
  leave: { label: 'Cuti', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  sick: { label: 'Sakit', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

// Roles
export const ROLES = {
  admin: { label: 'Admin', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  technician: { label: 'Teknisi', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
};

// Material units
export const UNITS = ['pcs', 'set', 'liter', 'kg', 'meter', 'roll', 'box', 'pack'];

// Equipment categories
export const EQUIPMENT_CATEGORIES = [
  'Mesin Produksi', 'Pompa', 'Kompresor', 'Conveyor', 'Generator',
  'HVAC', 'Elektrikal', 'Instrumentasi', 'Perpipaan', 'Lainnya'
];

// Material categories
export const MATERIAL_CATEGORIES = [
  'Bearing', 'Seal & Gasket', 'Belt', 'Filter', 'Electrical',
  'Lubricant', 'Fastener', 'Pipe Fitting', 'Valve', 'Lainnya'
];
