# Export Data Explorer (EDE)

A comprehensive Indian Export Data Analysis System for tracking competitors, clients, and market trends from Indian sea and air port export data.

![EDE Dashboard](https://img.shields.io/badge/Platform-Web%20%7C%20Desktop%20%7C%20Mobile-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

### 📊 Data Import
- **Excel Upload**: Import monthly export data in Excel format (.xlsx, .xls)
- **Dual Categories**: Separate handling for Fruits and Vegetables data
- **Smart Parsing**: Flexible column mapping to handle various Excel formats
- **Duplicate Detection**: Uses Declaration ID to prevent duplicate entries

### 🎯 Competitor Tracking
- Add/remove competitors dynamically
- Track competitor shipments, FOB values, products, and destinations
- Month-over-month comparison with percentage changes
- Visual charts for competitor performance

### 👥 Client Monitoring
- Track client (consignee) purchasing patterns
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
- **FOB Values**: Total and segmented export values
- **Geographic Analysis**: Top destination countries
- **Category Breakdown**: Fruits vs Vegetables split
- **Trend Analysis**: Monthly patterns and growth

### 📑 Reports
- Interactive charts (Bar, Pie, Line, Area)
- Exportable data tables
- Month-over-month comparisons
- Customizable date ranges

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, Recharts
- **Backend**: Node.js, Express
- **Database**: SQLite (easily upgradable to PostgreSQL)
- **File Processing**: xlsx library

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd EDE
```

2. **Install dependencies**
```bash
npm run install:all
```

3. **Start development servers**
```bash
npm run dev
```

This will start:
- Backend API server on `http://localhost:3001`
- Frontend dev server on `http://localhost:5173`

## Excel Data Format

The system expects Excel files with the following columns (flexible naming):

| Column | Alternative Names | Description |
|--------|------------------|-------------|
| Declaration ID | Dec ID, DECLARATION_ID | Unique shipment identifier |
| Exporter Name | EXPORTER_NAME, Exporter | Company exporting goods |
| Consignee Name | CONSIGNEE_NAME, Buyer | Receiving party |
| Product Description | Product, Item | Product details |
| HS Code | HSCode | Harmonized System code |
| Quantity | Qty | Amount shipped |
| Unit | - | Unit of measurement (KGS, etc.) |
| FOB Value | FOB, Value | Free On Board value |
| Currency | - | Currency (defaults to USD) |
| Shipment Date | Date, SB Date | Date of shipment |
| Port of Loading | Indian Port | Indian port of export |
| Port of Discharge | Foreign Port | Destination port |
| Country | Destination Country | Destination country |

## Usage Guide

### 1. Configure Your Company
- Go to **Settings** tab
- Enter your company name (e.g., "AGNA")
- This name will be used to highlight your data in reports

### 2. Add Competitors
- Navigate to **Competitors** tab
- Enter competitor names exactly as they appear in export data
- Names are case-insensitive and stored in uppercase

### 3. Add Clients
- Go to **Clients** tab
- Add consignee/buyer names you want to track
- Monitor their purchasing patterns

### 4. Import Data
- Go to **Import Data** tab
- Select data type (Fruits or Vegetables)
- Upload Excel file
- System will parse and store the data

### 5. Analyze
- **Dashboard**: Overview of all data
- **Competitors**: Detailed competitor analysis
- **Clients**: Client purchase analysis
- **Company Analysis**: Your company vs competitors
- **Trends**: Historical patterns

## API Endpoints

### Competitors
- `GET /api/competitors` - List all competitors
- `POST /api/competitors` - Add competitor
- `DELETE /api/competitors/:id` - Remove competitor

### Clients
- `GET /api/clients` - List all clients
- `POST /api/clients` - Add client
- `DELETE /api/clients/:id` - Remove client

### Analytics
- `GET /api/analytics/dashboard` - Dashboard summary
- `GET /api/analytics/competitors` - Competitor analysis
- `GET /api/analytics/clients` - Client analysis
- `GET /api/analytics/company-comparison` - Company vs competitors
- `GET /api/analytics/trends` - Monthly trends
- `GET /api/analytics/months` - Available months

### Data
- `POST /api/upload` - Upload Excel file
- `GET /api/company` - Get company info
- `PUT /api/company` - Update company name

## Future Roadmap

### Phase 2: Desktop App
- Electron wrapper for Windows/Mac/Linux
- Offline capability
- Local data backup

### Phase 3: Mobile App
- React Native for Android
- Push notifications for important changes
- Quick view dashboards

### Phase 4: Advanced Features
- PDF report generation
- Email alerts for competitor activity
- Predictive analytics
- Multi-user support with roles

## Project Structure

```
EDE/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main application
│   │   ├── main.jsx       # Entry point
│   │   └── index.css      # Styles
│   ├── public/
│   └── package.json
├── server/
│   ├── index.js           # Express API server
│   ├── database.sqlite    # SQLite database (auto-created)
│   └── uploads/           # Temporary upload folder
├── package.json           # Root package.json
└── README.md
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use for personal and commercial projects.

## Support

For issues and feature requests, please open a GitHub issue.

---

Built with ❤️ for Indian Export Data Analysis

