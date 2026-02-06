// Telegram Spending Tracker Bot
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');
const http = require('http');
require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;
const channelId = process.env.TELEGRAM_CHANNEL_ID;

if (!token || !channelId) {
  console.error('❌ Set TELEGRAM_TOKEN and TELEGRAM_CHANNEL_ID in .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const DATA_FILE = path.join(__dirname, 'data.json');

/* ─── debug ─────────────────────────────────────────────────────── */
bot.on('polling_error', e => console.error('polling_error:', e.message));

/* ─── data persistence ──────────────────────────────────────────── */
function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { daily: {}, monthly: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ─── helpers ───────────────────────────────────────────────────── */
function getToday() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function add(category, amount) {
  const data = loadData();
  const today = getToday();

  if (!data.daily[today]) data.daily[today] = {};
  data.daily[today][category] = (data.daily[today][category] || 0) + amount;

  // Store in monthly log
  data.monthly.push({ date: today, category, amount });

  saveData(data);
}

function getDailySummary() {
  const data = loadData();
  const today = getToday();
  const todayData = data.daily[today];

  if (!todayData || !Object.keys(todayData).length) {
    return '🕛 No spendings recorded today.';
  }

  const lines = Object.entries(todayData)
    .map(([cat, amt]) => `• ${cat}: ${amt.toLocaleString()}`);
  const total = Object.values(todayData).reduce((sum, amt) => sum + amt, 0);
  lines.push(`\n💰 Total: ${total.toLocaleString()}`);

  return lines.join('\n');
}

function getMonthlySummary(month = getCurrentMonth()) {
  const data = loadData();
  const monthlyEntries = data.monthly.filter(e => e.date.startsWith(month));

  if (!monthlyEntries.length) {
    return `📊 No spendings recorded for ${month}.`;
  }

  // Aggregate by category
  const byCategory = {};
  monthlyEntries.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });

  const lines = [`📊 Monthly Report: ${month}`];
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, amt]) => lines.push(`• ${cat}: ${amt.toLocaleString()}`));

  const total = monthlyEntries.reduce((sum, e) => sum + e.amount, 0);
  lines.push(`\n💰 Total: ${total.toLocaleString()}`);

  return lines.join('\n');
}

function hasTodaySpendings() {
  const data = loadData();
  const today = getToday();
  return data.daily[today] && Object.keys(data.daily[today]).length > 0;
}

/* ─── message handler ───────────────────────────────────────────── */
bot.on('channel_post', msg => {
  if (String(msg.chat.id) !== String(channelId) || !msg.text) return;

  const text = msg.text.trim();

  // Handle /total command - daily summary
  if (/^\/total(@\w+)?$/i.test(text)) {
    return bot.sendMessage(channelId, getDailySummary());
  }

  // Handle /monthly-total command - monthly summary
  if (/^\/monthly-total(@\w+)?$/i.test(text)) {
    return bot.sendMessage(channelId, getMonthlySummary());
  }

  // Parse spending: "Lunch 345" or "coffee 1,000"
  const match = text.match(/^(.+?)\s+([\d,]+)$/i);
  if (!match) return;

  const category = match[1].trim().toLowerCase();
  const amount = Number(match[2].replace(/,/g, ''));

  if (Number.isNaN(amount) || amount <= 0) return;

  add(category, amount);
  bot.sendMessage(channelId, `✔️ ${category}: ${amount.toLocaleString()}`);
});

/* ─── reminder at 23:00 if no spendings ─────────────────────────── */
schedule.scheduleJob({ tz: 'Asia/Dubai', hour: 23, minute: 0 }, () => {
  if (!hasTodaySpendings()) {
    bot.sendMessage(channelId, '⏰ Reminder: Please report your spendings for today!');
  }
});

/* ─── daily summary at 23:55 GMT+4 ──────────────────────────────── */
schedule.scheduleJob({ tz: 'Asia/Dubai', hour: 23, minute: 55 }, () => {
  bot.sendMessage(channelId, getDailySummary());
});

/* ─── monthly summary on last day at 23:50 ──────────────────────── */
schedule.scheduleJob({ tz: 'Asia/Dubai', hour: 23, minute: 50, date: 'L' }, () => {
  bot.sendMessage(channelId, getMonthlySummary());
});

/* ─── HTTP server for Render health check ───────────────────────── */
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running');
}).listen(PORT, () => {
  console.log(`🚀 Bot running. Channel: ${channelId}, Health check on port ${PORT}`);
});