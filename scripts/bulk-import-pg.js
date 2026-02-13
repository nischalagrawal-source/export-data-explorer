/**
 * Bulk Import Script for Export Data Explorer - PostgreSQL/Neon Version
 * Imports all 24 Excel files (12 months × 2 categories) into the database
 * 
 * Run: node scripts/bulk-import-pg.js
 */

import pg from 'pg';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database setup
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not set in .env file');
  process.exit(1);
}

console.log('🔗 Connecting to Neon PostgreSQL...');

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

// Initialize database tables
async function initDb() {
  console.log('🔧 Initializing database tables...');
  
  const client = await pool.connect();
  
  try {
    // Create exports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ede_exports (
        id SERIAL PRIMARY KEY,
        declaration_id TEXT NOT NULL,
        exporter_name TEXT,
        consignee_name TEXT,
        product_description TEXT,
        product_category TEXT,
        data_type TEXT,
        hs_code TEXT,
        quantity REAL,
        unit TEXT,
        fob_value REAL,
        fob_currency TEXT DEFAULT 'USD',
        port_of_loading TEXT,
        port_of_discharge TEXT,
        country_of_destination TEXT,
        shipment_date DATE,
        month_year TEXT,
        upload_batch TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ ede_exports table created');

    // Create competitors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ede_competitors (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active INTEGER DEFAULT 1
      )
    `);
    console.log('   ✅ ede_competitors table created');

    // Create clients table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ede_clients (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active INTEGER DEFAULT 1
      )
    `);
    console.log('   ✅ ede_clients table created');

    // Create company_info table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ede_company_info (
        id SERIAL PRIMARY KEY,
        company_name TEXT NOT NULL DEFAULT 'AGNA',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ ede_company_info table created');

    // Create feedback table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ede_feedback (
        id SERIAL PRIMARY KEY,
        user_name TEXT,
        feedback_type TEXT,
        message TEXT NOT NULL,
        page TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ ede_feedback table created');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ede_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'user', 'demo')) DEFAULT 'user',
        full_name TEXT,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);
    console.log('   ✅ ede_users table created');

    // Insert default company if not exists
    const companyResult = await client.query('SELECT COUNT(*) as count FROM ede_company_info');
    if (parseInt(companyResult.rows[0].count) === 0) {
      await client.query(
        'INSERT INTO ede_company_info (company_name) VALUES ($1)',
        ['AGNA ORG AGROVILLA INDIA PRIVATE LIMITED']
      );
      console.log('   ✅ Default company info added');
    }

    // Create default admin account if no users exist
    const userResult = await client.query('SELECT COUNT(*) as count FROM ede_users');
    if (parseInt(userResult.rows[0].count) === 0) {
      const adminPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO ede_users (username, password_hash, role, full_name) VALUES ($1, $2, $3, $4)',
        ['admin', adminPassword, 'admin', 'Administrator']
      );
      console.log('   ✅ Default admin account created (username: admin, password: admin123)');
    }

    // Create demo account if not exists
    const demoResult = await client.query('SELECT COUNT(*) as count FROM ede_users WHERE username = $1', ['demo']);
    if (parseInt(demoResult.rows[0].count) === 0) {
      const demoPassword = await bcrypt.hash('demo-readonly-' + Date.now(), 10);
      await client.query(
        'INSERT INTO ede_users (username, password_hash, role, full_name) VALUES ($1, $2, $3, $4)',
        ['demo', demoPassword, 'demo', 'Demo User']
      );
      console.log('   ✅ Demo account created (use "Try Demo" button on login page)');
    }

    // Create indexes for better performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_exports_exporter ON ede_exports(exporter_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_exports_consignee ON ede_exports(consignee_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_exports_data_type ON ede_exports(data_type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_exports_month_year ON ede_exports(month_year)');
    console.log('   ✅ Indexes created');

    console.log('✅ Database initialized successfully\n');
  } finally {
    client.release();
  }
}

