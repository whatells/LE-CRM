/**
 * DashboardService.gs — calculs et mise à jour du tableau de bord.
 */

function refreshDashboardData() {
  try {
    const data = computeDashboardData_();
    writeDashboardSheet_(data);
    logInfo_('Dashboard', 'Données recalculées', safeJsonStringify({ kpis: data.kpis.length }));
    return data;
  } catch (error) {
    handleError(error, 'refreshDashboardData');
  }
}

function getDashboardData() {
  try {
    const data = computeDashboardData_();
    return data;
  } catch (error) {
    handleError(error, 'getDashboardData');
  }
}

function computeDashboardData_() {
  const ss = getActiveSpreadsheet_();
  const ventesSheet = ss.getSheetByName(CONFIG.sheets.ventes);
  const stockSheet = ss.getSheetByName(CONFIG.sheets.stock);
  const boostsSheet = ss.getSheetByName(CONFIG.sheets.boosts);
  const costsSheet = ss.getSheetByName(CONFIG.sheets.costs);

  const ventesRows = readTable_(ventesSheet, { maxCols: 12 });
  const stockRows = readTable_(stockSheet, { maxCols: 15 });
  const boostsRows = readTable_(boostsSheet, { maxCols: 5 });
  const costsRows = readTable_(costsSheet, { maxCols: 5 });

  const metrics = computeMetrics_(ventesRows, stockRows, boostsRows, costsRows);
  const tables = buildTables_(ventesRows, stockRows, metrics.meta);

  const generatedAt = Utilities.formatDate(new Date(), CONFIG.timezone, "yyyy-MM-dd HH:mm:ss");

  return {
    generatedAt: generatedAt,
    kpis: metrics.kpis,
    tables: tables,
    meta: metrics.meta
  };
}

function computeMetrics_(ventesRows, stockRows, boostsRows, costsRows) {
  const IDX_V_PRICE = 3;
  const IDX_V_GROSS = 8;
  const IDX_V_NET = 9;
  const IDX_V_BUYER = 6;

  const IDX_S_TARGET = 9;
  const IDX_S_STATUS = 10;
  const IDX_S_FAVS = 13;
  const IDX_S_OFFERS = 14;

  const IDX_B_AMOUNT = 4;
  const IDX_C_AMOUNT = 3;

  const validSales = ventesRows.filter(function (row) {
    return Boolean(row[0]);
  });

  const revenue = validSales.reduce(function (sum, row) {
    return sum + toNumber(getCell_(row, IDX_V_PRICE));
  }, 0);
  const gross = validSales.reduce(function (sum, row) {
    return sum + toNumber(getCell_(row, IDX_V_GROSS));
  }, 0);
  const net = validSales.reduce(function (sum, row) {
    return sum + toNumber(getCell_(row, IDX_V_NET));
  }, 0);
  const countSales = validSales.length;
  const aov = countSales ? revenue / countSales : 0;

  const buyers = validSales
    .map(function (row) { return String(getCell_(row, IDX_V_BUYER) || '').trim(); })
    .filter(function (value) { return Boolean(value); });
  const buyerFrequency = buyers.reduce(function (acc, buyer) {
    acc[buyer] = (acc[buyer] || 0) + 1;
    return acc;
  }, {});
  const buyerCount = Object.keys(buyerFrequency).length;
  const repeatCount = Object.keys(buyerFrequency).filter(function (key) {
    return buyerFrequency[key] > 1;
  }).length;
  const repeatRate = buyerCount ? repeatCount / buyerCount : 0;

  const activeStock = stockRows.filter(function (row) {
    const status = String(getCell_(row, IDX_S_STATUS) || '').toLowerCase();
    if (!status) {
      return true;
    }
    return !(status === 'vendu' || status === 'sold');
  });
  const stockValue = activeStock.reduce(function (sum, row) {
    return sum + toNumber(getCell_(row, IDX_S_TARGET));
  }, 0);
  const favs = stockRows.reduce(function (sum, row) {
    return sum + toNumber(getCell_(row, IDX_S_FAVS));
  }, 0);
  const offers = stockRows.reduce(function (sum, row) {
    return sum + toNumber(getCell_(row, IDX_S_OFFERS));
  }, 0);

  const boostsTotal = boostsRows.reduce(function (sum, row) {
    return sum + toNumber(getCell_(row, IDX_B_AMOUNT));
  }, 0);
  const costsTotal = costsRows.reduce(function (sum, row) {
    return sum + toNumber(getCell_(row, IDX_C_AMOUNT));
  }, 0);
  const roiBoosts = boostsTotal > 0 ? (net - boostsTotal) / boostsTotal : null;

  const kpis = [
    makeKpi_('revenue', 'CA total', revenue, formatCurrency(revenue)),
    makeKpi_('gross', 'Marge brute', gross, formatCurrency(gross)),
    makeKpi_('net', 'Marge nette', net, formatCurrency(net)),
    makeKpi_('countSales', 'Nb ventes', countSales, String(countSales)),
    makeKpi_('aov', 'Panier moyen', aov, formatCurrency(roundNumber(aov, 2))),
    makeKpi_(
      'repeatRate',
      'Repeat rate acheteurs',
      repeatRate,
      formatNumber(repeatRate * 100, 1) + ' %'
    ),
    makeKpi_('stockValue', 'Valeur stock (prix cible)', stockValue, formatCurrency(stockValue)),
    makeKpi_('costsTotal', 'Coûts fixes cumulés', costsTotal, formatCurrency(costsTotal)),
    makeKpi_('boostsTotal', 'Coût Boosts', boostsTotal, formatCurrency(boostsTotal)),
    makeKpi_(
      'roiBoosts',
      'ROI Boosts',
      roiBoosts === null ? null : roiBoosts,
      roiBoosts === null ? 'n/a' : formatNumber(roiBoosts * 100, 1) + ' %'
    ),
    makeKpi_('favs', 'Favoris (total)', favs, formatNumber(favs, 0)),
    makeKpi_('offers', 'Offres (total)', offers, formatNumber(offers, 0))
  ];

  return {
    kpis: kpis,
    meta: {
      revenue: revenue,
      gross: gross,
      net: net,
      countSales: countSales,
      aov: aov,
      repeatRate: repeatRate,
      stockValue: stockValue,
      costsTotal: costsTotal,
      boostsTotal: boostsTotal,
      roiBoosts: roiBoosts,
      favs: favs,
      offers: offers
    }
  };
}

