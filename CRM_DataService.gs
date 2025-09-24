/**
 * Service de gestion des données CRM
 * Toutes les opérations CRUD sur les feuilles Google Sheets
 */

// Configuration des feuilles
const SHEETS_CONFIG = {
  STOCK: 'Stock',
  SALES: 'Ventes', 
  PURCHASES: 'Achats',
  CONFIG: 'Configuration',
  DASHBOARD: 'Dashboard'
};

// Colonnes des feuilles
const COLUMNS = {
  STOCK: {
    DATE: 1, SKU: 2, TITLE: 3, PHOTOS: 4, CATEGORY: 5, BRAND: 6, 
    SIZE: 7, CONDITION: 8, PURCHASE_PRICE: 9, TARGET_PRICE: 10, 
    STATUS: 11, PLATFORM: 12, PURCHASE_REF: 13, FAVORITES: 14, 
    OFFERS: 15, NOTES: 16
  },
  SALES: {
    DATE: 1, PLATFORM: 2, TITLE: 3, PRICE: 4, FEES: 5, SHIPPING: 6,
    BUYER: 7, SKU: 8, GROSS_MARGIN: 9, NET_MARGIN: 10, TRACKING: 11, 
    SHIPPING_METHOD: 12
  },
  PURCHASES: {
    DATE: 1, SUPPLIER: 2, PRICE: 3, CATEGORY: 4, BRAND: 5, SIZE: 6,
    CONDITION: 7, NOTES: 8, REF: 9
  }
};

/**
 * Initialise la structure des feuilles
 */
function createSheetsStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Créer les feuilles si elles n'existent pas
  createSheetIfNotExists(ss, SHEETS_CONFIG.STOCK, [
    'Date entrée', 'SKU', 'Titre (avec SKU)', 'Photos', 'Catégorie', 'Marque',
    'Taille', 'État', 'Prix achat', 'Prix cible', 'Statut', 'Plateforme',
    'Réf. Achat', 'Favoris', 'Offres', 'Notes'
  ]);
  
  createSheetIfNotExists(ss, SHEETS_CONFIG.SALES, [
    'Date vente', 'Plateforme', 'Titre (avec SKU)', 'Prix de vente', 'Frais/Commission',
    'Frais port', 'Acheteur', 'SKU', 'Marge brute', 'Marge nette', 'N° suivi', 'Mode d\'envoi'
  ]);
  
  createSheetIfNotExists(ss, SHEETS_CONFIG.PURCHASES, [
    'Date achat', 'Fournisseur', 'Prix achat', 'Catégorie', 'Marque',
    'Taille', 'État', 'Notes', 'Réf (auto)'
  ]);
  
  createSheetIfNotExists(ss, SHEETS_CONFIG.CONFIG, [
    'Clé', 'Valeur', 'Notes'
  ]);
  
  createSheetIfNotExists(ss, SHEETS_CONFIG.DASHBOARD, [
    'KPI', 'Valeur'
  ]);
  
  // Appliquer les formats et validations
  setupSheetFormats();
}

/**
 * Crée une feuille si elle n'existe pas
 */
function createSheetIfNotExists(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  
  // Ajouter les en-têtes si la feuille est vide
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    // Ajuster la largeur des colonnes
    for (let i = 1; i <= headers.length; i++) {
      sheet.setColumnWidth(i, 150);
    }
  }
  
  return sheet;
}

/**
 * Configure les formats des feuilles
 */
