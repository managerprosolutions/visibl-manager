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
    initialiserModaleProduit();
    initialiserCalculsProduit();
    initialiserFormulaireProduit();

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
   MODALE PRODUIT
=========================================================== */

function initialiserModaleProduit() {

    const boutonNouveauProduit =
        document.getElementById("new-product-btn");

    const boutonFermer =
        document.getElementById("close-product-modal");

    const boutonAnnuler =
        document.getElementById("cancel-product-btn");

    const modale =
        document.getElementById("product-modal");

    if (!modale) {

        console.error(
            "La modale #product-modal est introuvable."
        );

        return;

    }

    if (boutonNouveauProduit) {

        boutonNouveauProduit.addEventListener(
            "click",
            ouvrirModaleProduit
        );

    }

    if (boutonFermer) {

        boutonFermer.addEventListener(
            "click",
            fermerModaleProduit
        );

    }

    if (boutonAnnuler) {

        boutonAnnuler.addEventListener(
            "click",
            fermerModaleProduit
        );

    }

    modale.addEventListener("click", event => {

        if (event.target === modale) {

            fermerModaleProduit();

        }

    });

    document.addEventListener("keydown", event => {

        if (
            event.key === "Escape" &&
            modale.classList.contains("active")
        ) {

            fermerModaleProduit();

        }

    });

}


function ouvrirModaleProduit() {

    const modale =
        document.getElementById("product-modal");

    const formulaire =
        document.getElementById("product-form");

    if (!modale) {

        return;

    }

    if (formulaire) {

        formulaire.reset();

    }

    remettreValeursParDefautProduit();
    masquerMessageFormulaireProduit();

    modale.classList.add("active");
    modale.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");

    const referenceProduit =
        document.getElementById("product-reference");

    if (referenceProduit) {

        setTimeout(() => {

            referenceProduit.focus();

        }, 100);

    }

}


function fermerModaleProduit() {

    const modale =
        document.getElementById("product-modal");

    if (!modale) {

        return;

    }

    modale.classList.remove("active");
    modale.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");

    masquerMessageFormulaireProduit();

}


/* ===========================================================
   CALCULS DU PRODUIT
=========================================================== */

function initialiserCalculsProduit() {

    const champsCalcul = [
        "product-purchase-price",
        "product-vat-rate",
        "product-transport-cost",
        "product-customs-cost",
        "product-other-costs",
        "product-sale-price"
    ];

    champsCalcul.forEach(id => {

        const champ =
            document.getElementById(id);

        if (champ) {

            champ.addEventListener(
                "input",
                calculerValeursProduit
            );

        }

    });

    calculerValeursProduit();

}


function calculerValeursProduit() {

    const prixAchat =
        obtenirValeurNombre("product-purchase-price");

    const tauxTVA =
        obtenirValeurNombre("product-vat-rate");

    const fraisTransport =
        obtenirValeurNombre("product-transport-cost");

    const fraisDouane =
        obtenirValeurNombre("product-customs-cost");

    const autresFrais =
        obtenirValeurNombre("product-other-costs");

    const prixVente =
        obtenirValeurNombre("product-sale-price");

    const montantTVA =
        prixAchat * tauxTVA / 100;

    const prixRevient =
        prixAchat +
        montantTVA +
        fraisTransport +
        fraisDouane +
        autresFrais;

    const margeFCFA =
        prixVente - prixRevient;

    const tauxMarge =
        prixRevient > 0
            ? margeFCFA / prixRevient * 100
            : 0;

    definirValeurChamp(
        "product-vat-amount",
        arrondirNombre(montantTVA)
    );

    definirValeurChamp(
        "product-cost-price",
        arrondirNombre(prixRevient)
    );

    definirValeurChamp(
        "product-margin-amount",
        arrondirNombre(margeFCFA)
    );

    definirValeurChamp(
        "product-margin-rate",
        arrondirNombre(tauxMarge, 2)
    );

}


function obtenirValeurNombre(id) {

    const champ =
        document.getElementById(id);

    if (!champ) {

        return 0;

    }

    return convertirNombre(champ.value);

}


function definirValeurChamp(id, valeur) {

    const champ =
        document.getElementById(id);

    if (champ) {

        champ.value = valeur;

    }

}


function arrondirNombre(nombre, decimales = 0) {

    const facteur =
        Math.pow(10, decimales);

    return Math.round(nombre * facteur) / facteur;

}


/* ===========================================================
   FORMULAIRE PRODUIT
=========================================================== */

function initialiserFormulaireProduit() {

    const formulaire =
        document.getElementById("product-form");

    if (!formulaire) {

        console.error(
            "Le formulaire #product-form est introuvable."
        );

        return;

    }

    formulaire.addEventListener(
        "submit",
        enregistrerProduit
    );

}


