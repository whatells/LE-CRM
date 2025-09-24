/**
 * Parseurs d’emails par label.
 * Idempotence: on marque Logs + labels Traite/Erreur pour éviter les doublons.
 * NOTE: pas de variables globales de type SHEET_* ici pour éviter les collisions.
 */

// ---- Utilitaires Logs & Idempotence ----
const LOG_SHEET_NAME_ = "Logs";
const PROC_IDS_KEY_ = "PROC_IDS";
const PROC_IDS_MAX_SIZE_ = 500;
const LOG_SCAN_LIMIT_ = 1000;
let PROC_IDS_CACHE_ = null;
let PROC_IDS_SHEET_SYNCED_ = false;

function alreadyProcessed_(msgId) {
  if (!msgId) return false;
  const cache = loadProcIds_();
  if (cache[msgId]) return true;
  hydrateProcIdsFromSheet_();
  return !!cache[msgId];
}

function markProcessed_(level, source, msg, details, msgId) {
  const sh = ensureLogsSheet_();
  sh.appendRow([new Date(), level, source, msgId || msg, details || ""]);
  if (msgId) {
    trackProcessedId_(msgId);
  }
}

function ensureLogsSheet_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(LOG_SHEET_NAME_) || ss.insertSheet(LOG_SHEET_NAME_);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,5).setValues([["Horodatage","Niveau","Source","Message","Détails"]]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function loadProcIds_() {
  if (PROC_IDS_CACHE_) return PROC_IDS_CACHE_;
  let map = {};
  try {
    if (typeof stateGet_ === 'function') {
      map = stateGet_(PROC_IDS_KEY_, {}) || {};
    } else {
      const raw = PropertiesService.getUserProperties().getProperty(PROC_IDS_KEY_);
      map = raw ? JSON.parse(raw) : {};
    }
  } catch (e) {
    map = {};
  }
  PROC_IDS_CACHE_ = sanitizeProcIds_(map);
  return PROC_IDS_CACHE_;
}

function persistProcIds_() {
  if (!PROC_IDS_CACHE_) return;
  try {
    if (typeof statePut_ === 'function') {
      statePut_(PROC_IDS_KEY_, PROC_IDS_CACHE_);
    } else {
      PropertiesService.getUserProperties().setProperty(PROC_IDS_KEY_, JSON.stringify(PROC_IDS_CACHE_));
    }
  } catch (e) {}
}

function hydrateProcIdsFromSheet_() {
  if (PROC_IDS_SHEET_SYNCED_) return;
  PROC_IDS_SHEET_SYNCED_ = true;
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(LOG_SHEET_NAME_);
  if (!sh) return;
  const last = sh.getLastRow();
  if (last < 2) return;
  const startRow = Math.max(2, last - LOG_SCAN_LIMIT_ + 1);
  const rows = sh.getRange(startRow, 4, last - startRow + 1, 1).getValues();
  const cache = loadProcIds_();
  const now = Date.now();
  for (let i = 0; i < rows.length; i++) {
    const id = String(rows[i][0] || "").trim();
    if (!id) continue;
    if (!cache[id]) {
      cache[id] = now;
    }
  }
  pruneProcIds_(cache);
  persistProcIds_();
}

function trackProcessedId_(msgId) {
  const cache = loadProcIds_();
  cache[msgId] = Date.now();
  pruneProcIds_(cache);
  persistProcIds_();
}

function sanitizeProcIds_(map) {
  const cache = {};
  const now = Date.now();
  Object.keys(map || {}).forEach(function(key) {
    if (!key) return;
    const val = map[key];
    cache[key] = typeof val === 'number' && isFinite(val) ? val : now;
  });
  pruneProcIds_(cache);
  return cache;
}

function pruneProcIds_(cache) {
  const keys = Object.keys(cache);
  if (keys.length <= PROC_IDS_MAX_SIZE_) return;
  keys.sort(function(a, b) { return Number(cache[a] || 0) - Number(cache[b] || 0); });
  while (keys.length > PROC_IDS_MAX_SIZE_) {
    const key = keys.shift();
    delete cache[key];
  }
}

// ---- STOCK: JSON dans corps ou PJ ----
function parseStockJsonMessage_(message) {
  const id = message.getId();
  if (alreadyProcessed_(id)) return null;
  let jsonText = message.getPlainBody();

  // Si pièce jointe JSON, on la préfère
  const atts = message.getAttachments({includeInlineImages: false, includeAttachments: true});
  for (let i=0;i<atts.length;i++){
    const a = atts[i];
    if (/\.json$/i.test(a.getName())){
      jsonText = a.getDataAsString();
      break;
    }
  }

  try {
    const obj = JSON.parse(jsonText);
    // Schéma attendu minimal: { sku, title?, price?, category?, brand?, size?, condition?, photos?, platform? }
    if (!obj || !obj.sku) throw new Error("JSON sans sku");
    return {id, data: obj};
  } catch(e){
    markProcessed_("ERROR","parseStockJson","parse fail", String(e), id);
    return null;
  }
}

// ---- VENTES (parsers simples démo) ----
function parseSaleMessage_(platform, message) {
  const id = message.getId();
  if (alreadyProcessed_(id)) return null;

  const plain = message.getPlainBody() || "";
  const html = message.getBody() || "";
  const subject = message.getSubject() || "";
  const htmlText = htmlToText_(html);

  const price = findSalePrice_(platform, plain, htmlText);
  const title = findSaleTitle_(platform, plain, htmlText, subject);
  const sku = extractSaleSku_(platform, title, plain, htmlText, subject);

  if (price === null || !title) return null;
  return { id, data: { platform, title, price, sku } };
}

// ---- FAVORIS/OFFRES Vinted ----
function parseFavOfferMessage_(type, message) {
  const id = message.getId();
  if (alreadyProcessed_(id)) return null;
  const subj = message.getSubject() || "";
  const sku = extractSaleSku_("Vinted", "", subj, subj, subj);
  if (!sku) return null;
  return { id, data: { type, sku } };
}

// ---- ACHATS Vinted ----
function parsePurchaseVinted_(message){
  const id = message.getId();
  if (alreadyProcessed_(id)) return null;
  const body = message.getPlainBody() || "";
  const htmlText = htmlToText_(message.getBody() || "");
  const combined = body + "\n" + htmlText;
  const priceStr = findFirstMatch_(combined, [/(?:total|montant)[^0-9]{0,10}([0-9]+(?:[\.,\s][0-9]{3})*(?:[\.,][0-9]{2})?)/i]);
  const price = normalizePrice_(priceStr);
  if (price === null) return null;
  const brand = findFirstMatch_(combined, [/Marque\s*[:\-]\s*(.+)/i]) || "";
  const size = findFirstMatch_(combined, [/Taille\s*[:\-]\s*(.+)/i]) || "";
  return {id, data:{date:new Date(), fournisseur:"Vinted", price, brand: brand.trim(), size: size.trim()}};
}

// ---- Helpers parsing avancés ----
function findSalePrice_(platform, plain, htmlText) {
  const texts = [plain, htmlText].filter(Boolean);
  const candidates = [];
  texts.forEach(function(text){
    candidates.push.apply(candidates, extractPriceCandidates_(text));
  });
  for (let i = 0; i < candidates.length; i++) {
    const value = normalizePrice_(candidates[i]);
    if (value !== null) return value;
  }
  return null;
}

function findSaleTitle_(platform, plain, htmlText, subject) {
  const lines = [];
  const pushLines = function(text) {
    if (!text) return;
    text.split(/\r?\n/).forEach(function(line){ lines.push(line); });
  };
  pushLines(plain);
  pushLines(htmlText);

  const labelPatterns = [
    /^(?:\s*)(?:Titre|Title|Article|Item|Objet|Listing)\s*[:\-]\s*(.+)$/i,
    /^(?:\s*)(?:Article\s+vendu|Item\s+sold)\s*[:\-]?\s*(.+)$/i
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < labelPatterns.length; j++) {
      const m = line.match(labelPatterns[j]);
      if (m && m[1]) return m[1].trim();
    }
  }

  if (subject) return subject.trim();
  for (let i = 0; i < lines.length; i++) {
    const clean = String(lines[i] || "").trim();
    if (clean) return clean;
  }
  return "";
}

