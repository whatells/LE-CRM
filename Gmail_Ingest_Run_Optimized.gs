/**
 * Étape 10 — Ingestion optimisée (batch + cache + idempotence rapide)
 * - Ne touche pas à tes anciens parseurs: on réutilise parseStockJsonMessage_, parseSaleMessage_, etc.
 * - Idempotence: on garde un set d'IDs déjà traités dans UserProperties (PROC_IDS) + Logs (fallback).
 */

function ingestAllLabelsFast(){
  const L = labels_();
  // Ordre conseillé: JSON Stock -> Ventes -> Achats -> Favoris/Offres
  ingestStockJsonFast_(L.INGEST_STOCK);
  ingestSalesFast_([
    {label:L.SALES_VINTED,      platform:"Vinted"},
    {label:L.SALES_VESTIAIRE,   platform:"Vestiaire"},
    {label:L.SALES_EBAY,        platform:"eBay"},
    {label:L.SALES_LEBONCOIN,   platform:"Leboncoin"},
    {label:L.SALES_WHATNOT,     platform:"Whatnot"},
  ]);
  ingestPurchasesVintedFast_(L.PUR_VINTED);
  ingestFavsOffersFast_([{label:L.FAV_VINTED,type:"fav"},{label:L.OFF_VINTED,type:"offer"}]);
  logE_("INFO","IngestFast","Terminé","");
}

// --- Proc IDs (idempotence mémoire + persistance légère) ---
const PROC_IDS_FAST_KEY = "PROC_IDS";
let PROC_IDS_FAST_CACHE = null;

function getProcIds_(){
  if (!PROC_IDS_FAST_CACHE) {
    PROC_IDS_FAST_CACHE = stateGet_(PROC_IDS_FAST_KEY, {}) || {};
  }
  return PROC_IDS_FAST_CACHE;
}
function addProcId_(id){
  if (!id) return;
  const map = getProcIds_();
  map[id] = Date.now();
  pruneProcIdsFast_(map);
  statePut_(PROC_IDS_FAST_KEY, map);
}
function seenProcId_(id){
  const map = getProcIds_();
  return !!map[id];
}

function pruneProcIdsFast_(map){
  const keys = Object.keys(map);
  const LIMIT = 500;
  if (keys.length <= LIMIT) return;
  keys.sort((a,b) => Number(map[a] || 0) - Number(map[b] || 0));
  while (keys.length > LIMIT) {
    const key = keys.shift();
    delete map[key];
  }
}

// --- Pagination threads (curseur en state) ---
function nextThreads_(query, batchSize){
  const cursorKey = "THREAD_CURSOR::"+query;
  const now = Date.now();
  let cursor = stateGet_(cursorKey, null);
  if (typeof cursor === 'number') {
    cursor = { page: cursor, ts: 0, done: false };
  }
  if (!cursor) {
    cursor = { page: 0, ts: now, done: false };
  } else if (cursor.done) {
    stateDel_(cursorKey);
    return [];
  } else if (cursor.ts && now - cursor.ts > 3600000) {
    cursor = { page: 0, ts: now, done: false };
  }

  const page = cursor.page || 0;
  const threads = withBackoff_(() => GmailApp.search(query, page * batchSize, batchSize));
  if (threads.length === 0) {
    stateDel_(cursorKey);
    return [];
  }

  cursor = { page: page + 1, ts: now, done: threads.length < batchSize };
  statePut_(cursorKey, cursor);
  return threads;
}

// ========== STOCK JSON ==========
function ingestStockJsonFast_(label){
  const done = GmailApp.getUserLabelByName("Traite") || GmailApp.createLabel("Traite");
  const err  = GmailApp.getUserLabelByName("Erreur") || GmailApp.createLabel("Erreur");
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName("Stock");
  const query = 'label:"'+label+'" -label:Traite -label:Erreur';
  let threads;
  while ((threads = nextThreads_(query, 25)).length) {
    for (const t of threads) {
      const msgs = t.getMessages();
      for (const m of msgs) {
        const id = m.getId();
        if (seenProcId_(id)) continue;
        const parsed = parseStockJsonMessage_(m);
        if (!parsed) { addProcId_(id); continue; }
        try {
          upsertStock_(sh, parsed.data);
          t.addLabel(done);
          addProcId_(id);
        } catch (e){
          t.addLabel(err);
          logE_("ERROR","ingestStockJsonFast", String(e), id);
