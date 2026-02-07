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

if (!token || !channelId) {
  console.error('❌ Set TELEGRAM_TOKEN and TELEGRAM_CHANNEL_ID in .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const DATA_FILE = path.join(__dirname, '..', 'data.json');

bot.on('polling_error', e => console.error('polling_error:', e.message));

module.exports = { bot, channelId, DATA_FILE };
