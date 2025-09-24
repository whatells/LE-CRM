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
  const cache = CacheService.getUserCache();
  cache.remove("PROC_IDS");
  cache.remove("THREAD_CURSOR");

  const props = PropertiesService.getUserProperties();
  const all = props.getProperties();
  Object.keys(all).forEach(function(key) {
    if (key === "PROC_IDS" || key === "THREAD_CURSOR" || key.indexOf("THREAD_CURSOR::") === 0) {
      props.deleteProperty(key);
    }
  });

  if (typeof PROC_IDS_FAST_CACHE !== "undefined") {
    PROC_IDS_FAST_CACHE = null;
  }
  if (typeof PROC_IDS_CACHE_ !== "undefined") {
    PROC_IDS_CACHE_ = null;
  }
  if (typeof PROC_IDS_SHEET_SYNCED_ !== "undefined") {
    PROC_IDS_SHEET_SYNCED_ = false;
  }
  logE_("INFO","Step10","Caches & états purgés","");
}
