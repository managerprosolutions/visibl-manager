/* ===========================================================
   VISIBL ERP
   Module : Produits
   Fichier : produits.js
=========================================================== */

const TVA = 18;

let produits = [];


/* ===========================================================
   INITIALISATION
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    console.log("Module Produits chargé.");

    initProduits();

    const refreshButton =
        document.getElementById("refresh-products-btn");

    if (refreshButton) {

        refreshButton.addEventListener("click", () => {

            chargerProduitsDepuisAPI();

        });

    }

});


/* ===========================================================
   INITIALISATION DU MODULE
=========================================================== */

function initProduits() {

    mettreAJourKPIs();

    chargerProduitsDepuisAPI();

}


/* ===========================================================
   CHARGEMENT DEPUIS L'API
=========================================================== */

async function chargerProduitsDepuisAPI() {

    try {

        afficherEtatChargement();

        const resultat =
            await apiGet("getProduits");

        if (!resultat.success) {

            throw new Error(
                resultat.message ||
                "Impossible de récupérer les produits."
            );

        }

        chargerProduits(resultat.data);

        console.log(
            produits.length +
            " produit(s) chargé(s) depuis Google Sheets."
        );

    } catch (error) {

        console.error(
            "Erreur lors du chargement des produits :",
            error
        );

        afficherErreurChargement(
            error.message
        );

    }

}


/* ===========================================================
   CHARGEMENT DES PRODUITS
=========================================================== */

function chargerProduits(data) {

    produits = Array.isArray(data)
        ? data
        : [];

    mettreAJourKPIs();

    /*
        Ces fonctions seront activées dès que nous ajouterons
        l'affichage du tableau et les filtres.
    */

    if (typeof afficherProduits === "function") {

        afficherProduits(produits);

    } else {

        afficherMessageTableauVide();

    }

    if (typeof remplirFiltres === "function") {

        remplirFiltres();

    }

    if (typeof pagination === "function") {

        pagination();

    }

}


/* ===========================================================
   ÉTAT DE CHARGEMENT DU TABLEAU
=========================================================== */

function afficherEtatChargement() {

    const tableBody =
        obtenirCorpsTableauProduits();

    if (!tableBody) {

        return;

    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="25" class="table-message">
                Chargement des produits...
            </td>
        </tr>
    `;

}


/* ===========================================================
   MESSAGE TABLEAU VIDE
=========================================================== */

function afficherMessageTableauVide() {

    const tableBody =
        obtenirCorpsTableauProduits();

    if (!tableBody) {

        return;

    }

    if (produits.length > 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="25" class="table-message">
                    ${produits.length} produit(s) récupéré(s).
                    L'affichage détaillé du tableau sera ajouté
                    à l'étape suivante.
                </td>
            </tr>
        `;

        return;

    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="25" class="table-message">
                Aucun produit enregistré.
            </td>
        </tr>
    `;

}


/* ===========================================================
   ERREUR DE CHARGEMENT
=========================================================== */

function afficherErreurChargement(message) {

    const tableBody =
        obtenirCorpsTableauProduits();

    if (!tableBody) {

        return;

    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="25" class="table-message table-error">
                Impossible de charger les produits.
                ${echapperHTML(message)}
            </td>
        </tr>
    `;

}


/* ===========================================================
   RÉCUPÉRER LE CORPS DU TABLEAU
=========================================================== */

function obtenirCorpsTableauProduits() {

    return (
        document.getElementById("products-table-body") ||
        document.getElementById("produits-table-body") ||
        document.querySelector(".sales-table tbody") ||
        document.querySelector("table tbody")
    );

}


/* ===========================================================
   KPI
=========================================================== */

function mettreAJourKPIs() {

    const totalProduits =
        produits.length;

    const produitsActifs =
        produits.filter(produit => {

            return String(produit.Statut || "")
                .trim()
                .toLowerCase() === "actif";

        }).length;

    let valeurStock = 0;

    let sommeMarges = 0;

    let nbMarges = 0;

    let ajoutesCeMois = 0;

    const maintenant =
        new Date();

    produits.forEach(produit => {

        const prixRevient =
            convertirNombre(
                produit["Prix de Revient"]
            );

        const stockInitial =
            convertirNombre(
                produit["Stock Initial"]
            );

        valeurStock +=
            prixRevient * stockInitial;

        const marge =
            convertirNombre(
                produit["Taux de Marge (%)"]
            );

        if (Number.isFinite(marge)) {

            sommeMarges += marge;

            nbMarges++;

        }

        const dateAjoutBrute =
            produit["Date d'Ajout"];

        if (dateAjoutBrute) {

            const dateAjout =
                new Date(dateAjoutBrute);

            if (
                !Number.isNaN(dateAjout.getTime()) &&
                dateAjout.getMonth() === maintenant.getMonth() &&
                dateAjout.getFullYear() === maintenant.getFullYear()
            ) {

                ajoutesCeMois++;

            }

        }

    });

    const margeMoyenne =
        nbMarges > 0
            ? sommeMarges / nbMarges
            : 0;

    definirTexteElement(
        "kpi-total-products",
        totalProduits
    );

    definirTexteElement(
        "kpi-products-month",
        "+" + ajoutesCeMois + " ce mois"
    );

    definirTexteElement(
        "kpi-stock-value",
        formatMoney(valeurStock)
    );

    definirTexteElement(
        "kpi-average-margin",
        formatNumber(margeMoyenne) + " %"
    );

    definirTexteElement(
        "kpi-average-margin-fcfa",
        "Marge moyenne"
    );

    definirTexteElement(
        "kpi-active-products",
        produitsActifs
    );

    const pourcentageProduitsActifs =
        totalProduits === 0
            ? 0
            : Math.round(
                produitsActifs /
                totalProduits *
                100
            );

    definirTexteElement(
        "kpi-active-percent",
        pourcentageProduitsActifs +
        " % du catalogue"
    );

}


/* ===========================================================
   MODIFIER LE TEXTE D'UN ÉLÉMENT
=========================================================== */

function definirTexteElement(id, valeur) {

    const element =
        document.getElementById(id);

    if (!element) {

        console.warn(
            "Élément HTML introuvable : #" + id
        );

        return;

    }

    element.textContent =
        valeur;

}


/* ===========================================================
   CONVERSION EN NOMBRE
=========================================================== */

function convertirNombre(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;

    }

    const nombre =
        Number(
            String(value)
                .replace(/\s/g, "")
                .replace(",", ".")
        );

    return Number.isFinite(nombre)
        ? nombre
        : 0;

}


/* ===========================================================
   FORMAT DES NOMBRES
=========================================================== */

function formatNumber(value) {

    return convertirNombre(value)
        .toLocaleString(
            "fr-FR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1
            }
        );

}


/* ===========================================================
   FORMAT FCFA
=========================================================== */

function formatMoney(value) {

    return convertirNombre(value)
        .toLocaleString(
            "fr-FR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }
        ) + " FCFA";

}


/* ===========================================================
   SÉCURISATION HTML
=========================================================== */

function echapperHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}
