# Export Data Explorer (EDE)

A comprehensive Indian Export Data Analysis System for tracking competitors, clients, and market trends from Indian sea and air port export data.

![Platform](https://img.shields.io/badge/Platform-Web-blue)
![Node](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-green)

## 🌐 Live Demo

**Access the app:** [Your Railway URL here]

> Replace with your deployed URL after Railway deployment

---

## ✨ Features

### 📊 Data Import
- **Excel Upload**: Import monthly export data in Excel format (.xlsx, .xls)
- **Dual Categories**: Separate handling for Fruits and Vegetables data
- **Smart Column Detection**: Flexible column mapping to handle various Indian export data formats
- **Duplicate Detection**: Uses Declaration ID + Date + Product combination for uniqueness
- **Bulk Processing**: Handles large files (50,000+ records) efficiently

### 🎯 Competitor Tracking
- Add/remove competitors dynamically
- **Fuzzy Search**: Find competitors with partial name matching
- Track shipments, FOB values, products, and destinations
- Month-over-month comparison with percentage changes
- Visual charts for competitor performance
- **Detailed Analysis**: Click any competitor for in-depth breakdown

### 👥 Client Monitoring
- Track client (consignee) purchasing patterns
- **Smart Name Handling**: "TO ORDER" and similar placeholders shown as "Name Not Available"
- Monitor which suppliers they're buying from
- Analyze product diversity and volume trends
- Historical comparison reports

### 🏢 Company Analysis (AGNA)
- Compare your company against all tracked competitors
- Market position visualization
- Performance metrics side-by-side
- Highlight your data in all reports

### 📈 Analytics Dashboard
- **Total Shipments**: Count based on unique Declaration IDs
- **FOB Values**: Displayed in both USD and INR (₹)
- **Geographic Analysis**: Top destination countries
- **Category Breakdown**: Fruits vs Vegetables split
- **Trend Analysis**: Monthly patterns and growth

### 🧠 Intelligence Tab
- **Prospective Clients**: Find potential buyers purchasing similar products from competitors
- **Cross-Sell Analysis**: Identify products your existing clients buy from competitors

### 📑 Reports & Export
- Interactive charts (Bar, Pie, Line, Area)
- **PDF Export**: Download detailed competitor/client analysis as PDF
- **Excel Export**: Export data tables
- Month-over-month comparisons
- Customizable date ranges

### 💬 Feedback System
- Built-in feedback button for users to report bugs, suggestions, or questions
- All feedback saved with timestamp and page context

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TailwindCSS, Chart.js |
| **Backend** | Node.js, Express |
| **Database** | SQLite (sql.js - pure JavaScript) |
| **File Processing** | xlsx library |
| **PDF Generation** | html2canvas, jspdf |

---

## 🚀 Deployment

### Deploy to Railway (Recommended)

1. **Fork/Clone this repository to your GitHub**

2. **Go to [Railway.app](https://railway.app)**
   - Sign in with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select `export-data-explorer`
   - Click "Deploy Now"

3. **Generate Public URL**
   - Go to Settings → Networking → Generate Domain
   - Share the URL with your team!

### Local Development

```bash
# Clone the repository
git clone https://github.com/nischalagrawal-source/export-data-explorer.git
cd export-data-explorer

# Install all dependencies
npm run install:all

# Start development servers
npm run dev
```

This will start:
- Backend API server on `http://localhost:3001`
- Frontend dev server on `http://localhost:5173`

### Production Build

```bash
# Build frontend
npm run build

# Start production server
npm start
```

---

## 📋 Excel Data Format

The system accepts Indian export data Excel files with flexible column naming:

| Column | Accepted Names | Description |
|--------|---------------|-------------|
| Declaration ID | SB No, Shipping Bill No, Dec ID | Unique shipment identifier |
| Exporter Name | Indian Exporter, Exporter | Company exporting goods |
| Consignee Name | Foreign Buyer, Buyer, Consignee | Receiving party |
| Product Description | Goods Description, Product, Item | Product details |
| HS Code | HSCode, HS | Harmonized System code |
| Quantity | Qty | Amount shipped |
| Unit | UQC | Unit of measurement (KGS, etc.) |
| FOB Value | FOB USD, Fob Usd, Value | Free On Board value in USD |
| Shipment Date | Date, SB Date | Date of shipment |
| Port of Loading | Indian Port | Indian port of export |
| Port of Discharge | Foreign Port, Destination Port | Destination port |
| Country | Destination Country | Destination country |

---

## 📖 Usage Guide

### 1. Import Data
- Go to **Import Data** tab
- Select category (Fruits or Vegetables)
- Upload your Excel file
- Wait for processing (large files may take 1-2 minutes)

### 2. Add Competitors
- Navigate to **Competitors** tab
- Type competitor name (partial matching supported)
- Select from suggestions or add new
- Click on any competitor for detailed analysis

### 3. Add Clients
- Go to **Clients** tab
- Add buyer/consignee names you want to track
- Click for detailed purchasing analysis

### 4. View Dashboard
- **Dashboard** shows overall statistics
- Use month filter to view specific periods
- Charts show trends and breakdowns

### 5. Use Intelligence
- **Prospective Clients**: Find new potential customers
- **Cross-Sell**: Identify upselling opportunities

### 6. Export Reports
- Click "Export Report" on any detail view
- Downloads as PDF with all charts and data

---

## 🔌 API Endpoints

### Data Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload Excel file |
| GET | `/api/dashboard/summary` | Dashboard statistics |
| GET | `/api/dashboard/monthly-trend` | Monthly trends |

### Competitors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/competitors` | List tracked competitors |
| POST | `/api/competitors` | Add competitor |
| DELETE | `/api/competitors/:id` | Remove competitor |
| GET | `/api/competitors/search?q=` | Search with fuzzy matching |
| GET | `/api/entity/competitor/:name/details` | Detailed analysis |

### Clients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | List tracked clients |
| POST | `/api/clients` | Add client |
| DELETE | `/api/clients/:id` | Remove client |
| GET | `/api/clients/search?q=` | Search with fuzzy matching |
| GET | `/api/entity/client/:name/details` | Detailed analysis |

### Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/intelligence/prospective-clients` | Find potential buyers |
| GET | `/api/intelligence/cross-sell` | Cross-sell opportunities |

### Feedback
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/feedback` | Submit feedback |
| GET | `/api/feedback` | View all feedback |

---

## 📁 Project Structure

```
export-data-explorer/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main application component
│   │   ├── main.jsx       # Entry point
│   │   └── index.css      # TailwindCSS styles
│   ├── public/
│   ├── dist/              # Production build (generated)
│   └── package.json
├── server/
│   ├── index.js           # Express API server
│   ├── database.sqlite    # SQLite database (auto-created)
│   └── uploads/           # Temporary upload folder
├── sample-data/           # Sample data templates
├── scripts/               # Utility scripts
├── package.json           # Root package.json
├── railway.json           # Railway deployment config
├── Procfile              # Process file for deployment
└── README.md
```

---

## 🗺️ Roadmap

- [x] Web Application
- [x] Excel Import with smart column detection
- [x] Competitor & Client tracking
- [x] Dashboard with charts
- [x] Intelligence (Prospective Clients, Cross-sell)
- [x] PDF Export
- [x] Dual currency display (USD/INR)
- [x] Feedback system
- [x] Cloud deployment (Railway)
- [ ] Desktop App (Electron)
- [ ] Mobile App (Android)
- [ ] Email alerts
- [ ] Multi-user support

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 Feedback

Use the in-app feedback button (yellow chat icon) or [open a GitHub issue](https://github.com/nischalagrawal-source/export-data-explorer/issues).

---

## 📄 License

MIT License - feel free to use for personal and commercial projects.

---

Built with ❤️ for Indian Export Data Analysis
