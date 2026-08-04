/* ===========================================================
   VISIBL ERP — mouvement_stock.js
   Consultation des mouvements de stock
=========================================================== */

let mouvementsStock = [];
let mouvementsStockFiltres = [];
let pageMouvementsActuelle = 1;
let taillePageMouvements = 10;


/* ===========================================================
   INITIALISATION
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initialiserModuleMouvementsStock();
});


function initialiserModuleMouvementsStock() {
    document
        .getElementById("refresh-stock-movements-btn")
        ?.addEventListener("click", chargerMouvementsStock);

    document
        .getElementById("stock-movements-search-input")
        ?.addEventListener("input", appliquerFiltresMouvementsStock);

    document
        .getElementById("header-stock-movements-search-input")
        ?.addEventListener("input", synchroniserRechercheEnteteMouvements);

    document
        .getElementById("header-stock-movements-search-btn")
        ?.addEventListener("click", appliquerFiltresMouvementsStock);

    document
        .getElementById("stock-movement-type-filter")
        ?.addEventListener("change", appliquerFiltresMouvementsStock);

    document
        .getElementById("stock-movement-date-from")
        ?.addEventListener("change", appliquerFiltresMouvementsStock);

    document
        .getElementById("stock-movement-date-to")
        ?.addEventListener("change", appliquerFiltresMouvementsStock);

    document
        .getElementById("reset-stock-movements-filters")
        ?.addEventListener("click", reinitialiserFiltresMouvementsStock);

    document
        .getElementById("stock-movements-page-size")
        ?.addEventListener("change", event => {
            taillePageMouvements = Math.max(
                1,
                Number(event.target.value) || 10
            );

            pageMouvementsActuelle = 1;
            afficherTableauMouvementsStock();
        });

    document
        .getElementById("print-stock-movements-btn")
        ?.addEventListener("click", () => window.print());

    initialiserMenuExportMouvementsStock();
    initialiserBoutonNouveauMouvement();
    chargerMouvementsStock();
}


function synchroniserRechercheEnteteMouvements(event) {
    const champPage =
        document.getElementById("stock-movements-search-input");

    if (champPage) {
        champPage.value = event.target.value;
    }

    appliquerFiltresMouvementsStock();
}


function initialiserBoutonNouveauMouvement() {
    const boutonOuvrir =
        document.getElementById("new-stock-movement-btn");

    const boutonFermer =
        document.getElementById("close-manual-adjustment-modal");

    const boutonAnnuler =
        document.getElementById("cancel-manual-adjustment-btn");

    const modal =
        document.getElementById("manual-adjustment-modal");

    boutonOuvrir?.addEventListener("click", ouvrirModaleAjustementManuel);
    boutonFermer?.addEventListener("click", fermerModaleAjustementManuel);
    boutonAnnuler?.addEventListener("click", fermerModaleAjustementManuel);

    modal?.addEventListener("click", event => {
        if (event.target === modal) {
            fermerModaleAjustementManuel();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modal?.classList.contains("active")) {
            fermerModaleAjustementManuel();
        }
    });

    document
        .getElementById("manual-adjustment-product")
        ?.addEventListener("change", mettreAJourCalculAjustementManuel);

    document
        .getElementById("manual-adjustment-type")
        ?.addEventListener("change", mettreAJourCalculAjustementManuel);

    document
        .getElementById("manual-adjustment-quantity")
        ?.addEventListener("input", mettreAJourCalculAjustementManuel);

    document
        .getElementById("manual-adjustment-form")
        ?.addEventListener(
            "submit",
            enregistrerAjustementManuel
        );
}


function ouvrirModaleAjustementManuel() {
    const modal = document.getElementById("manual-adjustment-modal");

    if (!modal) {
        return;
    }

    remplirListeProduitsAjustement();
    reinitialiserFormulaireAjustement();

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    setTimeout(() => {
        document.getElementById("manual-adjustment-product")?.focus();
    }, 50);
}


function fermerModaleAjustementManuel() {
    const modal = document.getElementById("manual-adjustment-modal");

    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}


function remplirListeProduitsAjustement() {
    const select = document.getElementById("manual-adjustment-product");

    if (!select) {
        return;
    }

    const valeurActuelle = select.value;

    const produits = new Map();

    mouvementsStock.forEach(mouvement => {
        if (!mouvement.idProduit) {
            return;
        }

        produits.set(mouvement.idProduit, {
            idProduit: mouvement.idProduit,
            produit: mouvement.produit || mouvement.idProduit,
            referenceProduit: mouvement.referenceProduit || "",
            stockDisponible: mouvement.stockApres
        });
    });

    select.innerHTML = '<option value="">Sélectionner un produit</option>';

    [...produits.values()]
        .sort((a, b) => a.produit.localeCompare(b.produit, "fr"))
        .forEach(produit => {
            const option = document.createElement("option");
            option.value = produit.idProduit;
            option.textContent = produit.referenceProduit
                ? `${produit.referenceProduit} — ${produit.produit}`
                : produit.produit;
            option.dataset.stock = String(produit.stockDisponible || 0);
            select.appendChild(option);
        });

    select.value = valeurActuelle;
}


function reinitialiserFormulaireAjustement() {
    const formulaire = document.getElementById("manual-adjustment-form");
    formulaire?.reset();

    definirTexteMouvement("manual-adjustment-stock-before", "—");
    definirTexteMouvement("manual-adjustment-stock-after", "—");

    const avant = document.getElementById("manual-adjustment-stock-before-value");
    const apres = document.getElementById("manual-adjustment-stock-after-value");

    if (avant) avant.value = "";
    if (apres) apres.value = "";

    afficherMessageFormulaireAjustement("", "");
}


function mettreAJourCalculAjustementManuel() {
    const selectProduit = document.getElementById("manual-adjustment-product");
    const type = normaliserTexteMouvementFrontend(
        document.getElementById("manual-adjustment-type")?.value || ""
    );
    const quantite = Math.max(
        0,
        Math.trunc(
            convertirNombreMouvementFrontend(
                document.getElementById("manual-adjustment-quantity")?.value
            )
        )
    );

    const option = selectProduit?.selectedOptions?.[0];
    const stockAvant = option?.value
        ? convertirNombreMouvementFrontend(option.dataset.stock)
        : null;

    if (stockAvant === null) {
        definirTexteMouvement("manual-adjustment-stock-before", "—");
        definirTexteMouvement("manual-adjustment-stock-after", "—");
        return;
    }

    const typesPositifs = ["ajustement positif"];
    const variation = typesPositifs.includes(type) ? quantite : -quantite;
    const stockApres = stockAvant + variation;

    definirTexteMouvement(
        "manual-adjustment-stock-before",
        formaterQuantiteMouvement(stockAvant)
    );

    definirTexteMouvement(
        "manual-adjustment-stock-after",
        formaterQuantiteMouvement(stockApres)
    );

    const avant = document.getElementById("manual-adjustment-stock-before-value");
    const apres = document.getElementById("manual-adjustment-stock-after-value");

    if (avant) avant.value = String(stockAvant);
    if (apres) apres.value = String(stockApres);

    if (stockApres < 0) {
        afficherMessageFormulaireAjustement(
            "La quantité saisie dépasse le stock disponible.",
            "error"
        );
    } else {
        afficherMessageFormulaireAjustement("", "");
    }
}


function validerAjustementManuel() {
    const idProduit = document.getElementById("manual-adjustment-product")?.value || "";
    const type = document.getElementById("manual-adjustment-type")?.value || "";
    const quantite = Math.trunc(
        convertirNombreMouvementFrontend(
            document.getElementById("manual-adjustment-quantity")?.value
        )
    );
    const commentaire = document.getElementById("manual-adjustment-comment")?.value.trim() || "";
    const stockApres = convertirNombreMouvementFrontend(
        document.getElementById("manual-adjustment-stock-after-value")?.value
    );

    if (!idProduit || !type || quantite <= 0 || !commentaire) {
        afficherMessageFormulaireAjustement(
            "Veuillez remplir tous les champs obligatoires.",
            "error"
        );
        return false;
    }

    if (stockApres < 0) {
        afficherMessageFormulaireAjustement(
            "Impossible d’enregistrer un ajustement qui rendrait le stock négatif.",
            "error"
        );
        return false;
    }

    return true;
}


function afficherMessageFormulaireAjustement(message, type) {
    const zone = document.getElementById("manual-adjustment-form-message");

    if (!zone) {
        return;
    }

    zone.textContent = message;
    zone.className = "form-message";

    if (message) {
        zone.classList.add("show");
        if (type) zone.classList.add(type);
    }
}



/* ===========================================================
   ENREGISTREMENT DE L'AJUSTEMENT MANUEL
=========================================================== */

