/* ===========================================================
   VISIBL ERP — Module Stock
   Nouvelle logique : physique / réservé / non vendable / vendable
=========================================================== */

let stockProduits = [];
let stockProduitsFiltres = [];
let pageStockActuelle = 1;
let taillePageStock = 10;

document.addEventListener("DOMContentLoaded", () => {
    initialiserModuleStock();
});

function initialiserModuleStock() {
    if (typeof requireAuth === "function" && !requireAuth()) return;

    document.getElementById("refresh-stock-btn")
        ?.addEventListener("click", chargerStock);

    document.getElementById("stock-search-input")
        ?.addEventListener("input", appliquerFiltresStock);

    document.getElementById("header-stock-search-input")
        ?.addEventListener("input", event => {
            const champ = document.getElementById("stock-search-input");
            if (champ) champ.value = event.target.value;
            appliquerFiltresStock();
        });

    document.getElementById("header-stock-search-btn")
        ?.addEventListener("click", appliquerFiltresStock);

    document.getElementById("stock-status-filter")
        ?.addEventListener("change", appliquerFiltresStock);

    document.getElementById("reset-stock-filters")
        ?.addEventListener("click", () => {
            const a = document.getElementById("stock-search-input");
            const b = document.getElementById("header-stock-search-input");
            const c = document.getElementById("stock-status-filter");
            if (a) a.value = "";
            if (b) b.value = "";
            if (c) c.value = "";
            stockProduitsFiltres = [...stockProduits];
            pageStockActuelle = 1;
            afficherTableauStock();
        });

    document.getElementById("stock-page-size")
        ?.addEventListener("change", event => {
            taillePageStock = Math.max(1, Number(event.target.value) || 10);
            pageStockActuelle = 1;
            afficherTableauStock();
        });

    document.getElementById("export-stock-btn")
        ?.addEventListener("click", exporterStockExcel);

    document.getElementById("print-stock-btn")
        ?.addEventListener("click", () => window.print());

    chargerStock();
}

