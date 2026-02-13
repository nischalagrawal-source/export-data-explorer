/**
 * Initialize Users Table and Create Admin Account
 * Run: node scripts/init-users.js
 */

import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const dbUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log('Database URL:', dbUrl);
console.log('Auth Token:', authToken ? 'Set' : 'NOT SET');

const db = createClient({
  url: dbUrl,
  authToken: authToken
});

async function initUsers() {
  try {
    console.log('\n🔧 Initializing users table...');
    
    // Create users table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'user', 'demo')) DEFAULT 'user',
        full_name TEXT,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);
    console.log('✅ Users table created/verified');
    
    // Check existing users
    const users = await db.execute('SELECT id, username, role, full_name, active FROM users');
    console.log('\n📋 Existing users:', users.rows.length);
    
    for (const user of users.rows) {
      console.log(`   - ${user.username} (${user.role}) - Active: ${user.active ? 'Yes' : 'No'}`);
    }
    
    // Check if admin exists
    const adminUser = await db.execute('SELECT * FROM users WHERE username = ?', ['admin']);
    
    if (adminUser.rows.length === 0) {
      console.log('\n🔐 Creating default admin account...');
      const adminPassword = await bcrypt.hash('admin123', 10);
      await db.execute(
        'INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
        ['admin', adminPassword, 'admin', 'Administrator']
      );
      console.log('✅ Default admin account created');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('\n✅ Admin account already exists');
      
      // Reset admin password to default
      const resetPassword = process.argv.includes('--reset');
      if (resetPassword) {
        console.log('🔐 Resetting admin password to default...');
        const adminPassword = await bcrypt.hash('admin123', 10);
        await db.execute('UPDATE users SET password_hash = ?, active = 1 WHERE username = ?', [adminPassword, 'admin']);
        console.log('✅ Admin password reset to: admin123');
      }
    }
    
    // Check for sarfaraz user
    const sarfarazUser = await db.execute('SELECT * FROM users WHERE username = ?', ['sarfaraz']);
    if (sarfarazUser.rows.length > 0) {
      console.log('\n📋 Found user "sarfaraz"');
      const user = sarfarazUser.rows[0];
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.active ? 'Yes' : 'No'}`);
      
      // Reset sarfaraz password if requested
      if (process.argv.includes('--reset-sarfaraz')) {
        console.log('🔐 Resetting sarfaraz password...');
        const newPassword = await bcrypt.hash('sarfaraz123', 10);
        await db.execute('UPDATE users SET password_hash = ?, active = 1 WHERE username = ?', [newPassword, 'sarfaraz']);
        console.log('✅ Sarfaraz password reset to: sarfaraz123');
      }
    }
    
    // Final user list
    const finalUsers = await db.execute('SELECT id, username, role, full_name, active, created_at FROM users');
    console.log('\n📊 Final user list:');
    console.log('==================');
    for (const user of finalUsers.rows) {
      console.log(`   ${user.id}. ${user.username} | Role: ${user.role} | Active: ${user.active ? 'Yes' : 'No'} | Name: ${user.full_name || 'N/A'}`);
    }
    
    console.log('\n✅ User initialization complete!');
    console.log('\n📌 Login credentials:');
    console.log('   Admin: admin / admin123');
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

initUsers();
