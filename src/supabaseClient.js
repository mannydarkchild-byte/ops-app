import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project URL and Anon Key
const supabaseUrl = 'https://hnzfcstoytxcbeaiiuhf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuemZjc3RveXR4Y2JlYWlpdWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDg5OTksImV4cCI6MjEwMjE4NDk5OX0.XeFeLIlYB6Pf186AlpDL7shJpuDpd98lPNiqEqtBnk8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);