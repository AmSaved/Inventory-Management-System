'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Function to update updated_at timestamp
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Function to generate request number
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION generate_request_number()
      RETURNS TRIGGER AS $$
      DECLARE
          year_prefix TEXT;
          sequence_num TEXT;
      BEGIN
          year_prefix := TO_CHAR(NEW.created_at, 'YYYY');
          SELECT LPAD(COALESCE(MAX(SUBSTRING(request_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
          INTO sequence_num
          FROM requests
          WHERE request_number LIKE 'REQ-' || year_prefix || '-%';
          
          NEW.request_number := 'REQ-' || year_prefix || '-' || sequence_num;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Function to generate discharge number
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION generate_discharge_number()
      RETURNS TRIGGER AS $$
      DECLARE
          year_prefix TEXT;
          sequence_num TEXT;
      BEGIN
          year_prefix := TO_CHAR(NEW.created_at, 'YYYY');
          SELECT LPAD(COALESCE(MAX(SUBSTRING(discharge_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
          INTO sequence_num
          FROM discharge_forms
          WHERE discharge_number LIKE 'DSC-' || year_prefix || '-%';
          
          NEW.discharge_number := 'DSC-' || year_prefix || '-' || sequence_num;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Function to generate store number
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION generate_store_number()
      RETURNS TRIGGER AS $$
      DECLARE
          year_prefix TEXT;
          sequence_num TEXT;
      BEGIN
          year_prefix := TO_CHAR(NEW.created_at, 'YYYY');
          SELECT LPAD(COALESCE(MAX(SUBSTRING(store_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
          INTO sequence_num
          FROM store_forms
          WHERE store_number LIKE 'STR-' || year_prefix || '-%';
          
          NEW.store_number := 'STR-' || year_prefix || '-' || sequence_num;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Function to generate assignment number
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION generate_assignment_number()
      RETURNS TRIGGER AS $$
      DECLARE
          year_prefix TEXT;
          sequence_num TEXT;
      BEGIN
          year_prefix := TO_CHAR(NEW.created_at, 'YYYY');
          SELECT LPAD(COALESCE(MAX(SUBSTRING(assignment_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
          INTO sequence_num
          FROM assignments
          WHERE assignment_number LIKE 'ASN-' || year_prefix || '-%';
          
          NEW.assignment_number := 'ASN-' || year_prefix || '-' || sequence_num;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Function to generate return number
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION generate_return_number()
      RETURNS TRIGGER AS $$
      DECLARE
          year_prefix TEXT;
          sequence_num TEXT;
      BEGIN
          year_prefix := TO_CHAR(NEW.created_at, 'YYYY');
          SELECT LPAD(COALESCE(MAX(SUBSTRING(return_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
          INTO sequence_num
          FROM returns
          WHERE return_number LIKE 'RET-' || year_prefix || '-%';
          
          NEW.return_number := 'RET-' || year_prefix || '-' || sequence_num;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Function to generate transfer number
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION generate_transfer_number()
      RETURNS TRIGGER AS $$
      DECLARE
          year_prefix TEXT;
          sequence_num TEXT;
      BEGIN
          year_prefix := TO_CHAR(NEW.created_at, 'YYYY');
          SELECT LPAD(COALESCE(MAX(SUBSTRING(transfer_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
          INTO sequence_num
          FROM transfers
          WHERE transfer_number LIKE 'TRF-' || year_prefix || '-%';
          
          NEW.transfer_number := 'TRF-' || year_prefix || '-' || sequence_num;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Function to generate issue number
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION generate_issue_number()
      RETURNS TRIGGER AS $$
      DECLARE
          year_prefix TEXT;
          sequence_num TEXT;
      BEGIN
          year_prefix := TO_CHAR(NEW.created_at, 'YYYY');
          SELECT LPAD(COALESCE(MAX(SUBSTRING(issue_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
          INTO sequence_num
          FROM issues
          WHERE issue_number LIKE 'ISS-' || year_prefix || '-%';
          
          NEW.issue_number := 'ISS-' || year_prefix || '-' || sequence_num;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Triggers for updating timestamps
    const tables = [
      'roles', 'permissions', 'branches', 'users', 'products', 
      'inventory', 'requests', 'request_items', 'approvals', 
      'store_forms', 'discharge_forms', 'assignments', 'returns', 
      'transfers', 'issues'
    ];

    for (const table of tables) {
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
            BEFORE UPDATE ON ${table}
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    // Triggers for generating numbers
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS generate_request_number_trigger ON requests;
      CREATE TRIGGER generate_request_number_trigger
          BEFORE INSERT ON requests
          FOR EACH ROW
          EXECUTE FUNCTION generate_request_number();
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS generate_discharge_number_trigger ON discharge_forms;
      CREATE TRIGGER generate_discharge_number_trigger
          BEFORE INSERT ON discharge_forms
          FOR EACH ROW
          EXECUTE FUNCTION generate_discharge_number();
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS generate_store_number_trigger ON store_forms;
      CREATE TRIGGER generate_store_number_trigger
          BEFORE INSERT ON store_forms
          FOR EACH ROW
          EXECUTE FUNCTION generate_store_number();
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS generate_assignment_number_trigger ON assignments;
      CREATE TRIGGER generate_assignment_number_trigger
          BEFORE INSERT ON assignments
          FOR EACH ROW
          EXECUTE FUNCTION generate_assignment_number();
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS generate_return_number_trigger ON returns;
      CREATE TRIGGER generate_return_number_trigger
          BEFORE INSERT ON returns
          FOR EACH ROW
          EXECUTE FUNCTION generate_return_number();
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS generate_transfer_number_trigger ON transfers;
      CREATE TRIGGER generate_transfer_number_trigger
          BEFORE INSERT ON transfers
          FOR EACH ROW
          EXECUTE FUNCTION generate_transfer_number();
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS generate_issue_number_trigger ON issues;
      CREATE TRIGGER generate_issue_number_trigger
          BEFORE INSERT ON issues
          FOR EACH ROW
          EXECUTE FUNCTION generate_issue_number();
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop triggers
    const tables = [
      'roles', 'permissions', 'branches', 'users', 'products', 
      'inventory', 'requests', 'request_items', 'approvals', 
      'store_forms', 'discharge_forms', 'assignments', 'returns', 
      'transfers', 'issues'
    ];

    for (const table of tables) {
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
      `);
    }

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS generate_request_number_trigger ON requests;
      DROP TRIGGER IF EXISTS generate_discharge_number_trigger ON discharge_forms;
      DROP TRIGGER IF EXISTS generate_store_number_trigger ON store_forms;
      DROP TRIGGER IF EXISTS generate_assignment_number_trigger ON assignments;
      DROP TRIGGER IF EXISTS generate_return_number_trigger ON returns;
      DROP TRIGGER IF EXISTS generate_transfer_number_trigger ON transfers;
      DROP TRIGGER IF EXISTS generate_issue_number_trigger ON issues;
    `);

    // Drop functions
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
      DROP FUNCTION IF EXISTS generate_request_number() CASCADE;
      DROP FUNCTION IF EXISTS generate_discharge_number() CASCADE;
      DROP FUNCTION IF EXISTS generate_store_number() CASCADE;
      DROP FUNCTION IF EXISTS generate_assignment_number() CASCADE;
      DROP FUNCTION IF EXISTS generate_return_number() CASCADE;
      DROP FUNCTION IF EXISTS generate_transfer_number() CASCADE;
      DROP FUNCTION IF EXISTS generate_issue_number() CASCADE;
    `);
  }
};