async function enregistrerProduit(event) {

    event.preventDefault();

    const formulaire =
        document.getElementById("product-form");

    const boutonEnregistrer =
        document.getElementById("save-product-btn");

    if (!formulaire) {

        return;

    }

    const referenceChamp =
        document.getElementById("product-reference");

    const designationChamp =
        document.getElementById("product-name");

    const referenceProduit =
        referenceChamp
            ? referenceChamp.value.trim()
            : "";

    const designation =
        designationChamp
            ? designationChamp.value.trim()
            : "";

    if (!referenceProduit || !designation) {

        afficherMessageFormulaireProduit(
            "Veuillez remplir la référence et la désignation.",
            "error"
        );

        return;

    }

    if (!formulaire.checkValidity()) {

        formulaire.reportValidity();

        return;

    }

    calculerValeursProduit();

    const produit = {

        referenceProduit,
        designation,

        description:
            obtenirValeurTexte("product-description"),

        prixAchat:
            obtenirValeurNombre("product-purchase-price"),

        tauxTVA:
            obtenirValeurNombre("product-vat-rate"),

        montantTVA:
            obtenirValeurNombre("product-vat-amount"),

        fraisTransport:
            obtenirValeurNombre("product-transport-cost"),

        fraisDouane:
            obtenirValeurNombre("product-customs-cost"),

        autresFrais:
            obtenirValeurNombre("product-other-costs"),

        prixRevient:
            obtenirValeurNombre("product-cost-price"),

        prixVente:
            obtenirValeurNombre("product-sale-price"),

        prixMinimumVente:
            obtenirValeurNombre("product-minimum-price"),

        margeFCFA:
            obtenirValeurNombre("product-margin-amount"),

        tauxMarge:
            obtenirValeurNombre("product-margin-rate"),

        stockInitial:
            obtenirValeurNombre("product-initial-stock"),

        seuilAlerte:
            obtenirValeurNombre("product-alert-threshold"),

        idFournisseurPrincipal:
            obtenirValeurTexte("product-main-supplier"),

        garantieMois:
            obtenirValeurNombre("product-warranty"),

        imageURL:
            obtenirValeurTexte("product-image-url"),

        statut:
            obtenirValeurTexte("product-status") || "Actif",

        commentaire:
            obtenirValeurTexte("product-comment")

    };

    try {

        if (boutonEnregistrer) {

            boutonEnregistrer.disabled = true;
            boutonEnregistrer.textContent =
                "Enregistrement...";

        }

        afficherMessageFormulaireProduit(
            "Enregistrement du produit...",
            "info"
        );

        const resultat =
            await apiPost(
                "createProduit",
                produit
            );

        if (!resultat || !resultat.success) {

            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le produit."
            );

        }

        afficherMessageFormulaireProduit(
            resultat.message ||
            "Produit enregistré avec succès.",
            "success"
        );

        formulaire.reset();
        remettreValeursParDefautProduit();

        await chargerProduitsDepuisAPI();

        setTimeout(() => {

            fermerModaleProduit();

        }, 800);

    } catch (error) {

        console.error(
            "Erreur d'enregistrement du produit :",
            error
        );

        afficherMessageFormulaireProduit(
            error.message ||
            "Une erreur est survenue.",
            "error"
        );

    } finally {

        if (boutonEnregistrer) {

            boutonEnregistrer.disabled = false;
            boutonEnregistrer.textContent =
                "Enregistrer le produit";

        }

    }

}


function obtenirValeurTexte(id) {

    const champ =
        document.getElementById(id);

    return champ
        ? String(champ.value || "").trim()
        : "";

}


function afficherMessageFormulaireProduit(
    message,
    type = "info"
) {

    const zoneMessage =
        document.getElementById(
            "product-form-message"
        );

    if (!zoneMessage) {

        return;

    }

    zoneMessage.textContent = message;
    zoneMessage.className =
        "form-message " + type;
    zoneMessage.style.display = "block";

}


function masquerMessageFormulaireProduit() {

    const zoneMessage =
        document.getElementById(
            "product-form-message"
        );

    if (!zoneMessage) {

        return;

    }

    zoneMessage.textContent = "";
    zoneMessage.className = "form-message";
    zoneMessage.style.display = "none";

}


function remettreValeursParDefautProduit() {

    definirValeurChamp("product-purchase-price", 0);
    definirValeurChamp("product-vat-rate", TVA);
    definirValeurChamp("product-vat-amount", 0);
    definirValeurChamp("product-transport-cost", 0);
    definirValeurChamp("product-customs-cost", 0);
    definirValeurChamp("product-other-costs", 0);
    definirValeurChamp("product-cost-price", 0);
    definirValeurChamp("product-sale-price", 0);
    definirValeurChamp("product-minimum-price", 0);
    definirValeurChamp("product-margin-amount", 0);
    definirValeurChamp("product-margin-rate", 0);
    definirValeurChamp("product-initial-stock", 0);
    definirValeurChamp("product-alert-threshold", 0);
    definirValeurChamp("product-warranty", 0);

    const statut =
        document.getElementById("product-status");

    if (statut) {

        statut.value = "Actif";

    }

    calculerValeursProduit();

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
