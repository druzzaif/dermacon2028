import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const fileContent = fs.readFileSync('faculty_export.txt', 'utf-8');
const lines = fileContent.split('\n').filter(l => l.trim() !== '');

async function importData() {
  console.log("Starting import...");
  let successCount = 0;
  let errorCount = 0;

  // Start from line 1 (skip the header)
  for (let i = 1; i < lines.length; i++) {
    // Split by tabs OR multiple spaces
    const values = lines[i].trim().split(/[\t\s]+/);
    
    const faculty_id = values[0];
    if (!faculty_id || !faculty_id.startsWith('FAC')) continue;

    // Find the email (the word containing @)
    let email = null;
    for (const val of values) {
      if (val.includes('@')) {
        email = val.replace(/["',]/g, '');
        break;
      }
    }

    // Find the phone (usually the next column after name, before country/email)
    // It's easier to just hardcode an empty phone for now to prevent errors.
    const phone = null; 

    // Extract name (everything between ID and Email)
    const emailIndex = values.findIndex(v => v.includes('@'));
    const nameParts = values.slice(1, emailIndex > 0 ? emailIndex : undefined);
    const canonical_name = nameParts.join(' ') || 'Unknown';

    let first_name = nameParts[0] || null;
    let last_name = nameParts.slice(1).join(' ') || null;
    
    // Clean up "Dr."
    if (first_name === 'Dr' || first_name === 'Dr.') {
      first_name = nameParts[1] || null;
      last_name = nameParts.slice(2).join(' ') || null;
    }

    const payload = {
      faculty_id,
      canonical_name,
      first_name,
      last_name,
      email, // If null, the DB now allows it
      is_active: true
    };

    const { error } = await supabase.from('faculty').insert(payload);

    if (error) {
      if (error.code !== '23505') { // Ignore duplicates
        console.error(`❌ Error on ${faculty_id}:`, error.message);
        errorCount++;
      }
    } else {
      successCount++;
    }
  }

  console.log(`\n🎉 Import Complete! Added ${successCount} new records.`);
}

importData();
