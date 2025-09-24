// ==============================
// Module: Ui_Config.gs — Back-end configuration
// But: fournir les clés connues, ouvrir la fenêtre HtmlService et persister les paires clé/valeur.
// ==============================
const UI_KNOWN_CONFIG_KEYS = [
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

/** Lit toutes les paires clé/valeur (upsert-friendly) */
function getKnownConfig(){
  const map = fetchConfigMap_();
  return UI_KNOWN_CONFIG_KEYS.map(key => ({
    key: key,
    value: Object.prototype.hasOwnProperty.call(map, key) ? map[key] : ''
  }));
}

/** Sauvegarde des valeurs (upsert dans l'onglet Configuration) */
function saveConfigValues(rows){
  const items = Array.isArray(rows) ? rows : [];
  const sh = ensureConfigSheet_();
  if (!sh) return { ok: false, count: 0 };

  const idx = buildConfigIndex_(sh);
  let saved = 0;
  items.forEach(item => {
    const key = String(item && item.key || '').trim();
    if (!key) return;
    const value = item.value;
    let row = idx[key];
    if (!row){
      row = Math.max(2, sh.getLastRow() + 1);
      idx[key] = row;
    }
    sh.getRange(row, 1).setValue(key);
    sh.getRange(row, 2).setValue(value);
    saved++;
  });
  return { ok: true, count: saved };
}

// --- Helpers internes ---
function ensureConfigSheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Configuration');
  if (!sh){
    sh = ss.insertSheet('Configuration');
  }
  if (sh.getLastRow() === 0){
    sh.getRange(1,1,1,2).setValues([["Clé","Valeur"]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function buildConfigIndex_(sh){
  const last = sh.getLastRow();
  const index = {};
  if (last >= 2){
    const keys = sh.getRange(2,1,last-1,1).getValues();
    for (let i = 0; i < keys.length; i++){
      const key = String(keys[i][0] || '').trim();
      if (key) index[key] = i + 2;
    }
  }
  return index;
}

function fetchConfigMap_(){
  if (typeof getConfig_ === 'function'){
    return getConfig_();
  }
  const sh = SpreadsheetApp.getActive().getSheetByName('Configuration');
  if (!sh) return {};
  const last = sh.getLastRow();
  if (last < 2) return {};
  const vals = sh.getRange(2,1,last-1,2).getValues();
  const map = {};
  for (let i = 0; i < vals.length; i++){
    const key = String(vals[i][0] || '').trim();
    if (!key) continue;
    map[key] = vals[i][1];
  }
  return map;
}