function buildTables_(ventesRows, stockRows, meta) {
  const tables = [];
  tables.push(buildMonthlyRevenueTable_(ventesRows));
  tables.push(buildPlatformSplitTable_(ventesRows));
  tables.push(buildFavOfferTable_(meta));
  tables.push(buildTopStockTable_(stockRows));
  return tables.filter(function (table) { return table && table.headers; });
}

function buildMonthlyRevenueTable_(ventesRows) {
  const header = ['Mois', 'CA'];
  const map = {};
  ventesRows.forEach(function (row) {
    const date = dateFromCell_(row[0]);
    if (!date) {
      return;
    }
    const key = Utilities.formatDate(date, CONFIG.timezone, 'yyyy-MM');
    map[key] = (map[key] || 0) + toNumber(getCell_(row, 3));
  });
  const keys = Object.keys(map).sort();
  const rows = keys.map(function (key) {
    return [key, formatCurrency(roundNumber(map[key], 2))];
  });
  return {
    id: 'monthlyRevenue',
    title: 'Chiffre d’affaires mensuel',
    headers: header,
    rows: rows
  };
}

function buildPlatformSplitTable_(ventesRows) {
  const header = ['Plateforme', 'CA'];
  const map = {};
  ventesRows.forEach(function (row) {
    const platform = String(getCell_(row, 1) || 'Inconnu');
    map[platform] = (map[platform] || 0) + toNumber(getCell_(row, 3));
  });
  const rows = Object.keys(map)
    .sort(function (a, b) { return map[b] - map[a]; })
    .map(function (key) { return [key, formatCurrency(roundNumber(map[key], 2))]; });
  return {
    id: 'platformSplit',
    title: 'CA par plateforme',
    headers: header,
    rows: rows
  };
}

function buildFavOfferTable_(meta) {
  const rows = [
    ['Favoris', formatNumber(meta.favs || 0, 0)],
    ['Offres', formatNumber(meta.offers || 0, 0)]
  ];
  return {
    id: 'favoritesOffers',
    title: 'Favoris & Offres',
    headers: ['Type', 'Total'],
    rows: rows
  };
}

function buildTopStockTable_(stockRows) {
  if (!stockRows.length) {
    return {
      id: 'topStock',
      title: 'Stock actif',
      headers: ['SKU', 'Titre', 'Prix cible'],
      rows: []
    };
  }
  const entries = stockRows
    .filter(function (row) { return getCell_(row, 9); })
    .map(function (row) {
      return {
        sku: String(getCell_(row, 1) || ''),
        title: String(getCell_(row, 2) || ''),
        target: toNumber(getCell_(row, 9))
      };
    })
    .sort(function (a, b) { return b.target - a.target; })
    .slice(0, 10);
  const rows = entries.map(function (entry) {
    return [entry.sku, entry.title, formatCurrency(entry.target)];
  });
  return {
    id: 'topStock',
    title: 'Top 10 prix cible',
    headers: ['SKU', 'Titre', 'Prix cible'],
    rows: rows
  };
}

function writeDashboardSheet_(data) {
  const sheet = ensureSheet_(CONFIG.sheets.dashboard, CONFIG.headers.dashboard);
  sheet.getRange(1, 1, 1, CONFIG.headers.dashboard.length).setValues([CONFIG.headers.dashboard]);
  sheet.getRange(1, 1, 1, CONFIG.headers.dashboard.length).setFontWeight('bold');
  clearBelow_(sheet, 2);

  const kpiRows = data.kpis.map(function (kpi) {
    return [kpi.label, kpi.display || kpi.value];
  });
  if (kpiRows.length) {
    writeBlock_(sheet, 2, 1, kpiRows);
  }

  sheet.getRange(1, 3).setValue('Mise à jour');
  sheet.getRange(1, 4).setValue(data.generatedAt);

  let currentCol = 5;
  data.tables.forEach(function (table) {
    if (!table.headers || !table.headers.length) {
      return;
    }
    const block = [table.headers].concat(table.rows || []);
    if (!block.length) {
      return;
    }
    sheet.getRange(1, currentCol).setValue(table.title);
    writeBlock_(sheet, 2, currentCol, block);
    sheet.getRange(2, currentCol, 1, table.headers.length).setFontWeight('bold');
    currentCol += table.headers.length + 2;
  });

  sheet.autoResizeColumns(1, Math.min(sheet.getLastColumn(), 8));
}

function makeKpi_(key, label, raw, value) {
  return {
    key: key,
    label: label,
    raw: raw,
    value: value,
    display: value
  };
}

function getCell_(row, index) {
  return index < row.length ? row[index] : null;
}

function dateFromCell_(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Test léger : renvoie les métriques pour validation manuelle.
 */
function test_computeDashboard() {
  return computeDashboardData_();
}
