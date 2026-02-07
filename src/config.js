const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
require('dotenv').config();


process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason instanceof Error ? reason.message : String(reason));
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});

const token = process.env.TELEGRAM_TOKEN;
const channelId = process.env.TELEGRAM_CHANNEL_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://accountant-telegram-bot.onrender.com';

if (!token || !channelId) {
  console.error('❌ Set TELEGRAM_TOKEN and TELEGRAM_CHANNEL_ID in .env');
  process.exit(1);
}

const bot = new TelegramBot(token);
const DATA_FILE = path.join(__dirname, '..', 'data.json');

module.exports = { bot, channelId, DATA_FILE, token, WEBHOOK_URL };
