import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://udlecsfqznitbcfvecqk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGVjc2Zxem5pdGJjZnZlY3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIxODQsImV4cCI6MjA5MzI0ODE4NH0.w5_h7r2XcSobhXtJYSO3drlX5-9uiq-IwN5_CSit5DE'


export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
