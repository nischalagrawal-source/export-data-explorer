import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import XLSX from 'xlsx';
import multer from 'multer';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer config for memory storage (works with serverless)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Database setup - Turso (cloud SQLite)
const dbUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

let db;
let dbInitialized = false;

// Helper functions
const run = async (sql, params = []) => {
  await db.execute({ sql, args: params });
};

const get = async (sql, params = []) => {
  const result = await db.execute({ sql, args: params });
  return result.rows.length > 0 ? result.rows[0] : null;
};

const all = async (sql, params = []) => {
  const result = await db.execute({ sql, args: params });
  return result.rows;
};

// Initialize database
async function initDb() {
  if (dbInitialized) return;
  
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS company_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL DEFAULT 'AGNA',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

  // Create indexes
  try {
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_exports_exporter ON exports(exporter_name)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_exports_consignee ON exports(consignee_name)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_exports_date ON exports(shipment_date)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_exports_month ON exports(month_year)`);
  } catch (e) {
    // Indexes might already exist
  }

  // Insert default company if not exists
  const companyExists = await get('SELECT COUNT(*) as count FROM company_info');
  if (!companyExists || companyExists.count === 0) {
    await run('INSERT INTO company_info (company_name) VALUES (?)', ['AGNA ORG AGROVILLA INDIA PRIVATE LIMITED']);
  }

  dbInitialized = true;
  console.log('📦 Database initialized');
}

// Middleware to ensure DB is initialized
app.use(async (req, res, next) => {
  try {
    await initDb();
    next();
  } catch (err) {
    console.error('DB init error:', err.message);
    console.error('DB URL:', dbUrl ? dbUrl.substring(0, 40) + '...' : 'NOT SET');
    console.error('Token set:', !!authToken);
    res.status(500).json({ 
      error: 'Database initialization failed', 
      details: err.message,
      hint: 'Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel environment variables'
    });
  }
});

// Helper function to find column value with flexible matching
const findColumnValue = (row, possibleNames) => {
  const rowKeys = Object.keys(row);
  const keyMap = {};
  for (const key of rowKeys) {
    const normalized = key.toLowerCase().replace(/[\s_-]+/g, '');
    keyMap[normalized] = key;
  }
  
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
      return row[name];
    }
    const normalizedName = name.toLowerCase().replace(/[\s_-]+/g, '');
    if (keyMap[normalizedName]) {
      const val = row[keyMap[normalizedName]];
      if (val !== undefined && val !== null && String(val).trim() !== '') return val;
    }
  }
  
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().replace(/[\s_-]+/g, '');
    for (const [normalized, actualKey] of Object.entries(keyMap)) {
      if (normalized.includes(normalizedName) || normalizedName.includes(normalized)) {
        const val = row[actualKey];
        if (val !== undefined && val !== null && String(val).trim() !== '') return val;
      }
    }
  }
  return '';
};

// ============= FILE UPLOAD ROUTE =============
app.post('/api/upload', upload.single('file'), async (req, res) => {
  console.log('Upload request received');
  console.log('File:', req.file ? 'present' : 'missing');
  console.log('Body:', req.body);
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded', debug: { body: req.body, headers: req.headers['content-type'] } });
  }

  const { dataType } = req.body;
  if (!dataType || !['fruits', 'vegetables'].includes(dataType)) {
    return res.status(400).json({ error: 'Invalid data type. Must be "fruits" or "vegetables"' });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    const columns = Object.keys(data[0]);
    const uploadBatch = `${Date.now()}-${dataType}`;
    let inserted = 0, skipped = 0;

    // Column name variations
    const declarationIdNames = ['Declaration ID', 'DECLARATION_ID', 'Declaration No', 'SB No', 'Shipping Bill No', 'Bill No', 'Invoice No'];
    const exporterNames = ['Exporter Name', 'EXPORTER_NAME', 'Exporter', 'Shipper', 'Seller', 'Company Name'];
    const consigneeNames = ['Consignee Name', 'CONSIGNEE_NAME', 'Consignee', 'Buyer', 'Importer', 'Customer', 'Consinee Name'];
    const productNames = ['Product Description', 'PRODUCT_DESCRIPTION', 'Product', 'Description', 'Goods Description', 'Item Description'];
    const hsCodeNames = ['HS Code', 'HS_CODE', 'HSCode', 'ITC Code', 'Tariff Code'];
    const quantityNames = ['Quantity', 'QUANTITY', 'Qty', 'Net Quantity', 'Weight'];
    const unitNames = ['Unit', 'UNIT', 'UQC', 'UOM'];
    const fobNames = ['FOB Value', 'FOB_VALUE', 'FOB', 'FOB USD', 'Fob Usd', 'Value', 'Amount'];
    const currencyNames = ['Currency', 'CURRENCY'];
    const portLoadingNames = ['Port of Loading', 'PORT_OF_LOADING', 'Indian Port', 'Loading Port', 'POL'];
    const portDischargeNames = ['Port of Discharge', 'PORT_OF_DISCHARGE', 'Foreign Port', 'Discharge Port', 'POD'];
    const countryNames = ['Country', 'COUNTRY', 'Destination Country', 'Country of Destination', 'Destination'];
    const dateNames = ['Shipment Date', 'SHIPMENT_DATE', 'Date', 'SB Date', 'Bill Date', 'Export Date'];

    for (const row of data) {
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
      
      // Parse date
      let shipmentDate = null, monthYear = null;
      const dateValue = findColumnValue(row, dateNames);
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

      if (uniqueId && uniqueId !== '') {
        try {
          await run(`INSERT INTO exports (declaration_id, exporter_name, consignee_name, product_description,
            product_category, data_type, hs_code, quantity, unit, fob_value, fob_currency, port_of_loading,
            port_of_discharge, country_of_destination, shipment_date, month_year, upload_batch)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uniqueId.toString().trim(), (exporterName || '').toString().trim().toUpperCase(),
             (consigneeName || '').toString().trim().toUpperCase(), (productDesc || '').toString().trim(),
             dataType, dataType, String(hsCode || '').trim(), quantity || 0, (unit || 'KGS').toString().trim(),
             fobValue || 0, (fobCurrency || 'USD').toString().trim(), (portLoading || '').toString().trim(),
             (portDischarge || '').toString().trim(), (countryDest || '').toString().trim(),
             shipmentDate, monthYear, uploadBatch]);
          inserted++;
        } catch (e) {
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    res.json({ success: true, message: `Processed ${data.length} rows`, inserted, skipped, dataType, columnsFound: columns });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= COMPETITORS ROUTES =============
app.get('/api/competitors', async (req, res) => {
  const competitors = await all('SELECT * FROM competitors WHERE active = 1 ORDER BY name');
  res.json(competitors);
});

app.get('/api/competitors/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  
  const searchTerm = q.trim().toUpperCase();
  const words = searchTerm.split(/\s+/).filter(w => w.length > 1);
  
  let query = `SELECT DISTINCT exporter_name as name, COUNT(*) as shipment_count, SUM(fob_value) as total_fob
    FROM exports WHERE exporter_name IS NOT NULL AND exporter_name != ''`;
  
  if (words.length > 0) {
    const conditions = words.map(() => `UPPER(exporter_name) LIKE ?`).join(' OR ');
    query += ` AND (${conditions})`;
  }
  query += ` GROUP BY exporter_name ORDER BY shipment_count DESC LIMIT 20`;
  
  const params = words.map(w => `%${w}%`);
  const results = await all(query, params);
  const tracked = await all('SELECT name FROM competitors WHERE active = 1');
  const trackedNames = new Set(tracked.map(t => t.name));
  
  res.json(results.map(r => ({ ...r, already_tracked: trackedNames.has(r.name) })));
});

