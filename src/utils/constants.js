// Equipment statuses — Industrial Patina palette
export const EQUIPMENT_STATUS = {
  operational:    { label: 'Operasional', color: '#2E8B57', bg: 'rgba(46,139,87,0.12)'   },
  maintenance:    { label: 'Perawatan',   color: '#E8920A', bg: 'rgba(232,146,10,0.12)'  },
  breakdown:      { label: 'Rusak',       color: '#C9372C', bg: 'rgba(201,55,44,0.12)'   },
  decommissioned: { label: 'Non-Aktif',   color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

// Work Order statuses
export const WO_STATUS = {
  open:               { label: 'Open',              color: '#2D6A9F', bg: 'rgba(45,106,159,0.12)'  },
  diploting:          { label: 'Diploting',          color: '#2D6A9F', bg: 'rgba(45,106,159,0.12)'  },
  hold:               { label: 'Hold',               color: '#E8920A', bg: 'rgba(232,146,10,0.12)'  },
  menunggu_approval:  { label: 'Menunggu Approval',  color: '#6E4FC8', bg: 'rgba(110,79,200,0.12)'  },
  revisi:             { label: 'Revisi',             color: '#C9372C', bg: 'rgba(201,55,44,0.12)'   },
  pending_inspection: { label: 'Pending Approval',   color: '#6E4FC8', bg: 'rgba(110,79,200,0.12)'  },
  closed:             { label: 'Closed',             color: '#2E8B57', bg: 'rgba(46,139,87,0.12)'   },
};

// WO Priority
export const WO_PRIORITY = {
  low:      { label: 'Rendah', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  medium:   { label: 'Sedang', color: '#2D6A9F', bg: 'rgba(45,106,159,0.12)'  },
  high:     { label: 'Tinggi', color: '#E8920A', bg: 'rgba(232,146,10,0.12)'  },
  critical: { label: 'Kritis', color: '#C9372C', bg: 'rgba(201,55,44,0.12)'   },
};

// WO Types
export const WO_TYPE = {
  corrective: { label: 'Korektif' },
  preventive: { label: 'Preventif' },
};

// WO Categories (General Maintenance)
export const WO_CATEGORY = {
  HVAC:       { label: 'HVAC',       color: '#2D6A9F', bg: 'rgba(45,106,159,0.12)'  },
  ELECTRICAL: { label: 'Electrical', color: '#E8920A', bg: 'rgba(232,146,10,0.12)'  },
  MECHANICAL: { label: 'Mechanical', color: '#1A2230', bg: 'rgba(26,34,48,0.10)'    },
  CIVIL:      { label: 'Civil',      color: '#2E8B57', bg: 'rgba(46,139,87,0.12)'   },
  OTHER:      { label: 'Other',      color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

// PM Status
export const PM_STATUS = {
  scheduled: { label: 'Terjadwal', color: '#2D6A9F', bg: 'rgba(45,106,159,0.12)'  },
  overdue:   { label: 'Terlambat', color: '#C9372C', bg: 'rgba(201,55,44,0.12)'   },
  completed: { label: 'Selesai',   color: '#2E8B57', bg: 'rgba(46,139,87,0.12)'   },
  cancelled: { label: 'Dibatalkan',color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

// Shifts
export const SHIFTS = {
  pagi:  { label: 'Pagi (06:00 - 14:00)',   color: '#E8920A' },
  siang: { label: 'Siang (14:00 - 22:00)',  color: '#2D6A9F' },
  malam: { label: 'Malam (22:00 - 06:00)',  color: '#1A2230' },
};

// Interval types for equipment maintenance requirements
export const INTERVAL_TYPES = {
  daily:   { label: 'Harian',   shortLabel: 'Hari',   multiplierFn: (days) => days },
  weekly:  { label: 'Mingguan', shortLabel: 'Minggu', multiplierFn: (days) => Math.floor(days / 7) },
  monthly: { label: 'Bulanan',  shortLabel: 'Bulan',  multiplierFn: (days) => Math.max(1, Math.ceil(days / 30)) },
  custom:  { label: 'Custom',   shortLabel: 'Custom', multiplierFn: (days, interval_days) => interval_days > 0 ? Math.floor(days / interval_days) : 0 },
};

// Color palette for shift matrix cells (by shift code prefix)
export const SHIFT_CELL_COLORS = {
  P:  { bg: 'rgba(232,146,10,0.16)',  color: '#A06508', border: 'rgba(232,146,10,0.35)' }, // Pagi
  S:  { bg: 'rgba(45,106,159,0.16)',  color: '#2D6A9F', border: 'rgba(45,106,159,0.35)' }, // Siang
  M:  { bg: 'rgba(26,34,48,0.16)',    color: '#8A96A3', border: 'rgba(26,34,48,0.35)'   }, // Malam
  O:  { bg: 'rgba(107,114,128,0.10)', color: '#6B7280', border: 'rgba(107,114,128,0.2)' }, // Off
};

// Schedule status
export const SCHEDULE_STATUS = {
  on_duty:  { label: 'Bertugas', color: '#2E8B57', bg: 'rgba(46,139,87,0.12)'   },
  off_duty: { label: 'Libur',    color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  leave:    { label: 'Cuti',     color: '#2D6A9F', bg: 'rgba(45,106,159,0.12)'  },
  sick:     { label: 'Sakit',    color: '#C9372C', bg: 'rgba(201,55,44,0.12)'   },
};

// Roles
export const ROLES = {
  admin:      { label: 'Admin',     color: '#2D6A9F', bg: 'rgba(45,106,159,0.12)'  },
  inspector:  { label: 'Inspector', color: '#E8920A', bg: 'rgba(232,146,10,0.12)'  },
  technician: { label: 'Teknisi',   color: '#1A2230', bg: 'rgba(26,34,48,0.10)'    },
};

// Technician Skills
export const TECHNICIAN_SKILLS = {
  HVAC:       { label: 'HVAC',       color: '#2D6A9F', bg: 'rgba(45,106,159,0.12)' },
  ME:         { label: 'ME',         color: '#6E4FC8', bg: 'rgba(110,79,200,0.12)' },
  CIVIL:      { label: 'Civil',      color: '#E8920A', bg: 'rgba(232,146,10,0.12)' },
  INDUSTRIAL: { label: 'Industrial', color: '#2E8B57', bg: 'rgba(46,139,87,0.12)'  },
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

// Tools Status / Condition
export const TOOL_STATUS = {
  baik:            { label: 'Baik / Siap Pakai', color: '#2E8B57', bg: 'rgba(46,139,87,0.12)'   },
  perlu_kalibrasi: { label: 'Perlu Kalibrasi',   color: '#E8920A', bg: 'rgba(232,146,10,0.12)'  },
  dalam_kalibrasi: { label: 'Dalam Kalibrasi',   color: '#2D6A9F', bg: 'rgba(45,106,159,0.12)'  },
  rusak:           { label: 'Rusak',             color: '#C9372C', bg: 'rgba(201,55,44,0.12)'   },
  hilang:          { label: 'Hilang',            color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

