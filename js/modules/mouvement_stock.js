/* ===========================================================
   VISIBL ERP — Module Mouvements de stock
   Historique + ajustements manuels + états vendable/non vendable
=========================================================== */

let mouvementsStock = [];
let mouvementsStockFiltres = [];
let stockReference = [];
let pageMouvement = 1;
let taillePageMouvement = 10;

document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("manual-adjustment-modal");
    if (modal) {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("modal-open");

    initialiserMouvementsStock();
});

function initialiserMouvementsStock() {
    if (typeof requireAuth === "function" && !requireAuth()) return;

    document.getElementById("refresh-stock-movements-btn")
        ?.addEventListener("click", chargerMouvementsStock);

    ["header-stock-movements-search-input","stock-movement-type-filter","stock-movement-date-from"]
        .forEach(id => document.getElementById(id)?.addEventListener("input", appliquerFiltresMouvements));

    document.getElementById("reset-stock-movements-filters")
        ?.addEventListener("click", reinitialiserFiltresMouvements);

    document.getElementById("stock-movements-page-size")
        ?.addEventListener("change", e => {
            taillePageMouvement = Math.max(1, Number(e.target.value) || 10);
            pageMouvement = 1;
            afficherMouvements();
        });

    document.getElementById("new-stock-movement-btn")
        ?.addEventListener("click", ouvrirAjustementManuel);

    document.getElementById("export-stock-movements-btn")
        ?.addEventListener("click", exporterMouvementsExcel);

    document.getElementById("print-stock-movements-btn")
        ?.addEventListener("click", () => window.print());

    document.getElementById("close-manual-adjustment-modal")
        ?.addEventListener("click", fermerAjustementManuel);
    document.getElementById("cancel-manual-adjustment-btn")
        ?.addEventListener("click", fermerAjustementManuel);

    document.getElementById("manual-adjustment-form")
        ?.addEventListener("submit", enregistrerAjustementManuel);

    document.getElementById("manual-adjustment-product")
        ?.addEventListener("change", recalculerAjustement);
    document.getElementById("manual-adjustment-type")
        ?.addEventListener("change", recalculerAjustement);
    document.getElementById("manual-adjustment-quantity")
        ?.addEventListener("input", recalculerAjustement);

    chargerMouvementsStock();
}

