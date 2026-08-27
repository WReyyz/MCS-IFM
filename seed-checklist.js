import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('./.env');
const env = fs.readFileSync(envPath, 'utf-8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

const checklist = [
  { id: Date.now() + 1, category: 'General check', task: 'Periksa dan bersihkan area chiller dan instalasinya', type: 'boolean' },
  { id: Date.now() + 2, category: 'General check', task: 'Ukur water temperatur in - out (oC)', type: 'number' },
  { id: Date.now() + 3, category: 'General check', task: 'Periksa dan ukur water pressure in - out (psi)', type: 'number' },
  { id: Date.now() + 4, category: 'General check', task: 'Periksa dan ukur level oil refrigerant dari sight glass', type: 'boolean' },
  { id: Date.now() + 5, category: 'General check', task: 'Periksa dan ukur noise operasional chiller (db)', type: 'number' },
  { id: Date.now() + 6, category: 'Panel Elektrikal kontrol', task: 'Periksa dan bersihkan box panel bagian luar dan dalam menggunakan kain majun, kuas nylon dan portable elect.vacum', type: 'boolean' },
  { id: Date.now() + 7, category: 'Panel Elektrikal kontrol', task: 'Periksa tightening / koneksi kabel dan komponen lainnya', type: 'boolean' },
  { id: Date.now() + 8, category: 'Panel Elektrikal kontrol', task: 'Ukur nilai arus dan tegangan source power', type: 'boolean' },
  { id: Date.now() + 9, category: 'Instalasi plumbing', task: 'Periksa dan bersihkan instalasi plumbing berikut accesorisnya, valve dll', type: 'boolean' },
  { id: Date.now() + 10, category: 'Instalasi plumbing', task: 'Periksa dan bersihkan water strainer', type: 'boolean' },
  { id: Date.now() + 11, category: 'Coil condensor', task: 'Periksa dan bersihkan sirip dan coil condensor dengan water jet spray', type: 'boolean' },
  { id: Date.now() + 12, category: 'Coil condensor', task: 'Periksa sirip coil dan rapihkan', type: 'boolean' },
  { id: Date.now() + 13, category: 'Heat exchanger', task: 'Periksa dan bersihkan sirip / honeycomp heat exchanger', type: 'boolean' },
  { id: Date.now() + 14, category: 'Heat exchanger', task: 'Periksa pressure in -out (psi)', type: 'number' },
  { id: Date.now() + 15, category: 'Annual maintenance', task: 'Lakukan perawatan secara menyeluruh pada chiller berikut heat echanger dan instalasinya, (by vendor / priciple)', type: 'boolean' }
];

async function run() {
  const { data: existing, error: existingErr } = await supabase.from('equipment').select('*').eq('idAset', '40.10.401-14-03.09.001');
  console.log('Existing:', existing, 'Error:', existingErr?.message);
  
  if (!existing || existing.length === 0) {
    const { data, error } = await supabase.from('equipment').insert({
      idAset: '40.10.401-14-03.09.001',
      noInventory: '40.10.401-14-03.09.001',
      namaEquipment: 'Anodizing - Air cool Chiller',
      type: 'Air cool Chiller',
      area: 'GMF/GSE',
      status: 'operational',
      checklist: checklist
    }).select();
    if (error) console.error('Insert Error:', error.message);
    else console.log('Successfully inserted equipment:', data);
  } else {
    const { data, error } = await supabase
      .from('equipment')
      .update({ checklist })
      .eq('idAset', '40.10.401-14-03.09.001')
      .select();
    if (error) console.error('Update Error:', error.message);
    else console.log('Successfully updated equipment:', data);
  }
}
run();
