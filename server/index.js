import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import XLSX from 'xlsx';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// NOTE: Static files are served AFTER all API routes (at the end of file)
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');

// Uploads directory (for local dev, not used on Render)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config - use memory storage for cloud deployment (no disk needed)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Database setup - Turso (cloud SQLite)
// Set these environment variables:
// TURSO_DATABASE_URL - Your Turso database URL
// TURSO_AUTH_TOKEN - Your Turso auth token
const dbUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log('📁 Database URL:', dbUrl.includes('turso') ? 'Turso Cloud' : 'Local SQLite');
console.log('🔑 Auth Token:', authToken ? 'Set' : 'NOT SET');

let db;
let dbInitialized = false;

// Debug endpoint - placed before other routes
app.get('/api/debug', (req, res) => {
  res.json({
    status: 'ok',
    database: dbUrl.includes('turso') ? 'Turso Cloud' : 'Local SQLite',
    dbInitialized,
    authToken: authToken ? 'Set' : 'NOT SET',
    nodeEnv: process.env.NODE_ENV,
    uploadsDir: uploadsDir
  });
});

// Helper to run queries (async)
const run = async (sql, params = []) => {
  try {
    await db.execute({ sql, args: params });
  } catch (err) {
    throw err;
  }
};

const get = async (sql, params = []) => {
  try {
    const result = await db.execute({ sql, args: params });
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error('DB get error:', err.message);
    return null;
  }
};

const all = async (sql, params = []) => {
  try {
    const result = await db.execute({ sql, args: params });
    return result.rows;
  } catch (err) {
    console.error('DB all error:', err.message);
    return [];
  }
};

