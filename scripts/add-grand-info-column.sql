-- Script to check and fix the grand_info column type in the agents table
-- This script should be run in your PostgreSQL database

-- First, check the current column type
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'agents' AND column_name = 'grand_info';

-- If the column doesn't exist, create it as TEXT
-- If it exists as JSON, alter it to TEXT
DO $$
BEGIN
    -- Check if grand_info column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agents' AND column_name = 'grand_info'
    ) THEN
        -- Create the column as TEXT
        ALTER TABLE public.agents ADD COLUMN grand_info TEXT;
        RAISE NOTICE 'Created grand_info column as TEXT';
    ELSE
        -- Check if it's JSON type and needs to be changed
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'agents' 
            AND column_name = 'grand_info' 
            AND data_type = 'json'
        ) THEN
            -- Change from JSON to TEXT
            ALTER TABLE public.agents ALTER COLUMN grand_info TYPE TEXT;
            RAISE NOTICE 'Changed grand_info column from JSON to TEXT';
        ELSE
            RAISE NOTICE 'grand_info column already exists with correct type';
        END IF;
    END IF;
END $$;

-- Verify the final column type
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'agents' AND column_name = 'grand_info'; 