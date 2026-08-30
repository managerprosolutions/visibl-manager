/* ===========================================================
   VISIBL ERP
   Module : Fournisseurs
   Fichier : fournisseurs.js
=========================================================== */

let fournisseurs = [];
let fournisseursFiltresCourants = [];
let fournisseursSelectionnes = new Set();

let approvisionnementsFournisseurs = [];
let produitsAnalyseFournisseurs = [];
let analyseFournisseursChargee = false;
let analyseFournisseursDisponible = false;

let pageFournisseursCourante = 1;
let fournisseursParPage = 10;

let idFournisseurEnModification = "";
let idFournisseurASupprimer = "";


/* ===========================================================
   INITIALISATION
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    console.log("Module Fournisseurs chargé.");

    initialiserModuleFournisseurs();
    initialiserModaleFournisseur();
    initialiserFormulaireFournisseur();
    initialiserActionsTableauFournisseurs();
    initialiserFiltresFournisseurs();
    initialiserPaginationFournisseurs();
    initialiserSelectionMultipleFournisseurs();
    initialiserSuppressionEnMasseFournisseurs();
    initialiserExportsFournisseurs();
    initialiserImpressionFournisseurs();
    initialiserHeaderFournisseurs();
    initialiserNotificationsFournisseurs();

    document
        .getElementById("refresh-suppliers-btn")
        ?.addEventListener(
            "click",
            chargerFournisseursDepuisAPI
        );
});


function initialiserModuleFournisseurs() {

    mettreAJourKPIsFournisseurs();
    chargerFournisseursDepuisAPI();
    chargerAnalyseFournisseursDepuisAPI();
}


/* ===========================================================
   OUTILS GÉNÉRAUX
=========================================================== */

function lireValeurFournisseur(fournisseur, cles) {

    if (!fournisseur || !Array.isArray(cles)) {
        return "";
    }

    for (const cle of cles) {

        if (
            Object.prototype.hasOwnProperty.call(
                fournisseur,
                cle
            ) &&
            fournisseur[cle] !== null &&
            fournisseur[cle] !== undefined &&
            fournisseur[cle] !== ""
        ) {
            return fournisseur[cle];
        }
    }

    return "";
}


function obtenirValeurTexte(id) {

    const champ = document.getElementById(id);

    return champ
        ? String(champ.value || "").trim()
        : "";
}


function obtenirValeurNombre(id) {

    const valeur = obtenirValeurTexte(id)
        .replace(/\s/g, "")
        .replace(",", ".");

    const nombre = Number(valeur);

    return Number.isFinite(nombre)
        ? nombre
        : 0;
}


function definirValeurChamp(id, valeur) {

    const champ = document.getElementById(id);

    if (champ) {
        champ.value = valeur ?? "";
    }
}


function definirTexteElement(id, valeur) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent =
            valeur === null ||
            valeur === undefined ||
            valeur === ""
                ? "—"
                : String(valeur);
    }
}


function echapperHTML(valeur) {

    const element = document.createElement("div");
    element.textContent = String(valeur ?? "");

    return element.innerHTML;
}


