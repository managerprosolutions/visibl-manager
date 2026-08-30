/* ===========================================================
   VISIBL ERP — comptabilite.js
   Frontend du module Comptabilité

   API :
   - GET getComptabilite
=========================================================== */

let ecrituresComptaChargees = [];
let ecrituresComptaAffichees = [];

const ETAT_COMPTA = {
    resume: {
        produits: 0,
        charges: 0,
        resultat: 0,
        nombreEcritures: 0
    },
    recherche: "",
    journal: "",
    source: "",
    dateDebut: "",
    dateFin: ""
};


/* ===========================================================
   INITIALISATION
=========================================================== */

function initialiserComptabilite() {
    if (
        typeof requireAuth === "function" &&
        !requireAuth()
    ) {
        return;
    }

    initialiserDeconnexionCompta();
    initialiserFiltresCompta();
    initialiserActionsCompta();
    initialiserRechercheHeaderCompta();

    chargerComptabilite();
}


if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserComptabilite
    );
} else {
    initialiserComptabilite();
}


/* ===========================================================
   AUTH / HEADER
=========================================================== */

function initialiserDeconnexionCompta() {
    const bouton =
        document.getElementById(
            "logout-button"
        );

    if (!bouton) return;

    bouton.addEventListener(
        "click",
        function(event) {
            event.preventDefault();

            if (
                typeof logoutUser ===
                "function"
            ) {
                logoutUser();
            }
        }
    );
}


function initialiserRechercheHeaderCompta() {
    const input =
        document.querySelector(
            ".header .search-input"
        );

    const bouton =
        document.querySelector(
            ".header .search-btn"
        );

    const executer = function() {
        if (!input) return;

        ETAT_COMPTA.recherche =
            normaliserTexteComptaFront(
                input.value
            );

        appliquerFiltresCompta();
    };

    bouton?.addEventListener(
        "click",
        executer
    );

    input?.addEventListener(
        "keydown",
        function(event) {
            if (
                event.key === "Enter"
            ) {
                event.preventDefault();
                executer();
            }
        }
    );
}


/* ===========================================================
   CHARGEMENT
=========================================================== */

async function chargerComptabilite() {
    try {
        const resultat =
            await apiGet(
                "getComptabilite"
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger la comptabilité."
            );
        }

        ecrituresComptaChargees =
            Array.isArray(
                resultat.ecritures
            )
                ? resultat.ecritures
                : (
                    Array.isArray(
                        resultat.data
                    )
                        ? resultat.data
                        : []
                );

        ETAT_COMPTA.resume =
            resultat.resume || {
                produits: 0,
                charges: 0,
                resultat: 0,
                nombreEcritures:
                    ecrituresComptaChargees.length
            };

        mettreAJourKpisCompta();
        appliquerFiltresCompta();

    } catch (error) {
        console.error(
            "Erreur chargement comptabilité :",
            error
        );

        ecrituresComptaChargees = [];
        ecrituresComptaAffichees = [];

        afficherTableauCompta();
        mettreAJourCompteurCompta();

        afficherToastCompta(
            error.message ||
            "Impossible de charger la comptabilité.",
            "error"
        );
    }
}


/* ===========================================================
   KPI
=========================================================== */

function mettreAJourKpisCompta() {
    const resume =
        ETAT_COMPTA.resume || {};

    definirTexteCompta(
        "accounting-income-value",
        formaterMontantCompta(
            resume.produits
        )
    );

    definirTexteCompta(
        "accounting-expense-value",
        formaterMontantCompta(
            resume.charges
        )
    );

    definirTexteCompta(
        "accounting-result-value",
        formaterMontantCompta(
            resume.resultat
        )
    );

    definirTexteCompta(
        "accounting-entries-value",
        String(
            Number(
                resume.nombreEcritures ||
                ecrituresComptaChargees.length ||
                0
            )
        )
    );
}


/* ===========================================================
   FILTRES
=========================================================== */