async function chargerStock() {
    const tbody = document.getElementById("stock-table-body");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="10" class="table-message">Chargement du stock...</td></tr>`;

    try {
        if (typeof apiGet !== "function") {
            throw new Error("La fonction apiGet est indisponible.");
        }

        const resultat = await apiGet("getStock");
        if (!resultat?.success) {
            throw new Error(resultat?.message || "Impossible de charger le stock.");
        }

        const produits = Array.isArray(resultat.data) ? resultat.data : [];
        stockProduits = produits.map(normaliserProduitStock).filter(p => p.idProduit);
        stockProduitsFiltres = [...stockProduits];
        pageStockActuelle = 1;

        mettreAJourKpiStock();
        afficherTableauStock();
        mettreAJourAlertesStock();
    } catch (error) {
        console.error("Erreur chargement stock :", error);
        tbody.innerHTML = `<tr><td colspan="10" class="error-row">${echapperHTMLStock(error.message || "Impossible de charger le stock.")}</td></tr>`;
    }
}

function normaliserProduitStock(produit) {
    return {
        idProduit: String(produit?.idProduit || "").trim(),
        reference: String(produit?.reference || produit?.idProduit || "").trim(),
        produit: String(produit?.produit || produit?.designation || produit?.idProduit || "").trim(),
        stockPhysique: entierStock(produit?.stockPhysique),
        stockReserve: entierStock(produit?.stockReserve),
        stockNonVendable: entierStock(produit?.stockNonVendable),
        stockVendable: entierStock(
            produit?.stockVendable !== undefined
                ? produit.stockVendable
                : produit?.stockDisponible
        ),
        stockDisponible: entierStock(produit?.stockDisponible),
        seuilAlerte: Math.max(0, entierStock(produit?.seuilAlerte)),
        etat: String(produit?.etat || "normal").trim().toLowerCase(),
        derniereOperation: String(produit?.derniereOperation || "Aucun mouvement").trim(),
        derniereMiseAJour: String(produit?.derniereMiseAJour || "—").trim()
    };
}

function appliquerFiltresStock() {
    const recherche = String(
        document.getElementById("stock-search-input")?.value ||
        document.getElementById("header-stock-search-input")?.value || ""
    ).trim().toLowerCase();

    const etat = String(
        document.getElementById("stock-status-filter")?.value || ""
    ).trim().toLowerCase();

    stockProduitsFiltres = stockProduits.filter(produit => {
        const texte = [produit.reference, produit.produit, produit.idProduit]
            .join(" ").toLowerCase();
        return (!recherche || texte.includes(recherche)) &&
               (!etat || produit.etat === etat);
    });

    pageStockActuelle = 1;
    afficherTableauStock();
}

function afficherTableauStock() {
    const tbody = document.getElementById("stock-table-body");
    if (!tbody) return;

    const totalPages = Math.max(1, Math.ceil(stockProduitsFiltres.length / taillePageStock));
    if (pageStockActuelle > totalPages) pageStockActuelle = totalPages;

    const debut = (pageStockActuelle - 1) * taillePageStock;
    const produits = stockProduitsFiltres.slice(debut, debut + taillePageStock);

    if (!produits.length) {
        tbody.innerHTML = `<tr><td colspan="10" class="empty-table-message">Aucun produit trouvé.</td></tr>`;
    } else {
        tbody.innerHTML = produits.map(produit => `
            <tr class="${produit.etat === "rupture" ? "stock-row-rupture" : produit.etat === "faible" ? "stock-row-faible" : ""}" data-stock-id="${echapperHTMLStock(produit.idProduit)}">
                <td>${echapperHTMLStock(produit.reference)}</td>
                <td>${echapperHTMLStock(produit.produit)}</td>
                <td><strong>${formatQ(produit.stockPhysique)}</strong></td>
                <td>${formatQ(produit.stockReserve)}</td>
                <td>${formatQ(produit.stockNonVendable)}</td>
                <td><strong>${formatQ(produit.stockVendable)}</strong></td>
                <td>${formatQ(produit.seuilAlerte)}</td>
                <td>${creerBadgeEtatStock(produit.etat)}</td>
                <td>${echapperHTMLStock(produit.derniereOperation)}</td>
                <td>${echapperHTMLStock(produit.derniereMiseAJour)}</td>
            </tr>
        `).join("");
    }

    mettreAJourCompteurStock();
    afficherPaginationStock();
}

function mettreAJourKpiStock() {
    const somme = cle => stockProduits.reduce((total, p) => total + entierStock(p[cle]), 0);
    definirTexteStock("kpi-stock-physique", formatQ(somme("stockPhysique")));
    definirTexteStock("kpi-stock-reserve", formatQ(somme("stockReserve")));
    definirTexteStock("kpi-stock-non-vendable", formatQ(somme("stockNonVendable")));
    definirTexteStock("kpi-stock-vendable", formatQ(somme("stockVendable")));
}

function mettreAJourCompteurStock() {
    definirTexteStock("filtered-stock-count", stockProduitsFiltres.length);
    definirTexteStock("stock-pagination-summary", `${stockProduitsFiltres.length} produit(s)`);
}

function afficherPaginationStock() {
    const conteneur = document.getElementById("stock-pagination-controls");
    if (!conteneur) return;

    const totalPages = Math.max(1, Math.ceil(stockProduitsFiltres.length / taillePageStock));
    let html = `<button type="button" data-stock-page="${pageStockActuelle - 1}" ${pageStockActuelle <= 1 ? "disabled" : ""}>‹</button>`;

    for (let p = 1; p <= totalPages; p++) {
        html += `<button type="button" data-stock-page="${p}" ${p === pageStockActuelle ? 'class="active"' : ""}>${p}</button>`;
    }

    html += `<button type="button" data-stock-page="${pageStockActuelle + 1}" ${pageStockActuelle >= totalPages ? "disabled" : ""}>›</button>`;
    conteneur.innerHTML = html;

    conteneur.querySelectorAll("[data-stock-page]").forEach(btn => {
        btn.addEventListener("click", () => {
            const cible = Number(btn.dataset.stockPage);
            if (cible >= 1 && cible <= totalPages) {
                pageStockActuelle = cible;
                afficherTableauStock();
            }
        });
    });
}


function exporterStockExcel() {
    const lignes = stockProduitsFiltres.length ? stockProduitsFiltres : stockProduits;
    if (!lignes.length) {
        afficherMessageStock("Aucune donnée de stock à exporter.");
        return;
    }

    const donnees = lignes.map(p => ({
        "Référence": p.reference,
        "Produit": p.produit,
        "Stock physique": p.stockPhysique,
        "Stock réservé": p.stockReserve,
        "Stock non vendable": p.stockNonVendable,
        "Stock vendable": p.stockVendable,
        "Seuil d'alerte": p.seuilAlerte,
        "État": p.etat,
        "Dernière opération": p.derniereOperation,
        "Dernière mise à jour": p.derniereMiseAJour
    }));

    if (window.XLSX?.utils) {
        const feuille = XLSX.utils.json_to_sheet(donnees);
        const classeur = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(classeur, feuille, "Stock");
        XLSX.writeFile(classeur, `stock_${new Date().toISOString().slice(0,10)}.xlsx`);
        return;
    }

    telechargerCsvStock(donnees, `stock_${new Date().toISOString().slice(0,10)}.csv`);
}

function telechargerCsvStock(donnees, nomFichier) {
    const colonnes = Object.keys(donnees[0] || {});
    const cellule = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const contenu = [
        colonnes.map(cellule).join(";"),
        ...donnees.map(ligne => colonnes.map(c => cellule(ligne[c])).join(";"))
    ].join("\\n");
    const blob = new Blob(["\\ufeff" + contenu], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

function afficherMessageStock(message) {
    if (typeof showToast === "function") return showToast(message);
    if (typeof afficherToast === "function") return afficherToast(message);
    alert(message);
}

function creerBadgeEtatStock(etat) {
    const e = String(etat || "").toLowerCase();
    const libelle = e === "rupture" ? "Rupture" : e === "faible" ? "Faible" : "Normal";
    return `<span class="status-badge status-${echapperHTMLStock(e || "normal")}">${libelle}</span>`;
}

function definirTexteStock(id, valeur) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(valeur ?? "");
}

function entierStock(v) {
    const n = Number(String(v ?? "0").replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function formatQ(v) {
    return new Intl.NumberFormat("fr-FR").format(entierStock(v));
}

function echapperHTMLStock(v) {
    return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}



/* ===== Harmonisation Ventes + alertes intelligentes Stock ===== */
document.addEventListener("DOMContentLoaded",()=>{initialiserHeaderStockHarmonise();initialiserToolbarStockHarmonisee();});
function initialiserHeaderStockHarmonise(){const q=(s,r=document)=>r.querySelector(s),search=q(".header .search-container"),mobile=q("#mobile-search-btn"),btn=q("#notification-button"),panel=q("#notification-panel");const cs=()=>search?.classList.remove("active"),cn=()=>{if(panel)panel.hidden=true;btn?.setAttribute("aria-expanded","false")};mobile?.addEventListener("click",e=>{e.stopPropagation();const o=!search?.classList.contains("active");cn();search?.classList.toggle("active",o);if(o)setTimeout(()=>q("input",search)?.focus(),40)},true);btn?.addEventListener("click",e=>{e.stopPropagation();const o=!!panel?.hidden;cs();if(panel)panel.hidden=!o;btn.setAttribute("aria-expanded",String(o))},true);document.addEventListener("click",e=>{if(!e.target.closest(".header .search-box")&&!e.target.closest(".header .notification-menu")){cs();cn()}});const h=q("#header-stock-search-input"),l=q("#stock-search-input");if(l){l.closest(".sales-search")?.setAttribute("hidden","");const sync=()=>{l.value=h?.value||"";appliquerFiltresStock()};h?.addEventListener("input",sync);q("#header-stock-search-btn")?.addEventListener("click",sync)}}
function initialiserToolbarStockHarmonisee(){
    const t=document.getElementById("stock-actions-trigger");
    const m=document.getElementById("stock-actions-dropdown");
    const fermer=()=>{if(m)m.hidden=true;t?.setAttribute("aria-expanded","false")};
    t?.addEventListener("click",e=>{
        e.stopPropagation();
        const o=!!m?.hidden;
        if(m)m.hidden=!o;
        t.setAttribute("aria-expanded",String(o));
    });
    document.addEventListener("click",e=>{
        if(!e.target.closest(".stock-actions-menu"))fermer();
    });
}
function mettreAJourAlertesStock(){const p=document.getElementById("notification-panel"),b=document.querySelector(".notification-badge");if(!p)return;p.querySelectorAll("[data-stock-alert]").forEach(x=>x.remove());const critiques=stockProduits.filter(x=>x.etat==="rupture"||x.etat==="faible"||x.stockVendable<=x.seuilAlerte).map(x=>({...x,etat:x.stockVendable<=0?"rupture":(x.etat==="rupture"?"rupture":"faible")})).sort((a,c)=>(a.etat==="rupture"?0:1)-(c.etat==="rupture"?0:1));const old=lireEtatsAlertesStock(),now={};let son=false;critiques.forEach(x=>{now[x.idProduit]=x.etat;if(old[x.idProduit]&&old[x.idProduit]!==x.etat&&x.etat==="rupture")son=true;const d=document.createElement("div");d.className="notification-item stock-notification "+(x.etat==="rupture"?"stock-notification-critical":"stock-notification-warning");d.dataset.stockAlert=x.idProduit;d.innerHTML=`<span class="notification-item-icon">${x.etat==="rupture"?"⛔":"⚠️"}</span><div><strong>${x.etat==="rupture"?"Rupture de stock":"Stock faible"}</strong><p>${echapperHTMLStock(x.produit)} : ${formatQ(x.stockVendable)} unité(s) vendable(s), seuil ${formatQ(x.seuilAlerte)}.</p><small>Stock • maintenant</small></div>`;p.appendChild(d)});enregistrerEtatsAlertesStock(now);const total=p.querySelectorAll(".notification-item").length,empty=p.querySelector(".notification-empty-state");if(empty)empty.hidden=total>0;if(b){b.textContent=String(total);b.hidden=total===0}if(son)jouerAlerteSonoreStock()}
function lireEtatsAlertesStock(){try{return JSON.parse(localStorage.getItem("visibl_stock_alert_states")||"{}")||{}}catch(_){return {}}}
function enregistrerEtatsAlertesStock(v){try{localStorage.setItem("visibl_stock_alert_states",JSON.stringify(v||{}))}catch(_){}}
function jouerAlerteSonoreStock(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const c=new A(),o=c.createOscillator(),g=c.createGain();o.frequency.value=720;g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.12,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.22);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.24);o.onended=()=>c.close()}catch(_){}}