function setupSheetFormats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Format Stock
  const stockSheet = ss.getSheetByName(SHEETS_CONFIG.STOCK);
  if (stockSheet) {
    // Format dates
    stockSheet.getRange(2, COLUMNS.STOCK.DATE, stockSheet.getMaxRows() - 1, 1)
      .setNumberFormat('dd/mm/yyyy');
    
    // Format prix
    stockSheet.getRange(2, COLUMNS.STOCK.PURCHASE_PRICE, stockSheet.getMaxRows() - 1, 1)
      .setNumberFormat('#,##0.00 €');
    stockSheet.getRange(2, COLUMNS.STOCK.TARGET_PRICE, stockSheet.getMaxRows() - 1, 1)
      .setNumberFormat('#,##0.00 €');
    
    // Validation SKU
    const skuValidation = SpreadsheetApp.newDataValidation()
      .requireFormulaSatisfied('=AND(LEN(B2)>=2, LEN(B2)<=10, REGEXMATCH(B2, "^[A-Z0-9]+$"))')
      .setAllowInvalid(false)
      .setHelpText('Le SKU doit contenir entre 2 et 10 caractères alphanumériques en majuscules')
      .build();
    
    stockSheet.getRange(2, COLUMNS.STOCK.SKU, stockSheet.getMaxRows() - 1, 1)
      .setDataValidation(skuValidation);
  }
  
  // Format Ventes
  const salesSheet = ss.getSheetByName(SHEETS_CONFIG.SALES);
  if (salesSheet) {
    // Format dates
    salesSheet.getRange(2, COLUMNS.SALES.DATE, salesSheet.getMaxRows() - 1, 1)
      .setNumberFormat('dd/mm/yyyy');
    
    // Format prix et marges
    const priceColumns = [COLUMNS.SALES.PRICE, COLUMNS.SALES.FEES, COLUMNS.SALES.SHIPPING, 
                         COLUMNS.SALES.GROSS_MARGIN, COLUMNS.SALES.NET_MARGIN];
    priceColumns.forEach(col => {
      salesSheet.getRange(2, col, salesSheet.getMaxRows() - 1, 1)
        .setNumberFormat('#,##0.00 €');
    });
  }
  
  // Format Achats
  const purchasesSheet = ss.getSheetByName(SHEETS_CONFIG.PURCHASES);
  if (purchasesSheet) {
    // Format dates
    purchasesSheet.getRange(2, COLUMNS.PURCHASES.DATE, purchasesSheet.getMaxRows() - 1, 1)
      .setNumberFormat('dd/mm/yyyy');
    
    // Format prix
    purchasesSheet.getRange(2, COLUMNS.PURCHASES.PRICE, purchasesSheet.getMaxRows() - 1, 1)
      .setNumberFormat('#,##0.00 €');
  }
}

/**
 * Récupère les données du dashboard
 */
function getDashboardData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Calculer les statistiques
    const stats = calculateDashboardStats();
    
    // Récupérer l'activité récente
    const recentActivity = getRecentActivity();
    
    return {
      totalRevenue: stats.totalRevenue,
      totalStock: stats.totalStock,
      totalSales: stats.totalSales,
      avgMargin: stats.avgMargin,
      recentActivity: recentActivity
    };
  } catch (error) {
    console.error('Erreur getDashboardData:', error);
    throw new Error('Impossible de charger les données du dashboard');
  }
}

/**
 * Calcule les statistiques du dashboard
 */
function calculateDashboardStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Statistiques des ventes
  const salesSheet = ss.getSheetByName(SHEETS_CONFIG.SALES);
  let totalRevenue = 0;
  let totalSales = 0;
  let totalMargin = 0;
  
  if (salesSheet && salesSheet.getLastRow() > 1) {
    const salesData = salesSheet.getRange(2, 1, salesSheet.getLastRow() - 1, 12).getValues();
    
    salesData.forEach(row => {
      if (row[COLUMNS.SALES.PRICE - 1]) {
        totalRevenue += Number(row[COLUMNS.SALES.PRICE - 1]) || 0;
        totalSales++;
        totalMargin += Number(row[COLUMNS.SALES.NET_MARGIN - 1]) || 0;
      }
    });
  }
  
  // Statistiques du stock
  const stockSheet = ss.getSheetByName(SHEETS_CONFIG.STOCK);
  let totalStock = 0;
  
  if (stockSheet && stockSheet.getLastRow() > 1) {
    const stockData = stockSheet.getRange(2, 1, stockSheet.getLastRow() - 1, 16).getValues();
    
    stockData.forEach(row => {
      if (row[COLUMNS.STOCK.SKU - 1] && row[COLUMNS.STOCK.STATUS - 1] !== 'Vendu') {
        totalStock++;
      }
    });
  }
  
  const avgMargin = totalSales > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  
  return {
    totalRevenue: totalRevenue,
    totalStock: totalStock,
    totalSales: totalSales,
    avgMargin: avgMargin
  };
}

/**
 * Récupère l'activité récente
 */
