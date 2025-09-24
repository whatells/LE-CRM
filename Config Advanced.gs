/**
 * Étape 8 — Lecture avancée de l'onglet Configuration
 * Clés supportées (exemples):
 *  - COMM_VINTED_PCT, COMM_VINTED_MIN, COMM_VINTED_FLAT
 *  - COMM_VESTIAIRE_PCT, COMM_VESTIAIRE_MIN, COMM_VESTIAIRE_FLAT
 *  - COMM_EBAY_PCT, COMM_EBAY_MIN, COMM_EBAY_FLAT
 *  - COMM_LEBONCOIN_PCT, COMM_LEBONCOIN_MIN, COMM_LEBONCOIN_FLAT
 *  - COMM_WHATNOT_PCT, COMM_WHATNOT_MIN, COMM_WHATNOT_FLAT
 *  - APPLY_URSSAF (TRUE/FALSE), URSSAF_RATE (0..1)
 *  - APPLY_FIXED_COSTS (TRUE/FALSE), FIXED_COST_PER_SALE (nombre €)
 *  - ROUND_MARGINS (TRUE/FALSE)
 */

function cfgAll_(){
  // Réutilise getConfig_() déjà présent dans Config.gs
  return (typeof getConfig_ === 'function') ? getConfig_() : {};
}

function cfgBool_(c, key, def){
  const v = c[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return /^true|oui|1$/i.test(v.trim());
  return !!def;
}

function cfgNum_(c, key, def){
  const v = Number(String(c[key]??'').toString().replace(',','.'));
  return isFinite(v) && v!==0 ? v : (def||0);
}

function getPlatformFees_(platform){
  const c = cfgAll_();
  const p = String(platform||'').toUpperCase();
  return {
    pct:  cfgNum_(c, `COMM_${p}_PCT`, 0),   // ex. 0.12
    min:  cfgNum_(c, `COMM_${p}_MIN`, 0),   // ex. 0.70
    flat: cfgNum_(c, `COMM_${p}_FLAT`, 0),  // ex. 0.00
  };
}

function getGlobalFlags_(){
  const c = cfgAll_();
  return {
    applyUrssaf:      cfgBool_(c, 'APPLY_URSSAF', false),
    urssafRate:       cfgNum_(c, 'URSSAF_RATE', 0),
    applyFixedCosts:  cfgBool_(c, 'APPLY_FIXED_COSTS', false),
    fixedCostPerSale: cfgNum_(c, 'FIXED_COST_PER_SALE', 0),
    roundMargins:     cfgBool_(c, 'ROUND_MARGINS', true)
  };
}