async function enregistrerAjustementManuel(event) {
    event.preventDefault();

    if (!validerAjustementManuel()) {
        return;
    }

    const bouton =
        document.getElementById(
            "save-manual-adjustment-btn"
        );

    const texteInitial =
        bouton?.textContent || "";

    try {
        if (typeof apiPost !== "function") {
            throw new Error(
                "La fonction apiPost est indisponible."
            );
        }

        if (bouton) {
            bouton.disabled = true;
            bouton.textContent =
                "Enregistrement...";
        }

        afficherMessageFormulaireAjustement(
            "Enregistrement en cours...",
            "info"
        );

        const payload = {
            idProduit:
                document
                    .getElementById(
                        "manual-adjustment-product"
                    )
                    ?.value || "",

            typeMouvement:
                document
                    .getElementById(
                        "manual-adjustment-type"
                    )
                    ?.value || "",

            quantite:
                Math.trunc(
                    convertirNombreMouvementFrontend(
                        document
                            .getElementById(
                                "manual-adjustment-quantity"
                            )
                            ?.value
                    )
                ),

            commentaire:
                document
                    .getElementById(
                        "manual-adjustment-comment"
                    )
                    ?.value
                    .trim() || "",

            idUtilisateur:
                obtenirIdUtilisateurConnecteMouvement()
        };

        const resultat = await apiPost(
            "createMouvementStock",
            payload
        );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer l'ajustement."
            );
        }

        afficherNotificationMouvement(
            resultat.message,
            "success"
        );

        await chargerMouvementsStock();

        fermerModaleAjustementManuel();
        reinitialiserFormulaireAjustement();

    } catch (error) {
        console.error(
            "Erreur d'enregistrement :",
            error
        );

        afficherMessageFormulaireAjustement(
            error.message ||
            "Une erreur est survenue.",
            "error"
        );

    } finally {
        if (bouton) {
            bouton.disabled = false;
            bouton.textContent =
                texteInitial ||
                "Enregistrer l'ajustement";
        }
    }
}