// Initialize database
async function initDb() {
  // Create Turso client
  db = createClient({
    url: dbUrl,
    authToken: authToken
  });

  // Initialize tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS competitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      active INTEGER DEFAULT 1
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      active INTEGER DEFAULT 1
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id TEXT NOT NULL,
      exporter_name TEXT,
      consignee_name TEXT,
      product_description TEXT,
      product_category TEXT,
      data_type TEXT CHECK(data_type IN ('fruits', 'vegetables')),
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create unique index on declaration_id + shipment_date + product_description + data_type
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exports_unique 
    ON exports(declaration_id, shipment_date, product_description, hs_code, quantity, fob_value)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS company_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL DEFAULT 'AGNA',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_exports_exporter ON exports(exporter_name)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_exports_consignee ON exports(consignee_name)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_exports_date ON exports(shipment_date)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_exports_month ON exports(month_year)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_exports_declaration ON exports(declaration_id)`);

  // Create feedback table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT,
      feedback_type TEXT,
      message TEXT NOT NULL,
      page TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default company if not exists
  const companyExists = await get('SELECT COUNT(*) as count FROM company_info');
  if (!companyExists || companyExists.count === 0) {
    await run('INSERT INTO company_info (company_name) VALUES (?)', ['AGNA ORG AGROVILLA INDIA PRIVATE LIMITED']);
  }

  console.log('📦 Database initialized');
}

// ============= COMPETITORS ROUTES =============
app.get('/api/competitors', async (req, res) => {
  const competitors = await all('SELECT * FROM competitors WHERE active = 1 ORDER BY name');
  res.json(competitors);
});

// Search for potential competitor matches in export data
app.get('/api/competitors/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json([]);
  }
  
  const searchTerm = q.trim().toUpperCase();
  const words = searchTerm.split(/\s+/).filter(w => w.length > 1);
  
  // Search for exporters matching any of the words
  let query = `
    SELECT DISTINCT exporter_name as name, 
           COUNT(*) as shipment_count,
           SUM(fob_value) as total_fob
    FROM exports 
    WHERE exporter_name IS NOT NULL AND exporter_name != ''
  `;
  
  if (words.length > 0) {
    const conditions = words.map(() => `UPPER(exporter_name) LIKE ?`).join(' OR ');
    query += ` AND (${conditions})`;
  }
  
  query += ` GROUP BY exporter_name ORDER BY shipment_count DESC LIMIT 20`;
  
  const params = words.map(w => `%${w}%`);
  const results = await all(query, params);
  
  // Also check if already tracked
  const tracked = await all('SELECT name FROM competitors WHERE active = 1');
  const trackedNames = new Set(tracked.map(t => t.name));
  
  const enriched = results.map(r => ({
    ...r,
    already_tracked: trackedNames.has(r.name)
  }));
  
  res.json(enriched);
});

app.post('/api/competitors', async (req, res) => {
  const { name, names } = req.body;
  
  // Support adding multiple names at once
  const namesToAdd = names || [name];
  const added = [];
  const errors = [];
  
  for (const n of namesToAdd) {
    if (!n || !n.trim()) continue;
    try {
      await run('INSERT INTO competitors (name) VALUES (?)', [n.trim().toUpperCase()]);
      const result = await get('SELECT last_insert_rowid() as id');
      added.push({ id: result?.id, name: n.trim().toUpperCase() });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        errors.push({ name: n, error: 'Already exists' });
      } else {
        errors.push({ name: n, error: err.message });
      }
    }
  }
  
  res.json({ added, errors });
});

app.delete('/api/competitors/:id', async (req, res) => {
  await run('UPDATE competitors SET active = 0 WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ success: true });
});

// ============= CLIENTS ROUTES =============
app.get('/api/clients', async (req, res) => {
  const clients = await all('SELECT * FROM clients WHERE active = 1 ORDER BY name');
  res.json(clients);
});

// Search for potential client matches in export data
app.get('/api/clients/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json([]);
  }
  
  const searchTerm = q.trim().toUpperCase();
  const words = searchTerm.split(/\s+/).filter(w => w.length > 1);
  
  // Search for consignees matching any of the words
  let query = `
    SELECT DISTINCT consignee_name as name, 
           COUNT(*) as shipment_count,
           SUM(fob_value) as total_fob,
           GROUP_CONCAT(DISTINCT country_of_destination) as countries
    FROM exports 
    WHERE consignee_name IS NOT NULL AND consignee_name != ''
  `;
  
  if (words.length > 0) {
    const conditions = words.map(() => `UPPER(consignee_name) LIKE ?`).join(' OR ');
    query += ` AND (${conditions})`;
  }
  
  query += ` GROUP BY consignee_name ORDER BY shipment_count DESC LIMIT 20`;
  
  const params = words.map(w => `%${w}%`);
  const results = await all(query, params);
  
  // Also check if already tracked
  const tracked = await all('SELECT name FROM clients WHERE active = 1');
  const trackedNames = new Set(tracked.map(t => t.name));
  
  const enriched = results.map(r => ({
    ...r,
    already_tracked: trackedNames.has(r.name)
  }));
  
  res.json(enriched);
});

app.post('/api/clients', async (req, res) => {
  const { name, names } = req.body;
  
  // Support adding multiple names at once
  const namesToAdd = names || [name];
  const added = [];
  const errors = [];
  
  for (const n of namesToAdd) {
    if (!n || !n.trim()) continue;
    try {
      await run('INSERT INTO clients (name) VALUES (?)', [n.trim().toUpperCase()]);
      const result = await get('SELECT last_insert_rowid() as id');
      added.push({ id: result?.id, name: n.trim().toUpperCase() });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        errors.push({ name: n, error: 'Already exists' });
      } else {
        errors.push({ name: n, error: err.message });
      }
    }
  }
  
  res.json({ added, errors });
});

app.delete('/api/clients/:id', async (req, res) => {
  await run('UPDATE clients SET active = 0 WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ success: true });
});

// ============= COMPANY ROUTES =============
app.get('/api/company', async (req, res) => {
  const company = await get('SELECT * FROM company_info LIMIT 1');
  res.json(company);
});

app.put('/api/company', async (req, res) => {
  const { company_name } = req.body;
  await run('UPDATE company_info SET company_name = ?', [company_name.trim().toUpperCase()]);
  res.json({ success: true });
});

// Helper function to find column value with flexible matching
const findColumnValue = (row, possibleNames) => {
  const rowKeys = Object.keys(row);
  
  // Build a map of normalized key names to actual keys
  const keyMap = {};
  for (const key of rowKeys) {
    const normalized = key.toLowerCase().replace(/[\s_-]+/g, '');
    keyMap[normalized] = key;
  }
  
  // Try each possible name
  for (const name of possibleNames) {
    // Direct match
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
      return row[name];
    }
    
    // Normalized match
    const normalizedName = name.toLowerCase().replace(/[\s_-]+/g, '');
    if (keyMap[normalizedName]) {
      const val = row[keyMap[normalizedName]];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return val;
      }
    }
  }
  
  // Partial match - check if any key contains any of the possible names
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().replace(/[\s_-]+/g, '');
    for (const [normalized, actualKey] of Object.entries(keyMap)) {
      if (normalized.includes(normalizedName) || normalizedName.includes(normalized)) {
        const val = row[actualKey];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return val;
        }
      }
    }
  }
  
  return '';
};

// ============= FILE UPLOAD ROUTE =============
app.post('/api/upload', upload.single('file'), async (req, res) => {
  console.log('📤 Upload request received');
  
  if (!req.file) {
    console.log('❌ No file in request');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  console.log(`📁 File received: ${req.file.originalname}, size: ${req.file.size} bytes`);

  const { dataType } = req.body;
  if (!dataType || !['fruits', 'vegetables'].includes(dataType)) {
    return res.status(400).json({ error: 'Invalid data type. Must be "fruits" or "vegetables"' });
  }

  try {
    // Read from buffer (memory) instead of disk
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Parsed ${data.length} rows from Excel`);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    // Get column names from first row
    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    console.log('Found columns:', columns);
    
    // Debug: Log first row to see actual data
    if (data.length > 0) {
      console.log('First row sample:', JSON.stringify(data[0], null, 2));
    }

    const uploadBatch = `${Date.now()}-${dataType}`;
    let inserted = 0;
    let skipped = 0;
    let noIdCount = 0;
    
    // Disable auto-save during bulk import for performance
    autoSave = false;

    // Column name variations for Indian export data
    const declarationIdNames = [
      'Declaration ID', 'DECLARATION_ID', 'declaration_id', 'Dec ID',
      'Declaration No', 'DECLARATION_NO', 'declaration_no', 'Declaration_No',
      'DeclarationNo', 'DECLARATIONNO', 'Dec No', 'DEC_NO', 'DecNo',
      'SB No', 'SB_No', 'SB NO', 'SB_NO', 'SBNO', 'Sb No', 
      'Shipping Bill No', 'SHIPPING_BILL_NO', 'Shipping Bill Number',
      'Bill No', 'BILL_NO', 'Bill Number', 'Reference No', 'Ref No',
      'Invoice No', 'INVOICE_NO', 'Invoice Number', 'ID', 'Sr No', 'SrNo',
      'S.No', 'SNO', 'Record ID', 'RECORD_ID', 'Unique ID'
    ];
    
    const exporterNames = [
      'Exporter Name', 'EXPORTER_NAME', 'exporter_name', 'Exporter',
      'EXPORTER', 'Indian Exporter', 'INDIAN_EXPORTER', 'Shipper',
      'SHIPPER', 'Shipper Name', 'Seller', 'SELLER', 'Seller Name',
      'Company', 'Company Name', 'COMPANY_NAME', 'Supplier', 'SUPPLIER'
    ];
    
    const consigneeNames = [
      'Consignee Name', 'CONSIGNEE_NAME', 'consignee_name', 'Consignee',
      'CONSIGNEE', 'Buyer', 'BUYER', 'Buyer Name', 'BUYER_NAME',
      'Foreign Buyer', 'FOREIGN_BUYER', 'Importer', 'IMPORTER',
      'Importer Name', 'Customer', 'CUSTOMER', 'Customer Name',
      'Consinee Name', 'CONSINEE_NAME', 'Consinee', 'CONSINEE'
    ];
    
    const productNames = [
      'Product Description', 'PRODUCT_DESCRIPTION', 'product_description',
      'Product', 'PRODUCT', 'Item', 'ITEM', 'Item Description',
      'ITEM_DESCRIPTION', 'Description', 'DESCRIPTION', 'Goods',
      'GOODS', 'Goods Description', 'GOODS_DESCRIPTION', 'Goods_Description',
      'Product Name', 'PRODUCT_NAME', 'Commodity', 'COMMODITY', 
      'HS Description', 'Item Name', 'ItemDescription'
    ];
    
    const hsCodeNames = [
      'HS Code', 'HS_CODE', 'hs_code', 'HSCode', 'HSCODE', 'HS',
      'ITC Code', 'ITC_CODE', 'ITCCode', 'ITC HS', 'ITC_HS',
      'Tariff Code', 'TARIFF_CODE', 'Chapter', 'CHAPTER'
    ];
    
    const quantityNames = [
      'Quantity', 'QUANTITY', 'quantity', 'Qty', 'QTY', 'qty',
      'Unit Quantity', 'UNIT_QUANTITY', 'Net Quantity', 'NET_QUANTITY',
      'Weight', 'WEIGHT', 'Net Weight', 'NET_WEIGHT', 'Gross Weight'
    ];
    
    const unitNames = [
      'Unit', 'UNIT', 'unit', 'UQC', 'UOM', 'Unit of Measure',
      'UNIT_OF_MEASURE', 'Quantity Unit', 'QUANTITY_UNIT'
    ];
    
    const fobNames = [
      'FOB Value', 'FOB_VALUE', 'fob_value', 'FOB', 'Fob',
      'FOB USD', 'FOB_USD', 'Fob Usd', 'FOB Usd', 'Fob USD',
      'FOB INR', 'FOB_INR', 'Fob Inr', 'Value',
      'VALUE', 'Invoice Value', 'INVOICE_VALUE', 'Total Value',
      'TOTAL_VALUE', 'Amount', 'AMOUNT', 'Price', 'PRICE',
      'Value USD', 'Value INR', 'FOB (USD)', 'FOB (INR)'
    ];
    
    const currencyNames = [
      'Currency', 'CURRENCY', 'currency', 'Curr', 'CURR',
      'Currency Code', 'CURRENCY_CODE'
    ];
    
    const portLoadingNames = [
      'Port of Loading', 'PORT_OF_LOADING', 'port_of_loading',
      'Indian Port', 'INDIAN_PORT', 'Loading Port', 'LOADING_PORT',
      'Port', 'PORT', 'Origin Port', 'ORIGIN_PORT', 'From Port',
      'Departure Port', 'DEPARTURE_PORT', 'POL', 'Port Code'
    ];
    
    const portDischargeNames = [
      'Port of Discharge', 'PORT_OF_DISCHARGE', 'port_of_discharge',
      'Foreign Port', 'FOREIGN_PORT', 'Discharge Port', 'DISCHARGE_PORT',
      'Destination Port', 'DESTINATION_PORT', 'To Port', 'POD',
      'Arrival Port', 'ARRIVAL_PORT', 'Final Port'
    ];
    
    const countryNames = [
      'Country', 'COUNTRY', 'country', 'Destination Country',
      'DESTINATION_COUNTRY', 'Country of Destination', 'COUNTRY_OF_DESTINATION',
      'Destination', 'DESTINATION', 'Foreign Country', 'FOREIGN_COUNTRY',
      'Importing Country', 'IMPORTING_COUNTRY', 'To Country'
    ];
    
    const dateNames = [
      'Shipment Date', 'SHIPMENT_DATE', 'shipment_date', 'Date', 'DATE',
      'SB Date', 'SB_DATE', 'Shipping Date', 'SHIPPING_DATE',
      'Bill Date', 'BILL_DATE', 'Export Date', 'EXPORT_DATE',
      'Invoice Date', 'INVOICE_DATE', 'Dispatch Date', 'DISPATCH_DATE'
    ];

    let debugCount = 0;
    let progressCount = 0;
    const totalRows = data.length;
    
    // Process in batches for better performance
    console.log(`Processing ${totalRows} rows...`);
    
    for (const row of data) {
      progressCount++;
      if (progressCount % 5000 === 0) {
        console.log(`Progress: ${progressCount}/${totalRows} rows processed (${inserted} inserted, ${skipped} skipped)...`);
      }
      // Map Excel columns to database fields using flexible matching
      const declarationId = findColumnValue(row, declarationIdNames);
      const exporterName = findColumnValue(row, exporterNames);
      const consigneeName = findColumnValue(row, consigneeNames);
      const productDesc = findColumnValue(row, productNames);
      const hsCode = findColumnValue(row, hsCodeNames);
      const quantity = parseFloat(findColumnValue(row, quantityNames) || 0);
      const unit = findColumnValue(row, unitNames) || 'KGS';
      const fobValue = parseFloat(String(findColumnValue(row, fobNames) || 0).replace(/[^0-9.-]/g, '')) || 0;
      const fobCurrency = findColumnValue(row, currencyNames) || 'USD';
      const portLoading = findColumnValue(row, portLoadingNames);
      const portDischarge = findColumnValue(row, portDischargeNames);
      const countryDest = findColumnValue(row, countryNames);
      
      // Debug first 3 rows
      if (debugCount < 3) {
        console.log(`Row ${debugCount + 1} extracted values:`, {
          declarationId,
          exporterName,
          consigneeName,
          productDesc: productDesc?.substring(0, 50),
          fobValue,
          hsCode
        });
        debugCount++;
      }
      
      // Parse date
      let shipmentDate = null;
      let monthYear = null;
      const dateValue = findColumnValue(row, dateNames);
      if (dateValue) {
        if (typeof dateValue === 'number') {
          // Excel serial date
          const date = XLSX.SSF.parse_date_code(dateValue);
          if (date) {
            shipmentDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
            monthYear = `${date.y}-${String(date.m).padStart(2, '0')}`;
          }
        } else {
          // Try parsing various date formats
          const dateStr = String(dateValue);
          let parsed = new Date(dateStr);
          
          // Try DD-MM-YYYY or DD/MM/YYYY format
          if (isNaN(parsed)) {
            const parts = dateStr.split(/[-\/]/);
            if (parts.length === 3) {
              // Assume DD-MM-YYYY
              parsed = new Date(parts[2], parts[1] - 1, parts[0]);
            }
          }
          
          if (!isNaN(parsed) && parsed.getFullYear() > 1900) {
            shipmentDate = parsed.toISOString().split('T')[0];
            monthYear = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
          }
        }
      }

      // Use a combination of fields to create unique ID if no declaration ID
      let uniqueId = declarationId;
      if (!uniqueId || uniqueId === '') {
        // Create a composite key from available data
        const composite = `${exporterName}-${consigneeName}-${productDesc}-${dateValue}-${fobValue}`;
        if (composite !== '----0') {
          uniqueId = `AUTO-${Buffer.from(composite).toString('base64').slice(0, 20)}-${Math.random().toString(36).slice(2, 8)}`;
        }
      }

      if (uniqueId && uniqueId !== '') {
        // Try to insert - let database handle duplicates via unique constraint
        try {
          await run(`
            INSERT INTO exports (
              declaration_id, exporter_name, consignee_name, product_description,
              product_category, data_type, hs_code, quantity, unit, fob_value,
              fob_currency, port_of_loading, port_of_discharge, country_of_destination,
              shipment_date, month_year, upload_batch
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
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
          ]);
          inserted++;
        } catch (insertErr) {
          // Log first 5 errors to understand the issue
          if (skipped < 5) {
            console.error(`Insert error for row ${progressCount}:`, insertErr.message);
            console.error('Data:', { uniqueId, exporterName, productDesc: productDesc?.substring(0,30), shipmentDate });
          }
          skipped++;
        }
      } else {
        noIdCount++;
        skipped++;
      }
    }
    
    console.log(`Import complete: ${inserted} inserted, ${skipped} skipped, ${noIdCount} no ID`);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Processed ${data.length} rows`,
      inserted,
      skipped,
      noIdCount,
      dataType,
      columnsFound: columns
    });
  } catch (err) {
    console.error('Upload error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============= ANALYTICS ROUTES =============

// Get available months
app.get('/api/analytics/months', async (req, res) => {
  const months = await all(`
    SELECT DISTINCT month_year FROM exports 
    WHERE month_year IS NOT NULL 
    ORDER BY month_year DESC
  `);
  res.json(months.map(m => m.month_year));
});

// Competitor Analysis
app.get('/api/analytics/competitors', async (req, res) => {
  const { month, compareMonth } = req.query;
  
  const competitors = await all('SELECT name FROM competitors WHERE active = 1');
  const competitorNames = competitors.map(c => c.name);

  if (competitorNames.length === 0) {
    return res.json({ competitors: [], comparison: [] });
  }

  const placeholders = competitorNames.map(() => '?').join(',');
  
  let query = `
    SELECT 
      exporter_name,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(fob_value) as total_fob,
      COUNT(DISTINCT product_description) as product_count,
      COUNT(DISTINCT country_of_destination) as country_count,
      GROUP_CONCAT(DISTINCT data_type) as categories,
      MIN(shipment_date) as first_shipment,
      MAX(shipment_date) as last_shipment
    FROM exports 
    WHERE UPPER(exporter_name) IN (${placeholders})
  `;
  
  const params = [...competitorNames];
  
  if (month) {
    query += ' AND month_year = ?';
    params.push(month);
  }
  
  query += ' GROUP BY exporter_name ORDER BY total_fob DESC';
  
  const results = await all(query, params);

  // Get comparison data if compareMonth provided
  let comparison = [];
  if (compareMonth && month) {
    const compQuery = `
      SELECT 
        exporter_name,
        COUNT(DISTINCT declaration_id) as shipment_count,
        SUM(fob_value) as total_fob
      FROM exports 
      WHERE UPPER(exporter_name) IN (${placeholders})
      AND month_year = ?
      GROUP BY exporter_name
    `;
    comparison = await all(compQuery, [...competitorNames, compareMonth]);
  }

  res.json({ competitors: results, comparison });
});

// Client Analysis
app.get('/api/analytics/clients', async (req, res) => {
  const { month, compareMonth } = req.query;
  
  const clients = await all('SELECT name FROM clients WHERE active = 1');
  const clientNames = clients.map(c => c.name);

  if (clientNames.length === 0) {
    return res.json({ clients: [], comparison: [] });
  }

  const placeholders = clientNames.map(() => '?').join(',');
  
  let query = `
    SELECT 
      consignee_name,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(fob_value) as total_fob,
      COUNT(DISTINCT product_description) as product_count,
      COUNT(DISTINCT exporter_name) as supplier_count,
      GROUP_CONCAT(DISTINCT data_type) as categories,
      MIN(shipment_date) as first_shipment,
      MAX(shipment_date) as last_shipment
    FROM exports 
    WHERE UPPER(consignee_name) IN (${placeholders})
  `;
  
  const params = [...clientNames];
  
  if (month) {
    query += ' AND month_year = ?';
    params.push(month);
  }
  
  query += ' GROUP BY consignee_name ORDER BY total_fob DESC';
  
  const results = await all(query, params);

  // Get comparison data
  let comparison = [];
  if (compareMonth && month) {
    const compQuery = `
      SELECT 
        consignee_name,
        COUNT(DISTINCT declaration_id) as shipment_count,
        SUM(fob_value) as total_fob
      FROM exports 
      WHERE UPPER(consignee_name) IN (${placeholders})
      AND month_year = ?
      GROUP BY consignee_name
    `;
    comparison = await all(compQuery, [...clientNames, compareMonth]);
  }

  res.json({ clients: results, comparison });
});

// AGNA vs Competitors Analysis
app.get('/api/analytics/company-comparison', async (req, res) => {
  const { month } = req.query;
  
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const competitors = await all('SELECT name FROM competitors WHERE active = 1');
  
  const companyName = company?.company_name || 'AGNA';
  const allNames = [companyName, ...competitors.map(c => c.name)];
  const placeholders = allNames.map(() => '?').join(',');
  
  let query = `
    SELECT 
      exporter_name,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(fob_value) as total_fob,
      AVG(fob_value) as avg_fob,
      COUNT(DISTINCT product_description) as product_count,
      COUNT(DISTINCT country_of_destination) as country_count,
      COUNT(DISTINCT consignee_name) as client_count,
      data_type
    FROM exports 
    WHERE UPPER(exporter_name) IN (${placeholders})
  `;
  
  const params = [...allNames];
  
  if (month) {
    query += ' AND month_year = ?';
    params.push(month);
  }
  
  query += ' GROUP BY exporter_name, data_type ORDER BY total_fob DESC';
  
  const results = await all(query, params);
  
  // Aggregate by company
  const aggregated = {};
  results.forEach(r => {
    if (!aggregated[r.exporter_name]) {
      aggregated[r.exporter_name] = {
        exporter_name: r.exporter_name,
        shipment_count: 0,
        total_fob: 0,
        product_count: 0,
        country_count: 0,
        client_count: 0,
        is_company: r.exporter_name === companyName,
        categories: []
      };
    }
    aggregated[r.exporter_name].shipment_count += r.shipment_count;
    aggregated[r.exporter_name].total_fob += r.total_fob;
    aggregated[r.exporter_name].product_count += r.product_count;
    aggregated[r.exporter_name].country_count += r.country_count;
    aggregated[r.exporter_name].client_count += r.client_count;
    if (r.data_type) aggregated[r.exporter_name].categories.push(r.data_type);
  });

  res.json({
    company_name: companyName,
    data: Object.values(aggregated)
  });
});

// Detailed analysis for a specific competitor or client
app.get('/api/analytics/entity-details', async (req, res) => {
  const { entity, type, month } = req.query;
  
  if (!entity || !type) {
    return res.status(400).json({ error: 'Entity and type required' });
  }

  const field = type === 'exporter' ? 'exporter_name' : 'consignee_name';
  const params = [entity.toUpperCase()];
  let monthFilter = '';
  if (month) {
    monthFilter = ' AND month_year = ?';
    params.push(month);
  }

  // Summary stats
  const summary = await get(`
    SELECT 
      COUNT(DISTINCT declaration_id) as total_shipments,
      SUM(fob_value) as total_fob,
      SUM(quantity) as total_quantity,
      COUNT(DISTINCT product_description) as unique_products,
      COUNT(DISTINCT country_of_destination) as unique_countries,
      COUNT(DISTINCT hs_code) as unique_hs_codes,
      MIN(shipment_date) as first_shipment,
      MAX(shipment_date) as last_shipment
    FROM exports 
    WHERE UPPER(${field}) = ?${monthFilter}
  `, params);

  // Products breakdown
  const products = await all(`
    SELECT 
      product_description,
      hs_code,
      data_type,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(quantity) as total_quantity,
      SUM(fob_value) as total_fob,
      AVG(fob_value) as avg_fob_per_shipment,
      unit
    FROM exports 
    WHERE UPPER(${field}) = ?${monthFilter}
    GROUP BY product_description, hs_code, data_type, unit
    ORDER BY total_fob DESC
    LIMIT 50
  `, params);

  // Countries breakdown
  const countries = await all(`
    SELECT 
      country_of_destination,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(quantity) as total_quantity,
      SUM(fob_value) as total_fob
    FROM exports 
    WHERE UPPER(${field}) = ?${monthFilter}
    GROUP BY country_of_destination
    ORDER BY total_fob DESC
  `, params);

  // Ports breakdown
  const ports = await all(`
    SELECT 
      port_of_loading as indian_port,
      port_of_discharge as foreign_port,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(fob_value) as total_fob
    FROM exports 
    WHERE UPPER(${field}) = ?${monthFilter}
    GROUP BY port_of_loading, port_of_discharge
    ORDER BY shipment_count DESC
    LIMIT 20
  `, params);

  // Monthly trend for this entity
  const monthlyTrend = await all(`
    SELECT 
      month_year,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(quantity) as total_quantity,
      SUM(fob_value) as total_fob
    FROM exports 
    WHERE UPPER(${field}) = ? AND month_year IS NOT NULL
    GROUP BY month_year
    ORDER BY month_year
  `, [entity.toUpperCase()]);

  // If it's a client, also get their suppliers
  let suppliers = [];
  if (type === 'consignee') {
    suppliers = await all(`
      SELECT 
        exporter_name,
        COUNT(DISTINCT declaration_id) as shipment_count,
        SUM(fob_value) as total_fob,
        GROUP_CONCAT(DISTINCT product_description) as products
      FROM exports 
      WHERE UPPER(consignee_name) = ?${monthFilter}
      GROUP BY exporter_name
      ORDER BY total_fob DESC
      LIMIT 20
    `, params);
  }

  // If it's an exporter, get their clients
  let clients = [];
  if (type === 'exporter') {
    clients = await all(`
      SELECT 
        consignee_name,
        country_of_destination,
        COUNT(DISTINCT declaration_id) as shipment_count,
        SUM(fob_value) as total_fob
      FROM exports 
      WHERE UPPER(exporter_name) = ?${monthFilter}
      GROUP BY consignee_name, country_of_destination
      ORDER BY total_fob DESC
      LIMIT 20
    `, params);
  }

  // Recent shipments with dates
  const recentShipments = await all(`
    SELECT 
      declaration_id,
      shipment_date,
      product_description,
      quantity,
      unit,
      fob_value,
      country_of_destination,
      consignee_name,
      exporter_name,
      port_of_loading,
      port_of_discharge
    FROM exports 
    WHERE UPPER(${field}) = ?${monthFilter}
    ORDER BY shipment_date DESC
    LIMIT 50
  `, params);

  res.json({
    entity,
    type,
    summary,
    products,
    countries,
    ports,
    monthlyTrend,
    suppliers,
    clients,
    recentShipments
  });
});

// Detailed shipments for a specific entity
app.get('/api/analytics/shipments', async (req, res) => {
  const { entity, type, month, page = 1, limit = 50 } = req.query;
  
  if (!entity || !type) {
    return res.status(400).json({ error: 'Entity and type required' });
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const field = type === 'exporter' ? 'exporter_name' : 'consignee_name';
  
  let query = `
    SELECT * FROM exports 
    WHERE UPPER(${field}) = ?
  `;
  const params = [entity.toUpperCase()];
  
  if (month) {
    query += ' AND month_year = ?';
    params.push(month);
  }
  
  query += ` ORDER BY shipment_date DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);
  
  const shipments = await all(query, params);
  
  // Get total count
  let countQuery = `SELECT COUNT(*) as total FROM exports WHERE UPPER(${field}) = ?`;
  const countParams = [entity.toUpperCase()];
  if (month) {
    countQuery += ' AND month_year = ?';
    countParams.push(month);
  }
  const total = await get(countQuery, countParams);

  res.json({ shipments, total: total?.total || 0, page: parseInt(page), limit: parseInt(limit) });
});

// Product breakdown
app.get('/api/analytics/products', async (req, res) => {
  const { entity, type, month } = req.query;
  
  const field = type === 'exporter' ? 'exporter_name' : 'consignee_name';
  
  let query = `
    SELECT 
      product_description,
      data_type,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(quantity) as total_quantity,
      SUM(fob_value) as total_fob
    FROM exports
  `;
  
  const params = [];
  const conditions = [];
  
  if (entity) {
    conditions.push(`UPPER(${field}) = ?`);
    params.push(entity.toUpperCase());
  }
  
  if (month) {
    conditions.push('month_year = ?');
    params.push(month);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' GROUP BY product_description, data_type ORDER BY total_fob DESC LIMIT 50';
  
  const products = await all(query, params);
  res.json(products);
});

// Country breakdown
app.get('/api/analytics/countries', async (req, res) => {
  const { entity, type, month } = req.query;
  
  const field = type === 'exporter' ? 'exporter_name' : 'consignee_name';
  
  let query = `
    SELECT 
      country_of_destination,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(fob_value) as total_fob
    FROM exports
  `;
  
  const params = [];
  const conditions = [];
  
  if (entity) {
    conditions.push(`UPPER(${field}) = ?`);
    params.push(entity.toUpperCase());
  }
  
  if (month) {
    conditions.push('month_year = ?');
    params.push(month);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' GROUP BY country_of_destination ORDER BY total_fob DESC';
  
  const countries = await all(query, params);
  res.json(countries);
});

// Monthly trends
app.get('/api/analytics/trends', async (req, res) => {
  const { entity, type } = req.query;
  
  let query = `
    SELECT 
      month_year,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(fob_value) as total_fob,
      COUNT(DISTINCT product_description) as product_count
    FROM exports
    WHERE month_year IS NOT NULL
  `;
  
  const params = [];
  
  if (entity && type) {
    const field = type === 'exporter' ? 'exporter_name' : 'consignee_name';
    query += ` AND UPPER(${field}) = ?`;
    params.push(entity.toUpperCase());
  }
  
  query += ' GROUP BY month_year ORDER BY month_year';
  
  const trends = await all(query, params);
  res.json(trends);
});

// Dashboard summary
app.get('/api/analytics/dashboard', async (req, res) => {
  const { month } = req.query;
  
  let whereClause = '';
  const params = [];
  if (month) {
    whereClause = 'WHERE month_year = ?';
    params.push(month);
  }

  const summary = await get(`
    SELECT 
      COUNT(DISTINCT declaration_id) as total_shipments,
      SUM(fob_value) as total_fob,
      COUNT(DISTINCT exporter_name) as unique_exporters,
      COUNT(DISTINCT consignee_name) as unique_consignees,
      COUNT(DISTINCT country_of_destination) as unique_countries,
      COUNT(DISTINCT product_description) as unique_products
    FROM exports ${whereClause}
  `, params);

  const byCategory = await all(`
    SELECT 
      data_type,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(fob_value) as total_fob
    FROM exports ${whereClause}
    GROUP BY data_type
  `, params);

  const topExporters = await all(`
    SELECT 
      exporter_name,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(fob_value) as total_fob
    FROM exports ${whereClause}
    GROUP BY exporter_name
    ORDER BY total_fob DESC
    LIMIT 10
  `, params);

  const topCountries = await all(`
    SELECT 
      country_of_destination,
      COUNT(DISTINCT declaration_id) as shipment_count,
      SUM(fob_value) as total_fob
    FROM exports ${whereClause}
    GROUP BY country_of_destination
    ORDER BY total_fob DESC
    LIMIT 10
  `, params);

  res.json({ summary, byCategory, topExporters, topCountries });
});

// ============= INTELLIGENCE ROUTES =============

// Find prospective clients based on company's products
app.get('/api/intelligence/prospective-clients', async (req, res) => {
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const companyName = company?.company_name || 'AGNA';
  
  // Get products that the company exports
  const companyProducts = await all(`
    SELECT DISTINCT 
      hs_code,
      product_description,
      data_type
    FROM exports 
    WHERE UPPER(exporter_name) LIKE ?
  `, [`%${companyName}%`]);

  if (companyProducts.length === 0) {
    return res.json({ 
      message: 'No products found for your company. Make sure your company name is set correctly in Settings.',
      prospectiveClients: [],
      companyProducts: []
    });
  }

  const hsCodeList = companyProducts.map(p => p.hs_code).filter(h => h);
  
  if (hsCodeList.length === 0) {
    return res.json({ 
      message: 'No HS codes found for company products.',
      prospectiveClients: [],
      companyProducts 
    });
  }

  const placeholders = hsCodeList.map(() => '?').join(',');
  
  // Find clients who buy similar products but NOT from this company
  const prospectiveClients = await all(`
    SELECT 
      consignee_name,
      country_of_destination,
      COUNT(DISTINCT declaration_id) as total_shipments,
      SUM(fob_value) as total_fob,
      SUM(quantity) as total_quantity,
      GROUP_CONCAT(DISTINCT hs_code) as hs_codes,
      GROUP_CONCAT(DISTINCT product_description) as products,
      GROUP_CONCAT(DISTINCT exporter_name) as current_suppliers
    FROM exports 
    WHERE hs_code IN (${placeholders})
    AND UPPER(exporter_name) NOT LIKE ?
    AND consignee_name IS NOT NULL 
    AND consignee_name != ''
    AND UPPER(consignee_name) != 'NULL'
    GROUP BY consignee_name, country_of_destination
    HAVING total_shipments >= 2
    ORDER BY total_fob DESC
    LIMIT 100
  `, [...hsCodeList, `%${companyName}%`]);

  res.json({
    companyName,
    companyProducts,
    prospectiveClients
  });
});

// Cross-sell analysis - what are current clients buying from competitors
app.get('/api/intelligence/cross-sell', async (req, res) => {
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const companyName = company?.company_name || 'AGNA';
  
  // Get clients that buy from this company
  const companyClients = await all(`
    SELECT DISTINCT consignee_name
    FROM exports 
    WHERE UPPER(exporter_name) LIKE ?
    AND consignee_name IS NOT NULL 
    AND consignee_name != ''
    AND UPPER(consignee_name) != 'NULL'
  `, [`%${companyName}%`]);

  if (companyClients.length === 0) {
    return res.json({ 
      message: 'No clients found for your company.',
      crossSellOpportunities: [],
      clientCount: 0
    });
  }

  const clientNames = companyClients.map(c => c.consignee_name);
  const clientPlaceholders = clientNames.map(() => '?').join(',');
  
  // Get what company sells to these clients (HS codes)
  const companyHsCodes = await all(`
    SELECT DISTINCT hs_code
    FROM exports 
    WHERE UPPER(exporter_name) LIKE ?
    AND UPPER(consignee_name) IN (${clientPlaceholders})
  `, [`%${companyName}%`, ...clientNames.map(n => n.toUpperCase())]);
  
  const companyHsCodeList = companyHsCodes.map(h => h.hs_code).filter(h => h);
  
  // Find what these clients buy from OTHER exporters that company doesn't supply
  let crossSellOpportunities = [];
  
  if (companyHsCodeList.length > 0) {
    const hsPlaceholders = companyHsCodeList.map(() => '?').join(',');
    
    crossSellOpportunities = await all(`
      SELECT 
        e.consignee_name as client_name,
        e.country_of_destination,
        e.hs_code,
        e.product_description,
        e.exporter_name as competitor,
        COUNT(DISTINCT e.declaration_id) as shipment_count,
        SUM(e.fob_value) as total_fob,
        SUM(e.quantity) as total_quantity,
        e.unit
      FROM exports e
      WHERE UPPER(e.consignee_name) IN (${clientPlaceholders})
      AND UPPER(e.exporter_name) NOT LIKE ?
      AND e.hs_code NOT IN (${hsPlaceholders})
      AND e.product_description IS NOT NULL
      GROUP BY e.consignee_name, e.hs_code, e.product_description, e.exporter_name, e.country_of_destination, e.unit
      ORDER BY total_fob DESC
      LIMIT 100
    `, [...clientNames.map(n => n.toUpperCase()), `%${companyName}%`, ...companyHsCodeList]);
  } else {
    // If no HS codes, just show what clients buy from others
    crossSellOpportunities = await all(`
      SELECT 
        e.consignee_name as client_name,
        e.country_of_destination,
        e.hs_code,
        e.product_description,
        e.exporter_name as competitor,
        COUNT(DISTINCT e.declaration_id) as shipment_count,
        SUM(e.fob_value) as total_fob,
        SUM(e.quantity) as total_quantity,
        e.unit
      FROM exports e
      WHERE UPPER(e.consignee_name) IN (${clientPlaceholders})
      AND UPPER(e.exporter_name) NOT LIKE ?
      AND e.product_description IS NOT NULL
      GROUP BY e.consignee_name, e.hs_code, e.product_description, e.exporter_name, e.country_of_destination, e.unit
      ORDER BY total_fob DESC
      LIMIT 100
    `, [...clientNames.map(n => n.toUpperCase()), `%${companyName}%`]);
  }

  res.json({
    companyName,
    clientCount: clientNames.length,
    clientNames,
    companyHsCodes: companyHsCodeList,
    crossSellOpportunities
  });
});

// ============= MONTHLY COMPARISON ROUTES =============

// Get monthly comparison data
app.get('/api/monthly-comparison', async (req, res) => {
  const { currentMonth, previousMonth } = req.query;
  
  if (!currentMonth || !previousMonth) {
    return res.status(400).json({ error: 'Both currentMonth and previousMonth required' });
  }
  
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const companyName = company?.company_name || 'AGNA';
  
  // Competitor comparison (tracked competitors)
  const competitors = await all('SELECT name FROM competitors WHERE active = 1');
  const competitorNames = competitors.map(c => c.name);
  
  let competitorComparison = [];
  if (competitorNames.length > 0) {
    const placeholders = competitorNames.map(() => '?').join(',');
    
    // Current month data
    const currentCompData = await all(`
      SELECT 
        exporter_name,
        COUNT(DISTINCT declaration_id) as shipments,
        SUM(fob_value) as total_fob,
        SUM(quantity) as total_qty,
        COUNT(DISTINCT product_description) as products,
        COUNT(DISTINCT country_of_destination) as countries,
        COUNT(DISTINCT consignee_name) as clients
      FROM exports 
      WHERE UPPER(exporter_name) IN (${placeholders}) AND month_year = ?
      GROUP BY exporter_name
    `, [...competitorNames, currentMonth]);
    
    // Previous month data
    const prevCompData = await all(`
      SELECT 
        exporter_name,
        COUNT(DISTINCT declaration_id) as shipments,
        SUM(fob_value) as total_fob,
        SUM(quantity) as total_qty,
        COUNT(DISTINCT product_description) as products,
        COUNT(DISTINCT country_of_destination) as countries,
        COUNT(DISTINCT consignee_name) as clients
      FROM exports 
      WHERE UPPER(exporter_name) IN (${placeholders}) AND month_year = ?
      GROUP BY exporter_name
    `, [...competitorNames, previousMonth]);
    
    const prevMap = {};
    prevCompData.forEach(p => prevMap[p.exporter_name] = p);
    
    competitorComparison = currentCompData.map(curr => ({
      name: curr.exporter_name,
      current: curr,
      previous: prevMap[curr.exporter_name] || null,
      shipmentChange: prevMap[curr.exporter_name] 
        ? ((curr.shipments - prevMap[curr.exporter_name].shipments) / prevMap[curr.exporter_name].shipments * 100).toFixed(1)
        : null,
      fobChange: prevMap[curr.exporter_name]
        ? ((curr.total_fob - prevMap[curr.exporter_name].total_fob) / prevMap[curr.exporter_name].total_fob * 100).toFixed(1)
        : null,
      isNew: !prevMap[curr.exporter_name]
    }));
    
    // Add competitors only in previous month (dropped)
    prevCompData.forEach(prev => {
      if (!currentCompData.find(c => c.exporter_name === prev.exporter_name)) {
        competitorComparison.push({
          name: prev.exporter_name,
          current: null,
          previous: prev,
          shipmentChange: -100,
          fobChange: -100,
          isDropped: true
        });
      }
    });
  }
  
  // Client comparison (tracked clients)
  const clients = await all('SELECT name FROM clients WHERE active = 1');
  const clientNames = clients.map(c => c.name);
  
  let clientComparison = [];
  if (clientNames.length > 0) {
    const placeholders = clientNames.map(() => '?').join(',');
    
    // Current month data
    const currentClientData = await all(`
      SELECT 
        consignee_name,
        COUNT(DISTINCT declaration_id) as shipments,
        SUM(fob_value) as total_fob,
        SUM(quantity) as total_qty,
        COUNT(DISTINCT product_description) as products,
        COUNT(DISTINCT exporter_name) as suppliers
      FROM exports 
      WHERE UPPER(consignee_name) IN (${placeholders}) AND month_year = ?
      GROUP BY consignee_name
    `, [...clientNames, currentMonth]);
    
    // Previous month data
    const prevClientData = await all(`
      SELECT 
        consignee_name,
        COUNT(DISTINCT declaration_id) as shipments,
        SUM(fob_value) as total_fob,
        SUM(quantity) as total_qty,
        COUNT(DISTINCT product_description) as products,
        COUNT(DISTINCT exporter_name) as suppliers
      FROM exports 
      WHERE UPPER(consignee_name) IN (${placeholders}) AND month_year = ?
      GROUP BY consignee_name
    `, [...clientNames, previousMonth]);
    
    const prevMap = {};
    prevClientData.forEach(p => prevMap[p.consignee_name] = p);
    
    clientComparison = currentClientData.map(curr => ({
      name: curr.consignee_name,
      current: curr,
      previous: prevMap[curr.consignee_name] || null,
      shipmentChange: prevMap[curr.consignee_name]
        ? ((curr.shipments - prevMap[curr.consignee_name].shipments) / prevMap[curr.consignee_name].shipments * 100).toFixed(1)
        : null,
      fobChange: prevMap[curr.consignee_name]
        ? ((curr.total_fob - prevMap[curr.consignee_name].total_fob) / prevMap[curr.consignee_name].total_fob * 100).toFixed(1)
        : null,
      isNew: !prevMap[curr.consignee_name]
    }));
  }
  
  // New suppliers to our clients this month (competitors entering our client base)
  let newSuppliersToClients = [];
  if (clientNames.length > 0) {
    const placeholders = clientNames.map(() => '?').join(',');
    
    // Suppliers in current month
    const currentSuppliers = await all(`
      SELECT DISTINCT consignee_name, exporter_name
      FROM exports 
      WHERE UPPER(consignee_name) IN (${placeholders}) AND month_year = ?
    `, [...clientNames, currentMonth]);
    
    // Suppliers in previous month
    const prevSuppliers = await all(`
      SELECT DISTINCT consignee_name, exporter_name
      FROM exports 
      WHERE UPPER(consignee_name) IN (${placeholders}) AND month_year = ?
    `, [...clientNames, previousMonth]);
    
    const prevSet = new Set(prevSuppliers.map(p => `${p.consignee_name}|${p.exporter_name}`));
    
    const newEntries = currentSuppliers.filter(c => 
      !prevSet.has(`${c.consignee_name}|${c.exporter_name}`)
    );
    
    // Get details for new supplier-client relationships
    if (newEntries.length > 0) {
      const newConditions = newEntries.map(() => '(UPPER(consignee_name) = ? AND UPPER(exporter_name) = ?)').join(' OR ');
      const newParams = [];
      newEntries.forEach(e => {
        newParams.push(e.consignee_name.toUpperCase(), e.exporter_name.toUpperCase());
      });
      
      newSuppliersToClients = await all(`
        SELECT 
          consignee_name as client,
          exporter_name as new_supplier,
          COUNT(DISTINCT declaration_id) as shipments,
          SUM(fob_value) as total_fob,
          GROUP_CONCAT(DISTINCT product_description) as products
        FROM exports 
        WHERE (${newConditions}) AND month_year = ?
        GROUP BY consignee_name, exporter_name
        ORDER BY total_fob DESC
        LIMIT 50
      `, [...newParams, currentMonth]);
    }
  }
  
  // Clients buying from new suppliers (any new supplier relationships)
  const clientsNewSuppliers = await all(`
    SELECT 
      curr.consignee_name as client,
      curr.exporter_name as new_supplier,
      COUNT(DISTINCT curr.declaration_id) as shipments,
      SUM(curr.fob_value) as total_fob,
      GROUP_CONCAT(DISTINCT curr.product_description) as products
    FROM exports curr
    LEFT JOIN (
      SELECT DISTINCT consignee_name, exporter_name 
      FROM exports 
      WHERE month_year = ?
    ) prev ON curr.consignee_name = prev.consignee_name AND curr.exporter_name = prev.exporter_name
    WHERE curr.month_year = ? 
    AND prev.exporter_name IS NULL
    AND curr.consignee_name IS NOT NULL
    AND curr.exporter_name IS NOT NULL
    GROUP BY curr.consignee_name, curr.exporter_name
    ORDER BY total_fob DESC
    LIMIT 100
  `, [previousMonth, currentMonth]);
  
  res.json({
    currentMonth,
    previousMonth,
    companyName,
    competitorComparison,
    clientComparison,
    newSuppliersToClients,
    clientsNewSuppliers
  });
});

// Get detailed monthly comparison for an entity
app.get('/api/monthly-comparison/details', async (req, res) => {
  const { entity, type, currentMonth, previousMonth } = req.query;
  
  if (!entity || !type || !currentMonth || !previousMonth) {
    return res.status(400).json({ error: 'entity, type, currentMonth, and previousMonth required' });
  }
  
  const field = type === 'competitor' ? 'exporter_name' : 'consignee_name';
  
  // Current month details
  const currentData = await all(`
    SELECT 
      declaration_id,
      shipment_date,
      exporter_name,
      consignee_name,
      product_description,
      hs_code,
      quantity,
      unit,
      fob_value,
      country_of_destination,
      port_of_loading,
      port_of_discharge
    FROM exports 
    WHERE UPPER(${field}) = ? AND month_year = ?
    ORDER BY shipment_date DESC
  `, [entity.toUpperCase(), currentMonth]);
  
  // Previous month details
  const previousData = await all(`
    SELECT 
      declaration_id,
      shipment_date,
      exporter_name,
      consignee_name,
      product_description,
      hs_code,
      quantity,
      unit,
      fob_value,
      country_of_destination,
      port_of_loading,
      port_of_discharge
    FROM exports 
    WHERE UPPER(${field}) = ? AND month_year = ?
    ORDER BY shipment_date DESC
  `, [entity.toUpperCase(), previousMonth]);
  
  // Product comparison
  const currentProducts = await all(`
    SELECT product_description, hs_code, SUM(quantity) as qty, SUM(fob_value) as fob
    FROM exports WHERE UPPER(${field}) = ? AND month_year = ?
    GROUP BY product_description, hs_code ORDER BY fob DESC
  `, [entity.toUpperCase(), currentMonth]);
  
  const prevProducts = await all(`
    SELECT product_description, hs_code, SUM(quantity) as qty, SUM(fob_value) as fob
    FROM exports WHERE UPPER(${field}) = ? AND month_year = ?
    GROUP BY product_description, hs_code ORDER BY fob DESC
  `, [entity.toUpperCase(), previousMonth]);
  
  // Country comparison
  const currentCountries = await all(`
    SELECT country_of_destination, COUNT(DISTINCT declaration_id) as shipments, SUM(fob_value) as fob
    FROM exports WHERE UPPER(${field}) = ? AND month_year = ?
    GROUP BY country_of_destination ORDER BY fob DESC
  `, [entity.toUpperCase(), currentMonth]);
  
  const prevCountries = await all(`
    SELECT country_of_destination, COUNT(DISTINCT declaration_id) as shipments, SUM(fob_value) as fob
    FROM exports WHERE UPPER(${field}) = ? AND month_year = ?
    GROUP BY country_of_destination ORDER BY fob DESC
  `, [entity.toUpperCase(), previousMonth]);
  
  res.json({
    entity,
    type,
    currentMonth,
    previousMonth,
    currentData,
    previousData,
    currentProducts,
    prevProducts,
    currentCountries,
    prevCountries
  });
});

// ============= BENCHMARKING ROUTES =============

// Get company benchmarking data
app.get('/api/benchmarking', async (req, res) => {
  const { month } = req.query;
  
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const companyName = company?.company_name || 'AGNA';
  
  const monthFilter = month ? 'AND month_year = ?' : '';
  const monthParam = month ? [month] : [];
  
  // Company data
  const companyData = await get(`
    SELECT 
      COUNT(DISTINCT declaration_id) as shipments,
      SUM(fob_value) as total_fob,
      SUM(quantity) as total_qty,
      COUNT(DISTINCT product_description) as products,
      COUNT(DISTINCT country_of_destination) as countries,
      COUNT(DISTINCT consignee_name) as clients,
      AVG(fob_value) as avg_fob_per_shipment
    FROM exports 
    WHERE UPPER(exporter_name) LIKE ? ${monthFilter}
  `, [`%${companyName}%`, ...monthParam]);
  
  // All competitors data
  const competitors = await all('SELECT name FROM competitors WHERE active = 1');
  const competitorNames = competitors.map(c => c.name);
  
  let competitorBenchmark = [];
  if (competitorNames.length > 0) {
    const placeholders = competitorNames.map(() => '?').join(',');
    competitorBenchmark = await all(`
      SELECT 
        exporter_name as name,
        COUNT(DISTINCT declaration_id) as shipments,
        SUM(fob_value) as total_fob,
        SUM(quantity) as total_qty,
        COUNT(DISTINCT product_description) as products,
        COUNT(DISTINCT country_of_destination) as countries,
        COUNT(DISTINCT consignee_name) as clients,
        AVG(fob_value) as avg_fob_per_shipment
      FROM exports 
      WHERE UPPER(exporter_name) IN (${placeholders}) ${monthFilter}
      GROUP BY exporter_name
      ORDER BY total_fob DESC
    `, [...competitorNames, ...monthParam]);
  }
  
  // Market totals (all exporters)
  const marketTotals = await get(`
    SELECT 
      COUNT(DISTINCT declaration_id) as shipments,
      SUM(fob_value) as total_fob,
      COUNT(DISTINCT exporter_name) as exporters
    FROM exports 
    WHERE 1=1 ${monthFilter}
  `, monthParam);
  
  // Company's clients and their other vendors
  const companyClients = await all(`
    SELECT DISTINCT consignee_name
    FROM exports 
    WHERE UPPER(exporter_name) LIKE ? ${monthFilter}
    AND consignee_name IS NOT NULL AND consignee_name != ''
  `, [`%${companyName}%`, ...monthParam]);
  
  let clientVendorAnalysis = [];
  if (companyClients.length > 0) {
    const clientNames = companyClients.map(c => c.consignee_name);
    const placeholders = clientNames.map(() => '?').join(',');
    
    // For each client, get all their suppliers and how they compare
    clientVendorAnalysis = await all(`
      SELECT 
        consignee_name as client,
        exporter_name as vendor,
        CASE WHEN UPPER(exporter_name) LIKE ? THEN 1 ELSE 0 END as is_your_company,
        COUNT(DISTINCT declaration_id) as shipments,
        SUM(fob_value) as total_fob,
        SUM(quantity) as total_qty,
        COUNT(DISTINCT product_description) as products
      FROM exports 
      WHERE UPPER(consignee_name) IN (${placeholders}) ${monthFilter}
      GROUP BY consignee_name, exporter_name
      ORDER BY consignee_name, total_fob DESC
    `, [`%${companyName}%`, ...clientNames.map(c => c.toUpperCase()), ...monthParam]);
  }
  
  // Calculate market share
  const companyMarketShare = marketTotals?.total_fob > 0 
    ? ((companyData?.total_fob || 0) / marketTotals.total_fob * 100).toFixed(2)
    : 0;
  
  // Company ranking among all exporters
  const companyRank = await get(`
    SELECT COUNT(*) + 1 as rank
    FROM (
      SELECT exporter_name, SUM(fob_value) as total_fob
      FROM exports 
      WHERE 1=1 ${monthFilter}
      GROUP BY exporter_name
      HAVING total_fob > (
        SELECT COALESCE(SUM(fob_value), 0)
        FROM exports 
        WHERE UPPER(exporter_name) LIKE ? ${monthFilter}
      )
    )
  `, [...monthParam, `%${companyName}%`, ...monthParam]);
  
  res.json({
    companyName,
    month: month || 'All Time',
    companyData: companyData || {},
    competitorBenchmark,
    marketTotals: marketTotals || {},
    companyMarketShare,
    companyRank: companyRank?.rank || 'N/A',
    clientVendorAnalysis
  });
});

// Export benchmarking to Excel
app.get('/api/export/benchmarking', async (req, res) => {
  const { month } = req.query;
  
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const companyName = company?.company_name || 'AGNA';
  
  const monthFilter = month ? 'AND month_year = ?' : '';
  const monthParam = month ? [month] : [];
  
  // Company vs Competitors
  const competitors = await all('SELECT name FROM competitors WHERE active = 1');
  const allNames = [companyName, ...competitors.map(c => c.name)];
  const placeholders = allNames.map(() => 'UPPER(exporter_name) LIKE ?').join(' OR ');
  
  const benchmark = await all(`
    SELECT 
      exporter_name as "Company",
      CASE WHEN UPPER(exporter_name) LIKE ? THEN 'Your Company' ELSE 'Competitor' END as "Type",
      COUNT(DISTINCT declaration_id) as "Shipments",
      SUM(fob_value) as "Total FOB (USD)",
      ROUND(SUM(fob_value) * 83.5, 2) as "Total FOB (INR)",
      SUM(quantity) as "Total Quantity",
      COUNT(DISTINCT product_description) as "Products",
      COUNT(DISTINCT country_of_destination) as "Countries",
      COUNT(DISTINCT consignee_name) as "Clients"
    FROM exports 
    WHERE (${placeholders}) ${monthFilter}
    GROUP BY exporter_name
    ORDER BY "Total FOB (USD)" DESC
  `, [`%${companyName}%`, ...allNames.map(n => `%${n}%`), ...monthParam]);
  
  // Client vendor analysis
  const companyClients = await all(`
    SELECT DISTINCT consignee_name
    FROM exports 
    WHERE UPPER(exporter_name) LIKE ? ${monthFilter}
    AND consignee_name IS NOT NULL AND consignee_name != ''
  `, [`%${companyName}%`, ...monthParam]);
  
  let clientVendors = [];
  if (companyClients.length > 0) {
    const clientNames = companyClients.map(c => c.consignee_name);
    const clientPlaceholders = clientNames.map(() => '?').join(',');
    
    clientVendors = await all(`
      SELECT 
        consignee_name as "Client",
        exporter_name as "Vendor",
        CASE WHEN UPPER(exporter_name) LIKE ? THEN 'Your Company' ELSE 'Competitor' END as "Type",
        COUNT(DISTINCT declaration_id) as "Shipments",
        SUM(fob_value) as "FOB (USD)",
        ROUND(SUM(fob_value) * 83.5, 2) as "FOB (INR)",
        SUM(quantity) as "Quantity"
      FROM exports 
      WHERE UPPER(consignee_name) IN (${clientPlaceholders}) ${monthFilter}
      GROUP BY consignee_name, exporter_name
      ORDER BY consignee_name, "FOB (USD)" DESC
    `, [`%${companyName}%`, ...clientNames.map(c => c.toUpperCase()), ...monthParam]);
  }
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  const benchmarkWs = XLSX.utils.json_to_sheet(benchmark);
  XLSX.utils.book_append_sheet(wb, benchmarkWs, 'Company vs Competitors');
  
  const clientVendorsWs = XLSX.utils.json_to_sheet(clientVendors);
  XLSX.utils.book_append_sheet(wb, clientVendorsWs, 'Client Vendor Analysis');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', `attachment; filename=benchmarking_report_${month || 'all'}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Export monthly comparison to Excel
app.get('/api/export/monthly-comparison', async (req, res) => {
  const { currentMonth, previousMonth } = req.query;
  
  if (!currentMonth || !previousMonth) {
    return res.status(400).json({ error: 'Both months required' });
  }
  
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const companyName = company?.company_name || 'AGNA';
  
  // Get all comparison data
  const competitors = await all('SELECT name FROM competitors WHERE active = 1');
  const competitorNames = competitors.map(c => c.name);
  
  let competitorData = [];
  if (competitorNames.length > 0) {
    const placeholders = competitorNames.map(() => '?').join(',');
    
    competitorData = await all(`
      SELECT 
        exporter_name as "Competitor",
        month_year as "Month",
        COUNT(DISTINCT declaration_id) as "Shipments",
        SUM(fob_value) as "FOB (USD)",
        ROUND(SUM(fob_value) * 83.5, 2) as "FOB (INR)",
        SUM(quantity) as "Quantity",
        COUNT(DISTINCT product_description) as "Products"
      FROM exports 
      WHERE UPPER(exporter_name) IN (${placeholders}) 
      AND month_year IN (?, ?)
      GROUP BY exporter_name, month_year
      ORDER BY exporter_name, month_year
    `, [...competitorNames, currentMonth, previousMonth]);
  }
  
  const clients = await all('SELECT name FROM clients WHERE active = 1');
  const clientNames = clients.map(c => c.name);
  
  let clientData = [];
  if (clientNames.length > 0) {
    const placeholders = clientNames.map(() => '?').join(',');
    
    clientData = await all(`
      SELECT 
        consignee_name as "Client",
        month_year as "Month",
        COUNT(DISTINCT declaration_id) as "Shipments",
        SUM(fob_value) as "FOB (USD)",
        ROUND(SUM(fob_value) * 83.5, 2) as "FOB (INR)",
        SUM(quantity) as "Quantity",
        COUNT(DISTINCT exporter_name) as "Suppliers"
      FROM exports 
      WHERE UPPER(consignee_name) IN (${placeholders}) 
      AND month_year IN (?, ?)
      GROUP BY consignee_name, month_year
      ORDER BY consignee_name, month_year
    `, [...clientNames, currentMonth, previousMonth]);
  }
  
  // New relationships
  const newRelationships = await all(`
    SELECT 
      curr.consignee_name as "Client",
      curr.exporter_name as "New Supplier",
      COUNT(DISTINCT curr.declaration_id) as "Shipments",
      SUM(curr.fob_value) as "FOB (USD)",
      ROUND(SUM(curr.fob_value) * 83.5, 2) as "FOB (INR)"
    FROM exports curr
    LEFT JOIN (
      SELECT DISTINCT consignee_name, exporter_name 
      FROM exports WHERE month_year = ?
    ) prev ON curr.consignee_name = prev.consignee_name AND curr.exporter_name = prev.exporter_name
    WHERE curr.month_year = ? AND prev.exporter_name IS NULL
    GROUP BY curr.consignee_name, curr.exporter_name
    ORDER BY "FOB (USD)" DESC
    LIMIT 100
  `, [previousMonth, currentMonth]);
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  const competitorWs = XLSX.utils.json_to_sheet(competitorData);
  XLSX.utils.book_append_sheet(wb, competitorWs, 'Competitor Comparison');
  
  const clientWs = XLSX.utils.json_to_sheet(clientData);
  XLSX.utils.book_append_sheet(wb, clientWs, 'Client Comparison');
  
  const newRelWs = XLSX.utils.json_to_sheet(newRelationships);
  XLSX.utils.book_append_sheet(wb, newRelWs, 'New Supplier-Client');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', `attachment; filename=monthly_comparison_${currentMonth}_vs_${previousMonth}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// ============= FEEDBACK ROUTES =============

app.post('/api/feedback', async (req, res) => {
  const { user_name, feedback_type, message, page } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  try {
    run(`INSERT INTO feedback (user_name, feedback_type, message, page) VALUES (?, ?, ?, ?)`,
      [user_name || 'Anonymous', feedback_type || 'general', message, page || '']);
    console.log(`📝 New feedback received: ${feedback_type} - ${message.substring(0, 50)}...`);
    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/feedback', async (req, res) => {
  const feedbacks = await all('SELECT * FROM feedback ORDER BY created_at DESC');
  res.json(feedbacks);
});

// ============= CUSTOM REPORT ROUTES =============

// Custom report by countries and/or companies
app.get('/api/custom-report', async (req, res) => {
  const { countries, exporters, consignees, month } = req.query;
  
  const countryList = countries ? countries.split(',').map(c => c.trim().toUpperCase()).filter(c => c) : [];
  const exporterList = exporters ? exporters.split(',').map(e => e.trim().toUpperCase()).filter(e => e) : [];
  const consigneeList = consignees ? consignees.split(',').map(c => c.trim().toUpperCase()).filter(c => c) : [];
  
  if (countryList.length === 0 && exporterList.length === 0 && consigneeList.length === 0) {
    return res.status(400).json({ error: 'Please provide at least one country, exporter, or consignee' });
  }
  
  // Build query conditions
  const conditions = [];
  const params = [];
  
  if (countryList.length > 0) {
    const placeholders = countryList.map(() => 'UPPER(country_of_destination) LIKE ?').join(' OR ');
    conditions.push(`(${placeholders})`);
    countryList.forEach(c => params.push(`%${c}%`));
  }
  
  if (exporterList.length > 0) {
    const placeholders = exporterList.map(() => 'UPPER(exporter_name) LIKE ?').join(' OR ');
    conditions.push(`(${placeholders})`);
    exporterList.forEach(e => params.push(`%${e}%`));
  }
  
  if (consigneeList.length > 0) {
    const placeholders = consigneeList.map(() => 'UPPER(consignee_name) LIKE ?').join(' OR ');
    conditions.push(`(${placeholders})`);
    consigneeList.forEach(c => params.push(`%${c}%`));
  }
  
  let whereClause = conditions.join(' AND ');
  if (month) {
    whereClause += ' AND month_year = ?';
    params.push(month);
  }
  
  // Get summary data
  const summary = await all(`
    SELECT 
      CASE 
        WHEN ? > 0 THEN country_of_destination
        WHEN ? > 0 THEN exporter_name  
        ELSE consignee_name
      END as group_by,
      COUNT(DISTINCT declaration_id) as total_shipments,
      SUM(quantity) as total_quantity,
      COUNT(DISTINCT product_description) as total_products,
      SUM(fob_value) as total_value,
      COUNT(DISTINCT exporter_name) as exporters,
      COUNT(DISTINCT consignee_name) as consignees
    FROM exports 
    WHERE ${whereClause}
    GROUP BY group_by
    ORDER BY total_value DESC
  `, [countryList.length, exporterList.length, ...params]);
  
  // Get detailed data
  const details = await all(`
    SELECT 
      declaration_id as "Declaration ID",
      shipment_date as "Shipment Date",
      exporter_name as "Exporter",
      consignee_name as "Consignee",
      product_description as "Product",
      hs_code as "HS Code",
      quantity as "Quantity",
      unit as "Unit",
      fob_value as "FOB Value (USD)",
      ROUND(fob_value * 83.5, 2) as "FOB Value (INR)",
      country_of_destination as "Country",
      port_of_loading as "Port of Loading",
      port_of_discharge as "Port of Discharge",
      data_type as "Category"
    FROM exports 
    WHERE ${whereClause}
    ORDER BY shipment_date DESC, total_value DESC
  `, params);
  
  res.json({ summary, details, filters: { countries: countryList, exporters: exporterList, consignees: consigneeList } });
});

// Export custom report to Excel
app.get('/api/export/custom-report', async (req, res) => {
  const { countries, exporters, consignees, month } = req.query;
  
  const countryList = countries ? countries.split(',').map(c => c.trim().toUpperCase()).filter(c => c) : [];
  const exporterList = exporters ? exporters.split(',').map(e => e.trim().toUpperCase()).filter(e => e) : [];
  const consigneeList = consignees ? consignees.split(',').map(c => c.trim().toUpperCase()).filter(c => c) : [];
  
  if (countryList.length === 0 && exporterList.length === 0 && consigneeList.length === 0) {
    return res.status(400).json({ error: 'Please provide at least one country, exporter, or consignee' });
  }
  
  // Build query conditions
  const conditions = [];
  const params = [];
  
  if (countryList.length > 0) {
    const placeholders = countryList.map(() => 'UPPER(country_of_destination) LIKE ?').join(' OR ');
    conditions.push(`(${placeholders})`);
    countryList.forEach(c => params.push(`%${c}%`));
  }
  
  if (exporterList.length > 0) {
    const placeholders = exporterList.map(() => 'UPPER(exporter_name) LIKE ?').join(' OR ');
    conditions.push(`(${placeholders})`);
    exporterList.forEach(e => params.push(`%${e}%`));
  }
  
  if (consigneeList.length > 0) {
    const placeholders = consigneeList.map(() => 'UPPER(consignee_name) LIKE ?').join(' OR ');
    conditions.push(`(${placeholders})`);
    consigneeList.forEach(c => params.push(`%${c}%`));
  }
  
  let whereClause = conditions.join(' AND ');
  if (month) {
    whereClause += ' AND month_year = ?';
    params.push(month);
  }
  
  // Get summary data grouped appropriately
  const summaryParams = [countryList.length, exporterList.length, ...params];
  const summary = await all(`
    SELECT 
      CASE 
        WHEN ? > 0 THEN country_of_destination
        WHEN ? > 0 THEN exporter_name  
        ELSE consignee_name
      END as "Entity",
      COUNT(DISTINCT declaration_id) as "Total Shipments",
      ROUND(SUM(quantity), 2) as "Total Quantity",
      COUNT(DISTINCT product_description) as "Total Products",
      ROUND(SUM(fob_value), 2) as "Total Value (USD)",
      ROUND(SUM(fob_value) * 83.5, 2) as "Total Value (INR)"
    FROM exports 
    WHERE ${whereClause}
    GROUP BY "Entity"
    ORDER BY "Total Value (USD)" DESC
  `, summaryParams);
  
  // Get detailed data
  const details = await all(`
    SELECT 
      declaration_id as "Declaration ID",
      shipment_date as "Shipment Date",
      exporter_name as "Exporter",
      consignee_name as "Consignee",
      product_description as "Product",
      hs_code as "HS Code",
      quantity as "Quantity",
      unit as "Unit",
      fob_value as "FOB Value (USD)",
      ROUND(fob_value * 83.5, 2) as "FOB Value (INR)",
      country_of_destination as "Country",
      port_of_loading as "Port of Loading",
      port_of_discharge as "Port of Discharge",
      data_type as "Category"
    FROM exports 
    WHERE ${whereClause}
    ORDER BY shipment_date DESC
  `, params);
  
  // Create workbook with multiple sheets
  const wb = XLSX.utils.book_new();
  
  // Summary sheet
  const summaryWs = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Detailed data sheet
  const detailsWs = XLSX.utils.json_to_sheet(details);
  XLSX.utils.book_append_sheet(wb, detailsWs, 'Detailed Data');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  const filename = `custom_report_${month || 'all'}_${Date.now()}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Export intelligence prospective clients to Excel
app.get('/api/export/prospective-clients', async (req, res) => {
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const companyName = company?.company_name || 'AGNA';
  
  // Get products that the company exports
  const companyProducts = await all(`
    SELECT DISTINCT 
      hs_code,
      product_description,
      data_type
    FROM exports 
    WHERE UPPER(exporter_name) LIKE ?
  `, [`%${companyName}%`]);

  if (companyProducts.length === 0) {
    return res.status(400).json({ error: 'No products found for your company' });
  }

  const hsCodeList = companyProducts.map(p => p.hs_code).filter(h => h);
  
  if (hsCodeList.length === 0) {
    return res.status(400).json({ error: 'No HS codes found for company products' });
  }

  const placeholders = hsCodeList.map(() => '?').join(',');
  
  // Find prospective clients with detailed info
  const prospectiveClients = await all(`
    SELECT 
      consignee_name as "Consignee Name",
      country_of_destination as "Country",
      COUNT(DISTINCT declaration_id) as "Total Shipments",
      SUM(fob_value) as "Total FOB (USD)",
      ROUND(SUM(fob_value) * 83.5, 2) as "Total FOB (INR)",
      SUM(quantity) as "Total Quantity",
      GROUP_CONCAT(DISTINCT hs_code) as "HS Codes",
      GROUP_CONCAT(DISTINCT product_description) as "Products",
      GROUP_CONCAT(DISTINCT exporter_name) as "Current Suppliers"
    FROM exports 
    WHERE hs_code IN (${placeholders})
    AND UPPER(exporter_name) NOT LIKE ?
    AND consignee_name IS NOT NULL 
    AND consignee_name != ''
    AND UPPER(consignee_name) != 'NULL'
    GROUP BY consignee_name, country_of_destination
    HAVING "Total Shipments" >= 2
    ORDER BY "Total FOB (USD)" DESC
  `, [...hsCodeList, `%${companyName}%`]);
  
  // Get product-wise breakdown for each prospective client
  const productBreakdown = await all(`
    SELECT 
      consignee_name as "Consignee",
      product_description as "Product",
      hs_code as "HS Code",
      COUNT(DISTINCT declaration_id) as "Shipments",
      SUM(fob_value) as "FOB (USD)",
      ROUND(SUM(fob_value) * 83.5, 2) as "FOB (INR)",
      SUM(quantity) as "Quantity",
      unit as "Unit",
      exporter_name as "Current Supplier"
    FROM exports 
    WHERE hs_code IN (${placeholders})
    AND UPPER(exporter_name) NOT LIKE ?
    AND consignee_name IS NOT NULL 
    AND consignee_name != ''
    GROUP BY consignee_name, product_description, hs_code, exporter_name, unit
    ORDER BY "FOB (USD)" DESC
  `, [...hsCodeList, `%${companyName}%`]);
  
  // Create workbook with multiple sheets
  const wb = XLSX.utils.book_new();
  
  // Summary sheet
  const summaryWs = XLSX.utils.json_to_sheet(prospectiveClients);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Prospective Clients');
  
  // Product breakdown sheet
  const productWs = XLSX.utils.json_to_sheet(productBreakdown);
  XLSX.utils.book_append_sheet(wb, productWs, 'Product Details');
  
  // Company products sheet (for reference)
  const companyProductsWs = XLSX.utils.json_to_sheet(companyProducts.map(p => ({
    "HS Code": p.hs_code,
    "Product": p.product_description,
    "Category": p.data_type
  })));
  XLSX.utils.book_append_sheet(wb, companyProductsWs, 'Your Products');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', `attachment; filename=prospective_clients_${Date.now()}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Export cross-sell opportunities to Excel
app.get('/api/export/cross-sell', async (req, res) => {
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const companyName = company?.company_name || 'AGNA';
  
  // Get clients that buy from this company
  const companyClients = await all(`
    SELECT DISTINCT consignee_name
    FROM exports 
    WHERE UPPER(exporter_name) LIKE ?
    AND consignee_name IS NOT NULL 
    AND consignee_name != ''
    AND UPPER(consignee_name) != 'NULL'
  `, [`%${companyName}%`]);

  if (companyClients.length === 0) {
    return res.status(400).json({ error: 'No clients found for your company' });
  }

  const clientNames = companyClients.map(c => c.consignee_name);
  const clientPlaceholders = clientNames.map(() => '?').join(',');
  
  // Get what company sells to these clients (HS codes)
  const companyHsCodes = await all(`
    SELECT DISTINCT hs_code
    FROM exports 
    WHERE UPPER(exporter_name) LIKE ?
    AND UPPER(consignee_name) IN (${clientPlaceholders})
  `, [`%${companyName}%`, ...clientNames.map(n => n.toUpperCase())]);
  
  const companyHsCodeList = companyHsCodes.map(h => h.hs_code).filter(h => h);
  
  let crossSellData = [];
  
  if (companyHsCodeList.length > 0) {
    const hsPlaceholders = companyHsCodeList.map(() => '?').join(',');
    
    crossSellData = await all(`
      SELECT 
        e.consignee_name as "Your Client",
        e.country_of_destination as "Country",
        e.hs_code as "HS Code",
        e.product_description as "Product",
        e.exporter_name as "Competitor",
        COUNT(DISTINCT e.declaration_id) as "Shipments",
        SUM(e.fob_value) as "Total FOB (USD)",
        ROUND(SUM(e.fob_value) * 83.5, 2) as "Total FOB (INR)",
        SUM(e.quantity) as "Total Quantity",
        e.unit as "Unit"
      FROM exports e
      WHERE UPPER(e.consignee_name) IN (${clientPlaceholders})
      AND UPPER(e.exporter_name) NOT LIKE ?
      AND e.hs_code NOT IN (${hsPlaceholders})
      AND e.product_description IS NOT NULL
      GROUP BY e.consignee_name, e.hs_code, e.product_description, e.exporter_name, e.country_of_destination, e.unit
      ORDER BY "Total FOB (USD)" DESC
    `, [...clientNames.map(n => n.toUpperCase()), `%${companyName}%`, ...companyHsCodeList]);
  }
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Cross-sell opportunities sheet
  const crossSellWs = XLSX.utils.json_to_sheet(crossSellData);
  XLSX.utils.book_append_sheet(wb, crossSellWs, 'Cross-Sell Opportunities');
  
  // Your clients sheet
  const clientsWs = XLSX.utils.json_to_sheet(clientNames.map(c => ({ "Client Name": c })));
  XLSX.utils.book_append_sheet(wb, clientsWs, 'Your Clients');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', `attachment; filename=cross_sell_opportunities_${Date.now()}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Export entity details to Excel (for competitor/client detailed export)
app.get('/api/export/entity-details', async (req, res) => {
  const { entity, type, month } = req.query;
  
  if (!entity || !type) {
    return res.status(400).json({ error: 'Entity and type required' });
  }

  const field = type === 'exporter' ? 'exporter_name' : 'consignee_name';
  const params = [entity.toUpperCase()];
  let monthFilter = '';
  if (month) {
    monthFilter = ' AND month_year = ?';
    params.push(month);
  }

  // Summary stats
  const summary = await get(`
    SELECT 
      COUNT(DISTINCT declaration_id) as total_shipments,
      SUM(fob_value) as total_fob,
      ROUND(SUM(fob_value) * 83.5, 2) as total_fob_inr,
      SUM(quantity) as total_quantity,
      COUNT(DISTINCT product_description) as unique_products,
      COUNT(DISTINCT country_of_destination) as unique_countries,
      MIN(shipment_date) as first_shipment,
      MAX(shipment_date) as last_shipment
    FROM exports 
    WHERE UPPER(${field}) = ?${monthFilter}
  `, params);

  // Products breakdown
  const products = await all(`
    SELECT 
      product_description as "Product",
      hs_code as "HS Code",
      data_type as "Category",
      COUNT(DISTINCT declaration_id) as "Shipments",
      SUM(quantity) as "Quantity",
      unit as "Unit",
      SUM(fob_value) as "FOB (USD)",
      ROUND(SUM(fob_value) * 83.5, 2) as "FOB (INR)"
    FROM exports 
    WHERE UPPER(${field}) = ?${monthFilter}
    GROUP BY product_description, hs_code, data_type, unit
    ORDER BY "FOB (USD)" DESC
  `, params);

  // Countries breakdown
  const countries = await all(`
    SELECT 
      country_of_destination as "Country",
      COUNT(DISTINCT declaration_id) as "Shipments",
      SUM(quantity) as "Quantity",
      SUM(fob_value) as "FOB (USD)",
      ROUND(SUM(fob_value) * 83.5, 2) as "FOB (INR)"
    FROM exports 
    WHERE UPPER(${field}) = ?${monthFilter}
    GROUP BY country_of_destination
    ORDER BY "FOB (USD)" DESC
  `, params);

  // All shipments
  const shipments = await all(`
    SELECT 
      declaration_id as "Declaration ID",
      shipment_date as "Date",
      exporter_name as "Exporter",
      consignee_name as "Consignee",
      product_description as "Product",
      hs_code as "HS Code",
      quantity as "Quantity",
      unit as "Unit",
      fob_value as "FOB (USD)",
      ROUND(fob_value * 83.5, 2) as "FOB (INR)",
      country_of_destination as "Country",
      port_of_loading as "Port of Loading",
      port_of_discharge as "Port of Discharge"
    FROM exports 
    WHERE UPPER(${field}) = ?${monthFilter}
    ORDER BY shipment_date DESC
  `, params);

  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Summary sheet
  const summaryData = [{
    "Entity": entity,
    "Type": type === 'exporter' ? 'Competitor' : 'Client',
    "Total Shipments": summary?.total_shipments || 0,
    "Total FOB (USD)": summary?.total_fob || 0,
    "Total FOB (INR)": summary?.total_fob_inr || 0,
    "Total Quantity": summary?.total_quantity || 0,
    "Unique Products": summary?.unique_products || 0,
    "Unique Countries": summary?.unique_countries || 0,
    "First Shipment": summary?.first_shipment || 'N/A',
    "Last Shipment": summary?.last_shipment || 'N/A'
  }];
  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Products sheet
  const productsWs = XLSX.utils.json_to_sheet(products);
  XLSX.utils.book_append_sheet(wb, productsWs, 'Products');
  
  // Countries sheet
  const countriesWs = XLSX.utils.json_to_sheet(countries);
  XLSX.utils.book_append_sheet(wb, countriesWs, 'Countries');
  
  // All shipments sheet
  const shipmentsWs = XLSX.utils.json_to_sheet(shipments);
  XLSX.utils.book_append_sheet(wb, shipmentsWs, 'All Shipments');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  const safeEntity = entity.replace(/[^a-zA-Z0-9]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename=${safeEntity}_report_${month || 'all'}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// ============= EXPORT/REPORT ROUTES =============

// Export competitor report
app.get('/api/export/competitors', async (req, res) => {
  const { month } = req.query;
  
  const competitors = await all('SELECT name FROM competitors WHERE active = 1');
  const competitorNames = competitors.map(c => c.name);

  if (competitorNames.length === 0) {
    return res.status(400).json({ error: 'No competitors to export' });
  }

  const placeholders = competitorNames.map(() => '?').join(',');
  
  let query = `
    SELECT 
      exporter_name as "Exporter",
      declaration_id as "Declaration ID",
      consignee_name as "Consignee",
      product_description as "Product",
      data_type as "Category",
      quantity as "Quantity",
      unit as "Unit",
      fob_value as "FOB Value",
      fob_currency as "Currency",
      port_of_loading as "Port of Loading",
      port_of_discharge as "Port of Discharge",
      country_of_destination as "Country",
      shipment_date as "Shipment Date"
    FROM exports 
    WHERE UPPER(exporter_name) IN (${placeholders})
  `;
  
  const params = [...competitorNames];
  
  if (month) {
    query += ' AND month_year = ?';
    params.push(month);
  }
  
  query += ' ORDER BY shipment_date DESC, exporter_name';
  
  const data = await all(query, params);
  
  // Create workbook
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Competitor Report');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', `attachment; filename=competitor_report_${month || 'all'}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Export client report
app.get('/api/export/clients', async (req, res) => {
  const { month } = req.query;
  
  const clients = await all('SELECT name FROM clients WHERE active = 1');
  const clientNames = clients.map(c => c.name);

  if (clientNames.length === 0) {
    return res.status(400).json({ error: 'No clients to export' });
  }

  const placeholders = clientNames.map(() => '?').join(',');
  
  let query = `
    SELECT 
      consignee_name as "Client/Consignee",
      exporter_name as "Supplier",
      declaration_id as "Declaration ID",
      product_description as "Product",
      data_type as "Category",
      quantity as "Quantity",
      unit as "Unit",
      fob_value as "FOB Value",
      fob_currency as "Currency",
      port_of_loading as "Port of Loading",
      port_of_discharge as "Port of Discharge",
      country_of_destination as "Country",
      shipment_date as "Shipment Date"
    FROM exports 
    WHERE UPPER(consignee_name) IN (${placeholders})
  `;
  
  const params = [...clientNames];
  
  if (month) {
    query += ' AND month_year = ?';
    params.push(month);
  }
  
  query += ' ORDER BY shipment_date DESC, consignee_name';
  
  const data = await all(query, params);
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Client Report');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', `attachment; filename=client_report_${month || 'all'}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Export company comparison report
app.get('/api/export/company-comparison', async (req, res) => {
  const { month } = req.query;
  
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const competitors = await all('SELECT name FROM competitors WHERE active = 1');
  
  const companyName = company?.company_name || 'AGNA';
  const allNames = [companyName, ...competitors.map(c => c.name)];
  const placeholders = allNames.map(() => '?').join(',');
  
  let query = `
    SELECT 
      exporter_name as "Company",
      CASE WHEN UPPER(exporter_name) = ? THEN 'Your Company' ELSE 'Competitor' END as "Type",
      declaration_id as "Declaration ID",
      consignee_name as "Client",
      product_description as "Product",
      data_type as "Category",
      quantity as "Quantity",
      unit as "Unit",
      fob_value as "FOB Value",
      fob_currency as "Currency",
      country_of_destination as "Country",
      shipment_date as "Shipment Date"
    FROM exports 
    WHERE UPPER(exporter_name) IN (${placeholders})
  `;
  
  const params = [companyName, ...allNames];
  
  if (month) {
    query += ' AND month_year = ?';
    params.push(month);
  }
  
  query += ' ORDER BY exporter_name, shipment_date DESC';
  
  const data = await all(query, params);
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Company Comparison');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', `attachment; filename=company_comparison_${month || 'all'}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Export summary report
app.get('/api/export/summary', async (req, res) => {
  const { month } = req.query;
  
  let whereClause = month ? 'WHERE month_year = ?' : '';
  const params = month ? [month] : [];
  
  // Get summary data
  const summary = await all(`
    SELECT 
      exporter_name as "Exporter",
      COUNT(DISTINCT declaration_id) as "Shipments",
      SUM(fob_value) as "Total FOB",
      COUNT(DISTINCT product_description) as "Products",
      COUNT(DISTINCT country_of_destination) as "Countries",
      COUNT(DISTINCT consignee_name) as "Clients",
      GROUP_CONCAT(DISTINCT data_type) as "Categories"
    FROM exports ${whereClause}
    GROUP BY exporter_name
    ORDER BY "Total FOB" DESC
  `, params);
  
  const ws = XLSX.utils.json_to_sheet(summary);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export Summary');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', `attachment; filename=export_summary_${month || 'all'}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Serve static files from the built frontend (AFTER all API routes)
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// Serve frontend for all other routes (SPA support)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run: npm run build' });
  }
});

// Start server after DB initialization
initDb().then(() => {
  dbInitialized = true;
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Export Data Explorer running on port ${PORT}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  // Still start server but mark DB as not initialized
  dbInitialized = false;
  app.listen(PORT, HOST, () => {
    console.log(`⚠️ Server started but DB initialization failed: ${err.message}`);
  });
});
