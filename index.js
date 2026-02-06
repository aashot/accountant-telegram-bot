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
  // Use Asia/Dubai to match the scheduler
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }); // YYYY-MM-DD
}

function getCurrentMonth() {
  return getToday().slice(0, 7); // YYYY-MM
}

function add(category, amount, messageId) {
  const data = loadData();

  // Idempotency check: don't add if messageId already exists
  if (messageId && data.monthly.some(e => e.messageId === messageId)) {
    return;
  }

  const today = getToday();

  if (!data.daily[today]) data.daily[today] = {};
  data.daily[today][category] = (data.daily[today][category] || 0) + amount;

  // Store in monthly log with message ID for tracking
  data.monthly.push({ date: today, category, amount, messageId });

  saveData(data);
}

function updateSpending(messageId, newCategory, newAmount) {
  const data = loadData();
  const entry = data.monthly.find(e => e.messageId === messageId);

  if (!entry) return false;

  // Calculate difference to update daily totals
  const oldDate = entry.date;
  const oldCategory = entry.category;
  const oldAmount = entry.amount;

  // 1. Revert old amount from daily totals
  if (data.daily[oldDate] && data.daily[oldDate][oldCategory]) {
    data.daily[oldDate][oldCategory] -= oldAmount;

    // Cleanup if zero or empty
    if (data.daily[oldDate][oldCategory] <= 0) {
      delete data.daily[oldDate][oldCategory];
    }
    if (Object.keys(data.daily[oldDate]).length === 0) {
      delete data.daily[oldDate];
    }
  }

  // 2. Add new amount to daily totals (PRESERVING THE ORIGINAL DATE)
  // We assume the date of transaction shouldn't change just because we fixed a typo
  if (!data.daily[oldDate]) data.daily[oldDate] = {};
  data.daily[oldDate][newCategory] = (data.daily[oldDate][newCategory] || 0) + newAmount;

  // 3. Update the monthly entry
  // entry.date remains unchanged
  entry.category = newCategory;
  entry.amount = newAmount;

  saveData(data);
  return true;
}

function removeSpending(messageId) {
  const data = loadData();
  const entryIndex = data.monthly.findIndex(e => e.messageId === messageId);

  if (entryIndex === -1) return false;

  const entry = data.monthly[entryIndex];

  // Subtract from daily totals
  if (data.daily[entry.date] && data.daily[entry.date][entry.category]) {
    data.daily[entry.date][entry.category] -= entry.amount;
    if (data.daily[entry.date][entry.category] <= 0) {
      delete data.daily[entry.date][entry.category];
    }
    if (Object.keys(data.daily[entry.date]).length === 0) {
      delete data.daily[entry.date];
    }
  }

  // Remove from monthly log
  data.monthly.splice(entryIndex, 1);

  saveData(data);
  return true;
}

async function resetDay() {
  const data = loadData();
  const today = getToday();

  // Get all message IDs for today
  const todayMessageIds = data.monthly
    .filter(e => e.date === today && e.messageId)
    .map(e => e.messageId);

  // Delete messages from channel
  const deletePromises = todayMessageIds.map(msgId =>
    bot.deleteMessage(channelId, msgId).catch(err => {
      console.log(`Could not delete message ${msgId}: ${err.message}`);
    })
  );
  await Promise.all(deletePromises);

  // Clear today's data
  delete data.daily[today];
  data.monthly = data.monthly.filter(e => e.date !== today);

  saveData(data);

  return todayMessageIds.length;
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
bot.on('channel_post', async msg => {
  if (String(msg.chat.id) !== String(channelId) || !msg.text) return;

  const text = msg.text.trim();

  // Handle /help command
  if (/^\/help(@\w+)?$/i.test(text)) {
    const helpText = `📋 *Available Commands*

/total - Show today's spendings
/monthly-total - Show this month's spendings
/reset-day - Reset all today's spendings and delete messages
/help - Show this help message

📝 *How to record spendings:*
Just type: \`Category Amount\`
Examples: \`Lunch 345\` or \`Coffee 1,000\`

✏️ *Edit/Delete:*
Edit or delete your spending message to update the data.`;
    return bot.sendMessage(channelId, helpText, { parse_mode: 'Markdown' });
  }

  // Handle /total command - daily summary
  if (/^\/total(@\w+)?$/i.test(text)) {
    return bot.sendMessage(channelId, getDailySummary());
  }

  // Handle /monthly-total command - monthly summary
  if (/^\/monthly-total(@\w+)?$/i.test(text)) {
    return bot.sendMessage(channelId, getMonthlySummary());
  }

  // Handle /reset-day command - ask for confirmation
  if (/^\/reset-day(@\w+)?$/i.test(text)) {
    const opts = {
      reply_to_message_id: msg.message_id,
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            { text: '✅ Yes, reset', callback_data: 'reset_confirm' },
            { text: '❌ No, cancel', callback_data: 'reset_cancel' }
          ]
        ]
      })
    };
    return bot.sendMessage(channelId, '⚠️ Are you sure you want to reset all spendings for today? This action cannot be undone.', opts);
  }

  // Parse spending: "Lunch 345" or "coffee 1,000"
  const match = text.match(/^(.+?)\s+([\d,]+)$/i);
  if (!match) return;

  const category = match[1].trim().toLowerCase();
  const amount = Number(match[2].replace(/,/g, ''));

  if (Number.isNaN(amount) || amount <= 0) return;

  add(category, amount, msg.message_id);
});

/* ─── callback query handler ────────────────────────────────────── */
bot.on('callback_query', async callbackQuery => {
  const msg = callbackQuery.message;
  const action = callbackQuery.data;

  if (action === 'reset_cancel') {
    await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => { });
    // Optionally delete the command message too if possible, but might be tricky to get its ID here easily without state. 
    // Usually we just delete the confirmation prompt.
    return bot.answerCallbackQuery(callbackQuery.id, { text: 'Cancelled' });
  }

  if (action === 'reset_confirm') {
    const deletedCount = await resetDay();
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Resetting day...' });

    // Delete the confirmation prompt
    await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => { });

    // Send confirmation
    return bot.sendMessage(channelId, `🔄 Day reset complete! Deleted ${deletedCount} spending message(s).`);
  }
});

/* ─── edited message handler ─────────────────────────────────────── */
bot.on('edited_channel_post', async msg => {
  if (String(msg.chat.id) !== String(channelId) || !msg.text) return;

  const text = msg.text.trim();

  // Parse spending: "Lunch 345" or "coffee 1,000"
  const match = text.match(/^(.+?)\s+([\d,]+)$/i);
  if (!match) {
    // Message was edited to something that's not a valid spending - remove it
    const removed = removeSpending(msg.message_id);
    if (removed) {
      await bot.deleteMessage(channelId, msg.message_id).catch(() => { });
    }
    return;
  }

  const category = match[1].trim().toLowerCase();
  const amount = Number(match[2].replace(/,/g, ''));

  if (Number.isNaN(amount) || amount <= 0) {
    const removed = removeSpending(msg.message_id);
    if (removed) {
      await bot.deleteMessage(channelId, msg.message_id).catch(() => { });
    }
    return;
  }

  // Update spending with new values
  const updated = updateSpending(msg.message_id, category, amount);

  // If this message wasn't tracked before, add it as new
  if (!updated) {
    add(category, amount, msg.message_id);
  }
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