// Parse a row into values
function parseRow(row, dataType, uploadBatch) {
  const declarationId = row['Declaration No'] || row['Declaration ID'] || row['DECLARATION_ID'] || '';
  const exporterName = row['Exporter Name'] || row['EXPORTER_NAME'] || '';
  const consigneeName = row['Consinee Name'] || row['Consignee Name'] || row['CONSIGNEE_NAME'] || '';
  const productDesc = row['Goods Description'] || row['Product Description'] || row['PRODUCT_DESCRIPTION'] || '';
  const hsCode = row['HS Code'] || row['HS_CODE'] || '';
  const quantity = parseFloat(row['Quantity'] || row['QUANTITY'] || 0) || 0;
  const unit = row['Unit'] || row['UNIT'] || 'KGS';
  const fobValue = parseFloat(String(row['Fob Usd'] || row['FOB Value'] || row['FOB_VALUE'] || 0).replace(/[^0-9.-]/g, '')) || 0;
  const fobCurrency = row['Currency'] || row['CURRENCY'] || 'USD';
  const portLoading = row['Indian Port'] || row['Port of Loading'] || row['PORT_OF_LOADING'] || '';
  const portDischarge = row['Destination Port'] || row['Port of Discharge'] || row['PORT_OF_DISCHARGE'] || '';
  const countryDest = row['Country'] || row['COUNTRY'] || '';
  
  // Parse date
  let shipmentDate = null, monthYear = null;
  const dateValue = row['Date'] || row['Shipment Date'] || row['SHIPMENT_DATE'];
  if (dateValue) {
    if (typeof dateValue === 'number') {
      const date = XLSX.SSF.parse_date_code(dateValue);
      if (date) {
        shipmentDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        monthYear = `${date.y}-${String(date.m).padStart(2, '0')}`;
      }
    } else {
      const dateStr = String(dateValue);
      let parsed = new Date(dateStr);
      if (isNaN(parsed)) {
        const parts = dateStr.split(/[-\/]/);
        if (parts.length === 3) parsed = new Date(parts[2], parts[1] - 1, parts[0]);
      }
      if (!isNaN(parsed) && parsed.getFullYear() > 1900) {
        shipmentDate = parsed.toISOString().split('T')[0];
        monthYear = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      }
    }
  }

  let uniqueId = declarationId;
  if (!uniqueId || uniqueId === '') {
    const composite = `${exporterName}-${consigneeName}-${productDesc}-${dateValue}-${fobValue}`;
    if (composite !== '----0') {
      uniqueId = `AUTO-${Buffer.from(composite).toString('base64').slice(0, 20)}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  if (!uniqueId || uniqueId === '') {
    return null;
  }

  return [
    uniqueId.toString().trim(),
    (exporterName || '').toString().trim().toUpperCase(),
    (consigneeName || '').toString().trim().toUpperCase(),
    (productDesc || '').toString().trim(),
    dataType,
    dataType,
    String(hsCode || '').trim(),
    quantity || 0,
    (unit || 'KGS').toString().trim(),
    fobValue || 0,
    (fobCurrency || 'USD').toString().trim(),
    (portLoading || '').toString().trim(),
    (portDischarge || '').toString().trim(),
    (countryDest || '').toString().trim(),
    shipmentDate,
    monthYear,
    uploadBatch
  ];
}

// Process a single Excel file with batch inserts
async function processExcelFile(filePath, dataType) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Processing: ${fileName} (${dataType})`);
  
  const client = await pool.connect();
  
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      console.log(`   ⚠️ Empty file: ${fileName}`);
      return { inserted: 0, skipped: 0, total: 0 };
    }

    console.log(`   📊 Rows in file: ${data.length}`);
    
    const uploadBatch = `bulk-${Date.now()}-${dataType}-${fileName}`;
    let inserted = 0, skipped = 0;

    // Parse all rows first
    const rows = [];
    for (const row of data) {
      const values = parseRow(row, dataType, uploadBatch);
      if (values) {
        rows.push(values);
      } else {
        skipped++;
      }
    }

    // Batch insert using COPY-like approach (multiple VALUES in single INSERT)
    const BATCH_SIZE = 100;
    const insertSql = `INSERT INTO ede_exports (declaration_id, exporter_name, consignee_name, product_description,
      product_category, data_type, hs_code, quantity, unit, fob_value, fob_currency, port_of_loading,
      port_of_discharge, country_of_destination, shipment_date, month_year, upload_batch)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      try {
        await client.query('BEGIN');
        for (const args of batch) {
          await client.query(insertSql, args);
        }
        await client.query('COMMIT');
        inserted += batch.length;
      } catch (e) {
        await client.query('ROLLBACK');
        // Try individual inserts
        for (const args of batch) {
          try {
            await client.query(insertSql, args);
            inserted++;
          } catch (err) {
            skipped++;
          }
        }
      }
      
      // Progress indicator
      if (rows.length > 500 && (i + BATCH_SIZE) % 1000 === 0) {
        process.stdout.write(`   Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
      }
    }

    console.log(`   ✅ Inserted: ${inserted}, Skipped: ${skipped}, Total rows: ${data.length}`);
    return { inserted, skipped, total: data.length };
  } catch (err) {
    console.error(`   ❌ Error processing ${fileName}:`, err.message);
    return { inserted: 0, skipped: 0, total: 0, error: err.message };
  } finally {
    client.release();
  }
}

