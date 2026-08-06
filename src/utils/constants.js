// Equipment statuses
export const EQUIPMENT_STATUS = {
  operational:    { label: 'Operasional', color: '#8CC63F', bg: 'rgba(140,198,63,0.12)' },
  maintenance:    { label: 'Perawatan',   color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  breakdown:      { label: 'Rusak',       color: '#EF4444', bg: 'rgba(239,68,68,0.12)'  },
  decommissioned: { label: 'Non-Aktif',   color: '#6B7280', bg: 'rgba(107,114,128,0.12)'},
};

// Work Order statuses
export const WO_STATUS = {
  open:   { label: 'Open',   color: '#173B63', bg: 'rgba(23,59,99,0.12)'    },
  hold:   { label: 'Hold',   color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
  closed: { label: 'Closed', color: '#8CC63F', bg: 'rgba(140,198,63,0.12)'  },
};

// WO Priority
export const WO_PRIORITY = {
  low:      { label: 'Rendah', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  medium:   { label: 'Sedang', color: '#173B63', bg: 'rgba(23,59,99,0.12)'    },
  high:     { label: 'Tinggi', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
  critical: { label: 'Kritis', color: '#EF4444', bg: 'rgba(239,68,68,0.12)'   },
};

// WO Types
export const WO_TYPE = {
  corrective: { label: 'Korektif' },
  preventive: { label: 'Preventif' },
};

// WO Categories (General Maintenance)
export const WO_CATEGORY = {
  HVAC:       { label: 'HVAC',       color: '#0E2439', bg: 'rgba(14,36,57,0.12)'    },
  ELECTRICAL: { label: 'Electrical', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
  MECHANICAL: { label: 'Mechanical', color: '#173B63', bg: 'rgba(23,59,99,0.12)'    },
  CIVIL:      { label: 'Civil',      color: '#8CC63F', bg: 'rgba(140,198,63,0.12)'  },
  OTHER:      { label: 'Other',      color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

// PM Status
export const PM_STATUS = {
  scheduled: { label: 'Terjadwal', color: '#173B63', bg: 'rgba(23,59,99,0.12)'    },
  overdue:   { label: 'Terlambat', color: '#EF4444', bg: 'rgba(239,68,68,0.12)'   },
  completed: { label: 'Selesai',   color: '#8CC63F', bg: 'rgba(140,198,63,0.12)'  },
  cancelled: { label: 'Dibatalkan',color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

// Shifts
export const SHIFTS = {
  pagi:  { label: 'Pagi (06:00 - 14:00)',   color: '#F59E0B' },
  siang: { label: 'Siang (14:00 - 22:00)',  color: '#173B63' },
  malam: { label: 'Malam (22:00 - 06:00)',  color: '#0E2439' },
};

// Schedule status
export const SCHEDULE_STATUS = {
  on_duty:  { label: 'Bertugas', color: '#8CC63F', bg: 'rgba(140,198,63,0.12)'  },
  off_duty:  { label: 'Libur',   color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  leave:    { label: 'Cuti',    color: '#173B63', bg: 'rgba(23,59,99,0.12)'    },
  sick:     { label: 'Sakit',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)'   },
};

// Roles
export const ROLES = {
  admin:      { label: 'Admin',   color: '#0E2439', bg: 'rgba(14,36,57,0.12)'  },
  technician: { label: 'Teknisi', color: '#173B63', bg: 'rgba(23,59,99,0.12)'  },
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