function obtenirIdUtilisateurConnecteMouvement() {
    const cles = [
        "idUtilisateur",
        "userId",
        "utilisateurId",
        "currentUserId"
    ];

    for (const cle of cles) {
        const valeur =
            localStorage.getItem(cle) ||
            sessionStorage.getItem(cle);

        if (valeur) {
            return String(valeur).trim();
        }
    }

    const objets = [
        "user",
        "currentUser",
        "utilisateur",
        "visiblUser"
    ];

    for (const cle of objets) {
        const valeur =
            localStorage.getItem(cle) ||
            sessionStorage.getItem(cle);

        if (!valeur) {
            continue;
        }

        try {
            const objet = JSON.parse(valeur);

            const id =
                objet?.idUtilisateur ||
                objet?.userId ||
                objet?.id ||
                "";

            if (id) {
                return String(id).trim();
            }
        } catch (error) {}
    }

    return "SYSTEM";
}


/* ===========================================================
   CHARGEMENT DES DONNÉES
=========================================================== */

async function chargerMouvementsStock() {
    const tbody =
        document.getElementById("stock-movements-table-body");

    if (!tbody) {
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="11" class="table-message">
                Chargement des mouvements de stock...
            </td>
        </tr>
    `;

    try {
        if (typeof apiGet !== "function") {
            throw new Error(
                "La fonction apiGet est indisponible."
            );
        }

        const resultat =
            await apiGet("getMouvementsStock");

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger les mouvements de stock."
            );
        }

        const donnees =
            Array.isArray(resultat.data)
                ? resultat.data
                : Array.isArray(resultat.data?.mouvements)
                    ? resultat.data.mouvements
                    : Array.isArray(resultat.mouvements)
                        ? resultat.mouvements
                        : [];

        mouvementsStock = donnees
            .map(normaliserMouvementStock)
            .filter(mouvement =>
                mouvement.idMouvement ||
                mouvement.idProduit ||
                mouvement.typeMouvement
            );

        mouvementsStockFiltres = [...mouvementsStock];
        pageMouvementsActuelle = 1;

        mettreAJourKpiMouvementsStock(
            resultat.meta || resultat.data?.meta
        );

        afficherTableauMouvementsStock();

        console.log(
            `${mouvementsStock.length} mouvement(s) de stock chargé(s).`
        );

    } catch (error) {
        console.error(
            "Erreur lors du chargement des mouvements :",
            error
        );

        mouvementsStock = [];
        mouvementsStockFiltres = [];

        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="error-row">
                    ${echapperHTMLMouvement(
                        error.message ||
                        "Impossible de charger les mouvements."
                    )}
                </td>
            </tr>
        `;

        mettreAJourKpiMouvementsStock();
        mettreAJourCompteurMouvementsStock();
        afficherPaginationMouvementsStock();
    }
}


