/**
 * FAST Bulk Import Script for PostgreSQL/Neon
 * Uses multi-row INSERT statements for much faster imports
 * 
 * Run: node scripts/bulk-import-pg-fast.js --clear
 */

import pg from 'pg';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

console.log('🔗 Connecting to Neon PostgreSQL...');

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 5
});

// Initialize database tables
async function initDb() {
  console.log('🔧 Initializing database tables...');
  const client = await pool.connect();
  
  try {
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (declaration_id, data_type)
      )
    `);

    await client.query(`CREATE TABLE IF NOT EXISTS ede_competitors (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, active INTEGER DEFAULT 1)`);
    await client.query(`CREATE TABLE IF NOT EXISTS ede_clients (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, active INTEGER DEFAULT 1)`);
    await client.query(`CREATE TABLE IF NOT EXISTS ede_company_info (id SERIAL PRIMARY KEY, company_name TEXT NOT NULL DEFAULT 'AGNA', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE IF NOT EXISTS ede_feedback (id SERIAL PRIMARY KEY, user_name TEXT, feedback_type TEXT, message TEXT NOT NULL, page TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE IF NOT EXISTS ede_users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT CHECK(role IN ('admin', 'user', 'demo')) DEFAULT 'user', full_name TEXT, active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_login TIMESTAMP)`);

    const companyResult = await client.query('SELECT COUNT(*) as count FROM ede_company_info');
    if (parseInt(companyResult.rows[0].count) === 0) {
      await client.query('INSERT INTO ede_company_info (company_name) VALUES ($1)', ['AGNA ORG AGROVILLA INDIA PRIVATE LIMITED']);
    }

    const userResult = await client.query('SELECT COUNT(*) as count FROM ede_users');
    if (parseInt(userResult.rows[0].count) === 0) {
      const adminPassword = await bcrypt.hash('admin123', 10);
      await client.query('INSERT INTO ede_users (username, password_hash, role, full_name) VALUES ($1, $2, $3, $4)', ['admin', adminPassword, 'admin', 'Administrator']);
      console.log('   ✅ Admin account created (admin / admin123)');
    }

    await client.query('CREATE INDEX IF NOT EXISTS idx_exports_exporter ON ede_exports(exporter_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_exports_consignee ON ede_exports(consignee_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_exports_data_type ON ede_exports(data_type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_exports_month_year ON ede_exports(month_year)');

    console.log('✅ Database initialized\n');
  } finally {
    client.release();
  }
}

function parseRow(row, dataType, uploadBatch) {
  const declarationId = row['Declaration No'] || row['Declaration ID'] || '';
  const exporterName = row['Exporter Name'] || '';
  const consigneeName = row['Consinee Name'] || row['Consignee Name'] || '';
  const productDesc = row['Goods Description'] || row['Product Description'] || '';
  const hsCode = row['HS Code'] || '';
  const quantity = parseFloat(row['Quantity'] || 0) || 0;
  const unit = row['Unit'] || 'KGS';
  const fobValue = parseFloat(String(row['Fob Usd'] || row['FOB Value'] || 0).replace(/[^0-9.-]/g, '')) || 0;
  const fobCurrency = row['Currency'] || 'USD';
  const portLoading = row['Indian Port'] || row['Port of Loading'] || '';
  const portDischarge = row['Destination Port'] || row['Port of Discharge'] || '';
  const countryDest = row['Country'] || '';
  
  let shipmentDate = null, monthYear = null;
  const dateValue = row['Date'] || row['Shipment Date'];
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
  if (!uniqueId) {
    const composite = `${exporterName}-${consigneeName}-${productDesc}-${dateValue}-${fobValue}`;
    if (composite !== '----0') {
      uniqueId = `AUTO-${Buffer.from(composite).toString('base64').slice(0, 20)}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  if (!uniqueId) return null;

  return {
    declaration_id: uniqueId.toString().trim(),
    exporter_name: (exporterName || '').toString().trim().toUpperCase(),
    consignee_name: (consigneeName || '').toString().trim().toUpperCase(),
    product_description: (productDesc || '').toString().trim(),
    product_category: dataType,
    data_type: dataType,
    hs_code: String(hsCode || '').trim(),
    quantity: quantity || 0,
    unit: (unit || 'KGS').toString().trim(),
    fob_value: fobValue || 0,
    fob_currency: (fobCurrency || 'USD').toString().trim(),
    port_of_loading: (portLoading || '').toString().trim(),
    port_of_discharge: (portDischarge || '').toString().trim(),
    country_of_destination: (countryDest || '').toString().trim(),
    shipment_date: shipmentDate,
    month_year: monthYear,
    upload_batch: uploadBatch
  };
}

// Bulk insert with multi-row VALUES
async function bulkInsert(client, rows) {
  if (rows.length === 0) return 0;
  
  const columns = ['declaration_id', 'exporter_name', 'consignee_name', 'product_description', 
    'product_category', 'data_type', 'hs_code', 'quantity', 'unit', 'fob_value', 'fob_currency',
    'port_of_loading', 'port_of_discharge', 'country_of_destination', 'shipment_date', 'month_year', 'upload_batch'];
  
  const values = [];
  const params = [];
  let paramIndex = 1;
  
  for (const row of rows) {
    const rowPlaceholders = [];
    for (const col of columns) {
      params.push(row[col]);
      rowPlaceholders.push(`$${paramIndex++}`);
    }
    values.push(`(${rowPlaceholders.join(', ')})`);
  }
  
  const sql = `INSERT INTO ede_exports (${columns.join(', ')}) VALUES ${values.join(', ')}`;
  
  await client.query(sql, params);
  return rows.length;
}

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
      console.log(`   ⚠️ Empty file`);
      return { inserted: 0, skipped: 0, total: 0 };
    }

    console.log(`   📊 Rows: ${data.length}`);
    
    const uploadBatch = `bulk-${Date.now()}-${dataType}`;
    let inserted = 0, skipped = 0;

    // Parse all rows
    const rows = [];
    for (const row of data) {
      const parsed = parseRow(row, dataType, uploadBatch);
      if (parsed) {
        rows.push(parsed);
      } else {
        skipped++;
      }
    }

    // Bulk insert in batches of 500 rows (single INSERT per batch)
    const BATCH_SIZE = 500;
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      try {
        const count = await bulkInsert(client, batch);
        inserted += count;
      } catch (e) {
        console.error(`   ⚠️ Batch error at ${i}: ${e.message.slice(0, 100)}`);
        skipped += batch.length;
      }
      
      if ((i + BATCH_SIZE) % 5000 === 0 || i + BATCH_SIZE >= rows.length) {
        process.stdout.write(`   Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
      }
    }

    console.log(`   ✅ Inserted: ${inserted}, Skipped: ${skipped}`);
    return { inserted, skipped, total: data.length };
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return { inserted: 0, skipped: 0, total: 0 };
  } finally {
    client.release();
  }
}

function findExcelFiles(dataDir) {
  const files = [];
  
  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls'))) {
        let dataType = null;
        if (entry.name.startsWith('07')) dataType = 'vegetables';
        else if (entry.name.startsWith('08')) dataType = 'fruits';
        if (dataType) files.push({ path: fullPath, fileName: entry.name, dataType });
      }
    }
  }
  
  scan(dataDir);
  return files;
}

async function main() {
  console.log('🚀 FAST Bulk Import (PostgreSQL/Neon)');
  console.log('=====================================\n');
  
  const startTime = Date.now();
  
  try {
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Connected to Neon PostgreSQL\n');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
  
  await initDb();
  
  if (process.argv.includes('--clear')) {
    console.log('🗑️ Clearing existing data...');
    await pool.query('DELETE FROM ede_exports');
    console.log('✅ Cleared\n');
  }
  
  const beforeResult = await pool.query('SELECT COUNT(*) as count FROM ede_exports');
  console.log(`📊 Current records: ${beforeResult.rows[0].count}`);
  
  const dataDir = path.join(__dirname, '..', 'Data');
  const files = findExcelFiles(dataDir);
  
  if (files.length === 0) {
    console.log('\n⚠️ No Excel files found!');
    await pool.end();
    return;
  }
  
  console.log(`\n📋 Found ${files.length} files`);
  files.sort((a, b) => a.fileName.localeCompare(b.fileName));
  
  let totalInserted = 0, totalSkipped = 0, totalRows = 0;
  
  for (const file of files) {
    const result = await processExcelFile(file.path, file.dataType);
    totalInserted += result.inserted;
    totalSkipped += result.skipped;
    totalRows += result.total;
  }
  
  const afterResult = await pool.query('SELECT COUNT(*) as count FROM ede_exports');
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n\n📊 IMPORT SUMMARY');
  console.log('==================');
  console.log(`Files: ${files.length}`);
  console.log(`Total rows: ${totalRows}`);
  console.log(`Inserted: ${totalInserted}`);
  console.log(`Skipped: ${totalSkipped}`);
  console.log(`Final count: ${afterResult.rows[0].count}`);
  console.log(`Time: ${duration} minutes`);
  
  const byCat = await pool.query('SELECT data_type, COUNT(*) as count, SUM(fob_value) as fob FROM ede_exports GROUP BY data_type');
  console.log('\n📈 By Category:');
  for (const r of byCat.rows) {
    console.log(`   ${r.data_type}: ${r.count} records, $${Number(r.fob || 0).toLocaleString()} FOB`);
  }
  
  console.log('\n✅ Import complete!');
  console.log('\n📌 Login: admin / admin123');
  
  await pool.end();
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
