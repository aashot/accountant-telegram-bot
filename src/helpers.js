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
  const match = text.match(/^(.+?)\s+([\d,]+)$/i);
  if (!match) return null;

  const category = match[1].trim().toLowerCase();
  const amount = Number(match[2].replace(/,/g, ''));

  if (Number.isNaN(amount) || amount <= 0) return null;

  return { category, amount };
}

module.exports = { getToday, getCurrentMonth, parseSpending, getDateFromTimestamp };
