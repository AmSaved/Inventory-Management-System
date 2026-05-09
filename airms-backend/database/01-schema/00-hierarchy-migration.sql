-- ========================================================
-- AIRMS Multi-Tenant Hierarchical Migration
-- ========================================================

BEGIN;

-- 1. Drop existing hierarchical tables if they exist partially (Clean slate for migration)
DROP TABLE IF EXISTS organization_units CASCADE;
DROP TABLE IF EXISTS organization_levels CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- 2. Create Companies Table
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    subdomain VARCHAR(50) UNIQUE,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Organization Levels Table
CREATE TABLE organization_levels (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    name VARCHAR(100) NOT NULL,
    rank INTEGER NOT NULL, -- Lower rank = higher in hierarchy (e.g. 1 = Global/HQ)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Organization Units Table (Replacing Branches/Departments)
CREATE TABLE organization_units (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    parent_id INTEGER REFERENCES organization_units(id),
    org_level_id INTEGER NOT NULL REFERENCES organization_levels(id),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    can_store_inventory BOOLEAN DEFAULT false,
    path TEXT, -- Materialized path (e.g. /1/5/12)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Initial Corporate Setup (Default Company)
INSERT INTO companies (id, name, subdomain) 
VALUES (1, 'Default Corporation', 'default')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_levels (id, company_id, name, rank)
VALUES 
    (1, 1, 'Headquarters', 1),
    (2, 1, 'Regional Office', 2),
    (3, 1, 'Branch', 3),
    (4, 1, 'Department', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_units (id, company_id, parent_id, org_level_id, name, code, can_store_inventory, path)
VALUES (1, 1, NULL, 1, 'Central Headquarters', 'HQ-001', true, '/1')
ON CONFLICT (id) DO NOTHING;

-- 5. Migrate Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_unit_id INTEGER REFERENCES organization_units(id);
-- Update existing users to HQ unit if they were in a branch
UPDATE users SET org_unit_id = 1 WHERE org_unit_id IS NULL;
-- Handle legacy branch_id
ALTER TABLE users DROP COLUMN IF EXISTS branch_id;
ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;

-- 6. Migrate Products
ALTER TABLE products ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT 1;
ALTER TABLE products ALTER COLUMN company_id SET NOT NULL;

-- 7. Migrate Inventory
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT 1;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS org_unit_id INTEGER REFERENCES organization_units(id);
UPDATE inventory SET org_unit_id = 1 WHERE org_unit_id IS NULL;
ALTER TABLE inventory DROP COLUMN IF EXISTS branch_id;
ALTER TABLE inventory DROP COLUMN IF EXISTS department_id;
ALTER TABLE inventory ALTER COLUMN company_id SET NOT NULL;

-- 8. Migrate Roles
ALTER TABLE roles ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id); -- Null for system roles
-- Migrate existing roles to default company
UPDATE roles SET company_id = 1 WHERE company_id IS NULL AND name NOT IN ('super_admin');

-- 9. Migrate Activity Logs
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT 1;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS org_unit_id INTEGER REFERENCES organization_units(id);
UPDATE activity_logs SET org_unit_id = 1 WHERE org_unit_id IS NULL;
ALTER TABLE activity_logs DROP COLUMN IF EXISTS branch_id;
ALTER TABLE activity_logs DROP COLUMN IF EXISTS department_id;
ALTER TABLE activity_logs ALTER COLUMN company_id SET NOT NULL;

-- 10. Migrate Request & Related Tables
ALTER TABLE requests ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT 1;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS org_unit_id INTEGER REFERENCES organization_units(id);
UPDATE requests SET org_unit_id = 1 WHERE org_unit_id IS NULL;
ALTER TABLE requests DROP COLUMN IF EXISTS branch_id;
ALTER TABLE requests ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE store_forms ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT 1;
ALTER TABLE store_forms ADD COLUMN IF NOT EXISTS org_unit_id INTEGER REFERENCES organization_units(id);
UPDATE store_forms SET org_unit_id = 1 WHERE org_unit_id IS NULL;
ALTER TABLE store_forms DROP COLUMN IF EXISTS branch_id;
ALTER TABLE store_forms ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE discharge_forms ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT 1;
ALTER TABLE discharge_forms ADD COLUMN IF NOT EXISTS from_unit_id INTEGER REFERENCES organization_units(id);
ALTER TABLE discharge_forms ADD COLUMN IF NOT EXISTS to_unit_id INTEGER REFERENCES organization_units(id);
UPDATE discharge_forms SET from_unit_id = 1, to_unit_id = 1 WHERE from_unit_id IS NULL;
ALTER TABLE discharge_forms DROP COLUMN IF EXISTS branch_id;
ALTER TABLE discharge_forms DROP COLUMN IF EXISTS from_branch_id;
ALTER TABLE discharge_forms DROP COLUMN IF EXISTS to_branch_id;
ALTER TABLE discharge_forms ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT 1;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS org_unit_id INTEGER REFERENCES organization_units(id);
UPDATE assignments SET org_unit_id = 1 WHERE org_unit_id IS NULL;
ALTER TABLE assignments DROP COLUMN IF EXISTS branch_id;
ALTER TABLE assignments ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE transfers ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT 1;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS from_unit_id INTEGER REFERENCES organization_units(id);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS to_unit_id INTEGER REFERENCES organization_units(id);
UPDATE transfers SET from_unit_id = 1, to_unit_id = 1 WHERE from_unit_id IS NULL;
ALTER TABLE transfers DROP COLUMN IF EXISTS from_branch_id;
ALTER TABLE transfers DROP COLUMN IF EXISTS to_branch_id;
ALTER TABLE transfers ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE returns ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT 1;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS from_unit_id INTEGER REFERENCES organization_units(id);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS to_unit_id INTEGER REFERENCES organization_units(id);
UPDATE returns SET from_unit_id = 1, to_unit_id = 1 WHERE from_unit_id IS NULL;
ALTER TABLE returns DROP COLUMN IF EXISTS from_branch_id;
ALTER TABLE returns DROP COLUMN IF EXISTS to_branch_id;
ALTER TABLE returns ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE issues ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) DEFAULT 1;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS org_unit_id INTEGER REFERENCES organization_units(id);
UPDATE issues SET org_unit_id = 1 WHERE org_unit_id IS NULL;
ALTER TABLE issues DROP COLUMN IF EXISTS branch_id;
ALTER TABLE issues ALTER COLUMN company_id SET NOT NULL;

-- 11. Drop Legacy Tables
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

COMMIT;