async function chargerMouvementsStock() {
    const tbody = document.getElementById("stock-movements-table-body");
    if (tbody) tbody.innerHTML = `<tr><td colspan="11" class="table-message">Chargement des mouvements...</td></tr>`;

    try {
        const [resMvt, resStock] = await Promise.all([
            apiGet("getMouvementsStock"),
            apiGet("getStock")
        ]);

        if (!resMvt?.success) throw new Error(resMvt?.message || "Impossible de charger les mouvements.");

        mouvementsStock = Array.isArray(resMvt.data) ? resMvt.data : [];
        mouvementsStockFiltres = [...mouvementsStock];
        stockReference = resStock?.success && Array.isArray(resStock.data) ? resStock.data : [];

        alimenterProduitsAjustement();
        mettreAJourKpiMouvements(resMvt.meta || {});
        pageMouvement = 1;
        afficherMouvements();
    } catch (error) {
        console.error(error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="11" class="error-row">${echapper(error.message)}</td></tr>`;
    }
}

function appliquerFiltresMouvements() {
    const recherche = String(
        document.getElementById("header-stock-movements-search-input")?.value || ""
    ).trim().toLowerCase();

    const type = String(document.getElementById("stock-movement-type-filter")?.value || "").trim().toLowerCase();
    const dateChoisie = document.getElementById("stock-movement-date-from")?.value || "";

    mouvementsStockFiltres = mouvementsStock.filter(m => {
        const texte = [m.produit,m.referenceProduit,m.reference,m.moduleOrigine,m.utilisateur,m.commentaire]
            .join(" ").toLowerCase();
        const mt = String(m.typeMouvement || "").toLowerCase();
        const d = convertirDateFrIso(m.date);
        return (!recherche || texte.includes(recherche)) &&
               (!type || mt === type) &&
               (!dateChoisie || d === dateChoisie);
    });

    pageMouvement = 1;
    afficherMouvements();
}

function reinitialiserFiltresMouvements() {
    ["header-stock-movements-search-input","stock-movement-date-from"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
    });
    const type = document.getElementById("stock-movement-type-filter");
    if (type) type.value = "";
    mouvementsStockFiltres = [...mouvementsStock];
    pageMouvement = 1;
    afficherMouvements();
}

function afficherMouvements() {
    const tbody = document.getElementById("stock-movements-table-body");
    if (!tbody) return;

    const totalPages = Math.max(1, Math.ceil(mouvementsStockFiltres.length / taillePageMouvement));
    if (pageMouvement > totalPages) pageMouvement = totalPages;
    const debut = (pageMouvement - 1) * taillePageMouvement;
    const lignes = mouvementsStockFiltres.slice(debut, debut + taillePageMouvement);

    tbody.innerHTML = lignes.length ? lignes.map((m,index) => {
        const typeClasse=classeTypeMouvement(m.typeMouvement);
        const quantite=Number(m.quantite||0);
        return `
        <tr>
            <td>${echapper(m.date || "—")}</td>
            <td>${echapper(m.heure || "—")}</td>
            <td>${echapper(m.produit || m.idProduit || "—")}</td>
            <td><span class="movement-type-badge ${typeClasse}">${echapper(m.typeMouvement || "—")}</span></td>
            <td><strong class="movement-quantity ${quantite>0?"movement-quantity-positive":quantite<0?"movement-quantity-negative":""}">${quantite>0?"+":""}${formatQ(quantite)}</strong></td>
            <td>${formatQ(m.stockAvant)}</td>
            <td>${formatQ(m.stockApres)}</td>
            <td>${echapper(m.reference || "—")}</td>
            <td>${echapper(m.moduleOrigine || "—")}</td>
            <td>${echapper(m.utilisateur || m.idUtilisateur || "SYSTEM")}</td>
            <td>${echapper(m.commentaire || "—")}</td>
        </tr>`;
    }).join("") : `<tr><td colspan="11" class="empty-table-message">Aucun mouvement trouvé.</td></tr>`;

    const resume = document.getElementById("stock-movements-pagination-summary");
    if (resume) resume.textContent = `${mouvementsStockFiltres.length} mouvement(s)`;

    afficherPaginationMouvements();
}

function afficherPaginationMouvements() {
    const c = document.getElementById("stock-movements-pagination-controls");
    if (!c) return;
    const total = Math.max(1, Math.ceil(mouvementsStockFiltres.length / taillePageMouvement));
    let html = `<button type="button" data-mvt-page="${pageMouvement-1}" ${pageMouvement<=1?"disabled":""}>‹</button>`;
    for (let p=1; p<=total; p++) html += `<button type="button" data-mvt-page="${p}" ${p===pageMouvement?'class="active"':""}>${p}</button>`;
    html += `<button type="button" data-mvt-page="${pageMouvement+1}" ${pageMouvement>=total?"disabled":""}>›</button>`;
    c.innerHTML = html;
    c.querySelectorAll("[data-mvt-page]").forEach(btn => btn.addEventListener("click", () => {
        const p = Number(btn.dataset.mvtPage);
        if (p>=1 && p<=total) { pageMouvement=p; afficherMouvements(); }
    }));
}

function mettreAJourKpiMouvements(meta) {
    texte("kpi-total-stock-movements", meta.totalMouvements || mouvementsStock.length);
    texte("kpi-stock-entries", formatQ(meta.totalEntrees || 0));
    texte("kpi-stock-exits", formatQ(meta.totalSorties || 0));
    texte("kpi-stock-adjustments", meta.totalAjustements || 0);
}

function ouvrirAjustementManuel() {
    const modal = document.getElementById("manual-adjustment-modal");
    document.getElementById("manual-adjustment-form")?.reset();
    alimenterProduitsAjustement();
    recalculerAjustement();
    if (modal) {
        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    }
}

function fermerAjustementManuel() {
    const modal = document.getElementById("manual-adjustment-modal");
    if (modal) {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    }
}

function alimenterProduitsAjustement() {
    const select = document.getElementById("manual-adjustment-product");
    if (!select) return;
    const valeur = select.value;
    select.innerHTML = `<option value="">Sélectionner un produit</option>` +
        stockReference.map(p => `<option value="${echapper(p.idProduit)}">${echapper(p.produit || p.idProduit)} — vendable ${formatQ(p.stockVendable ?? p.stockDisponible)}</option>`).join("");
    if ([...select.options].some(o => o.value === valeur)) select.value = valeur;
}

function recalculerAjustement() {
    const id = document.getElementById("manual-adjustment-product")?.value || "";
    const type = String(document.getElementById("manual-adjustment-type")?.value || "").toLowerCase();
    const q = Math.max(0, Math.trunc(Number(document.getElementById("manual-adjustment-quantity")?.value || 0)));
    const p = stockReference.find(x => String(x.idProduit) === id);

    const avant = p ? Number(p.stockPhysique || 0) : 0;
    let apres = avant;
    if (["ajustement positif"].includes(type)) apres += q;
    if (["ajustement négatif","perte","casse","vol","don"].includes(type)) apres -= q;

    texte("manual-adjustment-stock-before", p ? formatQ(avant) : "—");
    texte("manual-adjustment-stock-after", p ? formatQ(apres) : "—");
    const h1 = document.getElementById("manual-adjustment-stock-before-value");
    const h2 = document.getElementById("manual-adjustment-stock-after-value");
    if (h1) h1.value = p ? avant : "";
    if (h2) h2.value = p ? apres : "";
}

async function enregistrerAjustementManuel(event) {
    event.preventDefault();

    const formulaire = event.currentTarget;
    const bouton =
        formulaire?.querySelector('button[type="submit"]') ||
        document.querySelector('#manual-adjustment-form button[type="submit"]');

    if (bouton?.disabled) {
        return;
    }

    const libelleInitial = bouton?.innerHTML || "Enregistrer";

    const data = {
        idProduit: document.getElementById("manual-adjustment-product")?.value || "",
        typeMouvement: document.getElementById("manual-adjustment-type")?.value || "",
        quantite: Number(document.getElementById("manual-adjustment-quantity")?.value || 0),
        commentaire: document.getElementById("manual-adjustment-comment")?.value || "",
        idUtilisateur: obtenirUtilisateurCourant()
    };

    const message = document.getElementById("manual-adjustment-form-message");
    if (message) {
        message.hidden = true;
        message.textContent = "";
    }

    if (bouton) {
        bouton.disabled = true;
        bouton.setAttribute("aria-busy", "true");
        bouton.classList.add("is-loading");
        bouton.innerHTML = '<span class="manual-adjustment-spinner" aria-hidden="true"></span><span>Enregistrement…</span>';
    }

    try {
        if (typeof apiPost !== "function") {
            throw new Error("La fonction apiPost est indisponible.");
        }

        const res = await apiPost("createMouvementStock", data);

        if (!res?.success) {
            throw new Error(
                res?.message ||
                "Impossible d'enregistrer l'ajustement."
            );
        }

        fermerAjustementManuel();
        await chargerMouvementsStock();
        afficherToastLocal(
            res.message ||
            "Mouvement enregistré."
        );

    } catch (error) {
        if (message) {
            message.textContent = error.message;
            message.hidden = false;
        } else {
            afficherToastLocal(error.message);
        }

    } finally {
        if (bouton) {
            bouton.disabled = false;
            bouton.removeAttribute("aria-busy");
            bouton.classList.remove("is-loading");
            bouton.innerHTML = libelleInitial;
        }
    }
}


function exporterMouvementsExcel() {
    const lignes = mouvementsStockFiltres.length ? mouvementsStockFiltres : mouvementsStock;
    if (!lignes.length) {
        afficherToastLocal("Aucun mouvement à exporter.");
        return;
    }

    const donnees = lignes.map(m => ({
        "Date": m.date || "",
        "Heure": m.heure || "",
        "Produit": m.produit || m.idProduit || "",
        "Type de mouvement": m.typeMouvement || "",
        "Quantité": Number(m.quantite || 0),
        "Stock avant": Number(m.stockAvant || 0),
        "Stock après": Number(m.stockApres || 0),
        "Référence": m.reference || "",
        "Module d'origine": m.moduleOrigine || "",
        "Utilisateur": m.utilisateur || m.idUtilisateur || "SYSTEM",
        "Commentaire": m.commentaire || ""
    }));

    if (window.XLSX?.utils) {
        const feuille = XLSX.utils.json_to_sheet(donnees);
        const classeur = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(classeur, feuille, "Mouvements");
        XLSX.writeFile(classeur, `mouvements_stock_${new Date().toISOString().slice(0,10)}.xlsx`);
        return;
    }

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
    a.download = `mouvements_stock_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

function obtenirUtilisateurCourant() {
    try {
        const u = JSON.parse(localStorage.getItem("user") || localStorage.getItem("currentUser") || "{}");
        return String(u.idUtilisateur || u.id || u.userId || "SYSTEM");
    } catch (_) {
        return "SYSTEM";
    }
}

function convertirDateFrIso(v) {
    const s = String(v || "");
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` : "";
}

function texte(id, valeur) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(valeur ?? "");
}
function formatQ(v) {
    const n = Number(v || 0);
    return new Intl.NumberFormat("fr-FR").format(Number.isFinite(n) ? Math.trunc(n) : 0);
}
function echapper(v) {
    return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function afficherToastLocal(message) {
    if (typeof showToast === "function") return showToast(message);
    if (typeof afficherToast === "function") return afficherToast(message);
    alert(message);
}



/* ===== Harmonisation Ventes — Mouvements ===== */
document.addEventListener("DOMContentLoaded",()=>{initialiserToolbarMouvementsHarmonisee();});
function obtenirCleMouvement(m,index){return String(m.idMouvement||m["ID Mouvement"]||m.reference||[m.date,m.heure,m.idProduit,m.typeMouvement,index].join("|"))}
function classeTypeMouvement(type){const t=String(type||"").toLowerCase();if(/approvisionnement|stock initial|retour client|liberation|libération|remise en vendable|ajustement positif/.test(t))return "movement-type-entry";if(/vente|sortie|perte|casse|vol|non vendable|ajustement négatif|ajustement negatif|reservation|réservation/.test(t))return "movement-type-exit";if(/ajustement/.test(t))return "movement-type-adjustment";return "movement-type-neutral"}


function initialiserToolbarMouvementsHarmonisee() {
    const trigger = document.getElementById("stock-movements-actions-trigger");
    const menu = document.getElementById("stock-movements-actions-dropdown");

    if (!trigger || !menu) return;

    const fermerMenu = () => {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    };

    trigger.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        const doitOuvrir = menu.hidden;
        menu.hidden = !doitOuvrir;
        trigger.setAttribute("aria-expanded", String(doitOuvrir));
    });

    menu.addEventListener("click", event => {
        if (event.target.closest("button, a")) {
            setTimeout(fermerMenu, 0);
        }
    });

    document.addEventListener("click", event => {
        if (
            !event.target.closest("#stock-movements-actions-trigger") &&
            !event.target.closest("#stock-movements-actions-dropdown")
        ) {
            fermerMenu();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            fermerMenu();
        }
    });
}
