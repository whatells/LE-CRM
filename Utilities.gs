/**
 * Utilities.gs — fonctions d'aide communes (logs, conversions, erreurs).
 */

/**
 * Retourne un objet Error enrichi et journalise l'exception.
 */
function handleError(error, context) {
  const err = error instanceof Error ? error : new Error(String(error));
  const source = context || 'handleError';
  logEvent_('ERROR', source, err.message, err.stack || '');
  console.error('[' + source + '] ' + err.message, err.stack);
  throw err;
}

function logInfo_(source, message, details) {
  logEvent_('INFO', source, message, details);
}

function logWarning_(source, message, details) {
  logEvent_('WARNING', source, message, details);
}

function logEvent_(level, source, message, details) {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ensureSheet_(CONFIG.sheets.logs, CONFIG.headers.logs);
    const tz = CONFIG.timezone;
    const timestamp = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss");
    const row = [timestamp, level, source, message, details || ''];
    sheet.appendRow(row);
  } catch (logError) {
    console.error('Log failure', logError);
  }
}

/**
 * Convertit une valeur en nombre (NaN => 0).
 */
function toNumber(value) {
  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return isFinite(parsed) ? parsed : 0;
  }
  if (value === true) return 1;
  if (value === false || value === null || value === undefined) return 0;
  const numberValue = Number(value);
  return isFinite(numberValue) ? numberValue : 0;
}

function roundNumber(value, digits) {
  const factor = Math.pow(10, digits || 0);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const number = Number(value);
  if (!isFinite(number)) {
    return '';
  }
  return number.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function formatNumber(value, fractionDigits) {
  if (value === null || value === undefined) {
    return '';
  }
  const number = Number(value);
  if (!isFinite(number)) {
    return '';
  }
  const digits = fractionDigits === undefined ? 2 : fractionDigits;
  return number.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return String(value);
  }
}