function initialiserFiltresCompta() {
    const inputRecherche =
        document.getElementById(
            "accounting-search-input"
        );

    const journal =
        document.getElementById(
            "accounting-journal-filter"
        );

    const source =
        document.getElementById(
            "accounting-source-filter"
        );

    const dateDebut =
        document.getElementById(
            "accounting-date-from"
        );


    inputRecherche?.addEventListener(
        "input",
        function() {
            ETAT_COMPTA.recherche =
                normaliserTexteComptaFront(
                    inputRecherche.value
                );

            appliquerFiltresCompta();
        }
    );

    journal?.addEventListener(
        "change",
        function() {
            ETAT_COMPTA.journal =
                normaliserTexteComptaFront(
                    journal.value
                );

            appliquerFiltresCompta();
        }
    );

    source?.addEventListener(
        "change",
        function() {
            ETAT_COMPTA.source =
                normaliserTexteComptaFront(
                    source.value
                );

            appliquerFiltresCompta();
        }
    );

    dateDebut?.addEventListener(
        "change",
        function() {
            ETAT_COMPTA.dateDebut =
                dateDebut.value || "";

            appliquerFiltresCompta();
        }
    );


    document
        .getElementById(
            "reset-accounting-filters"
        )
        ?.addEventListener(
            "click",
            reinitialiserFiltresCompta
        );
}


function reinitialiserFiltresCompta() {
    ETAT_COMPTA.recherche = "";
    ETAT_COMPTA.journal = "";
    ETAT_COMPTA.source = "";
    ETAT_COMPTA.dateDebut = "";
    ETAT_COMPTA.dateFin = "";

    [
        "accounting-journal-filter",
        "accounting-source-filter",
        "accounting-date-from"
    ].forEach(
        function(id) {
            const element =
                document.getElementById(
                    id
                );

            if (element) {
                element.value = "";
            }
        }
    );

    const rechercheHeader =
        document.querySelector(
            ".header .search-input"
        );

    if (rechercheHeader) {
        rechercheHeader.value = "";
    }

    appliquerFiltresCompta();
}


function appliquerFiltresCompta() {
    const recherche =
        ETAT_COMPTA.recherche;

    const journal =
        ETAT_COMPTA.journal;

    const source =
        ETAT_COMPTA.source;

    const debut =
        ETAT_COMPTA.dateDebut
            ? new Date(
                ETAT_COMPTA.dateDebut +
                "T00:00:00"
              )
            : null;

    const fin =
        ETAT_COMPTA.dateDebut
            ? new Date(
                ETAT_COMPTA.dateDebut +
                "T23:59:59"
              )
            : null;

    ecrituresComptaAffichees =
        ecrituresComptaChargees.filter(
            function(ligne) {
                if (recherche) {
                    const contenu =
                        normaliserTexteComptaFront(
                            [
                                ligne.reference,
                                ligne.journal,
                                ligne.compte,
                                ligne.libelle,
                                ligne.source,
                                ligne.piece,
                                ligne.idUtilisateur
                            ].join(" ")
                        );

                    if (
                        !contenu.includes(
                            recherche
                        )
                    ) {
                        return false;
                    }
                }

                if (
                    journal &&
                    normaliserTexteComptaFront(
                        ligne.journal
                    ) !== journal
                ) {
                    return false;
                }

                if (
                    source &&
                    normaliserSourceFiltreCompta(
                        ligne.source
                    ) !== source
                ) {
                    return false;
                }

                if (
                    debut ||
                    fin
                ) {
                    const date =
                        convertirDateComptaFront(
                            ligne.date
                        );

                    if (
                        !date
                    ) {
                        return false;
                    }

                    if (
                        debut &&
                        date < debut
                    ) {
                        return false;
                    }

                    if (
                        fin &&
                        date > fin
                    ) {
                        return false;
                    }
                }

                return true;
            }
        );

    afficherTableauCompta();
    mettreAJourCompteurCompta();
}


