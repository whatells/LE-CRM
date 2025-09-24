/**
 * SheetService.gs — utilitaires pour manipuler les feuilles de calcul.
 */

function getActiveSpreadsheet_() {
  return SpreadsheetApp.getActive();
}

function ensureSheet_(name, headers) {
  const ss = getActiveSpreadsheet_();
  const normalizedName = name || 'Sheet';
  const sheet = ss.getSheetByName(normalizedName) || ss.insertSheet(normalizedName);
  if (headers && headers.length) {
    const range = sheet.getRange(1, 1, 1, headers.length);
    const current = range.getValues()[0];
    const needsUpdate = headers.some(function (header, index) {
      return String(current[index] || '') !== header;
    });
    if (needsUpdate) {
      range.setValues([headers]);
    }
    range.setFontWeight('bold');
    if (sheet.getFrozenRows() < 1) {
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function readTable_(sheet, options) {
  if (!sheet) {
    return [];
  }
  const opts = options || {};
  const startRow = opts.startRow || 2;
  const startCol = opts.startCol || 1;
  const maxCols = opts.maxCols || sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) {
    return [];
  }
  const numRows = lastRow - startRow + 1;
  if (numRows <= 0 || maxCols <= 0) {
    return [];
  }
  return sheet.getRange(startRow, startCol, numRows, maxCols).getValues();
}

function writeBlock_(sheet, startRow, startCol, values) {
  if (!sheet || !values || !values.length) {
    return;
  }
  const height = values.length;
  const width = Math.max.apply(null, values.map(function (row) { return row.length; }));
  if (!width) {
    return;
  }
  sheet.getRange(startRow, startCol, height, width).setValues(values);
}

function clearBelow_(sheet, startRow) {
  if (!sheet) {
    return;
  }
  const lastRow = sheet.getLastRow();
  if (startRow <= lastRow) {
    const numRows = lastRow - startRow + 1;
    sheet.getRange(startRow, 1, numRows, sheet.getMaxColumns()).clearContent();
  }
}
