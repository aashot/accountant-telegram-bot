/**
 * Converts a Unix timestamp (seconds) to a local date string (YYYY-MM-DD).
 * Uses the system's local timezone for conversion.
 * @param {number} unixTimestamp - Unix timestamp in seconds
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getDateFromTimestamp(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets today's date in YYYY-MM-DD format using the system's local timezone.
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getToday() {
  const now = Math.floor(Date.now() / 1000);
  return getDateFromTimestamp(now);
}

function getCurrentMonth() {
  return getToday().slice(0, 7);
}

function parseSpending(text) {
  const match = text.match(/^(.+?)\s+([\d,]+(?:\.\d+)?)\s*([A-Za-z]{3})?$/i);
  if (!match) return null;

  const category = match[1].trim().toLowerCase();
  const amount = Number(match[2].replace(/,/g, ''));
  const currency = match[3] ? match[3].toUpperCase() : 'AMD';

  if (Number.isNaN(amount) || amount <= 0) return null;

  return { category, amount, currency };
}

/**
 * Parse multiple spending entries from a multi-line message.
 * Each line is parsed separately.
 * @param {string} text - Multi-line text input
 * @returns {Array<{category: string, amount: number, currency: string, lineIndex: number}>}
 */
function parseSpendings(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const results = [];

  lines.forEach((line, index) => {
    const spending = parseSpending(line);
    if (spending) {
      results.push({ ...spending, lineIndex: index });
    }
  });

  return results;
}

module.exports = { getToday, getCurrentMonth, parseSpending, parseSpendings, getDateFromTimestamp };