function normaliserTexte(valeur) {

    return String(valeur || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


function normaliserStatut(valeur) {

    const statut = normaliserTexte(valeur);

    if (statut === "suspendue") {
        return "suspendu";
    }

    if (statut === "archivee") {
        return "archive";
    }

    return statut;
}


function formaterDateFournisseur(valeur) {

    if (!valeur) {
        return "—";
    }

    const date = new Date(valeur);

    if (Number.isNaN(date.getTime())) {
        return String(valeur);
    }

    return date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


function formaterDelaiLivraison(valeur) {

    const nombre = Number(
        String(valeur ?? "")
            .replace(/\s/g, "")
            .replace(",", ".")
    );

    if (!Number.isFinite(nombre) || nombre <= 0) {
        return "—";
    }

    return `${nombre.toLocaleString("fr-FR")} jour${nombre > 1 ? "s" : ""}`;
}


function obtenirCorpsTableauFournisseurs() {

    return document.getElementById(
        "suppliers-table-body"
    );
}


function trouverFournisseurParId(idFournisseur) {

    const recherche = String(
        idFournisseur || ""
    ).trim();

    return fournisseurs.find(fournisseur => {

        const id = String(
            lireValeurFournisseur(
                fournisseur,
                ["ID Fournisseur", "idFournisseur"]
            ) || ""
        ).trim();

        return id === recherche;
    });
}


function obtenirInitialesFournisseur(nom) {

    const mots = String(nom || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!mots.length) {
        return "FR";
    }

    return mots
        .slice(0, 2)
        .map(mot => mot.charAt(0).toUpperCase())
        .join("");
}


/* ===========================================================
   CHARGEMENT DEPUIS L'API
=========================================================== */

async function chargerFournisseursDepuisAPI() {

    afficherEtatChargementFournisseurs();

    try {

        const resultat =
            await apiGet("getFournisseurs");

        if (!resultat?.success) {

            throw new Error(
                resultat?.message ||
                "Impossible de récupérer les fournisseurs."
            );
        }

        fournisseurs = Array.isArray(resultat.data)
            ? resultat.data
            : [];

        nettoyerSelectionFournisseurs();
        mettreAJourOptionsFiltresFournisseurs();
        mettreAJourKPIsFournisseurs();
        appliquerFiltresFournisseurs();

        console.log(
            `${fournisseurs.length} fournisseur(s) chargé(s) depuis Google Sheets.`
        );

    } catch (error) {

        console.error(
            "Erreur lors du chargement des fournisseurs :",
            error
        );

        afficherErreurChargementFournisseurs(
            error?.message ||
            "Une erreur est survenue."
        );
    }
}


/* ===========================================================
   ANALYSE FOURNISSEURS / APPROVISIONNEMENTS
=========================================================== */

async function chargerAnalyseFournisseursDepuisAPI() {

    analyseFournisseursChargee = false;
    analyseFournisseursDisponible = false;

    try {
        const [resultatApprovisionnements, resultatProduits] =
            await Promise.all([
                apiGet("getApprovisionnements"),
                apiGet("getProduits")
            ]);

        if (!resultatApprovisionnements?.success) {
            throw new Error(
                resultatApprovisionnements?.message ||
                "Impossible de charger les approvisionnements."
            );
        }

        approvisionnementsFournisseurs =
            Array.isArray(resultatApprovisionnements.approvisionnements)
                ? resultatApprovisionnements.approvisionnements
                : Array.isArray(resultatApprovisionnements.data)
                    ? resultatApprovisionnements.data
                    : [];

        produitsAnalyseFournisseurs =
            resultatProduits?.success && Array.isArray(resultatProduits.data)
                ? resultatProduits.data
                : resultatProduits?.success && Array.isArray(resultatProduits.produits)
                    ? resultatProduits.produits
                    : [];

        analyseFournisseursDisponible = true;

    } catch (error) {
        console.error(
            "Erreur chargement analyse fournisseurs :",
            error
        );
        approvisionnementsFournisseurs = [];
        produitsAnalyseFournisseurs = [];
    } finally {
        analyseFournisseursChargee = true;
        mettreAJourKPIsFournisseurs();
    }
}


function convertirMontantAnalyseFournisseur(valeur) {
    if (typeof valeur === "number") {
        return Number.isFinite(valeur) ? valeur : 0;
    }

    const texte = String(valeur ?? "")
        .replace(/\s/g, "")
        .replace(/[^0-9,.-]/g, "")
        .replace(/,/g, ".");

    const nombre = Number(texte);
    return Number.isFinite(nombre) ? nombre : 0;
}


function formaterMontantAnalyseFournisseur(valeur) {
    return `${Math.max(
        0,
        convertirMontantAnalyseFournisseur(valeur)
    ).toLocaleString("fr-FR", {
        maximumFractionDigits: 0
    })} FCFA`;
}


function convertirDateAnalyseFournisseur(valeur) {
    if (!valeur) return null;

    if (valeur instanceof Date && !Number.isNaN(valeur.getTime())) {
        return valeur;
    }

    const texte = String(valeur).trim();

    const iso = texte.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/
    );
    if (iso) {
        const date = new Date(
            Number(iso[1]),
            Number(iso[2]) - 1,
            Number(iso[3])
        );
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const fr = texte.match(
        /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/
    );
    if (fr) {
        const date = new Date(
            Number(fr[3]),
            Number(fr[2]) - 1,
            Number(fr[1])
        );
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(texte);
    return Number.isNaN(date.getTime()) ? null : date;
}


function formaterDateAnalyseFournisseur(valeur) {
    const date = convertirDateAnalyseFournisseur(valeur);
    if (!date) return valeur ? String(valeur) : "—";

    return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}


function statutApprovisionnementAnalyseFournisseur(item) {
    return normaliserTexte(item?.statut || "");
}


function estApprovisionnementEngageFournisseur(item) {
    const statut = statutApprovisionnementAnalyseFournisseur(item);
    return statut !== "brouillon" && statut !== "annule";
}


function calculerResteAnalyseFournisseur(item) {
    const montantGlobal = convertirMontantAnalyseFournisseur(
        item?.montantGlobal
    );
    const montantPaye = convertirMontantAnalyseFournisseur(
        item?.montantPaye
    );

    if (
        item?.resteAPayer !== undefined &&
        item?.resteAPayer !== null &&
        item?.resteAPayer !== ""
    ) {
        return Math.max(
            0,
            convertirMontantAnalyseFournisseur(item.resteAPayer)
        );
    }

    return Math.max(0, montantGlobal - montantPaye);
}


function obtenirApprovisionnementsFournisseur(idFournisseur) {
    const id = String(idFournisseur || "").trim();

    return approvisionnementsFournisseurs
        .filter(item =>
            String(item?.idFournisseur || "").trim() === id
        )
        .filter(estApprovisionnementEngageFournisseur)
        .sort((a, b) => {
            const dateA = convertirDateAnalyseFournisseur(a?.dateAchat);
            const dateB = convertirDateAnalyseFournisseur(b?.dateAchat);
            return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        });
}


function obtenirNomProduitAnalyseFournisseur(idProduit) {
    const id = String(idProduit || "").trim();

    const produit = produitsAnalyseFournisseurs.find(item =>
        String(
            item?.idProduit ||
            item?.["ID Produit"] ||
            ""
        ).trim() === id
    );

    return String(
        produit?.nomProduit ||
        produit?.["Désignation"] ||
        produit?.designation ||
        produit?.nom ||
        id ||
        "Produit"
    );
}


function calculerAnalyseFournisseur(idFournisseur) {
    const liste = obtenirApprovisionnementsFournisseur(idFournisseur);

    const totalAchats = liste.reduce(
        (somme, item) => somme +
            convertirMontantAnalyseFournisseur(item?.montantGlobal),
        0
    );

    const totalPaye = liste.reduce(
        (somme, item) => somme +
            convertirMontantAnalyseFournisseur(item?.montantPaye),
        0
    );

    const dette = liste.reduce(
        (somme, item) => somme + calculerResteAnalyseFournisseur(item),
        0
    );

    const delais = liste
        .map(item => {
            const achat = convertirDateAnalyseFournisseur(item?.dateAchat);
            const reception = convertirDateAnalyseFournisseur(
                item?.dateReceptionReelle
            );

            if (!achat || !reception || reception < achat) {
                return null;
            }

            return (reception - achat) / 86400000;
        })
        .filter(valeur => Number.isFinite(valeur));

    const delaiMoyen = delais.length
        ? delais.reduce((somme, valeur) => somme + valeur, 0) /
            delais.length
        : null;

    return {
        liste,
        totalAchats,
        totalPaye,
        dette,
        dernierApprovisionnement: liste[0] || null,
        delaiMoyen
    };
}


function afficherEtatAnalyseFournisseurChargement() {
    [
        "view-supplier-supply-count",
        "view-supplier-total-purchases",
        "view-supplier-total-paid",
        "view-supplier-balance",
        "view-supplier-last-purchase",
        "view-supplier-real-delay",
        "view-supplier-delivery-time"
    ].forEach(id => definirTexteElement(id, "Chargement…"));

    const corps = document.getElementById("view-supplier-history-body");
    if (corps) {
        corps.innerHTML = `
            <tr>
                <td colspan="7" class="supplier-history-empty">
                    Chargement de l'historique…
                </td>
            </tr>
        `;
    }
}


function afficherAnalyseFournisseur(idFournisseur) {
    if (!analyseFournisseursDisponible) {
        [
            "view-supplier-supply-count",
            "view-supplier-total-purchases",
            "view-supplier-total-paid",
            "view-supplier-balance",
            "view-supplier-last-purchase",
            "view-supplier-real-delay",
            "view-supplier-delivery-time"
        ].forEach(id => definirTexteElement(id, "Indisponible"));

        const corps = document.getElementById("view-supplier-history-body");
        if (corps) {
            corps.innerHTML = `
                <tr>
                    <td colspan="7" class="supplier-history-empty">
                        Impossible de charger l'historique pour le moment.
                    </td>
                </tr>
            `;
        }
        return;
    }

    const analyse = calculerAnalyseFournisseur(idFournisseur);

    definirTexteElement(
        "view-supplier-supply-count",
        analyse.liste.length.toLocaleString("fr-FR")
    );
    definirTexteElement(
        "view-supplier-total-purchases",
        formaterMontantAnalyseFournisseur(analyse.totalAchats)
    );
    definirTexteElement(
        "view-supplier-total-paid",
        formaterMontantAnalyseFournisseur(analyse.totalPaye)
    );
    definirTexteElement(
        "view-supplier-balance",
        formaterMontantAnalyseFournisseur(analyse.dette)
    );
    definirTexteElement(
        "view-supplier-last-purchase",
        analyse.dernierApprovisionnement
            ? formaterDateAnalyseFournisseur(
                analyse.dernierApprovisionnement.dateAchat
            )
            : "—"
    );

    const delai = analyse.delaiMoyen === null
        ? "—"
        : `${analyse.delaiMoyen
            .toFixed(1)
            .replace(".", ",")} jour${analyse.delaiMoyen > 1 ? "s" : ""}`;

    definirTexteElement("view-supplier-real-delay", delai);
    definirTexteElement("view-supplier-delivery-time", delai);

    afficherProduitsAnalyseFournisseur(analyse.liste);
    afficherHistoriqueAnalyseFournisseur(analyse.liste);
}


function afficherProduitsAnalyseFournisseur(liste) {
    const conteneur = document.getElementById(
        "view-supplier-products-summary"
    );
    if (!conteneur) return;

    const produits = new Map();

    liste.forEach(item => {
        const details = Array.isArray(item?.details) ? item.details : [];

        details.forEach(detail => {
            const idProduit = String(detail?.idProduit || "").trim();
            if (!idProduit) return;

            const quantite = convertirMontantAnalyseFournisseur(
                detail?.quantiteCommandee
            );

            produits.set(
                idProduit,
                (produits.get(idProduit) || 0) + quantite
            );
        });
    });

    if (!produits.size) {
        conteneur.innerHTML = `
            <span class="supplier-products-empty">
                Aucun produit approvisionné pour le moment.
            </span>
        `;
        return;
    }

    conteneur.innerHTML = Array.from(produits.entries())
        .slice(0, 12)
        .map(([idProduit, quantite]) => `
            <span class="supplier-product-chip">
                ${echapperHTML(
                    obtenirNomProduitAnalyseFournisseur(idProduit)
                )}
                <small>${quantite.toLocaleString("fr-FR")}</small>
            </span>
        `)
        .join("");
}


function afficherHistoriqueAnalyseFournisseur(liste) {
    const corps = document.getElementById("view-supplier-history-body");
    if (!corps) return;

    if (!liste.length) {
        corps.innerHTML = `
            <tr>
                <td colspan="7" class="supplier-history-empty">
                    Aucun approvisionnement pour ce fournisseur.
                </td>
            </tr>
        `;
        return;
    }

    corps.innerHTML = liste.slice(0, 10).map(item => {
        const details = Array.isArray(item?.details) ? item.details : [];
        const noms = details
            .map(detail => obtenirNomProduitAnalyseFournisseur(
                detail?.idProduit
            ))
            .filter(Boolean);

        const produits = noms.length
            ? noms.slice(0, 3).join(", ") +
                (noms.length > 3 ? ` +${noms.length - 3}` : "")
            : "—";

        const reste = calculerResteAnalyseFournisseur(item);

        return `
            <tr>
                <td><strong>${echapperHTML(
                    item?.idApprovisionnement || "—"
                )}</strong></td>
                <td>${echapperHTML(
                    formaterDateAnalyseFournisseur(item?.dateAchat)
                )}</td>
                <td class="supplier-history-products">${echapperHTML(
                    produits
                )}</td>
                <td>${echapperHTML(
                    formaterMontantAnalyseFournisseur(item?.montantGlobal)
                )}</td>
                <td>${echapperHTML(
                    formaterMontantAnalyseFournisseur(item?.montantPaye)
                )}</td>
                <td class="${
                    reste > 0
                        ? "supplier-history-debt"
                        : "supplier-history-paid"
                }">${echapperHTML(
                    formaterMontantAnalyseFournisseur(reste)
                )}</td>
                <td>${echapperHTML(item?.statut || "—")}</td>
            </tr>
        `;
    }).join("");
}

/* ===========================================================
   KPI
=========================================================== */

function mettreAJourKPIsFournisseurs() {

    const total = fournisseurs.length;

    const actifs = fournisseurs.filter(fournisseur =>
        normaliserStatut(
            lireValeurFournisseur(
                fournisseur,
                ["Statut", "statut"]
            )
        ) === "actif"
    ).length;

    const internationaux = fournisseurs.filter(
        fournisseur => {

            const pays = normaliserTexte(
                lireValeurFournisseur(
                    fournisseur,
                    ["Pays", "pays"]
                )
            );

            return (
                pays &&
                ![
                    "cote d'ivoire",
                    "cote divoire",
                    "ci"
                ].includes(pays)
            );
        }
    ).length;


    const maintenant = new Date();

    const ajoutsCeMois = fournisseurs.filter(
        fournisseur => {

            const date = new Date(
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Date d’Ajout",
                        "Date d'Ajout",
                        "dateAjout"
                    ]
                )
            );

            return (
                !Number.isNaN(date.getTime()) &&
                date.getMonth() === maintenant.getMonth() &&
                date.getFullYear() === maintenant.getFullYear()
            );
        }
    ).length;

    definirTexteElement(
        "kpi-total-suppliers",
        total.toLocaleString("fr-FR")
    );

    definirTexteElement(
        "kpi-suppliers-month",
        `+${ajoutsCeMois} ce mois`
    );

    definirTexteElement(
        "kpi-international-suppliers",
        internationaux.toLocaleString("fr-FR")
    );

    definirTexteElement(
        "kpi-international-percent",
        total
            ? `${(
                internationaux / total * 100
            ).toFixed(1).replace(".", ",")} % du total`
            : "0 % du total"
    );

    definirTexteElement(
        "kpi-active-suppliers",
        actifs.toLocaleString("fr-FR")
    );

    definirTexteElement(
        "kpi-active-suppliers-percent",
        total
            ? `${(
                actifs / total * 100
            ).toFixed(1).replace(".", ",")} % du total`
            : "0 % du total"
    );

    const approvisionnementsEngages =
        approvisionnementsFournisseurs.filter(
            estApprovisionnementEngageFournisseur
        );

    const detteGlobale = approvisionnementsEngages.reduce(
        (somme, item) =>
            somme + calculerResteAnalyseFournisseur(item),
        0
    );

    const fournisseursAvecDette = new Set(
        approvisionnementsEngages
            .filter(item =>
                calculerResteAnalyseFournisseur(item) > 0.000001
            )
            .map(item => String(item?.idFournisseur || "").trim())
            .filter(Boolean)
    ).size;

    definirTexteElement(
        "kpi-suppliers-debt",
        analyseFournisseursChargee && analyseFournisseursDisponible
            ? formaterMontantAnalyseFournisseur(detteGlobale)
            : analyseFournisseursChargee
                ? "Indisponible"
                : "Chargement…"
    );

    definirTexteElement(
        "kpi-suppliers-debt-detail",
        analyseFournisseursChargee && analyseFournisseursDisponible
            ? fournisseursAvecDette
                ? `${fournisseursAvecDette} fournisseur(s) avec un solde`
                : "Aucune dette fournisseur"
            : analyseFournisseursChargee
                ? "Données indisponibles"
                : "Calcul en cours"
    );
}


/* ===========================================================
   AFFICHAGE DU TABLEAU
=========================================================== */

function afficherFournisseurs(listeFournisseurs) {

    const tableBody =
        obtenirCorpsTableauFournisseurs();

    if (!tableBody) {
        return;
    }

    fournisseursFiltresCourants =
        Array.isArray(listeFournisseurs)
            ? [...listeFournisseurs]
            : [];

    const total =
        fournisseursFiltresCourants.length;

    const totalPages = Math.max(
        1,
        Math.ceil(
            total / fournisseursParPage
        )
    );

    if (pageFournisseursCourante > totalPages) {
        pageFournisseursCourante = totalPages;
    }

    const debut =
        (pageFournisseursCourante - 1) *
        fournisseursParPage;

    const page =
        fournisseursFiltresCourants.slice(
            debut,
            debut + fournisseursParPage
        );

    mettreAJourCompteurFournisseurs(total);
    afficherPaginationFournisseurs(
        total,
        totalPages
    );

    if (page.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="table-message"
                >
                    Aucun fournisseur ne correspond à votre recherche.
                </td>
            </tr>
        `;

        synchroniserSelectionFournisseurs();
        return;
    }

    tableBody.innerHTML = page.map(
        fournisseur => {

            const idBrut = String(
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "ID Fournisseur",
                        "idFournisseur"
                    ]
                ) || ""
            ).trim();

            const id = echapperHTML(idBrut);

            const code = echapperHTML(
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Code Fournisseur",
                        "codeFournisseur"
                    ]
                ) ||
                idBrut ||
                "—"
            );

            const nom = echapperHTML(
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Nom Fournisseur",
                        "nomFournisseur"
                    ]
                ) || "—"
            );

            const contact = echapperHTML(
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Nom du Contact",
                        "nomContact"
                    ]
                ) || "—"
            );

            const telephone = echapperHTML(
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Téléphone",
                        "telephone"
                    ]
                ) || "—"
            );

            const pays = echapperHTML(
                lireValeurFournisseur(
                    fournisseur,
                    ["Pays", "pays"]
                ) || "—"
            );

            const ville = echapperHTML(
                lireValeurFournisseur(
                    fournisseur,
                    ["Ville", "ville"]
                ) || "—"
            );

            const categorie = echapperHTML(
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Catégorie de Produits",
                        "Type de Produits",
                        "categorieProduits",
                        "typeProduits"
                    ]
                ) || "—"
            );

            const statutBrut = String(
                lireValeurFournisseur(
                    fournisseur,
                    ["Statut", "statut"]
                ) || "Inactif"
            ).trim();

            const statut =
                normaliserStatut(statutBrut);

            const classeStatut =
                statut === "actif"
                    ? "status-active"
                    : statut === "suspendu"
                        ? "status-suspended"
                        : statut === "archive"
                            ? "status-archived"
                            : "status-inactive";

            const selectionne =
                fournisseursSelectionnes.has(
                    idBrut
                );

            return `
                <tr
                    data-supplier-id="${id}"
                    class="${
                        selectionne
                            ? "supplier-row-selected"
                            : ""
                    }"
                >
                    <td class="selection-column">
                        <input
                            type="checkbox"
                            class="supplier-row-checkbox"
                            data-supplier-id="${id}"
                            ${
                                selectionne
                                    ? "checked"
                                    : ""
                            }
                            aria-label="Sélectionner ${nom}"
                        >
                    </td>

                    <td>
                        <strong>${code}</strong>
                    </td>

                    <td>
                        <div class="supplier-table-name">
                            <strong>${nom}</strong>

                            <span class="supplier-table-contact">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    aria-hidden="true"
                                >
                                    <path d="M20 21a8 8 0 0 0-16 0"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>

                                ${contact}
                            </span>
                        </div>
                    </td>

                    <td>${telephone}</td>
                    <td>${pays}</td>
                    <td>${ville}</td>
                    <td>${categorie}</td>

                    <td>
                        <span
                            class="supplier-status product-status ${classeStatut}"
                        >
                            ${echapperHTML(statutBrut)}
                        </span>
                    </td>

                    <td class="supplier-actions-cell">
                        <div class="supplier-row-menu">
                            <button
                                type="button"
                                class="supplier-row-menu-trigger"
                                data-supplier-actions-toggle="${idBrut}"
                                aria-label="Afficher les actions du fournisseur"
                                aria-expanded="false"
                            >
                                ⋮
                            </button>

                            <div
                                class="supplier-row-menu-dropdown"
                                data-supplier-actions-menu="${idBrut}"
                                hidden
                            >
                                <button
                                    type="button"
                                    class="view-supplier-btn"
                                    data-supplier-id="${id}"
                                >
                                    👁️ <span>Voir</span>
                                </button>

                                <button
                                    type="button"
                                    class="edit-supplier-btn"
                                    data-supplier-id="${id}"
                                >
                                    ✏️ <span>Modifier</span>
                                </button>

                                <button
                                    type="button"
                                    class="delete-supplier-btn danger-action"
                                    data-supplier-id="${id}"
                                >
                                    🗑️ <span>Supprimer</span>
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }
    ).join("");

    synchroniserSelectionFournisseurs();
}


