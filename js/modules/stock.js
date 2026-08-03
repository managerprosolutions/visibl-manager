/* ===========================================================
   VISIBL ERP — Module Stock
   Affichage initial à partir du module Produits
=========================================================== */

let stockProduits = [];
let stockProduitsFiltres = [];
let pageStockActuelle = 1;
let taillePageStock = 10;

document.addEventListener("DOMContentLoaded", () => {
    initialiserModuleStock();
});


function initialiserModuleStock() {
    document
        .getElementById("refresh-stock-btn")
        ?.addEventListener("click", chargerStockDepuisProduits);

    document
        .getElementById("stock-search-input")
        ?.addEventListener("input", appliquerFiltresStock);

    document
        .getElementById("header-stock-search-input")
        ?.addEventListener("input", event => {
            const recherchePage =
                document.getElementById("stock-search-input");

            if (recherchePage) {
                recherchePage.value = event.target.value;
            }

            appliquerFiltresStock();
        });

    document
        .getElementById("header-stock-search-btn")
        ?.addEventListener("click", appliquerFiltresStock);

    document
        .getElementById("stock-status-filter")
        ?.addEventListener("change", appliquerFiltresStock);

    document
        .getElementById("reset-stock-filters")
        ?.addEventListener("click", reinitialiserFiltresStock);

    document
        .getElementById("stock-page-size")
        ?.addEventListener("change", event => {
            taillePageStock =
                Math.max(1, Number(event.target.value) || 10);

            pageStockActuelle = 1;
            afficherTableauStock();
        });

    document
        .getElementById("print-stock-btn")
        ?.addEventListener("click", () => window.print());

    chargerStockDepuisProduits();
}


async function chargerStockDepuisProduits() {
    const tbody = document.getElementById("stock-table-body");

    if (!tbody) {
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="table-message">
                Chargement des produits...
            </td>
        </tr>
    `;

    try {
        if (typeof apiGet !== "function") {
            throw new Error(
                "La fonction apiGet est indisponible."
            );
        }

        const resultat = await apiGet("getStock");

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger les produits."
            );
        }

        const produits = Array.isArray(resultat.data)
            ? resultat.data
            : Array.isArray(resultat.data?.produits)
                ? resultat.data.produits
                : Array.isArray(resultat.produits)
                    ? resultat.produits
                    : [];

        stockProduits = produits
            .map(normaliserProduitStock)
            .filter(produit => produit.idProduit);

        stockProduitsFiltres = [...stockProduits];
        pageStockActuelle = 1;

        mettreAJourKpiStock();
        afficherTableauStock();

        console.log(
            `${stockProduits.length} produit(s) chargé(s) dans le module Stock.`
        );

    } catch (error) {
        console.error(
            "Erreur lors du chargement du stock :",
            error
        );

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="error-row">
                    ${echapperHTMLStock(
                        error.message ||
                        "Impossible de charger le stock."
                    )}
                </td>
            </tr>
        `;

        stockProduits = [];
        stockProduitsFiltres = [];
        mettreAJourKpiStock();
        mettreAJourCompteurStock();
        afficherPaginationStock();
    }
}


function normaliserProduitStock(produit) {
    const idProduit = lireValeurStock(
        produit,
        ["ID Produit", "idProduit", "Identifiant", "identifiant"]
    );

    const reference = lireValeurStock(
        produit,
        [
            "Référence",
            "Reference",
            "Référence Produit",
            "referenceProduit",
            "Code Produit",
            "codeProduit"
        ]
    ) || idProduit;

    const designation = lireValeurStock(
        produit,
        [
            "Désignation",
            "Designation",
            "designation",
            "Nom Produit",
            "nomProduit"
        ]
    ) || idProduit;

    const seuilAlerte = Math.max(
        0,
        Math.trunc(
            convertirNombreStock(
                lireValeurStock(
                    produit,
                    [
                        "Seuil d'Alerte",
                        "Seuil d’Alerte",
                        "Seuil Alerte",
                        "seuilAlerte"
                    ]
                )
            )
        )
    );

    /*
       Tant que StockService.gs et les mouvements ne sont pas encore
       connectés, tous les produits sont affichés avec un stock calculé à 0.
    */
    const stockDisponible = 0;
    const etat = calculerEtatStock(
        stockDisponible,
        seuilAlerte
    );

    return {
        idProduit: String(idProduit || "").trim(),
        reference: String(reference || "").trim(),
        produit: String(designation || "").trim(),
        stockDisponible,
        seuilAlerte,
        etat,
        derniereOperation: "Aucun mouvement",
        derniereMiseAJour: "—"
    };
}