// Find all Excel files in Data folder
function findExcelFiles(dataDir) {
  const files = [];
  
  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls'))) {
        let dataType = null;
        if (entry.name.startsWith('07')) {
          dataType = 'vegetables';
        } else if (entry.name.startsWith('08')) {
          dataType = 'fruits';
        }
        
        if (dataType) {
          files.push({ path: fullPath, fileName: entry.name, dataType });
        }
      }
    }
  }
  
  scanDirectory(dataDir);
  return files;
}

// Main import function
async function bulkImport() {
  console.log('🚀 Starting Bulk Import Process (PostgreSQL/Neon)');
  console.log('=================================================\n');
  
  const startTime = Date.now();
  
  // Test connection
  try {
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Connected to Neon PostgreSQL');
    console.log(`   Server time: ${testResult.rows[0].now}\n`);
  } catch (err) {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  }
  
  // Initialize database
  await initDb();
  
  // Clear existing data if requested
  const args = process.argv.slice(2);
  if (args.includes('--clear')) {
    console.log('🗑️ Clearing existing export data...');
    await pool.query('DELETE FROM ede_exports');
    console.log('✅ Export data cleared\n');
  }
  
  // Get current record count
  const beforeResult = await pool.query('SELECT COUNT(*) as count FROM ede_exports');
  const beforeCount = parseInt(beforeResult.rows[0].count) || 0;
  console.log(`📊 Current records in database: ${beforeCount}`);
  
  // Find all Excel files
  const dataDir = path.join(__dirname, '..', 'Data');
  console.log(`\n📁 Scanning: ${dataDir}`);
  
  const files = findExcelFiles(dataDir);
  
  if (files.length === 0) {
    console.log('\n⚠️ No Excel files found in Data folder!');
    await pool.end();
    return;
  }
  
  // Group files by type
  const vegetableFiles = files.filter(f => f.dataType === 'vegetables');
  const fruitFiles = files.filter(f => f.dataType === 'fruits');
  
  console.log(`\n📋 Found ${files.length} files:`);
  console.log(`   🥬 Vegetables (07_*): ${vegetableFiles.length} files`);
  console.log(`   🍎 Fruits (08_*): ${fruitFiles.length} files`);
  
  // Sort files by name
  files.sort((a, b) => a.fileName.localeCompare(b.fileName));
  
  // Process all files
  let totalInserted = 0, totalSkipped = 0, totalRows = 0;
  
  console.log('\n📥 Processing files...');
  console.log('========================');
  
  for (const file of files) {
    const result = await processExcelFile(file.path, file.dataType);
    totalInserted += result.inserted;
    totalSkipped += result.skipped;
    totalRows += result.total;
  }
  
  // Get final record count
  const afterResult = await pool.query('SELECT COUNT(*) as count FROM ede_exports');
  const afterCount = parseInt(afterResult.rows[0].count) || 0;
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Summary
  console.log('\n\n📊 IMPORT SUMMARY');
  console.log('==================');
  console.log(`Total files processed: ${files.length}`);
  console.log(`Total rows in files: ${totalRows}`);
  console.log(`Successfully inserted: ${totalInserted}`);
  console.log(`Skipped: ${totalSkipped}`);
  console.log(`\nDatabase records before: ${beforeCount}`);
  console.log(`Database records after: ${afterCount}`);
  console.log(`New records added: ${afterCount - beforeCount}`);
  console.log(`\n⏱️ Time taken: ${duration} seconds`);
  
  // Show breakdown by category
  const byCatResult = await pool.query('SELECT data_type, COUNT(*) as count, SUM(fob_value) as total_fob FROM ede_exports GROUP BY data_type');
  console.log('\n📈 Records by Category:');
  for (const cat of byCatResult.rows) {
    const emoji = cat.data_type === 'fruits' ? '🍎' : '🥬';
    console.log(`   ${emoji} ${cat.data_type}: ${cat.count} records, $${Number(cat.total_fob || 0).toLocaleString()} FOB`);
  }
  
  // Show breakdown by month
  const byMonthResult = await pool.query('SELECT month_year, COUNT(*) as count FROM ede_exports WHERE month_year IS NOT NULL GROUP BY month_year ORDER BY month_year');
  console.log('\n📅 Records by Month:');
  for (const month of byMonthResult.rows) {
    console.log(`   ${month.month_year}: ${month.count} records`);
  }
  
  console.log('\n✅ Bulk import complete!');
  console.log('\n📌 Login credentials:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  
  await pool.end();
}

// Run the import
bulkImport().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
