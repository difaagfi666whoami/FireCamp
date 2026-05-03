const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL='([^']+)'/);
const keyMatch = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY='([^']+)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data, error } = await supabase.from('invite_codes').select('id').limit(1);
  if (error) {
    console.error("Error accessing invite_codes:", error.message);
  } else {
    console.log("invite_codes table exists! Data:", data);
  }
}
run();