function extractSaleSku_(platform, title, plain, htmlText, subject) {
  const texts = [title, subject, plain, htmlText];
  for (let i = 0; i < texts.length; i++) {
    const sku = findSkuWithLabel_(texts[i]);
    if (sku) return sku;
  }

  const fallbackSources = [title, subject];
  for (let i = 0; i < fallbackSources.length; i++) {
    const sku = findAlphaNumericToken_(fallbackSources[i]);
    if (sku) return sku;
  }
  return "";
}

function findSkuWithLabel_(text) {
  if (!text) return "";
  const patterns = [
    /(?:SKU|Réf(?:erence)?|Reference|Ref|Article\s*#|Item\s*#)[^A-Z0-9]{0,10}([A-Z0-9\-]{2,12})/gi,
    /#([A-Z0-9\-]{2,12})/g
  ];
  for (let i = 0; i < patterns.length; i++) {
    const re = patterns[i];
    let m;
    while ((m = re.exec(text))) {
      const normalized = normalizeSku_(m[1]);
      if (normalized) return normalized;
    }
  }
  return "";
}

function findAlphaNumericToken_(text) {
  if (!text) return "";
  const re = /\b([A-Z0-9]{2,10})\b/g;
  let m;
  while ((m = re.exec(text))) {
    const candidate = normalizeSku_(m[1]);
    if (candidate) return candidate;
  }
  return "";
}

function normalizeSku_(value) {
  if (!value) return "";
  const clean = String(value).toUpperCase().replace(/[^A-Z0-9\-]/g, "");
  if (clean.length < 2) return "";
  if (!/[0-9]/.test(clean) && clean.length > 4) return "";
  return clean;
}

function extractPriceCandidates_(text) {
  if (!text) return [];
  const matches = [];
  const prioritized = /(?:total|montant|prix|price|amount)[^0-9]{0,10}([0-9]+(?:[\.,\s][0-9]{3})*(?:[\.,][0-9]{2})?)/gi;
  let match;
  while ((match = prioritized.exec(text))) {
    matches.push(match[1]);
  }
  const generic = /([0-9]+(?:[\.,\s][0-9]{3})*(?:[\.,][0-9]{2})?)\s?(?:€|eur|euro|£|gbp|\$|usd)/gi;
  while ((match = generic.exec(text))) {
    matches.push(match[1]);
  }
  return matches;
}

function normalizePrice_(raw) {
  if (!raw) return null;
  let cleaned = String(raw).trim();
  if (!cleaned) return null;
  cleaned = cleaned.replace(/\s+/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, '');
    cleaned = cleaned.replace(/,/g, '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  cleaned = cleaned.replace(/[^0-9.\-]/g, '');
  const num = Number(cleaned);
  if (!isFinite(num) || num <= 0) return null;
  return num;
}

function findFirstMatch_(text, patterns) {
  if (!text) return "";
  for (let i = 0; i < patterns.length; i++) {
    const m = text.match(patterns[i]);
    if (m && m[1]) return m[1];
  }
  return "";
}

function htmlToText_(html) {
  if (!html) return "";
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|br\/)\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ');
  text = text.replace(/\r/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{2,}/g, '\n');
  return text.trim();
}
