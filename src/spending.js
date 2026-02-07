const { bot, channelId } = require('./config');
const { getSpendings } = require('./database');
const { getToday, getCurrentMonth, getDateFromTimestamp } = require('./helpers');

/**
 * Add a spending record.
 * @param {string} customDate - Optional custom date (YYYY-MM-DD) for past entries
 * @param {number} lineIndex - Optional line index for multi-line messages
 */
async function add(category, amount, messageId, messageDate, currencyInfo = null, customDate = null, lineIndex = null) {
  const spendings = getSpendings();
  const date = customDate || (messageDate ? getDateFromTimestamp(messageDate) : getToday());

  if (messageId) {
    const query = lineIndex !== null
      ? { messageId, lineIndex }
      : { messageId };
    const existing = await spendings.findOne(query);
    if (existing) {
      console.log(`[SKIP] Duplicate messageId ${messageId} (lineIndex: ${lineIndex}) for ${category}`);
      return;
    }
  }

  const entry = {
    date,
    category,
    amount,
    createdAt: new Date()
  };

  if (messageId !== null) {
    entry.messageId = messageId;
  }
  if (lineIndex !== null) {
    entry.lineIndex = lineIndex;
  }

  if (currencyInfo && currencyInfo.originalCurrency !== 'AMD') {
    entry.originalAmount = currencyInfo.originalAmount;
    entry.originalCurrency = currencyInfo.originalCurrency;
    entry.exchangeRate = currencyInfo.rate;
  }

  await spendings.insertOne(entry);
  console.log(`[ADDED] ${category}: ${amount} AMD (messageId: ${messageId}, lineIndex: ${lineIndex}, date: ${date})`);
}

async function updateSpending(messageId, newCategory, newAmount, currencyInfo = null) {
  const spendings = getSpendings();
  const entry = await spendings.findOne({ messageId });

  if (!entry) return false;

  const updateData = {
    category: newCategory,
    amount: newAmount
  };

  if (currencyInfo && currencyInfo.originalCurrency !== 'AMD') {
    updateData.originalAmount = currencyInfo.originalAmount;
    updateData.originalCurrency = currencyInfo.originalCurrency;
    updateData.exchangeRate = currencyInfo.rate;
  } else {
    updateData.originalAmount = null;
    updateData.originalCurrency = null;
    updateData.exchangeRate = null;
  }

  await spendings.updateOne({ messageId }, { $set: updateData });
  return true;
}

async function removeSpending(messageId) {
  const spendings = getSpendings();
  const result = await spendings.deleteOne({ messageId });
  return result.deletedCount > 0;
}

/**
 * Remove all spending entries for a given messageId (for multi-line edits)
 */
async function removeAllByMessageId(messageId) {
  const spendings = getSpendings();
  const result = await spendings.deleteMany({ messageId });
  return result.deletedCount;
}

async function resetDay() {
  const spendings = getSpendings();
  const today = getToday();

  const todayEntries = await spendings.find({ date: today, messageId: { $ne: null } }).toArray();
  const uniqueMessageIds = [...new Set(todayEntries.map(e => e.messageId))];

  const deletePromises = uniqueMessageIds.map(msgId =>
    bot.deleteMessage(channelId, msgId).catch(err => {
      console.log(`Could not delete message ${msgId}: ${err.message}`);
    })
  );
  await Promise.all(deletePromises);

  await spendings.deleteMany({ date: today });

  return uniqueMessageIds.length;
}

async function getDailyData(targetDate = null) {
  const spendings = getSpendings();
  const date = targetDate || getToday();
  const dbEntries = await spendings.find({ date }).toArray();

  if (!dbEntries.length) {
    return null;
  }

  const categoryTotals = {};
  const categoryDetails = {};
  const totalOriginalsByCurrency = {};

  dbEntries.forEach(entry => {
    categoryTotals[entry.category] = (categoryTotals[entry.category] || 0) + entry.amount;

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

  const sortedEntries = Object.entries(categoryTotals)
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

  const total = sortedEntries.reduce((sum, e) => sum + e.amount, 0);

  let totalOriginalsInfo = null;
  if (Object.keys(totalOriginalsByCurrency).length > 0) {
    totalOriginalsInfo = Object.entries(totalOriginalsByCurrency)
      .map(([curr, amt]) => `${amt.toLocaleString()} ${curr}`)
      .join(' + ');
  }

  return { entries: sortedEntries, total, date, totalOriginalsInfo };
}

async function getDailySummary(targetDate = null) {
  const dailyData = await getDailyData(targetDate);

  if (!dailyData) {
    const dateStr = targetDate || getToday();
    return `🕛 No spendings recorded for ${dateStr}.`;
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

async function getDailyCsv(targetDate = null) {
  const dailyData = await getDailyData(targetDate);

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

async function getMonthlySummary(month = getCurrentMonth()) {
  const spendings = getSpendings();
  const monthlyEntries = await spendings.find({ date: { $regex: `^${month}` } }).toArray();

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

async function hasTodaySpendings() {
  const spendings = getSpendings();
  const today = getToday();
  const count = await spendings.countDocuments({ date: today });
  return count > 0;
}

module.exports = {
  add,
  updateSpending,
  removeSpending,
  removeAllByMessageId,
  resetDay,
  getDailySummary,
  getDailyCsv,
  getDailyData,
  getMonthlySummary,
  hasTodaySpendings
};
