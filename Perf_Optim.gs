/** Étape 10 — Helpers de performance (cache, backoff, états). */

// --- Cache KV (30 min) ---
function cacheSet_(key, value, seconds) {
  const c = CacheService.getUserCache();
  c.put(key, JSON.stringify(value), seconds || 1800);
}
function cacheGet_(key) {
  const c = CacheService.getUserCache();
  const v = c.get(key);
  return v ? JSON.parse(v) : null;
}
function cacheDel_(key) {
  const c = CacheService.getUserCache();
  c.remove(key);
}

// --- États persistants (IDs déjà traités, etc.) ---
function statePut_(key, value) {
  PropertiesService.getUserProperties().setProperty(key, JSON.stringify(value));
}
function stateGet_(key, def) {
  const v = PropertiesService.getUserProperties().getProperty(key);
  return v ? JSON.parse(v) : (def === undefined ? null : def);
}
function stateDel_(key) {
  PropertiesService.getUserProperties().deleteProperty(key);
}

// --- Backoff pour appels Gmail/Drive fragiles ---
function withBackoff_(fn, tries) {
  let n = tries || 5, wait = 500;
  while (n-- > 0) {
    try { return fn(); }
    catch (e) {
      if (n === 0) throw e;
      Utilities.sleep(wait);
      wait = Math.min(wait * 2, 8000);
    }
  }
}

// --- Logs enrichis (ne remplace pas log_ existant) ---
function logE_(level, source, message, details) {
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName("Logs") || ss.insertSheet("Logs");
    if (sh.getLastRow() === 0) {
      sh.getRange(1,1,1,5).setValues([["Horodatage","Niveau","Source","Message","Détails"]]).setFontWeight("bold");
      sh.setFrozenRows(1);
    }
    sh.appendRow([new Date(), level, source, message, details || ""]);
  } catch (_) {}
}

// --- Triggers horaires ---
function step10InstallHourlyTrigger() {
  step10RemoveTriggers();
  ScriptApp.newTrigger("ingestAllLabelsFast").timeBased().everyHours(1).create();
  logE_("INFO","Step10","Trigger horaire installé","ingestAllLabelsFast");
}
function step10RemoveTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "ingestAllLabelsFast") ScriptApp.deleteTrigger(t);
  });
  logE_("INFO","Step10","Triggers Étape10 supprimés","");
}

// --- Purge caches/états ---
function step10ClearCaches() {
  CacheService.getUserCache().removeAll(["PROC_IDS", "THREAD_CURSOR"]);
  stateDel_("PROC_IDS");
  stateDel_("THREAD_CURSOR");
  logE_("INFO","Step10","Caches & états purgés","");
}
