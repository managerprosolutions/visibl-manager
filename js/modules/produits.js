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

});


/* ===========================================================
   INITIALISATION DU MODULE
=========================================================== */

function initProduits() {

    /*
        Plus tard cette fonction appellera Apps Script.

        Exemple :

        google.script.run
            .withSuccessHandler(chargerProduits)
            .getProduits();
    */

    mettreAJourKPIs();

}


/* ===========================================================
   CHARGEMENT DES PRODUITS
=========================================================== */

function chargerProduits(data) {

    produits = data || [];

    mettreAJourKPIs();

    // afficherProduits();
    // remplirFiltres();
    // pagination();
}


/* ===========================================================
   KPI
=========================================================== */

function mettreAJourKPIs() {

    const totalProduits = produits.length;

    const produitsActifs = produits.filter(
        p => (p.Statut || "").toLowerCase() === "actif"
    ).length;

    let valeurStock = 0;

    let sommeMarges = 0;

    let nbMarges = 0;

    let ajoutesCeMois = 0;

    const maintenant = new Date();

    produits.forEach(produit => {

        const prixRevient = Number(produit["Prix de Revient"] || 0);

        const stockInitial = Number(produit["Stock Initial"] || 0);

        valeurStock += prixRevient * stockInitial;

        const marge = Number(produit["Taux de Marge (%)"] || 0);

        if (!isNaN(marge)) {

            sommeMarges += marge;

            nbMarges++;

        }

        if (produit["Date d'Ajout"]) {

            const dateAjout = new Date(produit["Date d'Ajout"]);

            if (
                dateAjout.getMonth() === maintenant.getMonth() &&
                dateAjout.getFullYear() === maintenant.getFullYear()
            ) {

                ajoutesCeMois++;

            }

        }

    });

    const margeMoyenne =
        nbMarges > 0
            ? (sommeMarges / nbMarges).toFixed(1)
            : 0;

    document.getElementById("kpi-total-products").textContent =
        totalProduits;

    document.getElementById("kpi-products-month").textContent =
        "+" + ajoutesCeMois + " ce mois";

    document.getElementById("kpi-stock-value").textContent =
        formatMoney(valeurStock);

    document.getElementById("kpi-average-margin").textContent =
        margeMoyenne + " %";

    document.getElementById("kpi-average-margin-fcfa").textContent =
        "Marge moyenne";

    document.getElementById("kpi-active-products").textContent =
        produitsActifs;

    document.getElementById("kpi-active-percent").textContent =
        totalProduits === 0
            ? "0 % du catalogue"
            : Math.round((produitsActifs / totalProduits) * 100) +
              "% du catalogue";

}


/* ===========================================================
   FORMAT FCFA
=========================================================== */

function formatMoney(value) {

    return Number(value).toLocaleString("fr-FR") + " FCFA";

}