/* ===========================================================
   TABLEAU
=========================================================== */

function afficherTableauCompta() {
    const tbody =
        document.getElementById(
            "accounting-table-body"
        );

    if (!tbody) return;

    if (
        !ecrituresComptaAffichees.length
    ) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-table">
                    Aucune écriture comptable.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML =
        ecrituresComptaAffichees
            .map(
                construireLigneCompta
            )
            .join("");
}


function construireLigneCompta(ligne) {
    const debit =
        convertirNombreComptaFront(
            ligne.debit
        );

    const credit =
        convertirNombreComptaFront(
            ligne.credit
        );

    const piece =
        String(
            ligne.piece || ""
        ).trim();

    const pieceHtml =
        /^https?:\/\//i.test(piece)
            ? `<a href="${echapperHTMLCompta(piece)}" target="_blank" rel="noopener">Voir</a>`
            : (
                piece
                    ? echapperHTMLCompta(piece)
                    : "—"
              );

    return `
        <tr>
            <td>
                ${echapperHTMLCompta(ligne.date || "—")}
                ${ligne.heure ? `<small style="display:block;color:#94a3b8">${echapperHTMLCompta(ligne.heure)}</small>` : ""}
            </td>
            <td>${echapperHTMLCompta(ligne.journal || "—")}</td>
            <td>${echapperHTMLCompta(ligne.reference || "—")}</td>
            <td>${echapperHTMLCompta(ligne.compte || "—")}</td>
            <td>${echapperHTMLCompta(ligne.libelle || "—")}</td>
            <td>${debit > 0 ? formaterMontantCompta(debit) : "—"}</td>
            <td>${credit > 0 ? formaterMontantCompta(credit) : "—"}</td>
            <td>${echapperHTMLCompta(ligne.source || "—")}</td>
            <td>${pieceHtml}</td>
            <td>${echapperHTMLCompta(ligne.idUtilisateur || "SYSTEM")}</td>
        </tr>
    `;
}


function mettreAJourCompteurCompta() {
    definirTexteCompta(
        "filtered-accounting-count",
        String(
            ecrituresComptaAffichees.length
        )
    );
}


/* ===========================================================
   ACTIONS
=========================================================== */

function activerBoutonComptaMobile(element, action) {
    if (!element) return;

    let dernierDeclenchement = 0;

    const executer = event => {
        const maintenant = Date.now();

        if (maintenant - dernierDeclenchement < 450) {
            event.preventDefault();
            return;
        }

        dernierDeclenchement = maintenant;
        event.preventDefault();
        event.stopPropagation();
        action();
    };

    if (window.PointerEvent) {
        element.addEventListener("pointerup", executer);
    } else {
        element.addEventListener(
            "touchend",
            executer,
            { passive: false }
        );
    }
}


