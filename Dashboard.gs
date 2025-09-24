/** Étape 9 — Dashboard : KPI + Graphiques (idempotent) */

function buildDashboard() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName("Dashboard") || ss.insertSheet("Dashboard");
  sh.clear(); // on repart propre

  // --- Récup données ---
  const ventes = ss.getSheetByName("Ventes");
  const stock  = ss.getSheetByName("Stock");
  const boosts = ss.getSheetByName("Boosts");
  const costs  = ss.getSheetByName("Coûts fonctionnement");

  // Ventes
  let rowsV = [];
  if (ventes && ventes.getLastRow() >= 2) {
    rowsV = ventes.getRange(2,1, ventes.getLastRow()-1, Math.max(10, ventes.getLastColumn())).getValues();
  }
  // Stock
  let rowsS = [];
  if (stock && stock.getLastRow() >= 2) {
    rowsS = stock.getRange(2,1, stock.getLastRow()-1, Math.max(15, stock.getLastColumn())).getValues();
  }
  // Boosts
  let rowsB = [];
  if (boosts && boosts.getLastRow() >= 2) {
    rowsB = boosts.getRange(2,1, boosts.getLastRow()-1, Math.max(6, boosts.getLastColumn())).getValues();
  }
  // Coûts fixes
  let rowsC = [];
  if (costs && costs.getLastRow() >= 2) {
    rowsC = costs.getRange(2,1, costs.getLastRow()-1, Math.max(5, costs.getLastColumn())).getValues();
  }

  // --- KPI principaux ---
  const kpi = computeKPIs_(rowsV, rowsS, rowsB, rowsC);

  // --- Pose tableau KPI ---
  const headers = ["KPI","Valeur"];
  const kv = [
    ["CA total", kpi.revenue],
    ["Marge brute", kpi.gross],
    ["Marge nette", kpi.net],
    ["Nb ventes", kpi.countSales],
    ["AOV (panier moyen)", kpi.aov],
    ["Repeat rate acheteurs", kpi.repeatRateStr],
    ["Valeur stock (prix cible)", kpi.stockValue],
    ["Coûts fixes cumulés", kpi.costsTotal],
    ["Coût Boosts", kpi.boostsTotal],
    ["ROI Boosts", kpi.roiBoostsStr],
    ["Favoris (total)", kpi.favs],
    ["Offres (total)", kpi.offers],
  ];
  sh.getRange(1,1,1,2).setValues([headers]).setFontWeight("bold");
  sh.getRange(2,1,kv.length,2).setValues(kv);
  sh.setColumnWidths(1,2,200);
  sh.setFrozenRows(1);

  // --- Données auxiliaires pour graphiques ---
  const block1 = buildMonthlyRevenue_(rowsV);              // [ [Mois, CA] ]
  const block2 = buildPlatformSplit_(rowsV);               // [ [Plateforme, CA] ]
  const block3 = [["Type","Total"],["Favoris",kpi.favs],["Offres",kpi.offers]];

  // Écrire ces blocs à droite (pour servir de data range aux charts)
  let col = 5;
  col = putBlock_(sh, 1, col, "CA mensuel", block1);
  col = putBlock_(sh, 1, col+2, "CA par plateforme", block2);
  putBlock_(sh, 1, col+2, "Favoris / Offres", block3);

  // --- Graphiques ---
  // Nettoie les charts existants
  sh.getCharts().forEach(c => sh.removeChart(c));

  // 1) Ligne CA mensuel
  const r1 = sh.getRange(2,5, Math.max(1, block1.length-1), 2);
  if (block1.length > 1) {
    const ch1 = sh.newChart()
      .asLineChart()
      .setPosition(1, 9, 0, 0)
      .addRange(r1)
      .setOption('title', 'CA par mois')
      .build();
    sh.insertChart(ch1);
  }

  // 2) Pie split plateformes
  const r2 = sh.getRange(2, 7 + (block1[0]?.length? (block1[0].length-2) : 0), Math.max(1, block2.length-1), 2);
  if (block2.length > 1) {
    const ch2 = sh.newChart()
      .asPieChart()
      .setPosition(16, 9, 0, 0)
      .addRange(r2)
      .setOption('title', 'Répartition CA par plateforme')
      .build();
    sh.insertChart(ch2);
  }

  // 3) Bar favoris/offres
  const r3 = sh.getRange(2, 9 + (block1[0]?.length? (block1[0].length-2) : 0) + (block2[0]?.length? (block2[0].length-2) : 0) + 2, 2, 2);
  const ch3 = sh.newChart()
    .asColumnChart()
    .setPosition(31, 9, 0, 0)
    .addRange(r3)
    .setOption('title', 'Favoris / Offres')
    .build();
  sh.insertChart(ch3);
}

