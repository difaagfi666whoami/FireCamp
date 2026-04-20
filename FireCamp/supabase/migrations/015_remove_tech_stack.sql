-- Remove tech_stack column from companies (field not used in output)
ALTER TABLE companies DROP COLUMN IF EXISTS tech_stack;
