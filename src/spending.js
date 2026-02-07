const { bot, channelId } = require('./config');
const { loadData, saveData } = require('./data');
const { getToday, getCurrentMonth } = require('./helpers');

function add(category, amount, messageId) {
  const data = loadData();

  if (messageId && data.monthly.some(e => e.messageId === messageId)) {
    return;
  }

  const today = getToday();

  if (!data.daily[today]) data.daily[today] = {};
  data.daily[today][category] = (data.daily[today][category] || 0) + amount;

  data.monthly.push({ date: today, category, amount, messageId });

  saveData(data);
}

function updateSpending(messageId, newCategory, newAmount) {
  const data = loadData();
  const entry = data.monthly.find(e => e.messageId === messageId);

  if (!entry) return false;

  const oldDate = entry.date;
  const oldCategory = entry.category;
  const oldAmount = entry.amount;

  if (data.daily[oldDate] && data.daily[oldDate][oldCategory]) {
    data.daily[oldDate][oldCategory] -= oldAmount;

    if (data.daily[oldDate][oldCategory] <= 0) {
      delete data.daily[oldDate][oldCategory];
    }
    if (Object.keys(data.daily[oldDate]).length === 0) {
      delete data.daily[oldDate];
    }
  }

  if (!data.daily[oldDate]) data.daily[oldDate] = {};
  data.daily[oldDate][newCategory] = (data.daily[oldDate][newCategory] || 0) + newAmount;

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

  if (data.daily[entry.date] && data.daily[entry.date][entry.category]) {
    data.daily[entry.date][entry.category] -= entry.amount;
    if (data.daily[entry.date][entry.category] <= 0) {
      delete data.daily[entry.date][entry.category];
    }
    if (Object.keys(data.daily[entry.date]).length === 0) {
      delete data.daily[entry.date];
    }
  }

  data.monthly.splice(entryIndex, 1);

  saveData(data);
  return true;
}

async function resetDay() {
  const data = loadData();
  const today = getToday();

  const todayMessageIds = data.monthly
    .filter(e => e.date === today && e.messageId)
    .map(e => e.messageId);

  const deletePromises = todayMessageIds.map(msgId =>
    bot.deleteMessage(channelId, msgId).catch(err => {
      console.log(`Could not delete message ${msgId}: ${err.message}`);
    })
  );
  await Promise.all(deletePromises);

  delete data.daily[today];
  data.monthly = data.monthly.filter(e => e.date !== today);

  saveData(data);

  return todayMessageIds.length;
}

function getDailyData() {
  const data = loadData();
  const today = getToday();
  const todayData = data.daily[today];

  if (!todayData || !Object.keys(todayData).length) {
    return null;
  }

  const entries = Object.entries(todayData)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return { entries, total, date: today };
}

function getDailySummary() {
  const dailyData = getDailyData();

  if (!dailyData) {
    return '🕛 No spendings recorded today.';
  }

  const header = `📊 *Spendings for ${dailyData.date}*\n\n`;
  const tableHeader = '```\n' + padRight('Category', 20) + padRight('Amount', 12) + '\n';
  const separator = '-'.repeat(32) + '\n';

  const rows = dailyData.entries
    .map(e => padRight(capitalize(e.category), 20) + padRight(e.amount.toLocaleString(), 12))
    .join('\n');

  const totalRow = '\n' + separator + padRight('TOTAL', 20) + padRight(dailyData.total.toLocaleString(), 12) + '```';

  return header + tableHeader + separator + rows + totalRow;
}

function getDailyCsv() {
  const dailyData = getDailyData();

  if (!dailyData) {
    return null;
  }

  const header = 'Category,Amount';
  const rows = dailyData.entries
    .map(e => `"${capitalize(e.category)}",${e.amount}`);
  rows.push(`"TOTAL",${dailyData.total}`);

  return [header, ...rows].join('\n');
}

function padRight(str, len) {
  return String(str).padEnd(len);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getMonthlySummary(month = getCurrentMonth()) {
  const data = loadData();
  const monthlyEntries = data.monthly.filter(e => e.date.startsWith(month));

  if (!monthlyEntries.length) {
    return `📊 No spendings recorded for ${month}.`;
  }

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

module.exports = {
  add,
  updateSpending,
  removeSpending,
  resetDay,
  getDailySummary,
  getDailyCsv,
  getDailyData,
  getMonthlySummary,
  hasTodaySpendings
};