// ===== Helpers KPI =====
function computeKPIs_(rowsV, rowsS, rowsB, rowsC) {
  // Indices Ventes (1-based dans la feuille) -> 0-based ici
  const IDX_V_DATE = 0;   // A
  const IDX_V_PLATFORM = 1;// B
  const IDX_V_PRICE = 3;  // D
  const IDX_V_FEES = 4;   // E
  const IDX_V_SHIP = 5;   // F
  const IDX_V_BUYER = 6;  // G
  const IDX_V_SKU = 7;    // H
  const IDX_V_GROSS = 8;  // I
  const IDX_V_NET = 9;    // J

  // Stock : prix cible J (col 10), statut K (11), fav L? (14), offers M? (15)
  const IDX_S_SKU = 1;     // B
  const IDX_S_TITLE = 2;   // C
  const IDX_S_COST = 8;    // I (prix achat link)
  const IDX_S_TARGET = 9;  // J (prix cible)
  const IDX_S_STATUS = 10; // K
  const IDX_S_FAV = 13;    // N? -> dans notre structure: Favoris = col 14 => index 13
  const IDX_S_OFFER = 14;  // Offres = col 15 => index 14

  // Boosts : date A(0), platform B(1), type C(2), cible D(3), coût E(4)
  const IDX_B_COST = 4;

  // Costs : date A(0), cat B(1), lib C(2), montant D(3)
  const IDX_C_AMOUNT = 3;

  // Ventes
  const validV = rowsV.filter(r => r[IDX_V_DATE]);
  const revenue = sum_(validV.map(r => num_(r[IDX_V_PRICE])));
  const gross   = sum_(validV.map(r => num_(r[IDX_V_GROSS])));
  const net     = sum_(validV.map(r => num_(r[IDX_V_NET])));
  const countSales = validV.length;
  const aov = countSales ? round2_(revenue / countSales) : 0;

  // Repeat rate acheteurs
  const buyers = validV.map(r => String(r[IDX_V_BUYER]||"").trim()).filter(Boolean);
  const buyerCount = new Set(buyers).size || 0;
  const repeats = (() => {
    const freq = {};
    buyers.forEach(b => freq[b] = (freq[b]||0)+1);
    return Object.values(freq).filter(n => n>1).length;
  })();
  const repeatRate = buyerCount ? repeats / buyerCount : 0;

  // Valeur stock (prix cible) sur items non “Vendu” (si statut présent)
  const stockRows = rowsS.filter(r => r[IDX_S_TARGET]);
  const remaining = stockRows.filter(r => {
    const st = String(r[IDX_S_STATUS]||"").toLowerCase();
    return !(st === "vendu" || st === "sold");
  });
  const stockValue = sum_(remaining.map(r => num_(r[IDX_S_TARGET])));

  // Favoris / Offres totals
  const favs = sum_(rowsS.map(r => num_(r[IDX_S_FAV])));
  const offers = sum_(rowsS.map(r => num_(r[IDX_S_OFFER])));

  // Coûts & Boosts
  const boostsTotal = sum_(rowsB.map(r => num_(r[IDX_B_COST])));
  const costsTotal  = sum_(rowsC.map(r => num_(r[IDX_C_AMOUNT])));
  const roiBoosts   = boostsTotal > 0 ? (net - boostsTotal) / boostsTotal : null;

  return {
    revenue: round2_(revenue),
    gross: round2_(gross),
    net: round2_(net),
    countSales,
    aov,
    repeatRateStr: (repeatRate*100).toFixed(1) + " %",
    stockValue: round2_(stockValue),
    costsTotal: round2_(costsTotal),
    boostsTotal: round2_(boostsTotal),
    roiBoostsStr: roiBoosts==null ? "n/a" : (roiBoosts*100).toFixed(1)+" %",
    favs: round0_(favs),
    offers: round0_(offers)
  };
}

function buildMonthlyRevenue_(rowsV){
  // renvoie [[Mois, CA], ...] avec Mois = 2025-01
  if (!rowsV.length) return [["Mois","CA"]];
  const IDX_DATE = 0, IDX_PRICE = 3;
  const map = {};
  rowsV.forEach(r => {
    const d = r[IDX_DATE];
    if (!d) return;
    const y = d.getFullYear ? d.getFullYear() : new Date(d).getFullYear();
    const m = d.getMonth ? (d.getMonth()+1) : (new Date(d).getMonth()+1);
    const key = y + "-" + String(m).padStart(2,"0");
    map[key] = (map[key]||0) + num_(r[IDX_PRICE]);
  });
  const keys = Object.keys(map).sort();
  return [["Mois","CA"]].concat(keys.map(k => [k, round2_(map[k])]));
}

function buildPlatformSplit_(rowsV){
  // renvoie [[Plateforme, CA]]
  if (!rowsV.length) return [["Plateforme","CA"]];
  const IDX_PLATFORM = 1, IDX_PRICE = 3;
  const map = {};
  rowsV.forEach(r => {
    const p = String(r[IDX_PLATFORM]||"").trim() || "Autre";
    map[p] = (map[p]||0) + num_(r[IDX_PRICE]);
  });
  const keys = Object.keys(map).sort();
  return [["Plateforme","CA"]].concat(keys.map(k => [k, round2_(map[k])]));
}

function putBlock_(sh, row, col, title, block){
  sh.getRange(row, col, 1, 1).setValue(title).setFontWeight("bold");
  if (block.length) sh.getRange(row+1, col, block.length, block[0].length).setValues(block);
  return col + (block[0]?.length || 2);
}

// small math helpers
function num_(v){ const n = Number(String(v).replace(',','.')); return isFinite(n)? n : 0; }
function sum_(arr){ return arr.reduce((a,b)=>a+num_(b),0); }
function round2_(n){ return Math.round(n*100)/100; }
function round0_(n){ return Math.round(n||0); }