app.post('/api/competitors', async (req, res) => {
  const { name, names } = req.body;
  const namesToAdd = names || [name];
  const added = [], errors = [];
  
  for (const n of namesToAdd) {
    if (!n || !n.trim()) continue;
    try {
      await run('INSERT INTO competitors (name) VALUES (?)', [n.trim().toUpperCase()]);
      added.push({ name: n.trim().toUpperCase() });
    } catch (err) {
      errors.push({ name: n, error: err.message.includes('UNIQUE') ? 'Already exists' : err.message });
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

app.get('/api/clients/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  
  const searchTerm = q.trim().toUpperCase();
  const words = searchTerm.split(/\s+/).filter(w => w.length > 1);
  
  let query = `SELECT DISTINCT consignee_name as name, COUNT(*) as shipment_count, SUM(fob_value) as total_fob
    FROM exports WHERE consignee_name IS NOT NULL AND consignee_name != ''`;
  
  if (words.length > 0) {
    const conditions = words.map(() => `UPPER(consignee_name) LIKE ?`).join(' OR ');
    query += ` AND (${conditions})`;
  }
  query += ` GROUP BY consignee_name ORDER BY shipment_count DESC LIMIT 20`;
  
  const params = words.map(w => `%${w}%`);
  const results = await all(query, params);
  const tracked = await all('SELECT name FROM clients WHERE active = 1');
  const trackedNames = new Set(tracked.map(t => t.name));
  
  res.json(results.map(r => ({ ...r, already_tracked: trackedNames.has(r.name) })));
});

app.post('/api/clients', async (req, res) => {
  const { name, names } = req.body;
  const namesToAdd = names || [name];
  const added = [], errors = [];
  
  for (const n of namesToAdd) {
    if (!n || !n.trim()) continue;
    try {
      await run('INSERT INTO clients (name) VALUES (?)', [n.trim().toUpperCase()]);
      added.push({ name: n.trim().toUpperCase() });
    } catch (err) {
      errors.push({ name: n, error: err.message.includes('UNIQUE') ? 'Already exists' : err.message });
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

// ============= ANALYTICS ROUTES =============
app.get('/api/analytics/months', async (req, res) => {
  const months = await all('SELECT DISTINCT month_year FROM exports WHERE month_year IS NOT NULL ORDER BY month_year DESC');
  res.json(months.map(m => m.month_year));
});

app.get('/api/analytics/dashboard', async (req, res) => {
  const { month } = req.query;
  let whereClause = '', params = [];
  if (month) { whereClause = 'WHERE month_year = ?'; params.push(month); }

  const summary = await get(`SELECT COUNT(DISTINCT declaration_id) as total_shipments, SUM(fob_value) as total_fob,
    COUNT(DISTINCT exporter_name) as unique_exporters, COUNT(DISTINCT consignee_name) as unique_consignees,
    COUNT(DISTINCT country_of_destination) as unique_countries, COUNT(DISTINCT product_description) as unique_products
    FROM exports ${whereClause}`, params);

  const byCategory = await all(`SELECT data_type, COUNT(DISTINCT declaration_id) as shipment_count, SUM(fob_value) as total_fob
    FROM exports ${whereClause} GROUP BY data_type`, params);

  const topExporters = await all(`SELECT exporter_name, COUNT(DISTINCT declaration_id) as shipment_count, SUM(fob_value) as total_fob
    FROM exports ${whereClause} GROUP BY exporter_name ORDER BY total_fob DESC LIMIT 10`, params);

  const topCountries = await all(`SELECT country_of_destination, COUNT(DISTINCT declaration_id) as shipment_count, SUM(fob_value) as total_fob
    FROM exports ${whereClause} GROUP BY country_of_destination ORDER BY total_fob DESC LIMIT 10`, params);

  res.json({ summary, byCategory, topExporters, topCountries });
});

app.get('/api/analytics/competitors', async (req, res) => {
  const { month } = req.query;
  const competitors = await all('SELECT name FROM competitors WHERE active = 1');
  const competitorNames = competitors.map(c => c.name);
  if (competitorNames.length === 0) return res.json({ competitors: [], comparison: [] });

  const placeholders = competitorNames.map(() => '?').join(',');
  let query = `SELECT exporter_name, COUNT(DISTINCT declaration_id) as shipment_count, SUM(fob_value) as total_fob,
    COUNT(DISTINCT product_description) as product_count, COUNT(DISTINCT country_of_destination) as country_count
    FROM exports WHERE UPPER(exporter_name) IN (${placeholders})`;
  const params = [...competitorNames];
  if (month) { query += ' AND month_year = ?'; params.push(month); }
  query += ' GROUP BY exporter_name ORDER BY total_fob DESC';

  const results = await all(query, params);
  res.json({ competitors: results, comparison: [] });
});

app.get('/api/analytics/clients', async (req, res) => {
  const { month } = req.query;
  const clients = await all('SELECT name FROM clients WHERE active = 1');
  const clientNames = clients.map(c => c.name);
  if (clientNames.length === 0) return res.json({ clients: [], comparison: [] });

  const placeholders = clientNames.map(() => '?').join(',');
  let query = `SELECT consignee_name, COUNT(DISTINCT declaration_id) as shipment_count, SUM(fob_value) as total_fob,
    COUNT(DISTINCT product_description) as product_count, COUNT(DISTINCT exporter_name) as supplier_count
    FROM exports WHERE UPPER(consignee_name) IN (${placeholders})`;
  const params = [...clientNames];
  if (month) { query += ' AND month_year = ?'; params.push(month); }
  query += ' GROUP BY consignee_name ORDER BY total_fob DESC';

  const results = await all(query, params);
  res.json({ clients: results, comparison: [] });
});

app.get('/api/analytics/entity-details', async (req, res) => {
  const { entity, type, month } = req.query;
  if (!entity || !type) return res.status(400).json({ error: 'Entity and type required' });

  const field = type === 'exporter' ? 'exporter_name' : 'consignee_name';
  const params = [entity.toUpperCase()];
  let monthFilter = '';
  if (month) { monthFilter = ' AND month_year = ?'; params.push(month); }

  const summary = await get(`SELECT COUNT(DISTINCT declaration_id) as total_shipments, SUM(fob_value) as total_fob,
    SUM(quantity) as total_quantity, COUNT(DISTINCT product_description) as unique_products,
    COUNT(DISTINCT country_of_destination) as unique_countries, MIN(shipment_date) as first_shipment, MAX(shipment_date) as last_shipment
    FROM exports WHERE UPPER(${field}) = ?${monthFilter}`, params);

  const products = await all(`SELECT product_description, hs_code, data_type, COUNT(DISTINCT declaration_id) as shipment_count,
    SUM(quantity) as total_quantity, SUM(fob_value) as total_fob, unit
    FROM exports WHERE UPPER(${field}) = ?${monthFilter} GROUP BY product_description, hs_code, data_type, unit ORDER BY total_fob DESC LIMIT 50`, params);

  const countries = await all(`SELECT country_of_destination, COUNT(DISTINCT declaration_id) as shipment_count, SUM(fob_value) as total_fob
    FROM exports WHERE UPPER(${field}) = ?${monthFilter} GROUP BY country_of_destination ORDER BY total_fob DESC`, params);

  const monthlyTrend = await all(`SELECT month_year, COUNT(DISTINCT declaration_id) as shipment_count, SUM(fob_value) as total_fob
    FROM exports WHERE UPPER(${field}) = ? AND month_year IS NOT NULL GROUP BY month_year ORDER BY month_year`, [entity.toUpperCase()]);

  const recentShipments = await all(`SELECT declaration_id, shipment_date, product_description, quantity, unit, fob_value,
    country_of_destination, consignee_name, exporter_name FROM exports WHERE UPPER(${field}) = ?${monthFilter} ORDER BY shipment_date DESC LIMIT 50`, params);

  res.json({ entity, type, summary, products, countries, ports: [], monthlyTrend, suppliers: [], clients: [], recentShipments });
});

app.get('/api/analytics/trends', async (req, res) => {
  const trends = await all(`SELECT month_year, COUNT(DISTINCT declaration_id) as shipment_count, SUM(fob_value) as total_fob
    FROM exports WHERE month_year IS NOT NULL GROUP BY month_year ORDER BY month_year`);
  res.json(trends);
});

// ============= FEEDBACK ROUTES =============
app.post('/api/feedback', async (req, res) => {
  const { user_name, feedback_type, message, page } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  await run('INSERT INTO feedback (user_name, feedback_type, message, page) VALUES (?, ?, ?, ?)',
    [user_name || 'Anonymous', feedback_type || 'general', message, page || '']);
  res.json({ success: true });
});

app.get('/api/feedback', async (req, res) => {
  const feedbacks = await all('SELECT * FROM feedback ORDER BY created_at DESC');
  res.json(feedbacks);
});

// ============= INTELLIGENCE ROUTES =============
app.get('/api/intelligence/prospective-clients', async (req, res) => {
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const companyName = company?.company_name || 'AGNA';
  
  const companyProducts = await all(`SELECT DISTINCT hs_code, product_description, data_type FROM exports WHERE UPPER(exporter_name) LIKE ?`, [`%${companyName}%`]);
  if (companyProducts.length === 0) return res.json({ message: 'No products found', prospectiveClients: [], companyProducts: [] });

  const hsCodeList = companyProducts.map(p => p.hs_code).filter(h => h);
  if (hsCodeList.length === 0) return res.json({ message: 'No HS codes found', prospectiveClients: [], companyProducts });

  const placeholders = hsCodeList.map(() => '?').join(',');
  const prospectiveClients = await all(`SELECT consignee_name, country_of_destination, COUNT(DISTINCT declaration_id) as total_shipments,
    SUM(fob_value) as total_fob, GROUP_CONCAT(DISTINCT exporter_name) as current_suppliers
    FROM exports WHERE hs_code IN (${placeholders}) AND UPPER(exporter_name) NOT LIKE ?
    AND consignee_name IS NOT NULL AND consignee_name != '' GROUP BY consignee_name, country_of_destination
    HAVING total_shipments >= 2 ORDER BY total_fob DESC LIMIT 100`, [...hsCodeList, `%${companyName}%`]);

  res.json({ companyName, companyProducts, prospectiveClients });
});

app.get('/api/intelligence/cross-sell', async (req, res) => {
  const company = await get('SELECT company_name FROM company_info LIMIT 1');
  const companyName = company?.company_name || 'AGNA';
  
  const companyClients = await all(`SELECT DISTINCT consignee_name FROM exports WHERE UPPER(exporter_name) LIKE ?
    AND consignee_name IS NOT NULL AND consignee_name != ''`, [`%${companyName}%`]);
  if (companyClients.length === 0) return res.json({ message: 'No clients found', crossSellOpportunities: [], clientCount: 0 });

  const clientNames = companyClients.map(c => c.consignee_name);
  res.json({ companyName, clientCount: clientNames.length, clientNames, crossSellOpportunities: [] });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: dbInitialized ? 'connected' : 'pending' });
});

// Debug endpoint - check environment variables
app.get('/api/debug', (req, res) => {
  const dbUrlSet = !!process.env.TURSO_DATABASE_URL;
  const tokenSet = !!process.env.TURSO_AUTH_TOKEN;
  const dbUrlStart = process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.substring(0, 30) + '...' : 'NOT SET';
  const tokenStart = process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.substring(0, 20) + '...' : 'NOT SET';
  
  res.json({
    env_vars: {
      TURSO_DATABASE_URL: dbUrlSet ? dbUrlStart : 'NOT SET',
      TURSO_AUTH_TOKEN: tokenSet ? tokenStart : 'NOT SET'
    },
    database_initialized: dbInitialized,
    using_local_fallback: dbUrl === 'file:local.db'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Export for Vercel
export default app;
