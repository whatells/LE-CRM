/**
 * Config.gs — configuration centralisée du projet LE-CRM.
 * Toutes les constantes utilisées côté serveur sont regroupées ici pour
 * simplifier l'audit et l'adaptation au contexte de l'utilisateur.
 */

const CONFIG = Object.freeze({
  timezone: 'Europe/Paris',
  locale: 'fr',
  sheets: {
    dashboard: 'Dashboard',
    stock: 'Stock',
    ventes: 'Ventes',
    boosts: 'Boosts',
    costs: 'Coûts fonctionnement',
    config: 'Configuration',
    logs: 'Logs'
  },
  headers: {
    dashboard: ['KPI', 'Valeur'],
    config: ['Clé', 'Valeur', 'Notes'],
    logs: ['Horodatage', 'Niveau', 'Source', 'Message', 'Détails']
  },
  ui: {
    pageSize: 50
  }
});

/**
 * Expose une configuration lisible côté UI pour éviter de manipuler l'objet
 * complet (non sérialisable automatiquement).
 */
function getPublicConfig() {
  return {
    timezone: CONFIG.timezone,
    locale: CONFIG.locale,
    sheetNames: CONFIG.sheets
  };
}