function initialiserActionsCompta() {
    const declencheurActions =
        document.getElementById(
            "accounting-actions-trigger"
        );

    const menuActions =
        document.getElementById(
            "accounting-actions-dropdown"
        );

    document
        .getElementById(
            "refresh-accounting-btn"
        )
        ?.addEventListener(
            "click",
            async function() {
                if (menuActions) {
                    menuActions.hidden = true;
                }

                declencheurActions?.setAttribute(
                    "aria-expanded",
                    "false"
                );

                await chargerComptabilite();

                afficherToastCompta(
                    "Comptabilité actualisée.",
                    "success"
                );
            }
        );

    document
        .getElementById(
            "export-accounting-btn"
        )
        ?.addEventListener(
            "click",
            function() {
                if (menuActions) {
                    menuActions.hidden = true;
                }

                declencheurActions?.setAttribute(
                    "aria-expanded",
                    "false"
                );

                exporterComptabiliteCSV();
            }
        );

    document
        .getElementById(
            "print-accounting-btn"
        )
        ?.addEventListener(
            "click",
            function() {
                if (menuActions) {
                    menuActions.hidden = true;
                }

                declencheurActions?.setAttribute(
                    "aria-expanded",
                    "false"
                );

                imprimerComptabilite();
            }
        );

    if (
        !declencheurActions ||
        !menuActions
    ) {
        return;
    }

    const basculerActions = () => {
        const vaOuvrir =
            menuActions.hidden;

        menuActions.hidden =
            !vaOuvrir;

        declencheurActions.setAttribute(
            "aria-expanded",
            String(
                vaOuvrir
            )
        );
    };

    if (
        window.matchMedia(
            "(max-width: 900px)"
        ).matches
    ) {
        activerBoutonComptaMobile(
            declencheurActions,
            basculerActions
        );
    } else {
        declencheurActions.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                basculerActions();
            }
        );
    }

    menuActions.addEventListener(
        "click",
        event => {
            if (
                event.target.closest(
                    "button"
                )
            ) {
                menuActions.hidden = true;

                declencheurActions.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }
    );

    document.addEventListener(
        "click",
        event => {
            if (
                !event.target.closest(
                    ".accounting-actions-menu"
                )
            ) {
                menuActions.hidden = true;

                declencheurActions.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }
    );
}

function exporterComptabiliteCSV() {
    if (
        !ecrituresComptaAffichees.length
    ) {
        afficherToastCompta(
            "Aucune écriture à exporter.",
            "error"
        );
        return;
    }

    const entetes = [
        "Date",
        "Heure",
        "Journal",
        "Référence",
        "Compte",
        "Libellé",
        "Débit",
        "Crédit",
        "Source",
        "Pièce",
        "Utilisateur"
    ];

    const lignes = [
        entetes,
        ...ecrituresComptaAffichees.map(
            function(ligne) {
                return [
                    ligne.date || "",
                    ligne.heure || "",
                    ligne.journal || "",
                    ligne.reference || "",
                    ligne.compte || "",
                    ligne.libelle || "",
                    convertirNombreComptaFront(
                        ligne.debit
                    ),
                    convertirNombreComptaFront(
                        ligne.credit
                    ),
                    ligne.source || "",
                    ligne.piece || "",
                    ligne.idUtilisateur || ""
                ];
            }
        )
    ];

    const csv =
        "\uFEFF" +
        lignes
            .map(
                function(ligne) {
                    return ligne
                        .map(
                            valeurCSVCompta
                        )
                        .join(";");
                }
            )
            .join("\n");

    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const lien =
        document.createElement(
            "a"
        );

    lien.href = url;
    lien.download =
        "comptabilite-visibl.csv";

    document.body.appendChild(
        lien
    );

    lien.click();
    lien.remove();

    URL.revokeObjectURL(
        url
    );
}


function imprimerComptabilite() {
    if (
        !ecrituresComptaAffichees.length
    ) {
        afficherToastCompta(
            "Aucune écriture à imprimer.",
            "error"
        );
        return;
    }

    window.print();
}


/* ===========================================================
   OUTILS FRONT
=========================================================== */

function normaliserSourceFiltreCompta(
    source
) {
    const valeur =
        normaliserTexteComptaFront(
            source
        );

    if (valeur === "vente") {
        return "vente";
    }

    if (valeur === "paiement") {
        return "paiement";
    }

    if (valeur === "depense") {
        return "depense";
    }

    if (valeur === "caisse") {
        return "caisse";
    }

    if (
        valeur.indexOf(
            "approvisionnement"
        ) !== -1
    ) {
        return "approvisionnement";
    }

    return valeur;
}


function convertirDateComptaFront(
    valeur
) {
    const texte =
        String(
            valeur || ""
        ).trim();

    const fr =
        texte.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        );

    if (fr) {
        return new Date(
            Number(fr[3]),
            Number(fr[2]) - 1,
            Number(fr[1])
        );
    }

    const date =
        new Date(
            texte
        );

    return isNaN(
        date.getTime()
    )
        ? null
        : date;
}


