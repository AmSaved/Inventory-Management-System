require('dotenv').config();
const { User } = require('../src/models');

async function check() {
    try {
        const users = await User.findAll({ attributes: ['email', 'password_hash'] });
        console.log("Users in DB:", users.length);
        users.forEach(u => console.log(`${u.email}: ${u.password_hash.substring(0, 10)}...`));
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        process.exit(0);
    }
}
check();