function appliquerFiltresStock() {
    const recherche = String(
        document.getElementById("stock-search-input")?.value ||
        document.getElementById("header-stock-search-input")?.value ||
        ""
    )
        .trim()
        .toLowerCase();

    const etat = String(
        document.getElementById("stock-status-filter")?.value || ""
    )
        .trim()
        .toLowerCase();

    stockProduitsFiltres = stockProduits.filter(produit => {
        const correspondRecherche =
            !recherche ||
            [
                produit.reference,
                produit.produit,
                produit.idProduit
            ]
                .join(" ")
                .toLowerCase()
                .includes(recherche);

        const correspondEtat =
            !etat ||
            produit.etat === etat;

        return correspondRecherche && correspondEtat;
    });

    pageStockActuelle = 1;
    afficherTableauStock();
}


function reinitialiserFiltresStock() {
    const recherchePage =
        document.getElementById("stock-search-input");

    const rechercheHeader =
        document.getElementById("header-stock-search-input");

    const filtreEtat =
        document.getElementById("stock-status-filter");

    if (recherchePage) {
        recherchePage.value = "";
    }

    if (rechercheHeader) {
        rechercheHeader.value = "";
    }

    if (filtreEtat) {
        filtreEtat.value = "";
    }

    stockProduitsFiltres = [...stockProduits];
    pageStockActuelle = 1;
    afficherTableauStock();
}