function getRecentActivity() {
  const activities = [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Dernières ventes
  const salesSheet = ss.getSheetByName(SHEETS_CONFIG.SALES);
  if (salesSheet && salesSheet.getLastRow() > 1) {
    const salesData = salesSheet.getRange(2, 1, Math.min(5, salesSheet.getLastRow() - 1), 12).getValues();
    
    salesData.forEach(row => {
      if (row[COLUMNS.SALES.DATE - 1]) {
        activities.push({
          type: 'sale',
          title: `Vente: ${row[COLUMNS.SALES.TITLE - 1]} - ${row[COLUMNS.SALES.PRICE - 1]}€`,
          date: row[COLUMNS.SALES.DATE - 1]
        });
      }
    });
  }
  
  // Derniers achats
  const purchasesSheet = ss.getSheetByName(SHEETS_CONFIG.PURCHASES);
  if (purchasesSheet && purchasesSheet.getLastRow() > 1) {
    const purchasesData = purchasesSheet.getRange(2, 1, Math.min(3, purchasesSheet.getLastRow() - 1), 9).getValues();
    
    purchasesData.forEach(row => {
      if (row[COLUMNS.PURCHASES.DATE - 1]) {
        activities.push({
          type: 'purchase',
          title: `Achat: ${row[COLUMNS.PURCHASES.SUPPLIER - 1]} - ${row[COLUMNS.PURCHASES.PRICE - 1]}€`,
          date: row[COLUMNS.PURCHASES.DATE - 1]
        });
      }
    });
  }
  
  // Trier par date décroissante
  activities.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return activities.slice(0, 10);
}

/**
 * Récupère les données du stock
 */
function getStockData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS_CONFIG.STOCK);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { items: [] };
    }
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getValues();
    const items = [];
    
    data.forEach((row, index) => {
      if (row[COLUMNS.STOCK.SKU - 1]) {
        items.push({
          id: index + 2, // Row number
          sku: row[COLUMNS.STOCK.SKU - 1],
          title: row[COLUMNS.STOCK.TITLE - 1],
          category: row[COLUMNS.STOCK.CATEGORY - 1],
          purchasePrice: row[COLUMNS.STOCK.PURCHASE_PRICE - 1] || 0,
          targetPrice: row[COLUMNS.STOCK.TARGET_PRICE - 1] || 0,
          status: row[COLUMNS.STOCK.STATUS - 1] || 'disponible',
          platform: row[COLUMNS.STOCK.PLATFORM - 1],
          notes: row[COLUMNS.STOCK.NOTES - 1]
        });
      }
    });
    
    return { items: items };
  } catch (error) {
    console.error('Erreur getStockData:', error);
    throw new Error('Impossible de charger les données du stock');
  }
}

/**
 * Récupère les données des ventes
 */
function getSalesData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS_CONFIG.SALES);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { sales: [] };
    }
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
    const sales = [];
    
    data.forEach((row, index) => {
      if (row[COLUMNS.SALES.DATE - 1]) {
        sales.push({
          id: index + 2, // Row number
          date: row[COLUMNS.SALES.DATE - 1],
          platform: row[COLUMNS.SALES.PLATFORM - 1],
          title: row[COLUMNS.SALES.TITLE - 1],
          price: row[COLUMNS.SALES.PRICE - 1] || 0,
          fees: row[COLUMNS.SALES.FEES - 1] || 0,
          margin: row[COLUMNS.SALES.NET_MARGIN - 1] || 0,
          buyer: row[COLUMNS.SALES.BUYER - 1],
          sku: row[COLUMNS.SALES.SKU - 1]
        });
      }
    });
    
    // Trier par date décroissante
    sales.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return { sales: sales };
  } catch (error) {
    console.error('Erreur getSalesData:', error);
    throw new Error('Impossible de charger les données des ventes');
  }
}

/**
 * Récupère les données des achats
 */
function getPurchasesData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS_CONFIG.PURCHASES);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { purchases: [] };
    }
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
    const purchases = [];
    
    data.forEach((row, index) => {
      if (row[COLUMNS.PURCHASES.DATE - 1]) {
        purchases.push({
          id: index + 2, // Row number
          date: row[COLUMNS.PURCHASES.DATE - 1],
          supplier: row[COLUMNS.PURCHASES.SUPPLIER - 1],
          description: `${row[COLUMNS.PURCHASES.BRAND - 1] || ''} ${row[COLUMNS.PURCHASES.CATEGORY - 1] || ''}`.trim(),
          price: row[COLUMNS.PURCHASES.PRICE - 1] || 0,
          category: row[COLUMNS.PURCHASES.CATEGORY - 1],
          status: 'reçu', // Status par défaut
          notes: row[COLUMNS.PURCHASES.NOTES - 1]
        });
      }
    });
    
    // Trier par date décroissante
    purchases.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return { purchases: purchases };
  } catch (error) {
    console.error('Erreur getPurchasesData:', error);
    throw new Error('Impossible de charger les données des achats');
  }
}