/* ===========================================================
   RECHERCHE ET FILTRE
=========================================================== */

function initialiserFiltresFournisseurs() {

    document
        .getElementById("suppliers-search-input")
        ?.addEventListener(
            "input",
            appliquerFiltresFournisseurs
        );

    document
        .getElementById("supplier-country-filter")
        ?.addEventListener(
            "change",
            appliquerFiltresFournisseurs
        );

    document
        .getElementById("supplier-category-filter")
        ?.addEventListener(
            "change",
            appliquerFiltresFournisseurs
        );

    document
        .getElementById("supplier-status-filter")
        ?.addEventListener(
            "change",
            appliquerFiltresFournisseurs
        );
}


function appliquerFiltresFournisseurs(event) {

    if (event) {
        pageFournisseursCourante = 1;
    }

    const recherche = normaliserTexte(
        obtenirValeurTexte(
            "suppliers-search-input"
        )
    );

    const paysRecherche = normaliserTexte(
        obtenirValeurTexte(
            "supplier-country-filter"
        )
    );

    const categorieRecherche = normaliserTexte(
        obtenirValeurTexte(
            "supplier-category-filter"
        )
    );

    const statutRecherche =
        normaliserStatut(
            obtenirValeurTexte(
                "supplier-status-filter"
            )
        );

    const listeFiltree =
        fournisseurs.filter(fournisseur => {

            const texte = normaliserTexte([
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "ID Fournisseur",
                        "Code Fournisseur",
                        "idFournisseur",
                        "codeFournisseur"
                    ]
                ),
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Nom Fournisseur",
                        "nomFournisseur"
                    ]
                ),
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Nom du Contact",
                        "nomContact"
                    ]
                ),
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Téléphone",
                        "telephone"
                    ]
                ),
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "WhatsApp",
                        "whatsapp"
                    ]
                ),
                lireValeurFournisseur(
                    fournisseur,
                    ["Email", "email"]
                ),
                lireValeurFournisseur(
                    fournisseur,
                    ["Pays", "pays"]
                ),
                lireValeurFournisseur(
                    fournisseur,
                    ["Ville", "ville"]
                ),
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Type de Produits",
                        "Catégorie de Produits",
                        "categorieProduits"
                    ]
                )
            ].join(" "));

            const pays = normaliserTexte(
                lireValeurFournisseur(
                    fournisseur,
                    ["Pays", "pays"]
                )
            );

            const categorie = normaliserTexte(
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Catégorie de Produits",
                        "Type de Produits",
                        "categorieProduits",
                        "typeProduits"
                    ]
                )
            );

            const statut =
                normaliserStatut(
                    lireValeurFournisseur(
                        fournisseur,
                        ["Statut", "statut"]
                    )
                );

            return (
                (
                    !recherche ||
                    texte.includes(recherche)
                ) &&
                (
                    !paysRecherche ||
                    pays === paysRecherche
                ) &&
                (
                    !categorieRecherche ||
                    categorie === categorieRecherche
                ) &&
                (
                    !statutRecherche ||
                    statut === statutRecherche
                )
            );
        });

    afficherFournisseurs(listeFiltree);
}



/* ===========================================================
   OPTIONS DYNAMIQUES DES FILTRES RAPIDES
=========================================================== */

function mettreAJourOptionsFiltresFournisseurs() {

    remplirFiltreFournisseurs(
        "supplier-country-filter",
        fournisseurs.map(fournisseur =>
            lireValeurFournisseur(
                fournisseur,
                ["Pays", "pays"]
            )
        ),
        "Tous les pays"
    );

    remplirFiltreFournisseurs(
        "supplier-category-filter",
        fournisseurs.map(fournisseur =>
            lireValeurFournisseur(
                fournisseur,
                [
                    "Catégorie de Produits",
                    "Type de Produits",
                    "categorieProduits",
                    "typeProduits"
                ]
            )
        ),
        "Toutes les catégories"
    );
}


function remplirFiltreFournisseurs(
    idSelect,
    valeurs,
    libelleToutes
) {

    const select =
        document.getElementById(idSelect);

    if (!select) {
        return;
    }

    const valeurActuelle =
        normaliserTexte(select.value);

    const valeursUniques = new Map();

    valeurs.forEach(valeur => {

        const libelle =
            String(valeur || "").trim();

        const cle =
            normaliserTexte(libelle);

        if (cle && !valeursUniques.has(cle)) {
            valeursUniques.set(cle, libelle);
        }
    });

    const options = [
        `<option value="">${echapperHTML(libelleToutes)}</option>`,
        ...[...valeursUniques.entries()]
            .sort((a, b) =>
                a[1].localeCompare(
                    b[1],
                    "fr",
                    { sensitivity: "base" }
                )
            )
            .map(([cle, libelle]) =>
                `<option value="${echapperHTML(cle)}">${echapperHTML(libelle)}</option>`
            )
    ];

    select.innerHTML = options.join("");

    if (valeursUniques.has(valeurActuelle)) {
        select.value = valeurActuelle;
    }
}

/* ===========================================================
   MODALE AJOUT / MODIFICATION
=========================================================== */

function initialiserModaleFournisseur() {

    document
        .getElementById("new-supplier-btn")
        ?.addEventListener(
            "click",
            ouvrirModaleFournisseur
        );

    document
        .getElementById("close-supplier-modal")
        ?.addEventListener(
            "click",
            fermerModaleFournisseur
        );

    document
        .getElementById("cancel-supplier-btn")
        ?.addEventListener(
            "click",
            fermerModaleFournisseur
        );
}


function ouvrirModaleFournisseur() {

    const modale =
        document.getElementById(
            "supplier-modal"
        );

    const formulaire =
        document.getElementById(
            "supplier-form"
        );

    if (!modale || !formulaire) {
        return;
    }

    idFournisseurEnModification = "";
    configurerModaleFournisseur("creation");

    formulaire.reset();
    genererCodeFournisseur();
    definirValeurChamp(
        "supplier-status",
        "Actif"
    );
    masquerMessageFormulaireFournisseur();

    modale.classList.add("active");
    modale.setAttribute(
        "aria-hidden",
        "false"
    );
    document.body.classList.add(
        "modal-open"
    );

    setTimeout(() => {
        document
            .getElementById("supplier-name")
            ?.focus();
    }, 100);
}


function fermerModaleFournisseur() {

    const modale =
        document.getElementById(
            "supplier-modal"
        );

    if (!modale) {
        return;
    }

    modale.classList.remove("active");
    modale.setAttribute(
        "aria-hidden",
        "true"
    );
    document.body.classList.remove(
        "modal-open"
    );

    masquerMessageFormulaireFournisseur();
}