function normaliserMouvementStock(mouvement) {
    const quantite =
        convertirNombreMouvementFrontend(
            mouvement.quantite ??
            mouvement["Quantité"] ??
            mouvement["Quantite"] ??
            0
        );

    return {
        idMouvement: String(
            mouvement.idMouvement ??
            mouvement["ID Mouvement"] ??
            ""
        ).trim(),

        date: String(
            mouvement.date ??
            mouvement["Date"] ??
            ""
        ).trim(),

        heure: String(
            mouvement.heure ??
            mouvement["Heure"] ??
            ""
        ).trim(),

        idProduit: String(
            mouvement.idProduit ??
            mouvement["ID Produit"] ??
            ""
        ).trim(),

        produit: String(
            mouvement.produit ??
            mouvement.designation ??
            mouvement["Produit"] ??
            mouvement["Désignation"] ??
            mouvement["ID Produit"] ??
            ""
        ).trim(),

        referenceProduit: String(
            mouvement.referenceProduit ??
            mouvement["Référence Produit"] ??
            ""
        ).trim(),

        typeMouvement: String(
            mouvement.typeMouvement ??
            mouvement["Type de Mouvement"] ??
            ""
        ).trim(),

        quantite,

        stockAvant:
            convertirNombreMouvementFrontend(
                mouvement.stockAvant ??
                mouvement["Stock Avant"] ??
                0
            ),

        stockApres:
            convertirNombreMouvementFrontend(
                mouvement.stockApres ??
                mouvement["Stock Après"] ??
                mouvement["Stock Apres"] ??
                0
            ),

        reference: String(
            mouvement.reference ??
            mouvement["Référence"] ??
            mouvement["Reference"] ??
            ""
        ).trim(),

        moduleOrigine: String(
            mouvement.moduleOrigine ??
            mouvement["Module d’Origine"] ??
            mouvement["Module d'Origine"] ??
            ""
        ).trim(),

        idUtilisateur: String(
            mouvement.idUtilisateur ??
            mouvement["ID Utilisateur"] ??
            ""
        ).trim(),

        utilisateur: String(
            mouvement.utilisateur ??
            mouvement["Utilisateur"] ??
            mouvement["ID Utilisateur"] ??
            ""
        ).trim(),

        commentaire: String(
            mouvement.commentaire ??
            mouvement["Commentaire"] ??
            ""
        ).trim()
    };
}


/* ===========================================================
   FILTRES
=========================================================== */

function appliquerFiltresMouvementsStock() {
    const recherche = String(
        document
            .getElementById("stock-movements-search-input")
            ?.value ||
        document
            .getElementById("header-stock-movements-search-input")
            ?.value ||
        ""
    )
        .trim()
        .toLowerCase();

    const typeRecherche = normaliserTexteMouvementFrontend(
        document
            .getElementById("stock-movement-type-filter")
            ?.value ||
        ""
    );

    const dateDebut = convertirDateFiltreMouvement(
        document
            .getElementById("stock-movement-date-from")
            ?.value
    );

    const dateFin = convertirDateFiltreMouvement(
        document
            .getElementById("stock-movement-date-to")
            ?.value,
        true
    );

    mouvementsStockFiltres = mouvementsStock.filter(
        mouvement => {
            const texteRecherche = [
                mouvement.idMouvement,
                mouvement.idProduit,
                mouvement.produit,
                mouvement.referenceProduit,
                mouvement.typeMouvement,
                mouvement.reference,
                mouvement.moduleOrigine,
                mouvement.idUtilisateur,
                mouvement.utilisateur,
                mouvement.commentaire
            ]
                .join(" ")
                .toLowerCase();

            const correspondRecherche =
                !recherche ||
                texteRecherche.includes(recherche);

            const correspondType =
                !typeRecherche ||
                normaliserTexteMouvementFrontend(
                    mouvement.typeMouvement
                ) === typeRecherche;

            const dateMouvement =
                convertirDateAfficheeMouvement(
                    mouvement.date,
                    mouvement.heure
                );

            const correspondDateDebut =
                !dateDebut ||
                (
                    dateMouvement &&
                    dateMouvement >= dateDebut
                );

            const correspondDateFin =
                !dateFin ||
                (
                    dateMouvement &&
                    dateMouvement <= dateFin
                );

            return (
                correspondRecherche &&
                correspondType &&
                correspondDateDebut &&
                correspondDateFin
            );
        }
    );

    pageMouvementsActuelle = 1;
    afficherTableauMouvementsStock();
}


function reinitialiserFiltresMouvementsStock() {
    [
        "stock-movements-search-input",
        "header-stock-movements-search-input",
        "stock-movement-type-filter",
        "stock-movement-date-from",
        "stock-movement-date-to"
    ].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.value = "";
        }
    });

    mouvementsStockFiltres = [...mouvementsStock];
    pageMouvementsActuelle = 1;
    afficherTableauMouvementsStock();
}