function afficherTableauStock() {
    const tbody = document.getElementById("stock-table-body");

    if (!tbody) {
        return;
    }

    const totalPages = Math.max(
        1,
        Math.ceil(
            stockProduitsFiltres.length /
            taillePageStock
        )
    );

    if (pageStockActuelle > totalPages) {
        pageStockActuelle = totalPages;
    }

    const debut =
        (pageStockActuelle - 1) * taillePageStock;

    const produitsPage =
        stockProduitsFiltres.slice(
            debut,
            debut + taillePageStock
        );

    if (!produitsPage.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-table-message">
                    Aucun produit trouvé.
                </td>
            </tr>
        `;

        mettreAJourCompteurStock();
        afficherPaginationStock();
        return;
    }

    tbody.innerHTML = produitsPage
        .map(produit => `
            <tr>
                <td title="${echapperHTMLStock(produit.reference)}">
                    ${echapperHTMLStock(produit.reference)}
                </td>

                <td title="${echapperHTMLStock(produit.produit)}">
                    ${echapperHTMLStock(produit.produit)}
                </td>

                <td>
                    <strong>
                        ${formaterQuantiteStock(
                            produit.stockDisponible
                        )}
                    </strong>
                </td>

                <td>
                    ${formaterQuantiteStock(
                        produit.seuilAlerte
                    )}
                </td>

                <td>
                    ${creerBadgeEtatStock(produit.etat)}
                </td>

                <td>
                    ${echapperHTMLStock(
                        produit.derniereOperation
                    )}
                </td>

                <td>
                    ${echapperHTMLStock(
                        produit.derniereMiseAJour
                    )}
                </td>
            </tr>
        `)
        .join("");

    mettreAJourCompteurStock();
    afficherPaginationStock();
}


function mettreAJourKpiStock() {
    const total = stockProduits.length;

    const disponibles = stockProduits.filter(
        produit => produit.stockDisponible > 0
    ).length;

    const faibles = stockProduits.filter(
        produit => produit.etat === "faible"
    ).length;

    const ruptures = stockProduits.filter(
        produit => produit.etat === "rupture"
    ).length;

    definirTexteStock(
        "kpi-total-stock-products",
        total
    );

    definirTexteStock(
        "kpi-available-stock-products",
        disponibles
    );

    definirTexteStock(
        "kpi-low-stock-products",
        faibles
    );

    definirTexteStock(
        "kpi-out-of-stock-products",
        ruptures
    );

    definirTexteStock(
        "kpi-available-stock-percent",
        total
            ? `${Math.round(
                disponibles * 100 / total
            )} % du total`
            : "0 % du total"
    );
}


function mettreAJourCompteurStock() {
    definirTexteStock(
        "filtered-stock-count",
        stockProduitsFiltres.length
    );

    definirTexteStock(
        "stock-pagination-summary",
        `${stockProduitsFiltres.length} produit(s)`
    );
}


function afficherPaginationStock() {
    const conteneur =
        document.getElementById(
            "stock-pagination-controls"
        );

    if (!conteneur) {
        return;
    }

    const totalPages = Math.max(
        1,
        Math.ceil(
            stockProduitsFiltres.length /
            taillePageStock
        )
    );

    const boutons = [];

    boutons.push(`
        <button
            type="button"
            data-stock-page="${pageStockActuelle - 1}"
            ${pageStockActuelle <= 1 ? "disabled" : ""}
            aria-label="Page précédente"
        >
            ‹
        </button>
    `);

    for (let page = 1; page <= totalPages; page += 1) {
        boutons.push(`
            <button
                type="button"
                data-stock-page="${page}"
                class="${page === pageStockActuelle ? "active" : ""}"
            >
                ${page}
            </button>
        `);
    }

    boutons.push(`
        <button
            type="button"
            data-stock-page="${pageStockActuelle + 1}"
            ${pageStockActuelle >= totalPages ? "disabled" : ""}
            aria-label="Page suivante"
        >
            ›
        </button>
    `);

    conteneur.innerHTML = boutons.join("");

    conteneur
        .querySelectorAll("[data-stock-page]")
        .forEach(bouton => {
            bouton.addEventListener("click", () => {
                const page =
                    Number(bouton.dataset.stockPage);

                if (
                    !Number.isFinite(page) ||
                    page < 1 ||
                    page > totalPages
                ) {
                    return;
                }

                pageStockActuelle = page;
                afficherTableauStock();
            });
        });
}


function calculerEtatStock(stockDisponible, seuilAlerte) {
    if (stockDisponible <= 0) {
        return "rupture";
    }

    if (
        seuilAlerte > 0 &&
        stockDisponible <= seuilAlerte
    ) {
        return "faible";
    }

    return "normal";
}


function creerBadgeEtatStock(etat) {
    const configuration = {
        normal: {
            libelle: "Stock normal",
            classe: "stock-status-normal"
        },
        faible: {
            libelle: "Stock faible",
            classe: "stock-status-low"
        },
        rupture: {
            libelle: "Rupture",
            classe: "stock-status-out"
        }
    };

    const statut =
        configuration[etat] ||
        {
            libelle: "Indéterminé",
            classe: "stock-status-unknown"
        };

    return `
        <span class="stock-status-badge ${statut.classe}">
            ${statut.libelle}
        </span>
    `;
}


function lireValeurStock(objet, cles) {
    if (!objet || !Array.isArray(cles)) {
        return "";
    }

    for (const cle of cles) {
        if (
            Object.prototype.hasOwnProperty.call(objet, cle) &&
            objet[cle] !== null &&
            objet[cle] !== undefined &&
            objet[cle] !== ""
        ) {
            return objet[cle];
        }
    }

    return "";
}


function convertirNombreStock(valeur) {
    const nombre = Number(
        String(valeur ?? "")
            .replace(/\s/g, "")
            .replace(",", ".")
    );

    return Number.isFinite(nombre)
        ? nombre
        : 0;
}


function formaterQuantiteStock(valeur) {
    return Math.trunc(
        convertirNombreStock(valeur)
    ).toLocaleString("fr-FR");
}


function definirTexteStock(id, valeur) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = String(valeur);
    }
}


function echapperHTMLStock(valeur) {
    return String(valeur ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
