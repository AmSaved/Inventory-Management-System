require('dotenv').config();
const { User } = require('../src/models');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const user = await User.findOne({ where: { email: 'admin@airms.com' } });
    if (user) {
      // Direct DB update to bypass the model hook
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('admin123', salt);
      await user.update({ password_hash: hash }, { hooks: false });
      console.log('Password fixed successfully');
    } else {
      console.log('User not found');
    }
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
})();
