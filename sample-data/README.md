# Sample Data Templates

This folder contains sample Excel templates and data for testing the Export Data Explorer.

## Excel Template Structure

Your Excel files should have columns matching these names (case-insensitive, flexible naming accepted):

### Required Columns:
| Column Name | Description | Example |
|-------------|-------------|---------|
| Declaration ID | Unique shipment identifier | DEC2024001234 |
| Exporter Name | Company exporting goods | AGNA EXPORTS PVT LTD |
| Consignee Name | Buyer/receiver of goods | FRESH FOODS LLC |
| Product Description | Product details | FRESH MANGOES ALPHONSO |
| FOB Value | Free On Board value (number) | 15000.50 |
| Shipment Date | Date of shipment | 2024-01-15 |

### Optional but Recommended:
| Column Name | Description | Example |
|-------------|-------------|---------|
| HS Code | Harmonized System code | 08045010 |
| Quantity | Amount shipped | 5000 |
| Unit | Unit of measurement | KGS |
| Currency | Currency code | USD |
| Port of Loading | Indian export port | JNPT MUMBAI |
| Port of Discharge | Destination port | DUBAI |
| Country | Destination country | UAE |

## Alternative Column Names

The system accepts these alternative names:

- **Declaration ID**: Dec ID, DECLARATION_ID, declaration_id
- **Exporter Name**: EXPORTER_NAME, exporter_name, Exporter
- **Consignee Name**: CONSIGNEE_NAME, consignee_name, Consignee, Buyer
- **Product Description**: PRODUCT_DESCRIPTION, product_description, Product, Item
- **FOB Value**: FOB_VALUE, fob_value, FOB, Value
- **Shipment Date**: SHIPMENT_DATE, shipment_date, Date, SB Date
- **Country**: COUNTRY, country, Destination Country, Country of Destination

## Sample Companies for Testing

### Competitors (Exporters):
1. APEX AGRO EXPORTS
2. SUNRISE FRESH PRODUCE
3. GREENLEAF INTERNATIONAL
4. PREMIUM FRUITS INDIA
5. ASIAN AGRI TRADERS

### Clients (Consignees):
1. FRESH FOODS LLC (USA)
2. EUROPEAN PRODUCE GMBH (Germany)
3. MIDDLE EAST TRADERS FZE (UAE)
4. UK FRESH IMPORTS LTD (UK)
5. ASIAN MARKET PTE (Singapore)

## Tips

1. **Unique Declaration IDs**: Each shipment should have a unique Declaration ID
2. **Consistent Names**: Use consistent company names across all records
3. **Date Format**: Use standard date formats (YYYY-MM-DD, DD/MM/YYYY, etc.)
4. **FOB Values**: Numeric values without currency symbols
5. **Monthly Data**: Upload data monthly for best trend analysis

