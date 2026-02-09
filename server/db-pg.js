/**
 * PostgreSQL Database Module for EDE
 * Provides abstraction layer for Neon PostgreSQL
 */

import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

let pool = null;

export function getPool() {
  if (!pool && databaseUrl) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 10
    });
  }
  return pool;
}

// Execute a query and return all rows
export async function all(sql, params = []) {
  const pool = getPool();
  if (!pool) throw new Error('Database not configured');
  
  // Convert ? placeholders to $1, $2, etc. for PostgreSQL
  let pgSql = sql;
  let paramIndex = 1;
  while (pgSql.includes('?')) {
    pgSql = pgSql.replace('?', `$${paramIndex++}`);
  }
  
  // Replace table names without prefix to ede_ prefixed names
  pgSql = pgSql.replace(/\bFROM\s+exports\b/gi, 'FROM ede_exports');
  pgSql = pgSql.replace(/\bINTO\s+exports\b/gi, 'INTO ede_exports');
  pgSql = pgSql.replace(/\bUPDATE\s+exports\b/gi, 'UPDATE ede_exports');
  pgSql = pgSql.replace(/\bFROM\s+competitors\b/gi, 'FROM ede_competitors');
  pgSql = pgSql.replace(/\bINTO\s+competitors\b/gi, 'INTO ede_competitors');
  pgSql = pgSql.replace(/\bUPDATE\s+competitors\b/gi, 'UPDATE ede_competitors');
  pgSql = pgSql.replace(/\bDELETE\s+FROM\s+competitors\b/gi, 'DELETE FROM ede_competitors');
  pgSql = pgSql.replace(/\bFROM\s+clients\b/gi, 'FROM ede_clients');
  pgSql = pgSql.replace(/\bINTO\s+clients\b/gi, 'INTO ede_clients');
  pgSql = pgSql.replace(/\bUPDATE\s+clients\b/gi, 'UPDATE ede_clients');
  pgSql = pgSql.replace(/\bDELETE\s+FROM\s+clients\b/gi, 'DELETE FROM ede_clients');
  pgSql = pgSql.replace(/\bFROM\s+users\b/gi, 'FROM ede_users');
  pgSql = pgSql.replace(/\bINTO\s+users\b/gi, 'INTO ede_users');
  pgSql = pgSql.replace(/\bUPDATE\s+users\b/gi, 'UPDATE ede_users');
  pgSql = pgSql.replace(/\bDELETE\s+FROM\s+users\b/gi, 'DELETE FROM ede_users');
  pgSql = pgSql.replace(/\bFROM\s+company_info\b/gi, 'FROM ede_company_info');
  pgSql = pgSql.replace(/\bINTO\s+company_info\b/gi, 'INTO ede_company_info');
  pgSql = pgSql.replace(/\bUPDATE\s+company_info\b/gi, 'UPDATE ede_company_info');
  pgSql = pgSql.replace(/\bFROM\s+feedback\b/gi, 'FROM ede_feedback');
  pgSql = pgSql.replace(/\bINTO\s+feedback\b/gi, 'INTO ede_feedback');
  
  const result = await pool.query(pgSql, params);
  return result.rows;
}

// Execute a query and return first row
export async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

// Execute a query (INSERT, UPDATE, DELETE)
export async function run(sql, params = []) {
  const pool = getPool();
  if (!pool) throw new Error('Database not configured');
  
  // Convert ? placeholders to $1, $2, etc.
  let pgSql = sql;
  let paramIndex = 1;
  while (pgSql.includes('?')) {
    pgSql = pgSql.replace('?', `$${paramIndex++}`);
  }
  
  // Replace table names
  pgSql = pgSql.replace(/\bFROM\s+exports\b/gi, 'FROM ede_exports');
  pgSql = pgSql.replace(/\bINTO\s+exports\b/gi, 'INTO ede_exports');
  pgSql = pgSql.replace(/\bUPDATE\s+exports\b/gi, 'UPDATE ede_exports');
  pgSql = pgSql.replace(/\bFROM\s+competitors\b/gi, 'FROM ede_competitors');
  pgSql = pgSql.replace(/\bINTO\s+competitors\b/gi, 'INTO ede_competitors');
  pgSql = pgSql.replace(/\bUPDATE\s+competitors\b/gi, 'UPDATE ede_competitors');
  pgSql = pgSql.replace(/\bDELETE\s+FROM\s+competitors\b/gi, 'DELETE FROM ede_competitors');
  pgSql = pgSql.replace(/\bFROM\s+clients\b/gi, 'FROM ede_clients');
  pgSql = pgSql.replace(/\bINTO\s+clients\b/gi, 'INTO ede_clients');
  pgSql = pgSql.replace(/\bUPDATE\s+clients\b/gi, 'UPDATE ede_clients');
  pgSql = pgSql.replace(/\bDELETE\s+FROM\s+clients\b/gi, 'DELETE FROM ede_clients');
  pgSql = pgSql.replace(/\bFROM\s+users\b/gi, 'FROM ede_users');
  pgSql = pgSql.replace(/\bINTO\s+users\b/gi, 'INTO ede_users');
  pgSql = pgSql.replace(/\bUPDATE\s+users\b/gi, 'UPDATE ede_users');
  pgSql = pgSql.replace(/\bDELETE\s+FROM\s+users\b/gi, 'DELETE FROM ede_users');
  pgSql = pgSql.replace(/\bFROM\s+company_info\b/gi, 'FROM ede_company_info');
  pgSql = pgSql.replace(/\bINTO\s+company_info\b/gi, 'INTO ede_company_info');
  pgSql = pgSql.replace(/\bUPDATE\s+company_info\b/gi, 'UPDATE ede_company_info');
  pgSql = pgSql.replace(/\bFROM\s+feedback\b/gi, 'FROM ede_feedback');
  pgSql = pgSql.replace(/\bINTO\s+feedback\b/gi, 'INTO ede_feedback');
  
  const result = await pool.query(pgSql, params);
  return { changes: result.rowCount, lastID: result.rows?.[0]?.id };
}

// Initialize database (tables already created by bulk import)
export async function initDatabase() {
  const pool = getPool();
  if (!pool) {
    console.log('⚠️ DATABASE_URL not set, using mock mode');
    return false;
  }
  
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to Neon PostgreSQL');
    
    // Verify tables exist
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'ede_%'
    `);
    console.log(`📋 Found ${tables.rows.length} EDE tables`);
    
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return false;
  }
}

export default { all, get, run, initDatabase, getPool };