/**
 * Récupère les données d'analytics
 */
function getAnalyticsData(period) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const salesSheet = ss.getSheetByName(SHEETS_CONFIG.SALES);
    
    if (!salesSheet || salesSheet.getLastRow() <= 1) {
      return { topItems: [] };
    }
    
    const data = salesSheet.getRange(2, 1, salesSheet.getLastRow() - 1, 12).getValues();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(period));
    
    // Filtrer par période
    const filteredData = data.filter(row => {
      const saleDate = new Date(row[COLUMNS.SALES.DATE - 1]);
      return saleDate >= cutoffDate;
    });
    
    // Calculer les top items
    const itemStats = {};
    filteredData.forEach(row => {
      const sku = row[COLUMNS.SALES.SKU - 1];
      const title = row[COLUMNS.SALES.TITLE - 1];
      const price = row[COLUMNS.SALES.PRICE - 1] || 0;
      
      if (sku) {
        if (!itemStats[sku]) {
          itemStats[sku] = {
            title: title,
            sales: 0,
            revenue: 0
          };
        }
        itemStats[sku].sales++;
        itemStats[sku].revenue += price;
      }
    });
    
    // Convertir en array et trier
    const topItems = Object.keys(itemStats).map(sku => ({
      sku: sku,
      title: itemStats[sku].title,
      sales: itemStats[sku].sales,
      revenue: itemStats[sku].revenue
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    
    return { topItems: topItems };
  } catch (error) {
    console.error('Erreur getAnalyticsData:', error);
    throw new Error('Impossible de charger les données d\'analytics');
  }
}

/**
 * Ajoute un article au stock
 */
function addStock(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS_CONFIG.STOCK);
    
    if (!sheet) {
      throw new Error('Feuille Stock non trouvée');
    }
    
    // Vérifier l'unicité du SKU
    if (data.sku) {
      const existingData = sheet.getRange(2, COLUMNS.STOCK.SKU, sheet.getLastRow() - 1 || 1, 1).getValues();
      const skuExists = existingData.some(row => row[0] === data.sku);
      
      if (skuExists) {
        return { success: false, error: 'Ce SKU existe déjà' };
      }
    }
    
    const newRow = sheet.getLastRow() + 1;
    
    // Ajouter les données
    sheet.getRange(newRow, COLUMNS.STOCK.DATE).setValue(new Date());
    sheet.getRange(newRow, COLUMNS.STOCK.SKU).setValue(data.sku.toUpperCase());
    sheet.getRange(newRow, COLUMNS.STOCK.TITLE).setValue(data.title);
    sheet.getRange(newRow, COLUMNS.STOCK.CATEGORY).setValue(data.category);
    sheet.getRange(newRow, COLUMNS.STOCK.PURCHASE_PRICE).setValue(data.purchasePrice);
    sheet.getRange(newRow, COLUMNS.STOCK.TARGET_PRICE).setValue(data.targetPrice);
    sheet.getRange(newRow, COLUMNS.STOCK.STATUS).setValue('disponible');
    sheet.getRange(newRow, COLUMNS.STOCK.NOTES).setValue(data.description);
    
    return { success: true };
  } catch (error) {
    console.error('Erreur addStock:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Ajoute une vente
 */
function addSale(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS_CONFIG.SALES);
    
    if (!sheet) {
      throw new Error('Feuille Ventes non trouvée');
    }
    
    // Vérifier que le SKU existe dans le stock
    const stockSheet = ss.getSheetByName(SHEETS_CONFIG.STOCK);
    if (stockSheet && data.sku) {
      const stockData = stockSheet.getRange(2, COLUMNS.STOCK.SKU, stockSheet.getLastRow() - 1 || 1, 1).getValues();
      const skuExists = stockData.some(row => row[0] === data.sku);
      
      if (!skuExists) {
        return { success: false, error: 'SKU non trouvé dans le stock' };
      }
      
      // Marquer l'article comme vendu dans le stock
      const stockRowData = stockSheet.getRange(2, 1, stockSheet.getLastRow() - 1, 16).getValues();
      for (let i = 0; i < stockRowData.length; i++) {
        if (stockRowData[i][COLUMNS.STOCK.SKU - 1] === data.sku) {
          stockSheet.getRange(i + 2, COLUMNS.STOCK.STATUS).setValue('vendu');
          break;
        }
      }
    }
    
    const newRow = sheet.getLastRow() + 1;
    const saleDate = data.date ? new Date(data.date) : new Date();
    
    // Calculer les marges (simplifié)
    const grossMargin = data.price - data.fees;
    const netMargin = grossMargin; // Peut être amélioré avec plus de calculs
    
    // Ajouter les données
    sheet.getRange(newRow, COLUMNS.SALES.DATE).setValue(saleDate);
    sheet.getRange(newRow, COLUMNS.SALES.PLATFORM).setValue(data.platform);
    sheet.getRange(newRow, COLUMNS.SALES.TITLE).setValue(`${data.sku} - Article vendu`);
    sheet.getRange(newRow, COLUMNS.SALES.PRICE).setValue(data.price);
    sheet.getRange(newRow, COLUMNS.SALES.FEES).setValue(data.fees);
    sheet.getRange(newRow, COLUMNS.SALES.BUYER).setValue(data.buyer);
    sheet.getRange(newRow, COLUMNS.SALES.SKU).setValue(data.sku);
    sheet.getRange(newRow, COLUMNS.SALES.GROSS_MARGIN).setValue(grossMargin);
    sheet.getRange(newRow, COLUMNS.SALES.NET_MARGIN).setValue(netMargin);
    
    return { success: true };
  } catch (error) {
    console.error('Erreur addSale:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Ajoute un achat
 */
function addPurchase(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS_CONFIG.PURCHASES);
    
    if (!sheet) {
      throw new Error('Feuille Achats non trouvée');
    }
    
    const newRow = sheet.getLastRow() + 1;
    const purchaseDate = data.date ? new Date(data.date) : new Date();
    
    // Générer une référence automatique
    const ref = `ACH-${String(newRow - 1).padStart(5, '0')}`;
    
    // Ajouter les données
    sheet.getRange(newRow, COLUMNS.PURCHASES.DATE).setValue(purchaseDate);
    sheet.getRange(newRow, COLUMNS.PURCHASES.SUPPLIER).setValue(data.supplier);
    sheet.getRange(newRow, COLUMNS.PURCHASES.PRICE).setValue(data.price);
    sheet.getRange(newRow, COLUMNS.PURCHASES.CATEGORY).setValue(data.category);
    sheet.getRange(newRow, COLUMNS.PURCHASES.NOTES).setValue(data.notes);
    sheet.getRange(newRow, COLUMNS.PURCHASES.REF).setValue(ref);
    
    return { success: true };
  } catch (error) {
    console.error('Erreur addPurchase:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Génère un rapport
 */
function generateReport() {
  try {
    // Créer un nouveau spreadsheet pour le rapport
    const reportSS = SpreadsheetApp.create('Rapport CRM - ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy'));
    
    // Copier les données principales
    const sourceSS = SpreadsheetApp.getActiveSpreadsheet();
    
    // Copier la feuille des ventes
    const salesSheet = sourceSS.getSheetByName(SHEETS_CONFIG.SALES);
    if (salesSheet) {
      salesSheet.copyTo(reportSS).setName('Ventes');
    }
    
    // Copier la feuille du stock
    const stockSheet = sourceSS.getSheetByName(SHEETS_CONFIG.STOCK);
    if (stockSheet) {
      stockSheet.copyTo(reportSS).setName('Stock');
    }
    
    // Supprimer la feuille par défaut
    const defaultSheet = reportSS.getSheetByName('Feuille 1');
    if (defaultSheet) {
      reportSS.deleteSheet(defaultSheet);
    }
    
    return { 
      success: true, 
      url: reportSS.getUrl() 
    };
  } catch (error) {
    console.error('Erreur generateReport:', error);
    return { success: false, error: error.toString() };
  }
}