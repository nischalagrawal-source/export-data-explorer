/**
 * Sample Data Generator for Export Data Explorer
 * Run: node scripts/generate-sample-data.js
 * 
 * This will create sample Excel files for testing the application.
 */

import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample data configurations
const exporters = [
  'AGNA EXPORTS PVT LTD',
  'APEX AGRO EXPORTS',
  'SUNRISE FRESH PRODUCE',
  'GREENLEAF INTERNATIONAL',
  'PREMIUM FRUITS INDIA',
  'ASIAN AGRI TRADERS',
  'FRESH HARVEST EXPORTS',
  'GOLDEN FARMS INDIA'
];

const consignees = [
  'FRESH FOODS LLC',
  'EUROPEAN PRODUCE GMBH',
  'MIDDLE EAST TRADERS FZE',
  'UK FRESH IMPORTS LTD',
  'ASIAN MARKET PTE',
  'GLOBAL FRUITS INC',
  'TROPICAL IMPORTS SA',
  'NORTHERN DISTRIBUTORS AB'
];

const fruitProducts = [
  { name: 'FRESH MANGOES ALPHONSO', hsCode: '08045010' },
  { name: 'FRESH MANGOES KESAR', hsCode: '08045010' },
  { name: 'FRESH GRAPES THOMPSON', hsCode: '08061000' },
  { name: 'FRESH POMEGRANATE', hsCode: '08109020' },
  { name: 'FRESH BANANA CAVENDISH', hsCode: '08039010' },
  { name: 'FRESH PAPAYA', hsCode: '08072000' },
  { name: 'FRESH GUAVA', hsCode: '08045020' },
  { name: 'FRESH WATERMELON', hsCode: '08071100' }
];

const vegetableProducts = [
  { name: 'FRESH ONION RED', hsCode: '07031010' },
  { name: 'FRESH POTATO', hsCode: '07019000' },
  { name: 'FRESH GREEN CHILLI', hsCode: '07096010' },
  { name: 'FRESH TOMATO', hsCode: '07020000' },
  { name: 'FRESH OKRA (LADYFINGER)', hsCode: '07099990' },
  { name: 'FRESH BITTER GOURD', hsCode: '07099990' },
  { name: 'FRESH DRUMSTICK', hsCode: '07099990' },
  { name: 'FRESH GINGER', hsCode: '09101110' }
];

const indianPorts = [
  'JNPT MUMBAI',
  'CHENNAI PORT',
  'MUNDRA PORT',
  'COCHIN PORT',
  'TUTICORIN PORT',
  'DELHI AIR CARGO',
  'MUMBAI AIR CARGO',
  'BANGALORE AIR CARGO'
];

const destinations = [
  { country: 'UAE', ports: ['DUBAI', 'ABU DHABI', 'SHARJAH'] },
  { country: 'USA', ports: ['NEW YORK', 'LOS ANGELES', 'CHICAGO'] },
  { country: 'UK', ports: ['LONDON', 'MANCHESTER', 'BIRMINGHAM'] },
  { country: 'GERMANY', ports: ['HAMBURG', 'FRANKFURT', 'MUNICH'] },
  { country: 'NETHERLANDS', ports: ['ROTTERDAM', 'AMSTERDAM'] },
  { country: 'SINGAPORE', ports: ['SINGAPORE'] },
  { country: 'QATAR', ports: ['DOHA'] },
  { country: 'SAUDI ARABIA', ports: ['JEDDAH', 'RIYADH'] }
];

// Helper functions
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDeclarationId(index, month, year) {
  return `DEC${year}${String(month).padStart(2, '0')}${String(index).padStart(5, '0')}`;
}

function generateDate(month, year) {
  const day = randomInt(1, 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function generateShipment(index, month, year, products) {
  const destination = randomElement(destinations);
  const product = randomElement(products);
  const quantity = randomInt(100, 10000);
  const fobPerKg = randomInt(1, 15) + Math.random();
  const fobValue = Math.round(quantity * fobPerKg * 100) / 100;

  return {
    'Declaration ID': generateDeclarationId(index, month, year),
    'Exporter Name': randomElement(exporters),
    'Consignee Name': randomElement(consignees),
    'Product Description': product.name,
    'HS Code': product.hsCode,
    'Quantity': quantity,
    'Unit': 'KGS',
    'FOB Value': fobValue,
    'Currency': 'USD',
    'Port of Loading': randomElement(indianPorts),
    'Port of Discharge': randomElement(destination.ports),
    'Country': destination.country,
    'Shipment Date': generateDate(month, year)
  };
}

function generateMonthData(month, year, products, count) {
  const data = [];
  for (let i = 1; i <= count; i++) {
    data.push(generateShipment(i, month, year, products));
  }
  return data;
}

// Main generation function
function generateSampleFiles() {
  const outputDir = path.join(__dirname, '..', 'sample-data');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const year = 2024;
  const months = [10, 11, 12]; // October, November, December

  for (const month of months) {
    // Generate fruits data
    const fruitsData = generateMonthData(month, year, fruitProducts, randomInt(80, 150));
    const fruitsWb = XLSX.utils.book_new();
    const fruitsWs = XLSX.utils.json_to_sheet(fruitsData);
    XLSX.utils.book_append_sheet(fruitsWb, fruitsWs, 'Export Data');
    
    const fruitsFilename = `fruits_export_${year}_${String(month).padStart(2, '0')}.xlsx`;
    XLSX.writeFile(fruitsWb, path.join(outputDir, fruitsFilename));
    console.log(`✅ Generated: ${fruitsFilename} (${fruitsData.length} records)`);

    // Generate vegetables data
    const vegData = generateMonthData(month, year, vegetableProducts, randomInt(100, 200));
    const vegWb = XLSX.utils.book_new();
    const vegWs = XLSX.utils.json_to_sheet(vegData);
    XLSX.utils.book_append_sheet(vegWb, vegWs, 'Export Data');
    
    const vegFilename = `vegetables_export_${year}_${String(month).padStart(2, '0')}.xlsx`;
    XLSX.writeFile(vegWb, path.join(outputDir, vegFilename));
    console.log(`✅ Generated: ${vegFilename} (${vegData.length} records)`);
  }

  console.log('\n🎉 Sample data generation complete!');
  console.log(`📁 Files saved to: ${outputDir}`);
  console.log('\nSuggested competitors to track:');
  exporters.filter(e => e !== 'AGNA EXPORTS PVT LTD').forEach(e => console.log(`  - ${e}`));
  console.log('\nSuggested clients to track:');
  consignees.forEach(c => console.log(`  - ${c}`));
}

generateSampleFiles();

