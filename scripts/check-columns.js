/**
 * Quick script to check Excel column names
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'Data');

// Find first Excel file
function findFirstFile(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFirstFile(fullPath);
      if (found) return found;
    } else if (entry.name.endsWith('.xlsx')) {
      return fullPath;
    }
  }
  return null;
}

const filePath = findFirstFile(dataDir);
if (filePath) {
  console.log('Checking file:', filePath);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  if (data.length > 0) {
    console.log('\nColumn names found:');
    const columns = Object.keys(data[0]);
    columns.forEach((col, i) => {
      console.log(`  ${i + 1}. "${col}"`);
    });
    
    console.log('\n\nFirst row data:');
    console.log(JSON.stringify(data[0], null, 2));
  }
} else {
  console.log('No Excel files found');
}
