// ==============================
// FICHIER 2/4 — Ui_Config.gs (Apps Script, serveur)
// ==============================
/** Ouvre la fenêtre de configuration (popup) */
function openConfigUI(){
  const html = HtmlService.createHtmlOutputFromFile('ui_config')
    .setWidth(520)
    .setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configuration du CRM');
}

/** Lit toutes les paires clé/valeur (upsert-friendly) */
function getKnownConfig(){
  const knownKeys = [
    // Labels Gmail
    'GMAIL_LABEL_INGEST_STOCK',
    'GMAIL_LABEL_SALES_VINTED',
    'GMAIL_LABEL_SALES_VESTIAIRE',
    'GMAIL_LABEL_SALES_EBAY',
    'GMAIL_LABEL_SALES_LEBONCOIN',
    'GMAIL_LABEL_SALES_WHATNOT',
    'GMAIL_LABEL_FAVORITES_VINTED',
    'GMAIL_LABEL_OFFERS_VINTED',
    'GMAIL_LABEL_PURCHASES_VINTED',
    // Commissions par plateforme
    'COMM_VINTED_PCT','COMM_VINTED_MIN','COMM_VINTED_FLAT',
    'COMM_VESTIAIRE_PCT','COMM_VESTIAIRE_MIN','COMM_VESTIAIRE_FLAT',
    'COMM_EBAY_PCT','COMM_EBAY_MIN','COMM_EBAY_FLAT',
    'COMM_LEBONCOIN_PCT','COMM_LEBONCOIN_MIN','COMM_LEBONCOIN_FLAT',
    'COMM_WHATNOT_PCT','COMM_WHATNOT_MIN','COMM_WHATNOT_FLAT',
    // Flags globaux
    'APPLY_URSSAF','URSSAF_RATE',
    'APPLY_FIXED_COSTS','FIXED_COST_PER_SALE',
    'ROUND_MARGINS'
  ];
  const map = getConfig_ ? getConfig_() : {};
  return knownKeys.map(k => ({ key:k, value: (k in map? map[k] : '') }));
}

/** Sauvegarde des valeurs (upsert dans l'onglet Configuration) */
function saveConfigValues(rows){
  // rows: [{key, value}]
  const ss = SpreadsheetApp.getActive();
  const name = 'Configuration';
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  // En-têtes si besoin
  if (sh.getLastRow() === 0){
    sh.getRange(1,1,1,2).setValues([["Clé","Valeur"]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  // Index existant par clé
  const last = sh.getLastRow();
  const idx = {};
  if (last >= 2){
    const keys = sh.getRange(2,1,last-1,1).getValues();
    for (let i=0;i<keys.length;i++){
      const k = String(keys[i][0]||'').trim();
      if (k) idx[k] = i+2; // row
    }
  }
  // Upsert ligne par ligne
  rows.forEach(r => {
    const k = String(r.key||'').trim();
    if (!k) return;
    const v = r.value;
    let row = idx[k];
    if (!row){ row = Math.max(2, sh.getLastRow()+1); idx[k] = row; }
    sh.getRange(row,1).setValue(k);
    sh.getRange(row,2).setValue(v);
  });
  return {ok:true, count: rows.length};

/** Ouvre la fenêtre de configuration (popup) */
function openConfigUI(){
  const html = HtmlService.createHtmlOutputFromFile('ui_config')
    .setWidth(520)
    .setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configuration du CRM');
}

/** Inclut un fichier HTML (CSS/JS) et renvoie son contenu */
function include_(filename){
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Renvoie les paires clé/valeur existantes (déjà fourni plus tôt) */
function getKnownConfig(){
  const knownKeys = [
    'GMAIL_LABEL_INGEST_STOCK','GMAIL_LABEL_SALES_VINTED','GMAIL_LABEL_SALES_VESTIAIRE',
    'GMAIL_LABEL_SALES_EBAY','GMAIL_LABEL_SALES_LEBONCOIN','GMAIL_LABEL_SALES_WHATNOT',
    'GMAIL_LABEL_FAVORITES_VINTED','GMAIL_LABEL_OFFERS_VINTED','GMAIL_LABEL_PURCHASES_VINTED',
    'COMM_VINTED_PCT','COMM_VINTED_MIN','COMM_VINTED_FLAT',
    'COMM_VESTIAIRE_PCT','COMM_VESTIAIRE_MIN','COMM_VESTIAIRE_FLAT',
    'COMM_EBAY_PCT','COMM_EBAY_MIN','COMM_EBAY_FLAT',
    'COMM_LEBONCOIN_PCT','COMM_LEBONCOIN_MIN','COMM_LEBONCOIN_FLAT',
    'COMM_WHATNOT_PCT','COMM_WHATNOT_MIN','COMM_WHATNOT_FLAT',
    'APPLY_URSSAF','URSSAF_RATE','APPLY_FIXED_COSTS','FIXED_COST_PER_SALE','ROUND_MARGINS'
  ];
  const map = (typeof getConfig_ === 'function') ? getConfig_() : {};
  return knownKeys.map(k => ({ key:k, value: (k in map ? map[k] : '') }));
}

/** Upsert dans l’onglet Configuration (déjà fourni plus tôt) */
function saveConfigValues(rows){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Configuration') || ss.insertSheet('Configuration');
  if (sh.getLastRow() === 0){
    sh.getRange(1,1,1,2).setValues([['Clé','Valeur']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const last = sh.getLastRow();
  const idx = {};
  if (last >= 2){
    const keys = sh.getRange(2,1,last-1,1).getValues();
    for (let i=0;i<keys.length;i++){
      const k = String(keys[i][0]||'').trim();
      if (k) idx[k] = i+2;
    }
  }
  rows.forEach(r => {
    const k = String(r.key||'').trim(); if (!k) return;
    const v = r.value;
    let row = idx[k];
    if (!row){ row = Math.max(2, sh.getLastRow()+1); idx[k] = row; }
    sh.getRange(row,1).setValue(k);
    sh.getRange(row,2).setValue(v);
  });
  return {ok:true, count: rows.length};
}


}