/* ===========================================================
   AFFICHAGE DU TABLEAU
=========================================================== */

function afficherTableauMouvementsStock() {
    const tbody =
        document.getElementById("stock-movements-table-body");

    if (!tbody) {
        return;
    }

    const totalPages = Math.max(
        1,
        Math.ceil(
            mouvementsStockFiltres.length /
            taillePageMouvements
        )
    );

    if (pageMouvementsActuelle > totalPages) {
        pageMouvementsActuelle = totalPages;
    }

    const indexDebut =
        (pageMouvementsActuelle - 1) *
        taillePageMouvements;

    const mouvementsPage =
        mouvementsStockFiltres.slice(
            indexDebut,
            indexDebut + taillePageMouvements
        );

    if (!mouvementsPage.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="empty-table-message">
                    Aucun mouvement de stock trouvé.
                </td>
            </tr>
        `;

        mettreAJourCompteurMouvementsStock();
        afficherPaginationMouvementsStock();
        return;
    }

    tbody.innerHTML = mouvementsPage
        .map(mouvement => {
            const variation =
                obtenirVariationSigneeMouvement(
                    mouvement
                );

            return `
                <tr>
                    <td>
                        ${echapperHTMLMouvement(
                            mouvement.date || "—"
                        )}
                    </td>

                    <td>
                        ${echapperHTMLMouvement(
                            mouvement.heure || "—"
                        )}
                    </td>

                    <td title="${echapperHTMLMouvement(
                        mouvement.referenceProduit
                            ? `${mouvement.referenceProduit} — ${mouvement.produit}`
                            : mouvement.produit
                    )}">
                        <strong>
                            ${echapperHTMLMouvement(
                                mouvement.produit ||
                                mouvement.idProduit ||
                                "—"
                            )}
                        </strong>
                    </td>

                    <td>
                        ${creerBadgeTypeMouvement(
                            mouvement.typeMouvement
                        )}
                    </td>

                    <td>
                        <span class="${variation >= 0
                            ? "movement-quantity movement-quantity-positive"
                            : "movement-quantity movement-quantity-negative"
                        }">
                            ${formaterVariationMouvement(
                                variation
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="stock-before-value">
                            ${formaterQuantiteMouvement(
                                mouvement.stockAvant
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="stock-after-value">
                            ${formaterQuantiteMouvement(
                                mouvement.stockApres
                            )}
                        </span>
                    </td>

                    <td title="${echapperHTMLMouvement(
                        mouvement.reference
                    )}">
                        ${echapperHTMLMouvement(
                            mouvement.reference || "—"
                        )}
                    </td>

                    <td>
                        ${echapperHTMLMouvement(
                            mouvement.moduleOrigine || "—"
                        )}
                    </td>

                    <td title="${echapperHTMLMouvement(
                        mouvement.idUtilisateur
                    )}">
                        ${echapperHTMLMouvement(
                            mouvement.utilisateur ||
                            mouvement.idUtilisateur ||
                            "—"
                        )}
                    </td>

                    <td title="${echapperHTMLMouvement(
                        mouvement.commentaire
                    )}">
                        ${echapperHTMLMouvement(
                            mouvement.commentaire || "—"
                        )}
                    </td>
                </tr>
            `;
        })
        .join("");

    mettreAJourCompteurMouvementsStock();
    afficherPaginationMouvementsStock();
}


/* ===========================================================
   KPI
=========================================================== */

function mettreAJourKpiMouvementsStock(metaBackend) {
    const statistiques =
        metaBackend && typeof metaBackend === "object"
            ? {
                totalMouvements:
                    Number(metaBackend.totalMouvements) || 0,
                totalEntrees:
                    Number(metaBackend.totalEntrees) || 0,
                totalSorties:
                    Number(metaBackend.totalSorties) || 0,
                totalAjustements:
                    Number(metaBackend.totalAjustements) || 0
            }
            : calculerKpiMouvementsFrontend(
                mouvementsStock
            );

    definirTexteMouvement(
        "kpi-total-stock-movements",
        statistiques.totalMouvements
    );

    definirTexteMouvement(
        "kpi-stock-entries",
        formaterQuantiteMouvement(
            statistiques.totalEntrees
        )
    );

    definirTexteMouvement(
        "kpi-stock-exits",
        formaterQuantiteMouvement(
            statistiques.totalSorties
        )
    );

    definirTexteMouvement(
        "kpi-stock-adjustments",
        statistiques.totalAjustements
    );
}


function calculerKpiMouvementsFrontend(mouvements) {
    let entrees = 0;
    let sorties = 0;
    let ajustements = 0;

    mouvements.forEach(mouvement => {
        const type = normaliserTexteMouvementFrontend(
            mouvement.typeMouvement
        );

        const variation =
            obtenirVariationSigneeMouvement(
                mouvement
            );

        if (variation > 0) {
            entrees += Math.abs(variation);
        }

        if (variation < 0) {
            sorties += Math.abs(variation);
        }

        if (
            type.includes("ajustement") ||
            type.includes("inventaire")
        ) {
            ajustements += 1;
        }
    });

    return {
        totalMouvements: mouvements.length,
        totalEntrees: entrees,
        totalSorties: sorties,
        totalAjustements: ajustements
    };
}


/* ===========================================================
   PAGINATION
=========================================================== */

function mettreAJourCompteurMouvementsStock() {
    definirTexteMouvement(
        "filtered-stock-movements-count",
        mouvementsStockFiltres.length
    );

    definirTexteMouvement(
        "stock-movements-pagination-summary",
        `${mouvementsStockFiltres.length} mouvement(s)`
    );
}


function afficherPaginationMouvementsStock() {
    const conteneur =
        document.getElementById(
            "stock-movements-pagination-controls"
        );

    if (!conteneur) {
        return;
    }

    const totalPages = Math.max(
        1,
        Math.ceil(
            mouvementsStockFiltres.length /
            taillePageMouvements
        )
    );

    const boutons = [];

    boutons.push(`
        <button
            type="button"
            data-movement-page="${pageMouvementsActuelle - 1}"
            ${pageMouvementsActuelle <= 1 ? "disabled" : ""}
            aria-label="Page précédente"
        >
            ‹
        </button>
    `);

    const pages = obtenirPagesPaginationMouvement(
        totalPages,
        pageMouvementsActuelle
    );

    pages.forEach(page => {
        if (page === "...") {
            boutons.push(
                `<span aria-hidden="true">…</span>`
            );
            return;
        }

        boutons.push(`
            <button
                type="button"
                data-movement-page="${page}"
                class="${page === pageMouvementsActuelle ? "active" : ""}"
            >
                ${page}
            </button>
        `);
    });

    boutons.push(`
        <button
            type="button"
            data-movement-page="${pageMouvementsActuelle + 1}"
            ${pageMouvementsActuelle >= totalPages ? "disabled" : ""}
            aria-label="Page suivante"
        >
            ›
        </button>
    `);

    conteneur.innerHTML = boutons.join("");

    conteneur
        .querySelectorAll("[data-movement-page]")
        .forEach(bouton => {
            bouton.addEventListener("click", () => {
                const page =
                    Number(bouton.dataset.movementPage);

                if (
                    !Number.isFinite(page) ||
                    page < 1 ||
                    page > totalPages
                ) {
                    return;
                }

                pageMouvementsActuelle = page;
                afficherTableauMouvementsStock();
            });
        });
}


function obtenirPagesPaginationMouvement(
    totalPages,
    pageActuelle
) {
    if (totalPages <= 7) {
        return Array.from(
            { length: totalPages },
            (_, index) => index + 1
        );
    }

    const pages = [1];

    if (pageActuelle > 4) {
        pages.push("...");
    }

    const debut = Math.max(
        2,
        pageActuelle - 1
    );

    const fin = Math.min(
        totalPages - 1,
        pageActuelle + 1
    );

    for (let page = debut; page <= fin; page += 1) {
        pages.push(page);
    }

    if (pageActuelle < totalPages - 3) {
        pages.push("...");
    }

    pages.push(totalPages);
    return pages;
}


/* ===========================================================
   BADGES ET VARIATIONS
=========================================================== */

function creerBadgeTypeMouvement(typeMouvement) {
    const type =
        normaliserTexteMouvementFrontend(
            typeMouvement
        );

    let classe = "movement-type-other";

    if (
        [
            "stock initial",
            "entree",
            "approvisionnement",
            "retour client",
            "ajustement positif"
        ].includes(type)
    ) {
        classe = "movement-type-entry";
    } else if (
        [
            "sortie",
            "vente",
            "retour fournisseur",
            "ajustement negatif",
            "perte",
            "casse",
            "vol",
            "don"
        ].includes(type)
    ) {
        classe = "movement-type-exit";
    } else if (
        type.includes("ajustement") ||
        type.includes("inventaire")
    ) {
        classe = "movement-type-adjustment";
    }

    return `
        <span class="movement-type-badge ${classe}">
            ${echapperHTMLMouvement(
                typeMouvement || "Autre"
            )}
        </span>
    `;
}


function obtenirVariationSigneeMouvement(mouvement) {
    const difference =
        convertirNombreMouvementFrontend(
            mouvement.stockApres
        ) -
        convertirNombreMouvementFrontend(
            mouvement.stockAvant
        );

    if (difference !== 0) {
        return difference;
    }

    const type =
        normaliserTexteMouvementFrontend(
            mouvement.typeMouvement
        );

    const quantite = Math.abs(
        convertirNombreMouvementFrontend(
            mouvement.quantite
        )
    );

    const typesNegatifs = [
        "sortie",
        "vente",
        "retour fournisseur",
        "ajustement negatif",
        "perte",
        "casse",
        "vol",
        "don"
    ];

    return typesNegatifs.includes(type)
        ? -quantite
        : quantite;
}


/* ===========================================================
   EXPORTS
=========================================================== */

function initialiserMenuExportMouvementsStock() {
    const bouton =
        document.getElementById(
            "export-stock-movements-btn"
        );

    const menu =
        document.getElementById(
            "stock-movements-export-dropdown"
        );

    if (!bouton || !menu) {
        return;
    }

    bouton.addEventListener("click", event => {
        event.stopPropagation();

        const ouvert = !menu.hidden;
        menu.hidden = ouvert;
        bouton.setAttribute(
            "aria-expanded",
            String(!ouvert)
        );
    });

    menu
        .querySelectorAll("[data-export-format]")
        .forEach(option => {
            option.addEventListener("click", () => {
                const format =
                    option.dataset.exportFormat;

                menu.hidden = true;
                bouton.setAttribute(
                    "aria-expanded",
                    "false"
                );

                exporterMouvementsStock(format);
            });
        });

    document.addEventListener("click", event => {
        if (
            !menu.hidden &&
            !menu.contains(event.target) &&
            !bouton.contains(event.target)
        ) {
            menu.hidden = true;
            bouton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    });
}


function exporterMouvementsStock(format) {
    if (!mouvementsStockFiltres.length) {
        afficherNotificationMouvement(
            "Aucun mouvement à exporter.",
            "error"
        );
        return;
    }

    switch (format) {
        case "xlsx":
            exporterMouvementsExcel();
            break;

        case "csv":
            exporterMouvementsCSV();
            break;

        case "pdf":
            exporterMouvementsPDF();
            break;

        default:
            afficherNotificationMouvement(
                "Format d’export non reconnu.",
                "error"
            );
    }
}


function obtenirDonneesExportMouvements() {
    return mouvementsStockFiltres.map(mouvement => ({
        Date: mouvement.date,
        Heure: mouvement.heure,
        Produit: mouvement.produit,
        "Type de mouvement": mouvement.typeMouvement,
        Quantité: obtenirVariationSigneeMouvement(mouvement),
        "Stock avant": mouvement.stockAvant,
        "Stock après": mouvement.stockApres,
        Référence: mouvement.reference,
        "Module d’origine": mouvement.moduleOrigine,
        Utilisateur: mouvement.utilisateur,
        Commentaire: mouvement.commentaire
    }));
}


function exporterMouvementsExcel() {
    if (typeof XLSX === "undefined") {
        afficherNotificationMouvement(
            "La bibliothèque Excel est indisponible.",
            "error"
        );
        return;
    }

    const feuille = XLSX.utils.json_to_sheet(
        obtenirDonneesExportMouvements()
    );

    const classeur = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        classeur,
        feuille,
        "Mouvements stock"
    );

    XLSX.writeFile(
        classeur,
        `mouvements_stock_${obtenirDateFichierMouvement()}.xlsx`
    );
}


function exporterMouvementsCSV() {
    const donnees =
        obtenirDonneesExportMouvements();

    const entetes = Object.keys(donnees[0]);

    const lignes = [
        entetes,
        ...donnees.map(ligne =>
            entetes.map(entete =>
                ligne[entete]
            )
        )
    ];

    const csv = lignes
        .map(ligne =>
            ligne
                .map(cellule =>
                    `"${String(cellule ?? "")
                        .replaceAll('"', '""')}"`
                )
                .join(";")
        )
        .join("\n");

    telechargerFichierMouvement(
        "\uFEFF" + csv,
        `mouvements_stock_${obtenirDateFichierMouvement()}.csv`,
        "text/csv;charset=utf-8"
    );
}


