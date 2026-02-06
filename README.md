# 💰 Accountant Telegram Bot

A simple yet powerful Telegram bot for tracking daily expenses directly from a Telegram channel. It supports natural language input, editing, automatic reporting, and data persistence.

## ✨ Features

- **📝 Easy Logging**: Just type `Category Amount` (e.g., `Lunch 150`).
- **🔄 Sync on Edit**: Editing a message automatically updates the database.
- **🗑️ Smart Deletion**: 
  - Edit a message to "invalid" text (e.g., "-") to remove it from the database.
  - The bot automatically deletes the "removed" message from the channel for a clean history.
- **⚡ /reset-day**: A command to wipe all today's data and auto-delete all spending messages.
- **📊 Auto-Reports**: 
  - Daily summary at 23:55.
  - Monthly summary on the last day of the month.
  - Reminder at 23:00 if no spendings were logged.
- **🌍 Timezone Aware**: Configured for `Asia/Dubai` time.

## 🚀 Setup

### Prerequisites
- Node.js installed.
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather)).
- A Telegram Channel (add the bot as an Admin with "Delete Messages" permission).

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd accountant-telegram-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   TELEGRAM_TOKEN=your_bot_token_here
   TELEGRAM_CHANNEL_ID=-100xxxxxxxxxx
   PORT=3000
   ```
   *Tip: To get your Channel ID, forward a message from the channel to [@userinfobot](https://t.me/userinfobot).*

4. **Run the Bot**
   ```bash
   npm start
   ```

## 📖 Usage Guide

### 1. Recording Expenses
Type the category followed by the amount in your channel.
- `Lunch 50`
- `Taxi 1,200`
- `Groceries 35.50`

The bot tracks it immediately.

### 2. Commands

| Command | Description |
|---------|-------------|
| `/total` | Show summary for **Today**. |
| `/monthly-total` | Show summary for the **Current Month**. |
| `/reset-day` | **Wipe today's data**. <br>• Asks for confirmation (Yes/No).<br>• Deletes all spending messages from the channel.<br>• Clears data from JSON. |
| `/help` | Show available commands and tips. |

### 3. Editing & Deleting (Important!)

Since Telegram bots cannot detect when you *manually delete* a message, we use an **Edit-based workflow**:

- **To Fix a Typos:**
  Simply **Edit** the message.
  *Example:* Change `Lunch 500` to `Lunch 50`.
  -> The bot detects the change, updates the total, and **preserves the original date**.

- **To Delete an Entry:**
  **Edit** the message to anything invalid (e.g., `del`, `-`, or just empty text).
  -> The bot will **remove the data** from the database AND **delete the message** from the channel automatically.

## ⚙️ Technical Details

- **Data Storage**: Data is stored locally in `data.json`.
- **Timezone**: Hardcoded to `Asia/Dubai` for all reports and date logic.
- **Health Check**: Runs a simple HTTP server on port 3000 (useful for hosting on Render/Heroku).

## 🕒 Schedule

- **23:00**: Reminder (if no spendings logged).
- **23:50**: Monthly Report (only on the last day of the month).
- **23:55**: Daily Report.
