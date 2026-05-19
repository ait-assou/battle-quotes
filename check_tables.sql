-- STEP 1: Check which tables actually exist in your database
-- Run this FIRST to see what tables are there
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