function exporterMouvementsPDF() {
    const jsPDF =
        window.jspdf?.jsPDF;

    if (!jsPDF) {
        afficherNotificationMouvement(
            "La bibliothèque PDF est indisponible.",
            "error"
        );
        return;
    }

    const documentPDF =
        new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
        });

    documentPDF.setFontSize(16);
    documentPDF.text(
        "VISIBL — Mouvements de stock",
        14,
        15
    );

    const lignes =
        mouvementsStockFiltres.map(mouvement => [
            mouvement.date,
            mouvement.heure,
            mouvement.produit,
            mouvement.typeMouvement,
            formaterVariationMouvement(
                obtenirVariationSigneeMouvement(
                    mouvement
                )
            ),
            formaterQuantiteMouvement(
                mouvement.stockAvant
            ),
            formaterQuantiteMouvement(
                mouvement.stockApres
            ),
            mouvement.reference,
            mouvement.moduleOrigine,
            mouvement.utilisateur,
            mouvement.commentaire
        ]);

    documentPDF.autoTable({
        startY: 22,
        head: [[
            "Date",
            "Heure",
            "Produit",
            "Type",
            "Quantité",
            "Avant",
            "Après",
            "Référence",
            "Module",
            "Utilisateur",
            "Commentaire"
        ]],
        body: lignes,
        styles: {
            fontSize: 7,
            cellPadding: 2
        },
        headStyles: {
            fontStyle: "bold"
        }
    });

    documentPDF.save(
        `mouvements_stock_${obtenirDateFichierMouvement()}.pdf`
    );
}