function configurerModaleFournisseur(
    mode = "creation"
) {

    const modification =
        mode === "modification";

    const titre =
        document.getElementById(
            "supplier-modal-title"
        );

    const description =
        document.querySelector(
            "#supplier-modal .modal-header p"
        );

    const bouton =
        document.getElementById(
            "save-supplier-btn"
        );

    if (titre) {
        titre.textContent = modification
            ? "Modifier le fournisseur"
            : "Nouveau fournisseur";
    }

    if (description) {
        description.textContent =
            modification
                ? "Modifiez les informations du fournisseur sélectionné."
                : "Enregistrez un nouveau fournisseur dans VISIBL.";
    }

    if (bouton) {
        bouton.textContent =
            modification
                ? "Enregistrer les modifications"
                : "Enregistrer le fournisseur";
    }
}


function genererCodeFournisseur() {

    const champ =
        document.getElementById(
            "supplier-code"
        );

    if (!champ) {
        return "";
    }

    let plusGrandNumero = 0;

    fournisseurs.forEach(fournisseur => {

        const code = String(
            lireValeurFournisseur(
                fournisseur,
                [
                    "Code Fournisseur",
                    "codeFournisseur"
                ]
            ) || ""
        ).trim();

        const correspondance =
            code.match(/^FOU(\d+)$/i);

        if (correspondance) {

            plusGrandNumero = Math.max(
                plusGrandNumero,
                Number(correspondance[1]) || 0
            );
        }
    });

    const nouveauCode =
        "FOU" +
        String(
            plusGrandNumero + 1
        ).padStart(6, "0");

    champ.value = nouveauCode;

    return nouveauCode;
}


/* ===========================================================
   FORMULAIRE
=========================================================== */

function initialiserFormulaireFournisseur() {

    const formulaire =
        document.getElementById(
            "supplier-form"
        );

    formulaire?.addEventListener(
        "submit",
        enregistrerFournisseur
    );
}


async function enregistrerFournisseur(event) {

    event.preventDefault();

    const formulaire =
        document.getElementById(
            "supplier-form"
        );

    const boutonEnregistrer =
        document.getElementById(
            "save-supplier-btn"
        );

    if (!formulaire) {
        return;
    }

    if (!formulaire.checkValidity()) {
        formulaire.reportValidity();
        return;
    }

    const fournisseur = {

        idFournisseur:
            idFournisseurEnModification || "",

        "ID Fournisseur":
            idFournisseurEnModification || "",

        codeFournisseur:
            obtenirValeurTexte(
                "supplier-code"
            ),

        nomFournisseur:
            obtenirValeurTexte(
                "supplier-name"
            ),

        nomContact:
            obtenirValeurTexte(
                "supplier-contact-name"
            ),

        fonctionContact:
            obtenirValeurTexte(
                "supplier-contact-function"
            ),

        telephone:
            obtenirValeurTexte(
                "supplier-phone"
            ),

        whatsapp:
            obtenirValeurTexte(
                "supplier-whatsapp"
            ),

        email:
            obtenirValeurTexte(
                "supplier-email"
            ),

        siteWeb:
            obtenirValeurTexte(
                "supplier-website"
            ),

        pays:
            obtenirValeurTexte(
                "supplier-country"
            ),

        ville:
            obtenirValeurTexte(
                "supplier-city"
            ),

        adresse:
            obtenirValeurTexte(
                "supplier-address"
            ),

        categorieProduits:
            obtenirValeurTexte(
                "supplier-product-category"
            ),

        devise:
            obtenirValeurTexte(
                "supplier-currency"
            ),

        conditionsPaiement:
            obtenirValeurTexte(
                "supplier-payment-terms"
            ),

        delaiMoyenLivraison:
            obtenirValeurNombre(
                "supplier-delivery-time"
            ),

        garantieFournisseur:
            obtenirValeurTexte(
                "supplier-warranty"
            ),

        statut:
            obtenirValeurTexte(
                "supplier-status"
            ) || "Actif",

        commentaire:
            obtenirValeurTexte(
                "supplier-comment"
            )
    };

    if (
        !fournisseur.codeFournisseur ||
        !fournisseur.nomFournisseur ||
        !fournisseur.telephone ||
        !fournisseur.pays
    ) {

        afficherMessageFormulaireFournisseur(
            "Le code, le nom, le téléphone et le pays sont obligatoires.",
            "error"
        );

        return;
    }

    const estModification =
        Boolean(
            idFournisseurEnModification
        );

    try {

        if (boutonEnregistrer) {
            boutonEnregistrer.disabled = true;
            boutonEnregistrer.textContent =
                "Enregistrement...";
        }

        afficherMessageFormulaireFournisseur(
            estModification
                ? "Enregistrement des modifications..."
                : "Enregistrement du fournisseur...",
            "info"
        );

        const resultat =
            await apiPost(
                estModification
                    ? "updateFournisseur"
                    : "createFournisseur",
                fournisseur
            );

        if (!resultat?.success) {

            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le fournisseur."
            );
        }

        const fournisseurEnregistre =
            resultat.data || fournisseur;

        const idEnregistre = String(
            lireValeurFournisseur(
                fournisseurEnregistre,
                [
                    "ID Fournisseur",
                    "idFournisseur"
                ]
            ) ||
            idFournisseurEnModification ||
            fournisseur.codeFournisseur
        ).trim();

        if (
            !lireValeurFournisseur(
                fournisseurEnregistre,
                [
                    "ID Fournisseur",
                    "idFournisseur"
                ]
            )
        ) {
            fournisseurEnregistre[
                "ID Fournisseur"
            ] = idEnregistre;
        }

        fournisseurs = estModification
            ? fournisseurs.map(
                fournisseurExistant => {

                    const id = String(
                        lireValeurFournisseur(
                            fournisseurExistant,
                            [
                                "ID Fournisseur",
                                "idFournisseur"
                            ]
                        ) || ""
                    ).trim();

                    return id === idEnregistre
                        ? fournisseurEnregistre
                        : fournisseurExistant;
                }
            )
            : [
                fournisseurEnregistre,
                ...fournisseurs.filter(
                    fournisseurExistant => {

                        const id = String(
                            lireValeurFournisseur(
                                fournisseurExistant,
                                [
                                    "ID Fournisseur",
                                    "idFournisseur"
                                ]
                            ) || ""
                        ).trim();

                        return id !== idEnregistre;
                    }
                )
            ];

        mettreAJourKPIsFournisseurs();
        appliquerFiltresFournisseurs();
        fermerModaleFournisseur();

        idFournisseurEnModification = "";
        configurerModaleFournisseur(
            "creation"
        );
        formulaire.reset();
        genererCodeFournisseur();

    } catch (error) {

        console.error(
            "Erreur d'enregistrement du fournisseur :",
            error
        );

        afficherMessageFormulaireFournisseur(
            error?.message ||
            "Une erreur est survenue.",
            "error"
        );

    } finally {

        if (boutonEnregistrer) {
            boutonEnregistrer.disabled = false;
            boutonEnregistrer.textContent =
                idFournisseurEnModification
                    ? "Enregistrer les modifications"
                    : "Enregistrer le fournisseur";
        }
    }
}


