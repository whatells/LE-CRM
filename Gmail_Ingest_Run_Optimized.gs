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
function getProcIds_(){
  return stateGet_("PROC_IDS", {});
}
function addProcId_(id){
  const map = getProcIds_();
  map[id] = 1;
  statePut_("PROC_IDS", map);
}
function seenProcId_(id){
  const map = getProcIds_();
  return !!map[id];
}

// --- Pagination threads (curseur en state) ---
function nextThreads_(query, batchSize){
  const cursorKey = "THREAD_CURSOR::"+query;
  const page = stateGet_(cursorKey, 0);
  const threads = withBackoff_(()=>GmailApp.search(query, page*batchSize, batchSize));
  if (threads.length === 0) return [];
  statePut_(cursorKey, page + 1);
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
        }
      }
    }
  }
}

// ========== VENTES ==========
function ingestSalesFast_(defs){
  const done = GmailApp.getUserLabelByName("Traite") || GmailApp.createLabel("Traite");
  const err  = GmailApp.getUserLabelByName("Erreur") || GmailApp.createLabel("Erreur");
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName("Ventes");
  defs.forEach(({label, platform}) => {
    const query = 'label:"'+label+'" -label:Traite -label:Erreur';
    let threads;
    while ((threads = nextThreads_(query, 25)).length) {
      for (const t of threads) {
        const msgs = t.getMessages();
        for (const m of msgs) {
          const id = m.getId();
          if (seenProcId_(id)) continue;
          const parsed = parseSaleMessage_(platform, m);
          if (!parsed) { addProcId_(id); continue; }
          try {
            // utilise l'override Étape 8
            insertSale_(sh, parsed.data);
            t.addLabel(done);
            addProcId_(id);
          } catch (e){
            t.addLabel(err);
            logE_("ERROR","ingestSalesFast", String(e), id);
          }
        }
      }
    }
  });
}

// ========== FAVORIS / OFFRES ==========
function ingestFavsOffersFast_(defs){
  const done = GmailApp.getUserLabelByName("Traite") || GmailApp.createLabel("Traite");
  const err  = GmailApp.getUserLabelByName("Erreur") || GmailApp.createLabel("Erreur");
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName("Stock");
  defs.forEach(({label,type})=>{
    const query = 'label:"'+label+'" -label:Traite -label:Erreur';
    let threads;
    while ((threads = nextThreads_(query, 50)).length) {
      for (const t of threads) {
        for (const m of t.getMessages()) {
          const id = m.getId();
          if (seenProcId_(id)) continue;
          const parsed = parseFavOfferMessage_(type, m);
          if (!parsed) { addProcId_(id); continue; }
          try {
            bumpCounter_(sh, parsed.data);
            t.addLabel(done);
            addProcId_(id);
          } catch (e){
            t.addLabel(err);
            logE_("ERROR","ingestFavOfferFast", String(e), id);
          }
        }
      }
    }
  });
}

// ========== ACHATS Vinted ==========
function ingestPurchasesVintedFast_(label){
  const done = GmailApp.getUserLabelByName("Traite") || GmailApp.createLabel("Traite");
  const err  = GmailApp.getUserLabelByName("Erreur") || GmailApp.createLabel("Erreur");
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName("Achats");
  const query = 'label:"'+label+'" -label:Traite -label:Erreur';
  let threads;
  while ((threads = nextThreads_(query, 25)).length) {
    for (const t of threads) {
      for (const m of t.getMessages()) {
        const id = m.getId();
        if (seenProcId_(id)) continue;
        const parsed = parsePurchaseVinted_(m);
        if (!parsed) { addProcId_(id); continue; }
        try {
          const row = Math.max(2, sh.getLastRow()+1);
          sh.getRange(row,1).setValue(parsed.data.date);
          sh.getRange(row,2).setValue(parsed.data.fournisseur);
          sh.getRange(row,3).setValue(parsed.data.price);
          sh.getRange(row,5).setValue(parsed.data.brand);
          sh.getRange(row,6).setValue(parsed.data.size);
          t.addLabel(done);
          addProcId_(id);
        } catch (e){
          t.addLabel(err);
          logE_("ERROR","ingestPurchasesFast", String(e), id);
        }
      }
    }
  }
}
