require('dotenv').config();
const { User, Role } = require('../src/models');
const bcrypt = require('bcryptjs');

const createSuperAdmin = async () => {
  try {
    // Check if Super Admin role exists
    let superAdminRole = await Role.findOne({ where: { name: 'super_admin' } });
    
    if (!superAdminRole) {
      console.log('Super Admin role not found. Creating it now...');
      superAdminRole = await Role.create({
        name: 'super_admin',
        description: 'System Administrator with full access',
        level: 1
      });
    }

    // Check if super admin user already exists
    const existingAdmin = await User.findOne({ where: { email: 'admin@airms.com' } });
    
    if (existingAdmin) {
      console.log('Super Admin user (admin@airms.com) already exists!');
      return process.exit(0);
    }

    console.log('Creating Super Admin user...');
    
    // Create the user
    // The User model's beforeCreate hook will hash the password if we provide password_hash
    const adminUser = await User.create({
      employee_id: 'SA001',
      first_name: 'Super',
      last_name: 'Admin',
      email: 'admin@airms.com',
      password_hash: 'admin123', // Will be hashed by hook
      role_id: superAdminRole.id,
      is_active: true
    });

    console.log('\n✅ Super Admin created successfully!');
    console.log('-----------------------------------');
    console.log(`Email:    admin@airms.com`);
    console.log(`Password: admin123`);
    console.log('-----------------------------------\n');
    console.log('You can now log in using these credentials.');
    
    process.exit(0);
  } catch (error) {
    console.error('Failed to create Super Admin:', error);
    process.exit(1);
  }
};

createSuperAdmin();
