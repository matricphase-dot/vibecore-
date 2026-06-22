import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchUsers() {
  console.log("Fetching users from Supabase Auth...");
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error("Error fetching auth users:", authError);
  } else {
    console.log(`\nFound ${users.length} users in Auth:`);
    users.forEach((u, i) => console.log(`${i+1}. ${u.email} (Created: ${new Date(u.created_at).toLocaleDateString()})`));
  }

  console.log("\nFetching profiles from database...");
  const { data: profiles, error: dbError } = await supabase.from('profiles').select('*');
  
  if (dbError) {
    console.error("Error fetching profiles:", dbError);
  } else {
    console.log(`\nFound ${profiles.length} user profiles:`);
    console.table(profiles.map(p => ({
      email: p.email,
      credits: p.credits,
      is_admin: p.is_admin,
      plan: p.plan_type
    })));
  }
}

fetchUsers();
