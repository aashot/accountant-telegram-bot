/**
 * Currency conversion service using fawazahmed0/exchange-api
 * Converts foreign currencies to AMD (Armenian Dram)
 * 
 * Supports 300+ currencies dynamically, including:
 * - Fiat: USD, EUR, GBP, RUB, GEL, IRR, TRY, AED, CNY, JPY, etc.
 * - Crypto: BTC, ETH, USDT, SOL, etc.
 * - Metals: XAU (gold), XAG (silver), etc.
 */

const HOME_CURRENCY = 'amd';

const CACHE_TTL_MS = 60 * 60 * 1000;
const rateCache = new Map();

/**
 * Fetches the exchange rate from a foreign currency to AMD.
 * Uses caching to minimize API calls.
 * Supports any currency the API provides (300+ currencies).
 * @param {string} fromCurrency - Source currency code (e.g., 'usd', 'btc')
 * @returns {Promise<number|null>} Exchange rate or null if unavailable
 */
async function getExchangeRate(fromCurrency) {
  const currency = fromCurrency.toLowerCase();

  if (currency === HOME_CURRENCY) {
    return 1;
  }

  const cached = rateCache.get(currency);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.rate;
  }

  try {
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${currency}.json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
    const rate = data[currency]?.[HOME_CURRENCY];

    if (!rate) {
      console.error(`No AMD rate found for ${currency}`);
      return null;
    }

    rateCache.set(currency, { rate, timestamp: Date.now() });

    return rate;
  } catch (error) {
    console.error(`Failed to fetch exchange rate for ${currency}:`, error.message);

    try {
      const fallbackUrl = `https://latest.currency-api.pages.dev/v1/currencies/${currency}.json`;
      const response = await fetch(fallbackUrl);

      if (!response.ok) {
        throw new Error(`Fallback API responded with status ${response.status}`);
      }

      const data = await response.json();
      const rate = data[currency]?.[HOME_CURRENCY];

      if (rate) {
        rateCache.set(currency, { rate, timestamp: Date.now() });
        return rate;
      }
    } catch (fallbackError) {
      console.error(`Fallback API also failed:`, fallbackError.message);
    }

    return null;
  }
}

/**
 * Converts an amount from a foreign currency to AMD.
 * @param {number} amount - Amount in foreign currency
 * @param {string} currency - Source currency code (e.g., 'USD')
 * @returns {Promise<{amountAMD: number, rate: number|null, success: boolean}>}
 */
async function convertToAMD(amount, currency) {
  const currencyLower = currency.toLowerCase();

  if (currencyLower === HOME_CURRENCY) {
    return { amountAMD: amount, rate: 1, success: true };
  }

  const rate = await getExchangeRate(currencyLower);

  if (rate === null) {
    return { amountAMD: amount, rate: null, success: false };
  }

  const amountAMD = Math.round(amount * rate);
  return { amountAMD, rate, success: true };
}

/**
 * Checks if a currency code looks valid (3-letter code).
 * Actual validation happens when we try to fetch the rate.
 * @param {string} currency - Currency code to check
 * @returns {boolean}
 */
function isSupportedCurrency(currency) {
  return /^[a-zA-Z]{3}$/.test(currency);
}

module.exports = {
  convertToAMD,
  getExchangeRate,
  isSupportedCurrency,
  HOME_CURRENCY: HOME_CURRENCY.toUpperCase()
};