function afficherMessageFormulaireFournisseur(
    message,
    type = "info"
) {

    const zone =
        document.getElementById(
            "supplier-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent = message;
    zone.className =
        `form-message ${type}`;
    zone.style.display = "block";
}


function masquerMessageFormulaireFournisseur() {

    const zone =
        document.getElementById(
            "supplier-form-message"
        );

    if (!zone) {
        return;
    }

    zone.textContent = "";
    zone.className = "form-message";
    zone.style.display = "none";
}


/* ===========================================================
   ACTIONS DU TABLEAU
=========================================================== */

function initialiserActionsTableauFournisseurs() {

    const tableBody =
        obtenirCorpsTableauFournisseurs();

    if (!tableBody) {
        return;
    }

    tableBody.addEventListener(
        "click",
        event => {

            const boutonVoir =
                event.target.closest(
                    ".view-supplier-btn"
                );

            const boutonModifier =
                event.target.closest(
                    ".edit-supplier-btn"
                );

            const boutonSupprimer =
                event.target.closest(
                    ".delete-supplier-btn"
                );

            if (boutonVoir) {

                ouvrirConsultationFournisseur(
                    boutonVoir.dataset.supplierId
                );

                return;
            }

            if (boutonModifier) {

                ouvrirModificationFournisseur(
                    boutonModifier.dataset.supplierId
                );

                return;
            }

            if (boutonSupprimer) {

                ouvrirSuppressionFournisseur(
                    boutonSupprimer.dataset.supplierId
                );
            }
        }
    );

    document
        .getElementById(
            "close-supplier-view-modal"
        )
        ?.addEventListener(
            "click",
            fermerConsultationFournisseur
        );

    document
        .getElementById(
            "close-supplier-view-modal-footer"
        )
        ?.addEventListener(
            "click",
            fermerConsultationFournisseur
        );

    document
        .getElementById(
            "cancel-delete-supplier-btn"
        )
        ?.addEventListener(
            "click",
            fermerSuppressionFournisseur
        );

    document
        .getElementById(
            "confirm-delete-supplier-btn"
        )
        ?.addEventListener(
            "click",
            confirmerSuppressionFournisseur
        );
}


/* ===========================================================
   MODIFICATION
=========================================================== */

function ouvrirModificationFournisseur(
    idFournisseur
) {

    const fournisseur =
        trouverFournisseurParId(
            idFournisseur
        );

    const modale =
        document.getElementById(
            "supplier-modal"
        );

    const formulaire =
        document.getElementById(
            "supplier-form"
        );

    if (
        !fournisseur ||
        !modale ||
        !formulaire
    ) {
        return;
    }

    idFournisseurEnModification =
        String(
            idFournisseur || ""
        ).trim();

    formulaire.reset();
    configurerModaleFournisseur(
        "modification"
    );
    masquerMessageFormulaireFournisseur();

    definirValeurChamp(
        "supplier-code",
        lireValeurFournisseur(
            fournisseur,
            [
                "Code Fournisseur",
                "codeFournisseur"
            ]
        )
    );

    definirValeurChamp(
        "supplier-name",
        lireValeurFournisseur(
            fournisseur,
            [
                "Nom Fournisseur",
                "nomFournisseur"
            ]
        )
    );

    definirValeurChamp(
        "supplier-contact-name",
        lireValeurFournisseur(
            fournisseur,
            [
                "Nom du Contact",
                "nomContact"
            ]
        )
    );

    definirValeurChamp(
        "supplier-contact-function",
        lireValeurFournisseur(
            fournisseur,
            [
                "Fonction du Contact",
                "fonctionContact"
            ]
        )
    );

    definirValeurChamp(
        "supplier-phone",
        lireValeurFournisseur(
            fournisseur,
            [
                "Téléphone",
                "telephone"
            ]
        )
    );

    definirValeurChamp(
        "supplier-whatsapp",
        lireValeurFournisseur(
            fournisseur,
            [
                "WhatsApp",
                "whatsapp"
            ]
        )
    );

    definirValeurChamp(
        "supplier-email",
        lireValeurFournisseur(
            fournisseur,
            ["Email", "email"]
        )
    );

    definirValeurChamp(
        "supplier-website",
        lireValeurFournisseur(
            fournisseur,
            [
                "Site Web",
                "siteWeb"
            ]
        )
    );

    definirValeurChamp(
        "supplier-country",
        lireValeurFournisseur(
            fournisseur,
            ["Pays", "pays"]
        )
    );

    definirValeurChamp(
        "supplier-city",
        lireValeurFournisseur(
            fournisseur,
            ["Ville", "ville"]
        )
    );

    definirValeurChamp(
        "supplier-address",
        lireValeurFournisseur(
            fournisseur,
            ["Adresse", "adresse"]
        )
    );

    definirValeurChamp(
        "supplier-product-category",
        lireValeurFournisseur(
            fournisseur,
            [
                "Type de Produits",
                "Catégorie de Produits",
                "categorieProduits"
            ]
        )
    );

    definirValeurChamp(
        "supplier-currency",
        lireValeurFournisseur(
            fournisseur,
            ["Devise", "devise"]
        )
    );

    definirValeurChamp(
        "supplier-payment-terms",
        lireValeurFournisseur(
            fournisseur,
            [
                "Conditions de Paiement",
                "conditionsPaiement"
            ]
        )
    );

    definirValeurChamp(
        "supplier-delivery-time",
        lireValeurFournisseur(
            fournisseur,
            [
                "Délai Moyen de Livraison",
                "delaiMoyenLivraison"
            ]
        )
    );

    definirValeurChamp(
        "supplier-warranty",
        lireValeurFournisseur(
            fournisseur,
            [
                "Garantie Fournisseur",
                "garantieFournisseur"
            ]
        )
    );

    definirValeurChamp(
        "supplier-status",
        lireValeurFournisseur(
            fournisseur,
            ["Statut", "statut"]
        ) || "Actif"
    );

    definirValeurChamp(
        "supplier-comment",
        lireValeurFournisseur(
            fournisseur,
            [
                "Commentaire",
                "commentaire"
            ]
        )
    );

    modale.classList.add("active");
    modale.setAttribute(
        "aria-hidden",
        "false"
    );
    document.body.classList.add(
        "modal-open"
    );
}


/* ===========================================================
   CONSULTATION
=========================================================== */

async function ouvrirConsultationFournisseur(
    idFournisseur
) {

    const fournisseur =
        trouverFournisseurParId(
            idFournisseur
        );

    if (!fournisseur) {
        return;
    }

    const nom = String(
        lireValeurFournisseur(
            fournisseur,
            [
                "Nom Fournisseur",
                "nomFournisseur"
            ]
        ) || ""
    );

    definirTexteElement(
        "view-supplier-id",
        lireValeurFournisseur(
            fournisseur,
            [
                "ID Fournisseur",
                "idFournisseur"
            ]
        )
    );

    definirTexteElement(
        "view-supplier-code",
        lireValeurFournisseur(
            fournisseur,
            [
                "Code Fournisseur",
                "codeFournisseur"
            ]
        )
    );

    definirTexteElement(
        "view-supplier-name",
        nom
    );

    definirTexteElement(
        "view-supplier-category",
        lireValeurFournisseur(
            fournisseur,
            [
                "Type de Produits",
                "Catégorie de Produits",
                "categorieProduits"
            ]
        )
    );

    definirTexteElement(
        "view-supplier-contact",
        lireValeurFournisseur(
            fournisseur,
            [
                "Nom du Contact",
                "nomContact"
            ]
        )
    );

    definirTexteElement(
        "view-supplier-contact-function",
        lireValeurFournisseur(
            fournisseur,
            [
                "Fonction du Contact",
                "fonctionContact"
            ]
        )
    );

    definirTexteElement(
        "view-supplier-phone",
        lireValeurFournisseur(
            fournisseur,
            [
                "Téléphone",
                "telephone"
            ]
        )
    );

    definirTexteElement(
        "view-supplier-whatsapp",
        lireValeurFournisseur(
            fournisseur,
            [
                "WhatsApp",
                "whatsapp"
            ]
        )
    );

    definirTexteElement(
        "view-supplier-email",
        lireValeurFournisseur(
            fournisseur,
            ["Email", "email"]
        )
    );

    definirTexteElement(
        "view-supplier-website",
        lireValeurFournisseur(
            fournisseur,
            [
                "Site Web",
                "siteWeb"
            ]
        )
    );

    definirTexteElement(
        "view-supplier-country",
        lireValeurFournisseur(
            fournisseur,
            ["Pays", "pays"]
        )
    );

    definirTexteElement(
        "view-supplier-city",
        lireValeurFournisseur(
            fournisseur,
            ["Ville", "ville"]
        )
    );

    definirTexteElement(
        "view-supplier-address",
        lireValeurFournisseur(
            fournisseur,
            ["Adresse", "adresse"]
        )
    );

    definirTexteElement(
        "view-supplier-product-category",
        lireValeurFournisseur(
            fournisseur,
            [
                "Type de Produits",
                "Catégorie de Produits",
                "categorieProduits"
            ]
        )
    );

    definirTexteElement(
        "view-supplier-currency",
        lireValeurFournisseur(
            fournisseur,
            ["Devise", "devise"]
        )
    );

    definirTexteElement(
        "view-supplier-payment-terms",
        lireValeurFournisseur(
            fournisseur,
            [
                "Conditions de Paiement",
                "conditionsPaiement"
            ]
        )
    );

    definirTexteElement(
        "view-supplier-delivery-time",
        "Chargement…"
    );

    definirTexteElement(
        "view-supplier-warranty",
        lireValeurFournisseur(
            fournisseur,
            [
                "Garantie Fournisseur",
                "garantieFournisseur"
            ]
        )
    );

    definirTexteElement(
        "view-supplier-created-at",
        formaterDateFournisseur(
            lireValeurFournisseur(
                fournisseur,
                [
                    "Date d’Ajout",
                    "Date d'Ajout",
                    "dateAjout"
                ]
            )
        )
    );

    definirTexteElement(
        "view-supplier-updated-at",
        formaterDateFournisseur(
            lireValeurFournisseur(
                fournisseur,
                [
                    "Date de Modification",
                    "dateModification"
                ]
            )
        )
    );

    definirTexteElement(
        "view-supplier-status",
        lireValeurFournisseur(
            fournisseur,
            ["Statut", "statut"]
        )
    );

    definirTexteElement(
        "view-supplier-comment",
        lireValeurFournisseur(
            fournisseur,
            [
                "Commentaire",
                "commentaire"
            ]
        )
    );

    definirTexteElement(
        "supplier-view-avatar",
        obtenirInitialesFournisseur(nom)
    );

    const badge =
        document.getElementById(
            "supplier-view-status-badge"
        );

    if (badge) {

        const statut =
            normaliserStatut(
                lireValeurFournisseur(
                    fournisseur,
                    ["Statut", "statut"]
                )
            );

        badge.className =
            "supplier-view-status-badge";

        badge.classList.add(
            statut === "actif"
                ? "status-active"
                : statut === "suspendu"
                    ? "status-suspended"
                    : "status-inactive"
        );
    }

    const idFournisseurAnalyse = String(
        lireValeurFournisseur(
            fournisseur,
            ["ID Fournisseur", "idFournisseur"]
        ) || ""
    ).trim();

    if (!analyseFournisseursChargee) {
        afficherEtatAnalyseFournisseurChargement();
        await chargerAnalyseFournisseursDepuisAPI();
    }

    afficherAnalyseFournisseur(idFournisseurAnalyse);

    const modale =
        document.getElementById(
            "supplier-view-modal"
        );

    if (modale) {
        modale.classList.add("active");
        modale.setAttribute(
            "aria-hidden",
            "false"
        );
        document.body.classList.add(
            "modal-open"
        );
    }
}


function fermerConsultationFournisseur() {

    const modale =
        document.getElementById(
            "supplier-view-modal"
        );

    if (!modale) {
        return;
    }

    modale.classList.remove("active");
    modale.setAttribute(
        "aria-hidden",
        "true"
    );
    document.body.classList.remove(
        "modal-open"
    );
}


/* ===========================================================
   SUPPRESSION INDIVIDUELLE
=========================================================== */

function ouvrirSuppressionFournisseur(
    idFournisseur
) {

    const fournisseur =
        trouverFournisseurParId(
            idFournisseur
        );

    if (!fournisseur) {
        return;
    }

    idFournisseurASupprimer =
        String(
            idFournisseur || ""
        ).trim();

    const nom = String(
        lireValeurFournisseur(
            fournisseur,
            [
                "Nom Fournisseur",
                "nomFournisseur"
            ]
        ) || ""
    );

    definirTexteElement(
        "delete-supplier-avatar",
        obtenirInitialesFournisseur(nom)
    );

    definirTexteElement(
        "delete-supplier-code",
        lireValeurFournisseur(
            fournisseur,
            [
                "Code Fournisseur",
                "codeFournisseur"
            ]
        )
    );

    definirTexteElement(
        "delete-supplier-name",
        nom
    );

    definirTexteElement(
        "delete-supplier-contact",
        lireValeurFournisseur(
            fournisseur,
            [
                "Nom du Contact",
                "nomContact"
            ]
        )
    );

    definirTexteElement(
        "delete-supplier-country",
        lireValeurFournisseur(
            fournisseur,
            ["Pays", "pays"]
        )
    );

    const modale =
        document.getElementById(
            "delete-supplier-modal"
        );

    if (modale) {
        modale.hidden = false;

        requestAnimationFrame(() => {
            modale.classList.add("active");
            document.body.classList.add(
                "modal-open"
            );
        });
    }
}


function fermerSuppressionFournisseur() {

    const modale =
        document.getElementById(
            "delete-supplier-modal"
        );

    if (modale) {
        modale.classList.remove("active");
        modale.hidden = true;
    }

    idFournisseurASupprimer = "";
    document.body.classList.remove(
        "modal-open"
    );
}


async function confirmerSuppressionFournisseur() {

    if (!idFournisseurASupprimer) {
        return;
    }

    const bouton =
        document.getElementById(
            "confirm-delete-supplier-btn"
        );

    const message =
        document.getElementById(
            "delete-supplier-message"
        );

    try {

        if (bouton) {
            bouton.disabled = true;
        }

        if (message) {
            message.hidden = true;
            message.textContent = "";
        }

        const resultat =
            await apiPost(
                "deleteFournisseur",
                {
                    idFournisseur:
                        idFournisseurASupprimer
                }
            );

        if (!resultat?.success) {

            throw new Error(
                resultat?.message ||
                "Impossible de supprimer le fournisseur."
            );
        }

        fournisseurs =
            fournisseurs.filter(
                fournisseur => {

                    const id = String(
                        lireValeurFournisseur(
                            fournisseur,
                            [
                                "ID Fournisseur",
                                "idFournisseur"
                            ]
                        ) || ""
                    ).trim();

                    return (
                        id !==
                        idFournisseurASupprimer
                    );
                }
            );

        fournisseursSelectionnes.delete(
            idFournisseurASupprimer
        );

        fermerSuppressionFournisseur();
        mettreAJourKPIsFournisseurs();
        appliquerFiltresFournisseurs();

    } catch (error) {

        console.error(
            "Erreur de suppression :",
            error
        );

        if (message) {
            message.hidden = false;
            message.textContent =
                error?.message ||
                "Une erreur est survenue.";
        }

    } finally {

        if (bouton) {
            bouton.disabled = false;
        }
    }
}


/* ===========================================================
   PAGINATION
=========================================================== */

function initialiserPaginationFournisseurs() {

    document
        .getElementById(
            "suppliers-page-size"
        )
        ?.addEventListener(
            "change",
            event => {

                fournisseursParPage =
                    Number(
                        event.target.value
                    ) || 10;

                pageFournisseursCourante = 1;

                afficherFournisseurs(
                    fournisseursFiltresCourants
                );
            }
        );
}


function afficherPaginationFournisseurs(
    total,
    totalPages
) {

    const resume =
        document.getElementById(
            "suppliers-pagination-summary"
        );

    const controles =
        document.getElementById(
            "suppliers-pagination-controls"
        );

    if (!resume || !controles) {
        return;
    }

    if (total === 0) {
        resume.textContent =
            "0 fournisseur";
        controles.innerHTML = "";
        return;
    }

    const debut =
        (
            pageFournisseursCourante - 1
        ) * fournisseursParPage + 1;

    const fin = Math.min(
        pageFournisseursCourante *
        fournisseursParPage,
        total
    );

    resume.textContent =
        `${debut}–${fin} sur ${total}`;

    controles.innerHTML = `
        <button
            type="button"
            class="suppliers-page-btn"
            data-page="${
                pageFournisseursCourante - 1
            }"
            ${
                pageFournisseursCourante === 1
                    ? "disabled"
                    : ""
            }
        >
            ← Précédent
        </button>

        <span class="suppliers-page-current">
            Page ${pageFournisseursCourante}
            sur ${totalPages}
        </span>

        <button
            type="button"
            class="suppliers-page-btn"
            data-page="${
                pageFournisseursCourante + 1
            }"
            ${
                pageFournisseursCourante === totalPages
                    ? "disabled"
                    : ""
            }
        >
            Suivant →
        </button>
    `;

    controles
        .querySelectorAll("[data-page]")
        .forEach(bouton => {

            bouton.addEventListener(
                "click",
                () => {

                    const page = Number(
                        bouton.dataset.page
                    );

                    if (
                        page >= 1 &&
                        page <= totalPages
                    ) {
                        pageFournisseursCourante =
                            page;

                        afficherFournisseurs(
                            fournisseursFiltresCourants
                        );
                    }
                }
            );
        });
}


/* ===========================================================
   SÉLECTION MULTIPLE
=========================================================== */

function initialiserSelectionMultipleFournisseurs() {

    const tableBody =
        obtenirCorpsTableauFournisseurs();

    tableBody?.addEventListener(
        "change",
        event => {

            const caseFournisseur =
                event.target.closest(
                    ".supplier-row-checkbox"
                );

            if (!caseFournisseur) {
                return;
            }

            const id = String(
                caseFournisseur.dataset
                    .supplierId || ""
            ).trim();

            if (caseFournisseur.checked) {
                fournisseursSelectionnes.add(id);
            } else {
                fournisseursSelectionnes.delete(id);
            }

            synchroniserSelectionFournisseurs();
        }
    );

    document
        .getElementById(
            "select-all-suppliers"
        )
        ?.addEventListener(
            "change",
            event => {

                document
                    .querySelectorAll(
                        ".supplier-row-checkbox"
                    )
                    .forEach(
                        caseFournisseur => {

                            const id = String(
                                caseFournisseur
                                    .dataset
                                    .supplierId ||
                                ""
                            ).trim();

                            caseFournisseur.checked =
                                event.target.checked;

                            if (
                                event.target.checked
                            ) {
                                fournisseursSelectionnes
                                    .add(id);
                            } else {
                                fournisseursSelectionnes
                                    .delete(id);
                            }
                        }
                    );

                synchroniserSelectionFournisseurs();
            }
        );

    document
        .getElementById(
            "clear-suppliers-selection-btn"
        )
        ?.addEventListener(
            "click",
            () => {

                fournisseursSelectionnes.clear();
                synchroniserSelectionFournisseurs();
            }
        );
}


function synchroniserSelectionFournisseurs() {

    document
        .querySelectorAll(
            ".supplier-row-checkbox"
        )
        .forEach(caseFournisseur => {

            const id = String(
                caseFournisseur.dataset
                    .supplierId || ""
            ).trim();

            const selectionne =
                fournisseursSelectionnes.has(id);

            caseFournisseur.checked =
                selectionne;

            caseFournisseur
                .closest("tr")
                ?.classList.toggle(
                    "supplier-row-selected",
                    selectionne
                );
        });

    const cases = [
        ...document.querySelectorAll(
            ".supplier-row-checkbox"
        )
    ];

    const toutes =
        cases.length > 0 &&
        cases.every(
            caseFournisseur =>
                caseFournisseur.checked
        );

    const certaines =
        cases.some(
            caseFournisseur =>
                caseFournisseur.checked
        ) &&
        !toutes;

    const caseTout =
        document.getElementById(
            "select-all-suppliers"
        );

    if (caseTout) {
        caseTout.checked = toutes;
        caseTout.indeterminate = certaines;
    }

    const nombre =
        fournisseursSelectionnes.size;

    definirTexteElement(
        "selected-suppliers-count",
        nombre.toLocaleString("fr-FR")
    );

    const barre =
        document.getElementById(
            "suppliers-bulk-bar"
        );

    if (barre) {
        barre.hidden = nombre === 0;
    }
}


function nettoyerSelectionFournisseurs() {

    const idsValides = new Set(
        fournisseurs.map(
            fournisseur =>
                String(
                    lireValeurFournisseur(
                        fournisseur,
                        [
                            "ID Fournisseur",
                            "idFournisseur"
                        ]
                    ) || ""
                ).trim()
        )
    );

    fournisseursSelectionnes =
        new Set(
            [...fournisseursSelectionnes]
                .filter(id =>
                    idsValides.has(id)
                )
        );
}


function mettreAJourCompteurFournisseurs(
    total
) {

    definirTexteElement(
        "filtered-supplier-count",
        Number(total || 0)
            .toLocaleString("fr-FR")
    );
}


/* ===========================================================
   SUPPRESSION EN MASSE
=========================================================== */

function initialiserSuppressionEnMasseFournisseurs() {

    document
        .getElementById(
            "bulk-delete-suppliers-btn"
        )
        ?.addEventListener(
            "click",
            ouvrirSuppressionEnMasseFournisseurs
        );

    document
        .getElementById(
            "cancel-bulk-delete-suppliers-btn"
        )
        ?.addEventListener(
            "click",
            fermerSuppressionEnMasseFournisseurs
        );

    document
        .getElementById(
            "confirm-bulk-delete-suppliers-btn"
        )
        ?.addEventListener(
            "click",
            confirmerSuppressionEnMasseFournisseurs
        );
}


function ouvrirSuppressionEnMasseFournisseurs() {

    if (
        fournisseursSelectionnes.size === 0
    ) {
        return;
    }

    definirTexteElement(
        "bulk-delete-suppliers-total",
        fournisseursSelectionnes.size
            .toLocaleString("fr-FR")
    );

    const modale =
        document.getElementById(
            "bulk-delete-suppliers-modal"
        );

    if (modale) {
        modale.hidden = false;

        requestAnimationFrame(() => {
            modale.classList.add("active");
            document.body.classList.add(
                "modal-open"
            );
        });
    }
}


function fermerSuppressionEnMasseFournisseurs() {

    const modale =
        document.getElementById(
            "bulk-delete-suppliers-modal"
        );

    if (modale) {
        modale.classList.remove("active");
        modale.hidden = true;
    }

    document.body.classList.remove(
        "modal-open"
    );

    const message =
        document.getElementById(
            "bulk-delete-suppliers-message"
        );

    if (message) {
        message.hidden = true;
        message.textContent = "";
    }
}


async function confirmerSuppressionEnMasseFournisseurs() {

    const ids = [
        ...fournisseursSelectionnes
    ];

    if (!ids.length) {
        return;
    }

    const bouton =
        document.getElementById(
            "confirm-bulk-delete-suppliers-btn"
        );

    const annuler =
        document.getElementById(
            "cancel-bulk-delete-suppliers-btn"
        );

    const message =
        document.getElementById(
            "bulk-delete-suppliers-message"
        );

    const supprimes = [];
    const erreurs = [];

    try {

        if (bouton) {
            bouton.disabled = true;
            bouton.textContent =
                "Suppression...";
        }

        if (annuler) {
            annuler.disabled = true;
        }

        for (
            const idFournisseur of ids
        ) {

            try {

                const resultat =
                    await apiPost(
                        "deleteFournisseur",
                        { idFournisseur }
                    );

                if (!resultat?.success) {

                    throw new Error(
                        resultat?.message ||
                        "Suppression refusée."
                    );
                }

                supprimes.push(
                    idFournisseur
                );

            } catch (error) {

                erreurs.push({
                    idFournisseur,
                    message:
                        error?.message ||
                        "Erreur inconnue"
                });
            }
        }

        if (supprimes.length) {

            fournisseurs =
                fournisseurs.filter(
                    fournisseur => {

                        const id = String(
                            lireValeurFournisseur(
                                fournisseur,
                                [
                                    "ID Fournisseur",
                                    "idFournisseur"
                                ]
                            ) || ""
                        ).trim();

                        return (
                            !supprimes.includes(id)
                        );
                    }
                );

            supprimes.forEach(id =>
                fournisseursSelectionnes
                    .delete(id)
            );

            mettreAJourKPIsFournisseurs();
            appliquerFiltresFournisseurs();
        }

        if (erreurs.length) {

            if (message) {
                message.hidden = false;
                message.textContent =
                    `${supprimes.length} fournisseur(s) supprimé(s), ` +
                    `${erreurs.length} échec(s).`;
            }

            return;
        }

        fermerSuppressionEnMasseFournisseurs();

    } finally {

        if (bouton) {
            bouton.disabled = false;
            bouton.textContent =
                "Supprimer définitivement";
        }

        if (annuler) {
            annuler.disabled = false;
        }
    }
}


/* ===========================================================
   EXPORTS
=========================================================== */

function obtenirFournisseursPourSortie() {

    if (
        fournisseursSelectionnes.size > 0
    ) {

        return fournisseurs.filter(
            fournisseur => {

                const id = String(
                    lireValeurFournisseur(
                        fournisseur,
                        [
                            "ID Fournisseur",
                            "idFournisseur"
                        ]
                    ) || ""
                ).trim();

                return (
                    fournisseursSelectionnes
                        .has(id)
                );
            }
        );
    }

    return [
        ...fournisseursFiltresCourants
    ];
}


function transformerFournisseursPourSortie(
    liste
) {

    return liste.map(fournisseur => ({
        "Code":
            lireValeurFournisseur(
                fournisseur,
                [
                    "Code Fournisseur",
                    "codeFournisseur"
                ]
            ),
        "Nom Fournisseur":
            lireValeurFournisseur(
                fournisseur,
                [
                    "Nom Fournisseur",
                    "nomFournisseur"
                ]
            ),
        "Nom du Contact":
            lireValeurFournisseur(
                fournisseur,
                [
                    "Nom du Contact",
                    "nomContact"
                ]
            ),
        "Téléphone":
            lireValeurFournisseur(
                fournisseur,
                [
                    "Téléphone",
                    "telephone"
                ]
            ),
        "WhatsApp":
            lireValeurFournisseur(
                fournisseur,
                [
                    "WhatsApp",
                    "whatsapp"
                ]
            ),
        "Email":
            lireValeurFournisseur(
                fournisseur,
                ["Email", "email"]
            ),
        "Pays":
            lireValeurFournisseur(
                fournisseur,
                ["Pays", "pays"]
            ),
        "Ville":
            lireValeurFournisseur(
                fournisseur,
                ["Ville", "ville"]
            ),
        "Catégorie de Produits":
            lireValeurFournisseur(
                fournisseur,
                [
                    "Type de Produits",
                    "Catégorie de Produits",
                    "categorieProduits"
                ]
            ),
        "Délai Moyen de Livraison":
            lireValeurFournisseur(
                fournisseur,
                [
                    "Délai Moyen de Livraison",
                    "delaiMoyenLivraison"
                ]
            ),
        "Conditions de Paiement":
            lireValeurFournisseur(
                fournisseur,
                [
                    "Conditions de Paiement",
                    "conditionsPaiement"
                ]
            ),
        "Statut":
            lireValeurFournisseur(
                fournisseur,
                ["Statut", "statut"]
            )
    }));
}


function initialiserExportsFournisseurs() {

    const bouton =
        document.getElementById(
            "export-suppliers-btn"
        );

    const menu =
        document.getElementById(
            "suppliers-export-dropdown"
        );

    bouton?.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            if (!menu) {
                return;
            }

            menu.hidden = !menu.hidden;

            bouton.setAttribute(
                "aria-expanded",
                menu.hidden
                    ? "false"
                    : "true"
            );
        }
    );

    menu?.addEventListener(
        "click",
        event => {

            const option =
                event.target.closest(
                    "[data-export-format]"
                );

            if (!option) {
                return;
            }

            menu.hidden = true;
            bouton?.setAttribute(
                "aria-expanded",
                "false"
            );

            exporterFournisseurs(
                option.dataset.exportFormat
            );
        }
    );

    document.addEventListener(
        "click",
        event => {

            if (
                menu &&
                !event.target.closest(
                    "#suppliers-export-menu"
                )
            ) {
                menu.hidden = true;
                bouton?.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }
    );
}