/* ===========================================================
   OUTILS
=========================================================== */

function convertirNombreMouvementFrontend(valeur) {
    const nombre = Number(
        String(valeur ?? "")
            .replace(/\s/g, "")
            .replace(",", ".")
    );

    return Number.isFinite(nombre)
        ? nombre
        : 0;
}


function formaterQuantiteMouvement(valeur) {
    return Math.trunc(
        convertirNombreMouvementFrontend(valeur)
    ).toLocaleString("fr-FR");
}


function formaterVariationMouvement(valeur) {
    const nombre = Math.trunc(
        convertirNombreMouvementFrontend(valeur)
    );

    return nombre > 0
        ? `+${nombre.toLocaleString("fr-FR")}`
        : nombre.toLocaleString("fr-FR");
}


function normaliserTexteMouvementFrontend(valeur) {
    return String(valeur || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


function convertirDateAfficheeMouvement(dateTexte, heureTexte = "") {
    const texte = String(dateTexte || "").trim();

    let date = null;

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(texte)) {
        const [jour, mois, annee] =
            texte.split("/").map(Number);

        date = new Date(
            annee,
            mois - 1,
            jour
        );
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(texte)) {
        const [annee, mois, jour] =
            texte.split("-").map(Number);

        date = new Date(
            annee,
            mois - 1,
            jour
        );
    } else {
        const candidate = new Date(texte);

        if (!Number.isNaN(candidate.getTime())) {
            date = candidate;
        }
    }

    if (!date) {
        return null;
    }

    const heure = String(
        heureTexte || ""
    ).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);

    if (heure) {
        date.setHours(
            Number(heure[1]),
            Number(heure[2]),
            Number(heure[3] || 0),
            0
        );
    }

    return date;
}


