/**
 * Scanners Gmail + upserts dans les feuilles.
 * Labels pris depuis Configuration.
 */

// ---- Raccourcis labels (avec valeurs par défaut si la Config est vide) ----
function labels_(){
  return {
    INGEST_STOCK: String(cfg_("GMAIL_LABEL_INGEST_STOCK","Ingestion/Stock")),
    SALES_VINTED: String(cfg_("GMAIL_LABEL_SALES_VINTED","Sales/Vinted")),
    SALES_VESTIAIRE: String(cfg_("GMAIL_LABEL_SALES_VESTIAIRE","Sales/Vestiaire")),
    SALES_EBAY: String(cfg_("GMAIL_LABEL_SALES_EBAY","Sales/eBay")),
    SALES_LEBONCOIN: String(cfg_("GMAIL_LABEL_SALES_LEBONCOIN","Sales/Leboncoin")),
    SALES_WHATNOT: String(cfg_("GMAIL_LABEL_SALES_WHATNOT","Sales/Whatnot")),
    FAV_VINTED: String(cfg_("GMAIL_LABEL_FAVORITES_VINTED","Favorites/Vinted")),
    OFF_VINTED: String(cfg_("GMAIL_LABEL_OFFERS_VINTED","Offers/Vinted")),
    PUR_VINTED: String(cfg_("GMAIL_LABEL_PURCHASES_VINTED","Purchases/Vinted")),
  };
}

// ---- Orchestrateur ----
function ingestAllLabels(){
  ingestStockJson();
  ingestSales();
  ingestPurchasesVinted();
  ingestFavsOffersVinted();
}

// ---- STOCK via JSON ----
function ingestStockJson(){
  const l = labels_().INGEST_STOCK; // Ingestion/Stock
  const threadQuery = 'label:"' + l + '" -label:Traite -label:Erreur';
  const threads = GmailApp.search(threadQuery, 0, 50);
  const labelDone = GmailApp.getUserLabelByName("Traite") || GmailApp.createLabel("Traite");
  const labelErr  = GmailApp.getUserLabelByName("Erreur") || GmailApp.createLabel("Erreur");

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName("Stock");
  for (let t of threads){
    const msgs = t.getMessages();
    for (let m of msgs){
      const parsed = parseStockJsonMessage_(m);
      if (!parsed) continue;
      try {
        upsertStock_(sh, parsed.data);
        t.addLabel(labelDone);
        markProcessed_("INFO","ingestStockJson","OK", "", parsed.id);
      } catch(e){
        t.addLabel(labelErr);
        markProcessed_("ERROR","ingestStockJson","KO", String(e), parsed.id);
      }
    }
  }
}

function upsertStock_(sh, obj){
  const headers = { sku:2, title:3, photos:4, category:5, brand:6, size:7, condition:8, platform:12 };
  const last = sh.getLastRow();
  let row = 0;
  if (last>=2){
    const rng = sh.getRange(2,2,last-1,1).getValues();
    for (let i=0;i<rng.length;i++){ if (String(rng[i][0]).toUpperCase() === String(obj.sku).toUpperCase()) { row = i+2; break; } }
  }
  if (!row){ row = Math.max(2, last+1); sh.getRange(row,1).setValue(new Date()); }
  if (obj.title) sh.getRange(row, headers.title).setValue(obj.title);
  if (obj.sku)   sh.getRange(row, headers.sku).setValue(String(obj.sku).toUpperCase());
  if (obj.photos) sh.getRange(row, headers.photos).setValue(Array.isArray(obj.photos)? obj.photos.join("\n"): obj.photos);
  if (obj.category) sh.getRange(row, headers.category).setValue(obj.category);
  if (obj.brand) sh.getRange(row, headers.brand).setValue(obj.brand);
  if (obj.size) sh.getRange(row, headers.size).setValue(obj.size);
  if (obj.condition) sh.getRange(row, headers.condition).setValue(obj.condition);
  if (obj.platform) sh.getRange(row, headers.platform).setValue(obj.platform);
}