function exporterFournisseurs(format) {

    const liste =
        obtenirFournisseursPourSortie();

    if (!liste.length) {
        return;
    }

    const donnees =
        transformerFournisseursPourSortie(
            liste
        );

    if (format === "xlsx") {
        exporterFournisseursExcel(
            donnees
        );
        return;
    }

    if (format === "pdf") {
        exporterFournisseursPDF(
            donnees
        );
        return;
    }

    if (format === "csv") {
        exporterFournisseursCSV(
            donnees
        );
    }
}


function exporterFournisseursExcel(
    donnees
) {

    if (typeof XLSX === "undefined") {

        alert(
            "La bibliothèque Excel n'est pas disponible."
        );

        return;
    }

    const feuille =
        XLSX.utils.json_to_sheet(
            donnees
        );

    const classeur =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        classeur,
        feuille,
        "Fournisseurs"
    );

    XLSX.writeFile(
        classeur,
        `fournisseurs_${dateFichierFournisseurs()}.xlsx`
    );
}


function exporterFournisseursCSV(
    donnees
) {

    const colonnes =
        Object.keys(donnees[0]);

    const echapperCSV = valeur =>
        `"${String(
            valeur ?? ""
        ).replace(/"/g, '""')}"`;

    const contenu = [
        colonnes
            .map(echapperCSV)
            .join(";"),
        ...donnees.map(ligne =>
            colonnes
                .map(colonne =>
                    echapperCSV(
                        ligne[colonne]
                    )
                )
                .join(";")
        )
    ].join("\n");

    telechargerFichierFournisseurs(
        "\uFEFF" + contenu,
        `fournisseurs_${dateFichierFournisseurs()}.csv`,
        "text/csv;charset=utf-8"
    );
}