function convertirDateFiltreMouvement(
    valeur,
    finDeJournee = false
) {
    if (!valeur) {
        return null;
    }

    const [annee, mois, jour] =
        String(valeur)
            .split("-")
            .map(Number);

    const date = new Date(
        annee,
        mois - 1,
        jour
    );

    if (finDeJournee) {
        date.setHours(
            23,
            59,
            59,
            999
        );
    }

    return date;
}


function definirTexteMouvement(id, valeur) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            String(valeur);
    }
}


function obtenirDateFichierMouvement() {
    const maintenant = new Date();

    return [
        maintenant.getFullYear(),
        String(
            maintenant.getMonth() + 1
        ).padStart(2, "0"),
        String(
            maintenant.getDate()
        ).padStart(2, "0")
    ].join("-");
}


function telechargerFichierMouvement(
    contenu,
    nomFichier,
    typeMime
) {
    const blob = new Blob(
        [contenu],
        { type: typeMime }
    );

    const url =
        URL.createObjectURL(blob);

    const lien =
        document.createElement("a");

    lien.href = url;
    lien.download = nomFichier;

    document.body.appendChild(lien);
    lien.click();
    lien.remove();

    URL.revokeObjectURL(url);
}


function afficherNotificationMouvement(
    message,
    type = "info"
) {
    if (typeof showToast === "function") {
        showToast(message, type);
        return;
    }

    if (typeof afficherToast === "function") {
        afficherToast(message, type);
        return;
    }

    console.log(`[${type}] ${message}`);
}


function echapperHTMLMouvement(valeur) {
    return String(valeur ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
