/**
 * Service de gestion de la configuration CRM
 */

/**
 * Récupère la configuration actuelle
 */
function getConfiguration() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS_CONFIG.CONFIG);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return getDefaultConfiguration();
    }
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
    const config = getDefaultConfiguration();
    
    // Charger les valeurs depuis la feuille
    data.forEach(row => {
      const key = row[0];
      const value = row[1];
      
      if (key && value !== '') {
        setConfigValue(config, key, value);
      }
    });
    
    return config;
  } catch (error) {
    console.error('Erreur getConfiguration:', error);
    return getDefaultConfiguration();
  }
}

/**
 * Sauvegarde la configuration
 */
function saveConfiguration(configData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEETS_CONFIG.CONFIG);
    
    if (!sheet) {
      sheet = createSheetIfNotExists(ss, SHEETS_CONFIG.CONFIG, ['Clé', 'Valeur', 'Notes']);
    }
    
    // Vider la feuille (sauf les en-têtes)
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clearContent();
    }
    
    // Convertir la configuration en lignes
    const rows = flattenConfiguration(configData);
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erreur saveConfiguration:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Configuration par défaut
 */
function getDefaultConfiguration() {
  return {
    companyName: '',
    currency: 'EUR',
    platforms: {
      vinted: {
        enabled: true,
        commission: 12,
        fees: 0.70
      },
      vestiaire: {
        enabled: false,
        commission: 25,
        fees: 0
      },
      ebay: {
        enabled: false,
        commission: 10,
        fees: 0.35
      }
    },
    categories: ['Vêtements', 'Chaussures', 'Accessoires', 'Sacs'],
    notifications: {
      lowStock: true,
      newSale: true,
      marginAlert: false
    },
    automation: {
      skuGeneration: true,
      priceCalculation: true,
      marginCalculation: true
    },
    backup: {
      autoBackup: true
    }
  };
}

/**
 * Définit une valeur de configuration à partir d'une clé
 */
function setConfigValue(config, key, value) {
  const keys = key.split('.');
  let current = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  const lastKey = keys[keys.length - 1];
  
  // Conversion des types
  if (value === 'true' || value === 'false') {
    current[lastKey] = value === 'true';
  } else if (!isNaN(value) && value !== '') {
    current[lastKey] = Number(value);
  } else if (key === 'categories') {
    current[lastKey] = JSON.parse(value);
  } else {
    current[lastKey] = value;
  }
}

/**
 * Aplatit la configuration en lignes pour la feuille
 */
function flattenConfiguration(config) {
  const rows = [];
  
  function addRow(key, value, notes = '') {
    rows.push([key, value, notes]);
  }
  
  // Informations générales
  addRow('companyName', config.companyName, 'Nom de l\'entreprise');
  addRow('currency', config.currency, 'Devise utilisée');
  
  // Plateformes
  Object.keys(config.platforms).forEach(platform => {
    const platformData = config.platforms[platform];
    addRow(`platforms.${platform}.enabled`, platformData.enabled, `${platform} activé`);
    addRow(`platforms.${platform}.commission`, platformData.commission, `Commission ${platform} (%)`);
    addRow(`platforms.${platform}.fees`, platformData.fees, `Frais fixes ${platform} (€)`);
  });
  
  // Catégories
  addRow('categories', JSON.stringify(config.categories), 'Liste des catégories');
  
  // Notifications
  Object.keys(config.notifications).forEach(key => {
    addRow(`notifications.${key}`, config.notifications[key], `Notification ${key}`);
  });
  
  // Automatisation
  Object.keys(config.automation).forEach(key => {
    addRow(`automation.${key}`, config.automation[key], `Automatisation ${key}`);
  });
  
  // Sauvegarde
  Object.keys(config.backup).forEach(key => {
    addRow(`backup.${key}`, config.backup[key], `Sauvegarde ${key}`);
  });
  
  return rows;
}

/**
 * Crée une sauvegarde
 */
function createBackup() {
  try {
    const sourceSS = SpreadsheetApp.getActiveSpreadsheet();
    const backupSS = SpreadsheetApp.create(`Sauvegarde CRM - ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')}`);
    
    // Copier toutes les feuilles
    const sheets = sourceSS.getSheets();
    sheets.forEach(sheet => {
      if (sheet.getName() !== 'Feuille 1') {
        sheet.copyTo(backupSS);
      }
    });
    
    // Supprimer la feuille par défaut
    const defaultSheet = backupSS.getSheetByName('Feuille 1');
    if (defaultSheet) {
      backupSS.deleteSheet(defaultSheet);
    }
    
    return { 
      success: true, 
      url: backupSS.getUrl() 
    };
  } catch (error) {
    console.error('Erreur createBackup:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Exporte toutes les données
 */
function exportAllData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const exportUrl = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=xlsx`;
    
    return { 
      success: true, 
      url: exportUrl 
    };
  } catch (error) {
    console.error('Erreur exportAllData:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Récupère les commissions d'une plateforme
 */
function getPlatformCommission(platform) {
  const config = getConfiguration();
  const platformConfig = config.platforms[platform.toLowerCase()];
  
  if (!platformConfig || !platformConfig.enabled) {
    return { commission: 0, fees: 0 };
  }
  
  return {
    commission: platformConfig.commission || 0,
    fees: platformConfig.fees || 0
  };
}

/**
 * Calcule les frais et marges pour une vente
 */
function calculateSaleMargins(platform, price, purchasePrice = 0) {
  const platformCommission = getPlatformCommission(platform);
  
  const fees = (price * platformCommission.commission / 100) + platformCommission.fees;
  const grossMargin = price - purchasePrice - fees;
  const netMargin = grossMargin; // Peut être étendu avec d'autres coûts
  
  return {
    fees: Math.round(fees * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
    netMargin: Math.round(netMargin * 100) / 100
  };
}