function exporterFournisseursPDF(
    donnees
) {

    const jsPDF =
        window.jspdf?.jsPDF;

    if (!jsPDF) {

        alert(
            "La bibliothèque PDF n'est pas disponible."
        );

        return;
    }

    const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    pdf.setFontSize(17);

    pdf.text(
        "VISIBL — Liste des fournisseurs",
        14,
        16
    );

    const colonnes =
        Object.keys(donnees[0]);

    pdf.autoTable({
        startY: 23,
        head: [colonnes],
        body: donnees.map(ligne =>
            colonnes.map(
                colonne =>
                    ligne[colonne]
            )
        ),
        styles: {
            fontSize: 7,
            cellPadding: 2
        },
        headStyles: {
            fillColor: [37, 99, 235]
        }
    });

    pdf.save(
        `fournisseurs_${dateFichierFournisseurs()}.pdf`
    );
}


function telechargerFichierFournisseurs(
    contenu,
    nom,
    type
) {

    const blob =
        new Blob(
            [contenu],
            { type }
        );

    const url =
        URL.createObjectURL(blob);

    const lien =
        document.createElement("a");

    lien.href = url;
    lien.download = nom;

    document.body.appendChild(lien);
    lien.click();
    lien.remove();

    URL.revokeObjectURL(url);
}


function dateFichierFournisseurs() {

    const date = new Date();

    return [
        date.getFullYear(),
        String(
            date.getMonth() + 1
        ).padStart(2, "0"),
        String(
            date.getDate()
        ).padStart(2, "0")
    ].join("-");
}


/* ===========================================================
   IMPRESSION
=========================================================== */

function initialiserImpressionFournisseurs() {

    document
        .getElementById(
            "print-suppliers-btn"
        )
        ?.addEventListener(
            "click",
            imprimerFournisseurs
        );
}


function imprimerFournisseurs() {

    const liste =
        obtenirFournisseursPourSortie();

    if (!liste.length) {
        return;
    }

    const donnees =
        transformerFournisseursPourSortie(
            liste
        );

    const colonnes =
        Object.keys(donnees[0]);

    const fenetre =
        window.open(
            "",
            "_blank",
            "width=1200,height=800"
        );

    if (!fenetre) {

        alert(
            "Autorisez les fenêtres contextuelles pour imprimer."
        );

        return;
    }

    const lignes =
        donnees.map(ligne => `
            <tr>
                ${colonnes
                    .map(colonne =>
                        `<td>${
                            echapperHTML(
                                ligne[colonne]
                            )
                        }</td>`
                    )
                    .join("")}
            </tr>
        `).join("");

    fenetre.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Liste des fournisseurs</title>
            <style>
                @page {
                    size: landscape;
                    margin: 12mm;
                }

                body {
                    font-family: Arial, sans-serif;
                    color: #0f172a;
                }

                h1 {
                    margin: 0 0 6px;
                    font-size: 22px;
                }

                p {
                    margin: 0 0 18px;
                    color: #64748b;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                th,
                td {
                    padding: 7px;
                    font-size: 9px;
                    text-align: left;
                    border: 1px solid #dbe2ea;
                }

                th {
                    background: #e5e7eb;
                }
            </style>
        </head>
        <body>
            <h1>
                VISIBL — Liste des fournisseurs
            </h1>

            <p>
                ${donnees.length} fournisseur(s)
            </p>

            <table>
                <thead>
                    <tr>
                        ${colonnes
                            .map(colonne =>
                                `<th>${
                                    echapperHTML(
                                        colonne
                                    )
                                }</th>`
                            )
                            .join("")}
                    </tr>
                </thead>

                <tbody>
                    ${lignes}
                </tbody>
            </table>

            <script>
                window.onload = () => {
                    window.print();
                };
            <\/script>
        </body>
        </html>
    `);

    fenetre.document.close();
}


/* ===========================================================
   HEADER
=========================================================== */

function initialiserHeaderFournisseurs() {

    const rechercheHeader =
        document.getElementById(
            "header-suppliers-search-input"
        );

    const boutonRecherche =
        document.getElementById(
            "header-suppliers-search-btn"
        );

    const rechercheModule =
        document.getElementById(
            "suppliers-search-input"
        );

    const synchroniserRecherche = valeur => {

        const texte =
            String(valeur || "");

        if (rechercheHeader) {
            rechercheHeader.value = texte;
        }

        if (rechercheModule) {
            rechercheModule.value = texte;
        }

        pageFournisseursCourante = 1;
        appliquerFiltresFournisseurs();
    };

    rechercheHeader?.addEventListener(
        "input",
        () =>
            synchroniserRecherche(
                rechercheHeader.value
            )
    );

    boutonRecherche?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            synchroniserRecherche(
                rechercheHeader?.value
            );
        }
    );

    rechercheHeader?.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                event.preventDefault();

                synchroniserRecherche(
                    rechercheHeader.value
                );
            }
        }
    );

    rechercheModule?.addEventListener(
        "input",
        () => {

            if (rechercheHeader) {
                rechercheHeader.value =
                    rechercheModule.value;
            }
        }
    );

    const boutonProfil =
        document.getElementById(
            "profile-menu-button"
        );

    const menuProfil =
        document.getElementById(
            "profile-dropdown"
        );

    boutonProfil?.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            if (!menuProfil) {
                return;
            }

            menuProfil.hidden =
                !menuProfil.hidden;

            boutonProfil.setAttribute(
                "aria-expanded",
                menuProfil.hidden
                    ? "false"
                    : "true"
            );
        }
    );

    menuProfil?.addEventListener(
        "click",
        event =>
            event.stopPropagation()
    );

    document.addEventListener(
        "click",
        event => {

            if (
                menuProfil &&
                !event.target.closest(
                    "#supplier-profile-menu"
                )
            ) {
                menuProfil.hidden = true;

                boutonProfil?.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }
    );

    document
        .getElementById("logout-button")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                if (
                    typeof logoutUser ===
                    "function"
                ) {
                    logoutUser();
                    return;
                }

                sessionStorage.clear();
                localStorage.clear();

                window.location.href =
                    "connexion.html";
            }
        );
}


/* ===========================================================
   NOTIFICATIONS
=========================================================== */

function initialiserNotificationsFournisseurs() {

    const bouton =
        document.getElementById("notification-button");

    const panneau =
        document.getElementById("notification-panel");

    if (!bouton || !panneau) {
        return;
    }

    /* Empêche un double branchement si cette fonction est appelée
       par l'initialisation principale ET par le correctif autonome. */
    if (bouton.dataset.notificationInit === "1") {
        return;
    }

    bouton.dataset.notificationInit = "1";

    const fermerNotifications = () => {
        panneau.classList.remove("is-open");
        panneau.hidden = true;
        bouton.setAttribute("aria-expanded", "false");
    };

    const ouvrirNotifications = () => {
        document
            .querySelector(".header .search-container")
            ?.classList.remove("active");

        panneau.hidden = false;
        panneau.classList.add("is-open");
        bouton.setAttribute("aria-expanded", "true");
    };

    /* État initial propre. */
    fermerNotifications();

    bouton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        if (panneau.classList.contains("is-open")) {
            fermerNotifications();
        } else {
            ouvrirNotifications();
        }
    });

    panneau.addEventListener("click", event => {
        event.stopPropagation();
    });

    document.addEventListener("click", event => {
        if (!event.target.closest(".notification-menu")) {
            fermerNotifications();
        }
    });

    window.addEventListener("resize", () => {
        if (panneau.classList.contains("is-open")) {
            panneau.hidden = false;
        }
    });
}


/* ===========================================================
   ÉTATS DU TABLEAU
=========================================================== */

function afficherEtatChargementFournisseurs() {

    const tableBody =
        obtenirCorpsTableauFournisseurs();

    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="table-message"
                >
                    Chargement des fournisseurs...
                </td>
            </tr>
        `;
    }
}


