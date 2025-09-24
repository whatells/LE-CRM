/**
 * Lecture simple de la table Configuration (clé/valeur)
 * Ex. clés: GMAIL_LABEL_INGEST_STOCK, GMAIL_LABEL_SALES_VINTED, COMMISSION_VINTED, APPLY_URSSAF...
 */
const SHEET_CONFIGURATION = "Configuration";

function getConfig_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_CONFIGURATION);
  const map = {};
  if (!sh) return map;
  const last = sh.getLastRow();
  if (last < 2) return map;
  const vals = sh.getRange(2,1,last-1,2).getValues();
  for (let i=0;i<vals.length;i++){
    const k = String(vals[i][0]||"").trim();
    const v = vals[i][1];
    if (k) map[k] = v;
  }
  return map;
}

function cfg_(key, def) {
  const c = getConfig_();
  return Object.prototype.hasOwnProperty.call(c, key) ? c[key] : def;
}
