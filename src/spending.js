const { bot, channelId } = require('./config');
const { loadData, saveData } = require('./data');
const { getToday, getCurrentMonth, getDateFromTimestamp } = require('./helpers');

/**
 * Add a spending record.
 * @param {string} category - Spending category
 * @param {number} amount - Amount spent (in AMD)
 * @param {number} messageId - Telegram message ID
 * @param {number} [messageDate] - Unix timestamp from the Telegram message (optional)
 * @param {Object} [currencyInfo] - Original currency info if converted
 * @param {number} [currencyInfo.originalAmount] - Original amount before conversion
 * @param {string} [currencyInfo.originalCurrency] - Original currency code
 * @param {number} [currencyInfo.rate] - Exchange rate used
 */
function add(category, amount, messageId, messageDate, currencyInfo = null) {
  const data = loadData();

  if (messageId && data.monthly.some(e => e.messageId === messageId)) {
    console.log(`[SKIP] Duplicate messageId ${messageId} for ${category}`);
    return;
  }

  const date = messageDate ? getDateFromTimestamp(messageDate) : getToday();

  if (!data.daily[date]) data.daily[date] = {};
  data.daily[date][category] = (data.daily[date][category] || 0) + amount;

  const entry = { date, category, amount, messageId };

  if (currencyInfo && currencyInfo.originalCurrency !== 'AMD') {
    entry.originalAmount = currencyInfo.originalAmount;
    entry.originalCurrency = currencyInfo.originalCurrency;
    entry.exchangeRate = currencyInfo.rate;
  }

  data.monthly.push(entry);

  saveData(data);
  console.log(`[ADDED] ${category}: ${amount} AMD (messageId: ${messageId}, date: ${date})`);
}

function updateSpending(messageId, newCategory, newAmount, currencyInfo = null) {
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

  if (currencyInfo && currencyInfo.originalCurrency !== 'AMD') {
    entry.originalAmount = currencyInfo.originalAmount;
    entry.originalCurrency = currencyInfo.originalCurrency;
    entry.exchangeRate = currencyInfo.rate;
  } else {
    delete entry.originalAmount;
    delete entry.originalCurrency;
    delete entry.exchangeRate;
  }

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

  const todayEntries = data.monthly.filter(e => e.date === today);

  const categoryDetails = {};
  const totalOriginalsByCurrency = {};

  todayEntries.forEach(entry => {
    if (!categoryDetails[entry.category]) {
      categoryDetails[entry.category] = [];
    }
    categoryDetails[entry.category].push({
      amount: entry.amount,
      originalAmount: entry.originalAmount,
      originalCurrency: entry.originalCurrency
    });

    if (entry.originalCurrency && entry.originalCurrency !== 'AMD') {
      if (!totalOriginalsByCurrency[entry.originalCurrency]) {
        totalOriginalsByCurrency[entry.originalCurrency] = 0;
      }
      totalOriginalsByCurrency[entry.originalCurrency] += entry.originalAmount;
    }
  });

  const entries = Object.entries(todayData)
    .map(([category, amount]) => {
      const details = categoryDetails[category] || [];
      const foreignEntries = details.filter(d => d.originalCurrency && d.originalCurrency !== 'AMD');
      let originalInfo = null;

      if (foreignEntries.length > 0) {
        const byCurrency = {};
        foreignEntries.forEach(e => {
          if (!byCurrency[e.originalCurrency]) {
            byCurrency[e.originalCurrency] = 0;
          }
          byCurrency[e.originalCurrency] += e.originalAmount;
        });
        originalInfo = Object.entries(byCurrency)
          .map(([curr, amt]) => `${amt.toLocaleString()} ${curr}`)
          .join(' + ');
      }

      return { category, amount, originalInfo };
    })
    .sort((a, b) => b.amount - a.amount);

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  let totalOriginalsInfo = null;
  if (Object.keys(totalOriginalsByCurrency).length > 0) {
    totalOriginalsInfo = Object.entries(totalOriginalsByCurrency)
      .map(([curr, amt]) => `${amt.toLocaleString()} ${curr}`)
      .join(' + ');
  }

  return { entries, total, date: today, totalOriginalsInfo };
}