function convertirNombreComptaFront(
    valeur
) {
    if (
        typeof valeur === "number"
    ) {
        return isFinite(valeur)
            ? valeur
            : 0;
    }

    const texte =
        String(
            valeur ?? ""
        )
            .replace(/\s/g, "")
            .replace(",", ".")
            .replace(/[^\d.-]/g, "");

    const nombre =
        Number(
            texte
        );

    return isFinite(nombre)
        ? nombre
        : 0;
}


function formaterMontantCompta(
    valeur
) {
    return (
        new Intl.NumberFormat(
            "fr-FR",
            {
                maximumFractionDigits: 0
            }
        ).format(
            convertirNombreComptaFront(
                valeur
            )
        ) +
        " FCFA"
    );
}


function normaliserTexteComptaFront(
    valeur
) {
    return String(
        valeur ?? ""
    )
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .trim();
}


function echapperHTMLCompta(
    valeur
) {
    return String(
        valeur ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function valeurCSVCompta(
    valeur
) {
    const texte =
        String(
            valeur ?? ""
        );

    return (
        '"' +
        texte.replace(
            /"/g,
            '""'
        ) +
        '"'
    );
}


function definirTexteCompta(
    id,
    valeur
) {
    const element =
        document.getElementById(
            id
        );

    if (element) {
        element.textContent =
            valeur;
    }
}


function afficherToastCompta(
    message,
    type
) {
    if (
        typeof showToast ===
        "function"
    ) {
        showToast(
            message,
            type
        );
        return;
    }

    const conteneur =
        document.getElementById(
            "toast-container"
        );

    if (!conteneur) {
        console.log(
            message
        );
        return;
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        "toast " +
        (
            type ||
            "info"
        );

    toast.textContent =
        message;

    conteneur.appendChild(
        toast
    );

    setTimeout(
        function() {
            toast.remove();
        },
        3500
    );
}




/* ===========================================================
   HEADER COMPTABILITÉ — comportement aligné sur Ventes
=========================================================== */

function initialiserInteractionsHeaderCompta() {
    const boutonRecherche =
        document.getElementById(
            "mobile-search-btn"
        );

    const conteneurRecherche =
        document.querySelector(
            ".header .search-container"
        );

    const boutonNotification =
        document.getElementById(
            "notification-button"
        );

    const panneauNotification =
        document.getElementById(
            "notification-panel"
        );

    const fermerRecherche = () => {
        conteneurRecherche?.classList.remove(
            "active"
        );
    };

    const fermerNotifications = () => {
        if (panneauNotification) {
            panneauNotification.hidden = true;
        }

        boutonNotification?.setAttribute(
            "aria-expanded",
            "false"
        );
    };

    /*
     * Comme dans Ventes :
     * - clic Recherche => Notifications fermées
     * - clic Notifications => Recherche fermée
     */
    boutonRecherche?.addEventListener(
        "click",
        () => {
            fermerNotifications();

            /*
             * Certains navigateurs mobiles déclenchent la logique
             * globale du header juste après. On réapplique donc
             * l'exclusivité une fois le clic complètement traité.
             */
            setTimeout(
                fermerNotifications,
                0
            );
        }
    );

    boutonNotification?.addEventListener(
        "click",
        () => {
            fermerRecherche();

            setTimeout(
                fermerRecherche,
                0
            );
        }
    );

    document.addEventListener(
        "click",
        event => {
            const dansRecherche =
                event.target.closest(
                    ".header .search-box"
                );

            const dansNotifications =
                event.target.closest(
                    ".header .notification-menu"
                );

            if (
                !dansRecherche &&
                !dansNotifications
            ) {
                fermerRecherche();
                fermerNotifications();
            }
        }
    );
}


/*
 * app.js est chargé avant comptabilite.js.
 * Cette initialisation est donc ajoutée après les interactions
 * générales du header, exactement comme pour la page Ventes.
 */
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserInteractionsHeaderCompta
    );
} else {
    initialiserInteractionsHeaderCompta();
}
