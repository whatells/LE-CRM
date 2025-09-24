/**
 * UiService.gs — fonctions exposées à l'interface HtmlService.
 */

function uiFetchDashboard() {
  try {
    const data = getDashboardData();
    return {
      ok: true,
      data: data
    };
  } catch (error) {
    handleError(error, 'uiFetchDashboard');
  }
}

function uiRefreshDashboard() {
  try {
    const data = refreshDashboardData();
    return {
      ok: true,
      data: data
    };
  } catch (error) {
    handleError(error, 'uiRefreshDashboard');
  }
}

function uiFetchSettings() {
  try {
    const sheet = ensureSheet_(CONFIG.sheets.config, CONFIG.headers.config);
    const rows = readTable_(sheet, { maxCols: CONFIG.headers.config.length });
    const settings = rows
      .map(function (row) {
        return {
          key: String(row[0] || '').trim(),
          value: row[1] === undefined || row[1] === null ? '' : row[1],
          notes: String(row[2] || '')
        };
      })
      .filter(function (entry) { return entry.key; });
    return {
      ok: true,
      settings: settings
    };
  } catch (error) {
    handleError(error, 'uiFetchSettings');
  }
}

function uiSaveSettings(settings) {
  try {
    const entries = Array.isArray(settings) ? settings : [];
    const cleaned = entries
      .map(function (entry) {
        return {
          key: String(entry.key || '').trim(),
          value: entry.value === undefined || entry.value === null ? '' : entry.value,
          notes: String(entry.notes || '')
        };
      })
      .filter(function (entry) { return entry.key; });

    const sheet = ensureSheet_(CONFIG.sheets.config, CONFIG.headers.config);
    const range = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), CONFIG.headers.config.length);
    range.clearContent();

    if (cleaned.length) {
      const values = cleaned.map(function (entry) {
        return [entry.key, entry.value, entry.notes];
      });
      sheet.getRange(2, 1, cleaned.length, CONFIG.headers.config.length).setValues(values);
    }

    logInfo_('Settings', 'Configuration sauvegardée', safeJsonStringify({ count: cleaned.length }));

    return {
      ok: true,
      count: cleaned.length
    };
  } catch (error) {
    handleError(error, 'uiSaveSettings');
  }
}

function uiFetchLogs(limit) {
  try {
    const max = Math.min(Math.max(limit || 50, 1), 200);
    const ss = getActiveSpreadsheet_();
    const sheet = ss.getSheetByName(CONFIG.sheets.logs);
    if (!sheet || sheet.getLastRow() < 2) {
      return {
        ok: true,
        logs: []
      };
    }
    const total = sheet.getLastRow() - 1;
    const take = Math.min(max, total);
    const start = sheet.getLastRow() - take + 1;
    const values = sheet.getRange(start, 1, take, CONFIG.headers.logs.length).getValues();
    const logs = values.reverse().map(function (row) {
      return {
        timestamp: row[0],
        level: row[1],
        source: row[2],
        message: row[3],
        details: row[4]
      };
    });
    return {
      ok: true,
      logs: logs
    };
  } catch (error) {
    handleError(error, 'uiFetchLogs');
  }
}

function uiFetchPublicConfig() {
  try {
    return {
      ok: true,
      config: getPublicConfig()
    };
  } catch (error) {
    handleError(error, 'uiFetchPublicConfig');
  }
}

function uiPing() {
  return {
    ok: true,
    timestamp: new Date().toISOString()
  };
}