function getDailySummary() {
  const dailyData = getDailyData();

  if (!dailyData) {
    return '🕛 No spendings recorded today.';
  }

  const header = `📊 *Spendings for ${dailyData.date}*\n\n`;
  const tableHeader = '```\n' + padRight('Category', 14) + padRight('AMD', 12) + 'Conversion\n';
  const separator = '-'.repeat(50) + '\n';

  const rows = dailyData.entries
    .map(e => {
      const conversion = e.originalInfo ? `${e.originalInfo} → ${e.amount.toLocaleString()} AMD` : '';
      return padRight(capitalize(e.category), 14) + padRight(e.amount.toLocaleString(), 12) + conversion;
    })
    .join('\n');

  const totalConversion = dailyData.totalOriginalsInfo
    ? `${dailyData.totalOriginalsInfo} → ${dailyData.total.toLocaleString()} AMD`
    : '';
  const totalRow = '\n' + separator + padRight('TOTAL', 14) + padRight(dailyData.total.toLocaleString(), 12) + totalConversion + '```';

  return header + tableHeader + separator + rows + totalRow;
}

function getDailyCsv() {
  const dailyData = getDailyData();

  if (!dailyData) {
    return null;
  }

  const header = 'Category,Amount AMD,Original Amount,Original Currency,Conversion';
  const rows = dailyData.entries
    .map(e => {
      const origAmt = e.originalInfo ? e.originalInfo.replace(/[^0-9,.+ ]/g, '').trim() : '';
      const origCur = e.originalInfo ? e.originalInfo.replace(/[0-9,.+ ]/g, '').trim() : '';
      const conversion = e.originalInfo ? `${e.originalInfo} → ${e.amount.toLocaleString()} AMD` : '';
      return `"${capitalize(e.category)}",${e.amount},"${origAmt}","${origCur}","${conversion}"`;
    });

  const totalConversion = dailyData.totalOriginalsInfo
    ? `${dailyData.totalOriginalsInfo} → ${dailyData.total.toLocaleString()} AMD`
    : '';
  rows.push(`"TOTAL",${dailyData.total},"","","${totalConversion}"`);

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
  const originalsByCategory = {};

  monthlyEntries.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;

    if (e.originalCurrency && e.originalCurrency !== 'AMD') {
      if (!originalsByCategory[e.category]) {
        originalsByCategory[e.category] = {};
      }
      const curr = e.originalCurrency;
      originalsByCategory[e.category][curr] = (originalsByCategory[e.category][curr] || 0) + e.originalAmount;
    }
  });

  const lines = [`📊 Monthly Report: ${month}`];
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, amt]) => {
      const originals = originalsByCategory[cat];
      let originalStr = '';
      if (originals) {
        originalStr = ' (' + Object.entries(originals)
          .map(([curr, origAmt]) => `${origAmt.toLocaleString()} ${curr}`)
          .join(' + ') + ')';
      }
      lines.push(`• ${capitalize(cat)}: ${amt.toLocaleString()} AMD${originalStr}`);
    });

  const total = monthlyEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalOriginals = {};
  monthlyEntries.forEach(e => {
    if (e.originalCurrency && e.originalCurrency !== 'AMD') {
      totalOriginals[e.originalCurrency] = (totalOriginals[e.originalCurrency] || 0) + e.originalAmount;
    }
  });

  let totalOriginalStr = '';
  if (Object.keys(totalOriginals).length > 0) {
    totalOriginalStr = ' (' + Object.entries(totalOriginals)
      .map(([curr, amt]) => `${amt.toLocaleString()} ${curr}`)
      .join(' + ') + ')';
  }

  lines.push(`\n💰 Total: ${total.toLocaleString()} AMD${totalOriginalStr}`);

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