// ---- VENTES ----
function ingestSales(){
  const L = labels_();
  const map = [
    {label:L.SALES_VINTED, platform:"Vinted"},
    {label:L.SALES_VESTIAIRE, platform:"Vestiaire"},
    {label:L.SALES_EBAY, platform:"eBay"},
    {label:L.SALES_LEBONCOIN, platform:"Leboncoin"},
    {label:L.SALES_WHATNOT, platform:"Whatnot"},
  ];
  const labelDone = GmailApp.getUserLabelByName("Traite") || GmailApp.createLabel("Traite");
  const labelErr  = GmailApp.getUserLabelByName("Erreur") || GmailApp.createLabel("Erreur");
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName("Ventes");
  for (let {label, platform} of map){
    const threads = GmailApp.search('label:"'+label+'" -label:Traite -label:Erreur', 0, 50);
    for (let t of threads){
      for (let m of t.getMessages()){
        const parsed = parseSaleMessage_(platform, m);
        if (!parsed) continue;
        try {
          insertSale_(sh, parsed.data);
          t.addLabel(labelDone);
          markProcessed_("INFO","ingestSales","OK", "", parsed.id);
        } catch(e){
          t.addLabel(labelErr);
          markProcessed_("ERROR","ingestSales","KO", String(e), parsed.id);
        }
      }
    }
  }
}

function insertSale_(sh, d){
  const conf = getConfig_();
  const pct = Number(conf['COMMISSION_'+d.platform.toUpperCase()]||0);
  const last = sh.getLastRow();
  const row = Math.max(2, last+1);
  sh.getRange(row,1).setValue(new Date());
  sh.getRange(row,2).setValue(d.platform);
  sh.getRange(row,3).setValue(d.title);
  sh.getRange(row,4).setValue(d.price);
  sh.getRange(row,5).setValue(d.price*pct); // commission simple (étape 5)
  sh.getRange(row,8).setValue(d.sku||"");
}

// ---- FAVORIS & OFFRES Vinted ----
function ingestFavsOffersVinted(){
  const L = labels_();
  const defs = [
    {label:L.FAV_VINTED, type:"fav"},
    {label:L.OFF_VINTED, type:"offer"}
  ];
  const labelDone = GmailApp.getUserLabelByName("Traite") || GmailApp.createLabel("Traite");
  const labelErr  = GmailApp.getUserLabelByName("Erreur") || GmailApp.createLabel("Erreur");
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName("Stock");
  for (let {label,type} of defs){
    const threads = GmailApp.search('label:"'+label+'" -label:Traite -label:Erreur',0,50);
    for (let t of threads){
      for (let m of t.getMessages()){
        const parsed = parseFavOfferMessage_(type, m);
        if (!parsed) continue;
        try {
          bumpCounter_(sh, parsed.data);
          t.addLabel(labelDone);
          markProcessed_("INFO","ingestFavOffer","OK","", parsed.id);
        } catch(e){
          t.addLabel(labelErr);
          markProcessed_("ERROR","ingestFavOffer","KO", String(e), parsed.id);
        }
      }
    }
  }
}

function bumpCounter_(sh, d){
  const last = sh.getLastRow();
  if (last<2) return;
  const rng = sh.getRange(2,2,last-1,1).getValues(); // SKU col B
  let row = 0;
  for (let i=0;i<rng.length;i++){ if (String(rng[i][0]).toUpperCase()===String(d.sku).toUpperCase()){ row=i+2; break; } }
  if (!row) return; // SKU inconnu: ignoré en étape 5
  const col = (d.type==='fav') ? 14 : 15; // Favoris/Offres
  const old = Number(sh.getRange(row,col).getValue()||0);
  sh.getRange(row,col).setValue(old+1);
}

// ---- ACHATS Vinted ----
function ingestPurchasesVinted(){
  const label = labels_().PUR_VINTED;
  const threads = GmailApp.search('label:"'+label+'" -label:Traite -label:Erreur',0,50);
  const labelDone = GmailApp.getUserLabelByName("Traite") || GmailApp.createLabel("Traite");
  const labelErr  = GmailApp.getUserLabelByName("Erreur") || GmailApp.createLabel("Erreur");
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName("Achats");
  for (let t of threads){
    for (let m of t.getMessages()){
      const parsed = parsePurchaseVinted_(m);
      if (!parsed) continue;
      try {
        const row = Math.max(2, sh.getLastRow()+1);
        sh.getRange(row,1).setValue(parsed.data.date);
        sh.getRange(row,2).setValue(parsed.data.fournisseur);
        sh.getRange(row,3).setValue(parsed.data.price);
        sh.getRange(row,5).setValue(parsed.data.brand);
        sh.getRange(row,6).setValue(parsed.data.size);
        t.addLabel(labelDone);
        markProcessed_("INFO","ingestPurchases","OK","", parsed.id);
      } catch(e){
        t.addLabel(labelErr);
        markProcessed_("ERROR","ingestPurchases","KO", String(e), parsed.id);
      }
    }
  }
}
