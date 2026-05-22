# Thermal Print Service Setup

## Overview

This print service handles silent thermal printing for the Balaji Bill Generator POS system. It communicates with thermal printers via ESC/POS protocol over USB and TCP/IP connections.

## Architecture

```
Frontend (Next.js/React)
    ↓ (fetch POST /print)
localhost:5000 Print Service
    ↓
Thermal Printers (USB + Network)
```

## Printer Configuration

### POS-X THERMAL PRINTER (USB)
- **Address**: `printer:POS-X`
- **Type**: EPSON Thermal Printer
- **Windows Setup**: Add printer named "POS-X" in Windows Printer Settings

### KITCHEN PRINTER 1 (Network)
- **Address**: `tcp://192.168.1.16:9100`
- **IP**: 192.168.1.16
- **Port**: 9100 (ESC/POS over TCP)

### KITCHEN PRINTER 2 (Network)
- **Address**: `tcp://192.168.1.87:9100`
- **IP**: 192.168.1.87
- **Port**: 9100 (ESC/POS over TCP)

## Installation

### Prerequisites
- Node.js 16+ installed
- Print service dependencies already in package.json:
  - `express`
  - `cors`
  - `node-thermal-printer`

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Print Service
From project root:
```bash
node print-service/server.js
```

You should see:
```
╔════════════════════════════════════════════════════╗
║  🖨️  Thermal Print Service Running                 ║
║  📍 http://localhost:5000                           ║
║  📋 POST /print    - Print bill to all printers     ║
║  🧪 GET  /test-print - Test print on POS-X         ║
║  💚 GET  /          - Health check                  ║
╚════════════════════════════════════════════════════╝
```

### Step 3: Start Billing App
In another terminal:
```bash
npm run dev
```

Open http://localhost:3000

## API Endpoints

### POST /print
**Purpose**: Print bill to all printers (2 copies POS-X + kitchen copies)

**Request Body**:
```json
{
  "billNo": "12345",
  "businessName": "BALAJI FOOD ARTS",
  "tokenNo": 1,
  "date": "5/20/2026",
  "time": "2:30 PM",
  "items": [
    {
      "name": "Paneer Butter Masala",
      "qty": 1,
      "price": 250
    }
  ],
  "grandTotal": 250
}
```

**Response**:
```json
{
  "success": true,
  "message": "Print jobs processed",
  "results": [
    {
      "success": true,
      "message": "Printed successfully: CUSTOMER COPY",
      "printerInterface": "printer:POS-X"
    }
  ],
  "billNo": "12345"
}
```

### GET /test-print
**Purpose**: Test print on POS-X Thermal Printer

**Response**:
```json
{
  "success": true,
  "message": "Printed successfully: TEST COPY",
  "result": {
    "success": true,
    "message": "Printed successfully: TEST COPY",
    "printerInterface": "printer:MASTER"
  }
}
```

### GET /
**Purpose**: Health check

**Response**:
```json
{
  "status": "ok",
  "service": "Thermal Print Service",
  "version": "1.0.0",
  "port": 5000
}
```

## Usage in Billing App

1. **Generate Bill**: Click "Generate Bill" button
2. **Print Bill**: Click "Print Bill" button
   - If service is running: Prints to all printers silently
   - If service is down: Shows error message with instructions
3. **Button States**:
   - Enabled: When bill is generated and not currently printing
   - Disabled: When printing in progress
   - Shows "Printing..." while processing

## Error Handling

### Print Service Not Running
**Error Message**: "Print service not running. Start it with: node print-service/server.js"

**Solution**: 
```bash
node print-service/server.js
```

### Printer Not Connected
**Error Message**: "Print service not running..." or printer-specific failure

**Solution**:
1. Check printer is powered on
2. For USB printer: Verify printer named "POS-X" exists in Windows Printer Settings
3. For Network printers: Verify IP addresses are correct and printers are on network
4. Run test: `curl http://localhost:5000/test-print`

### Network/Connection Issues
**Error Message**: "Print error: ..." with specific details

**Debug**:
```bash
# Check if service is running
curl http://localhost:5000/

# Test printer connectivity
curl http://localhost:5000/test-print

# Check service logs in terminal where it's running
```

## Troubleshooting

### Printer Not Printing
1. **Verify printer is on network/USB**
   ```bash
   # Windows: Check Device Manager for USB printer
   # Network: Ping printer IP
   ping 192.168.1.16
   ```

2. **Check Windows Printer Settings**
   - Settings → Devices → Printers & Scanners
   - USB printer should be listed and named "POS-X"

3. **Run test print**
   ```bash
   curl http://localhost:5000/test-print
   ```

4. **Check service logs** - Look at terminal where `node print-service/server.js` is running

### Service Won't Start
1. **Port 5000 already in use**
   ```bash
   # Find process using port 5000
   netstat -ano | findstr :5000
   
   # Kill process (replace PID with actual)
   taskkill /PID <PID> /F
   ```

2. **Dependencies missing**
   ```bash
   npm install
   ```

3. **Node.js not found**
   - Install Node.js from https://nodejs.org/

## Manual Testing

### Test Health Check
```bash
curl http://localhost:5000/
```

### Test Printer
```bash
curl http://localhost:5000/test-print
```

### Test Full Print
```bash
curl -X POST http://localhost:5000/print \
  -H "Content-Type: application/json" \
  -d '{
    "billNo": "TEST123",
    "businessName": "BALAJI FOOD ARTS",
    "tokenNo": 1,
    "date": "5/20/2026",
    "time": "2:30 PM",
    "items": [
      {"name": "Sample Item", "qty": 2, "price": 100}
    ],
    "grandTotal": 200
  }'
```

## Windows Auto-Start Setup (Optional)

To auto-start the print service when Windows boots:

1. Create a batch file `start-print-service.bat` in project root:
```batch
@echo off
cd /d "%~dp0"
node print-service/server.js
```

2. Create Windows Task Scheduler task to run this at startup

3. Or use a process manager like PM2:
```bash
npm install -g pm2
pm2 start print-service/server.js --name "thermal-printer"
pm2 startup
pm2 save
```

## File Structure

```
print-service/
  └── server.js          # Thermal print service (Node.js/Express)

services/
  └── printApi.js        # Frontend API wrapper for print service

app/page.js              # Updated with thermal printer integration
```

## Production Packaging

For packaging as EXE, consider:

1. **Simple**: Use PM2 + pkg
   ```bash
   npm install -g pkg
   pkg . --targets win-x64
   ```

2. **Better**: Use Electron for standalone desktop app

3. **Alternative**: Use NSIS/InnoSetup for installer that auto-starts service

## Performance Notes

- Print jobs execute **sequentially** for reliability
- Each print takes ~2-5 seconds depending on receipt size
- Service can handle ~15-20 prints/minute
- TCP network latency is ~50-200ms per printer

## Support

For issues:
1. Check error message in billing app UI
2. Check service terminal logs
3. Run test endpoints
4. Verify printer connections
5. Review this documentation

