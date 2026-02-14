# 💰 Accountant Telegram Bot

A Telegram bot for tracking daily expenses in a channel. Supports multiple currencies with automatic conversion to AMD (Armenian Dram).

## ✨ Features

- **📝 Easy Logging**: Type `Category Amount` (e.g., `Lunch 150`) or `Category Amount Currency` (e.g., `Coffee 5 USD`)
- **📋 Multi-Line**: Record multiple expenses in one message (one per line)
- **💱 Multi-Currency**: 300+ currencies supported (fiat, crypto, metals) with real-time conversion to AMD
- **🔄 Sync on Edit**: Editing a message automatically updates the database
- **🗑️ Smart Deletion**: Edit to invalid text (e.g., `-`) to remove entry and message
- **⚡ /reset-day**: Wipe today's data and delete all spending messages
- **📊 Auto-Reports**: Daily summary at 23:55, monthly on last day, reminder at 23:00

## 💱 Currency Support

Supports **300+ currencies** including:
- **Fiat**: USD, EUR, GBP, RUB, GEL, TRY, AED, CNY, JPY, VND, THB...
- **Crypto**: BTC, ETH, USDT, SOL, BNB, XRP, DOGE...
- **Metals**: XAU (gold), XAG (silver), XPT (platinum)

**Examples:**
```
Lunch 345           → 345 AMD
Coffee 5.50 USD     → ~2,255 AMD
Dinner 10 EUR       → ~4,200 AMD
Savings 0.001 BTC   → ~40,000 AMD
```

Powered by [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api) (free, no rate limits).

## 🚀 Setup

### Prerequisites
- Node.js installed
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Telegram Channel (add bot as Admin with "Delete Messages" permission)

### Installation

```bash
git clone <repository-url>
cd accountant-telegram-bot
npm install
```

### Configuration
Create `.env` file:
```env
TELEGRAM_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL_ID=-100xxxxxxxxxx
PORT=3000
```

### Run
```bash
npm start      # Production
npm run dev    # Development (with hot reload)
```

## 📖 Commands

| Command | Description |
|---------|-------------|
| `/total [YYYY-MM-DD]` | Summary for today or a specific date (table + CSV file) |
| `/monthly-total` | Current month's summary |
| `/reset-day` | Wipe today's data (with confirmation) |
| `/help` | Show help message |

## 📝 Recording Expenses

**Single expense:**
```
Category Amount [Currency]
```

| Input | Result |
|-------|--------|
| `Lunch 50` | 50 AMD |
| `Coffee 5 USD` | ~2,050 AMD |
| `Taxi 1,000` | 1,000 AMD |
| `Crypto 0.001 BTC` | ~40,000 AMD |

**Multiple expenses in one message:**
```
Coffee 500
Lunch 3500
Transport 10 USD
```

**Add past expense (single line):**
```
/add-past 2026-02-07 lunch 5000
```

**Add past expenses (multi-line):**
```
/add-past 2026-02-07
Coffee 500
Lunch 1500 USD
```

## ✏️ Editing & Deleting

- **Fix typo**: Edit the message → data updates automatically
- **Delete entry**: Edit to `-` or invalid text → removes from database and deletes message

## 📊 Reports

**Daily (`/total`)**:
```
📊 Spendings for 2026-02-07

Category            Amount (AMD)   Original
--------------------------------------------------
Coffee              2,050          (5 USD)
Lunch               4,200          (10 EUR)
Bread               500            
--------------------------------------------------
TOTAL               6,750          (5 USD + 10 EUR)
```

**Monthly (`/monthly-total`)**:
```
📊 Monthly Report: 2026-02
• Coffee: 8,200 AMD (10 USD + 5 EUR)
• Lunch: 4,200 AMD (10 EUR)

💰 Total: 12,400 AMD (10 USD + 15 EUR)
```

## ⚙️ Technical Details

- **Data Storage**: `data.json` (local file)
- **Timezone**: Uses message timestamps; set `TZ` env variable
- **Health Check**: HTTP server on port 3000
- **Exchange Rates**: Cached for 1 hour

## 🕒 Schedule

- **23:00**: Reminder (if no spendings logged)
- **23:50**: Monthly Report (last day of month)
- **23:55**: Daily Report
