function getToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
}

function getCurrentMonth() {
  return getToday().slice(0, 7);
}

function parseSpending(text) {
  const match = text.match(/^(.+?)\s+([\d,]+)$/i);
  if (!match) return null;

  const category = match[1].trim().toLowerCase();
  const amount = Number(match[2].replace(/,/g, ''));

  if (Number.isNaN(amount) || amount <= 0) return null;

  return { category, amount };
}

module.exports = { getToday, getCurrentMonth, parseSpending };