function afficherErreurChargementFournisseurs(
    message
) {

    const tableBody =
        obtenirCorpsTableauFournisseurs();

    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="table-message error-row"
                >
                    ${echapperHTML(message)}
                </td>
            </tr>
        `;
    }
}


/* ===========================================================
   FOURNISSEURS — TOOLBAR + MENU ⋮
   Référence visuelle et responsive : Clients
=========================================================== */

let modeSelectionFournisseursUI = false;

function definirModeSelectionFournisseursUI(actif) {
    modeSelectionFournisseursUI = Boolean(actif);

    document.body.classList.toggle(
        "suppliers-selection-mode",
        modeSelectionFournisseursUI
    );

    const bouton = document.getElementById("selection-suppliers-btn");
    bouton?.setAttribute("aria-pressed", String(modeSelectionFournisseursUI));

    const barre = document.getElementById("suppliers-bulk-bar");

    if (!modeSelectionFournisseursUI) {
        fournisseursSelectionnes.clear();
        synchroniserSelectionFournisseurs();
        if (barre) barre.hidden = true;
    } else if (barre) {
        barre.hidden = false;
    }
}

function fermerMenuActionsFournisseursUI() {
    const menu = document.getElementById("suppliers-actions-dropdown");
    const trigger = document.getElementById("suppliers-actions-trigger");

    if (menu) menu.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
}

function initialiserToolbarFournisseursUI() {
    const boutonSelection = document.getElementById("selection-suppliers-btn");
    const triggerActions = document.getElementById("suppliers-actions-trigger");
    const menuActions = document.getElementById("suppliers-actions-dropdown");

    boutonSelection?.addEventListener("click", () => {
        fermerMenuActionsFournisseursUI();
        definirModeSelectionFournisseursUI(!modeSelectionFournisseursUI);
    });

    triggerActions?.addEventListener("click", event => {
        event.stopPropagation();

        const ouvrir = Boolean(menuActions?.hidden);

        if (ouvrir && modeSelectionFournisseursUI) {
            definirModeSelectionFournisseursUI(false);
        }

        if (menuActions) menuActions.hidden = !ouvrir;
        triggerActions.setAttribute("aria-expanded", String(ouvrir));
    });

    menuActions?.addEventListener("click", event => event.stopPropagation());

    document.addEventListener("click", event => {
        if (!event.target.closest(".suppliers-actions-menu")) {
            fermerMenuActionsFournisseursUI();
        }
    });

    document.getElementById("refresh-suppliers-btn")
        ?.addEventListener("click", fermerMenuActionsFournisseursUI);

    document.getElementById("print-suppliers-btn")
        ?.addEventListener("click", fermerMenuActionsFournisseursUI);
}

const synchroniserSelectionFournisseursOriginalUI = synchroniserSelectionFournisseurs;

synchroniserSelectionFournisseurs = function () {
    synchroniserSelectionFournisseursOriginalUI();

    const barre = document.getElementById("suppliers-bulk-bar");
    if (barre) {
        barre.hidden = !modeSelectionFournisseursUI;
    }
};

function fermerMenusLignesFournisseurs() {
    document.querySelectorAll("[data-supplier-actions-menu]").forEach(menu => {
        menu.hidden = true;
        menu.style.top = "";
        menu.style.right = "";
        menu.style.left = "";
        menu.style.bottom = "";
    });

    document.querySelectorAll("[data-supplier-actions-toggle]").forEach(button => {
        button.setAttribute("aria-expanded", "false");
    });
}

function positionnerMenuLigneFournisseur(trigger, menu) {
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();

    menu.hidden = false;

    /* Desktop : menu fixé au viewport pour éviter qu'il soit coupé
       par le conteneur du tableau ou un overflow parent. */
    if (window.innerWidth > 900) {
        menu.style.position = "fixed";
        menu.style.zIndex = "10020";
        menu.style.bottom = "auto";
        menu.style.right = "auto";

        const largeurMenu = 210;
        const marge = 8;
        const espaceDroite = window.innerWidth - rect.right;

        if (espaceDroite >= largeurMenu) {
            menu.style.left = `${Math.round(rect.right + marge)}px`;
        } else {
            menu.style.left = `${Math.max(
                12,
                Math.round(rect.left - largeurMenu - marge)
            )}px`;
        }

        /* S'il n'y a pas assez de place dessous, ouvrir au-dessus. */
        const hauteurEstimee = 145;
        const espaceBas = window.innerHeight - rect.bottom;

        if (espaceBas >= hauteurEstimee) {
            menu.style.top = `${Math.round(rect.bottom + marge)}px`;
        } else {
            menu.style.top = `${Math.max(
                12,
                Math.round(rect.top - hauteurEstimee - marge)
            )}px`;
        }
    } else {
        /* Mobile : les règles CSS existantes gèrent la feuille en bas. */
        menu.style.position = "";
        menu.style.top = "";
        menu.style.left = "";
        menu.style.right = "";
        menu.style.bottom = "";
    }
}

function initialiserMenusLignesFournisseurs() {
    const tableBody = document.getElementById("suppliers-table-body");

    tableBody?.addEventListener("click", event => {
        const trigger = event.target.closest("[data-supplier-actions-toggle]");

        if (trigger) {
            event.preventDefault();
            event.stopPropagation();

            const id = String(trigger.dataset.supplierActionsToggle || "");
            const menu = document.querySelector(
                `[data-supplier-actions-menu="${CSS.escape(id)}"]`
            );

            const ouvrir = Boolean(menu?.hidden);

            fermerMenusLignesFournisseurs();

            if (ouvrir && menu) {
                positionnerMenuLigneFournisseur(trigger, menu);
                trigger.setAttribute("aria-expanded", "true");
            }

            return;
        }

        if (event.target.closest(".supplier-row-menu-dropdown button")) {
            fermerMenusLignesFournisseurs();
        }
    });

    document.addEventListener("click", event => {
        if (!event.target.closest(".supplier-row-menu")) {
            fermerMenusLignesFournisseurs();
        }
    });

    window.addEventListener("resize", fermerMenusLignesFournisseurs);
    window.addEventListener("scroll", fermerMenusLignesFournisseurs, true);
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initialiserToolbarFournisseursUI();
        initialiserMenusLignesFournisseurs();
        definirModeSelectionFournisseursUI(false);
    });
} else {
    initialiserToolbarFournisseursUI();
    initialiserMenusLignesFournisseurs();
    definirModeSelectionFournisseursUI(false);
}


/* ===========================================================
   BRANCHEMENT AUTONOME DES NOTIFICATIONS
   Ne dépend d'aucune autre initialisation du module.
=========================================================== */
(function brancherNotificationsFournisseursIndependamment() {
    const lancer = () => {
        try {
            initialiserNotificationsFournisseurs();
        } catch (error) {
            console.error(
                "Erreur lors de l'initialisation autonome des notifications Fournisseurs :",
                error
            );
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", lancer);
    } else {
        lancer();
    }
})();

/* ===========================================================
   EXCLUSIVITÉ RECHERCHE HEADER / NOTIFICATIONS
   Une seule fenêtre peut être ouverte à la fois.
=========================================================== */
(function initialiserExclusiviteHeaderFournisseurs() {
    const lancer = () => {
        const boutonNotification = document.getElementById("notification-button");
        const panneauNotification = document.getElementById("notification-panel");
        const boutonRechercheMobile = document.getElementById("mobile-search-btn");
        const searchBox = document.querySelector(".header .search-box");
        const searchContainer = document.querySelector(".header .search-container");
        if (!boutonNotification || !panneauNotification) return;

        const fermerNotifications = () => {
            panneauNotification.classList.remove("is-open");
            panneauNotification.hidden = true;
            boutonNotification.setAttribute("aria-expanded", "false");
        };
        const fermerRecherche = () => {
            searchContainer?.classList.remove("active");
        };

        document.addEventListener("click", event => {
            if (event.target.closest("#notification-button")) {
                fermerRecherche();
                return;
            }
            if (event.target.closest("#mobile-search-btn, .header .search-box, .header .search-container, .header .search-input, .header .search-btn")) {
                fermerNotifications();
            }
        }, true);

        boutonRechercheMobile?.addEventListener("click", fermerNotifications, true);
        searchBox?.addEventListener("focusin", fermerNotifications);

        const observateur = new MutationObserver(() => {
            const rechercheOuverte = searchContainer?.classList.contains("active");
            const notificationsOuvertes = panneauNotification.classList.contains("is-open") && panneauNotification.hidden === false;
            if (rechercheOuverte && notificationsOuvertes) fermerNotifications();
        });
        if (searchContainer) observateur.observe(searchContainer,{attributes:true,attributeFilter:["class"]});
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lancer, {once:true});
    else lancer();
})();
