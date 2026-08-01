/* ===========================================================
   VISIBL ERP
   Module : Fournisseurs
   Fichier : fournisseurs.js
=========================================================== */

let fournisseurs = [];
let fournisseursFiltresCourants = [];
let fournisseursSelectionnes = new Set();

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

    const delais = fournisseurs
        .map(fournisseur =>
            Number(
                lireValeurFournisseur(
                    fournisseur,
                    [
                        "Délai Moyen de Livraison",
                        "delaiMoyenLivraison"
                    ]
                )
            )
        )
        .filter(nombre =>
            Number.isFinite(nombre) &&
            nombre > 0
        );

    const delaiMoyen = delais.length
        ? delais.reduce(
            (somme, valeur) => somme + valeur,
            0
        ) / delais.length
        : 0;

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

    definirTexteElement(
        "kpi-average-delivery-time",
        delaiMoyen
            ? `${delaiMoyen
                .toFixed(1)
                .replace(".", ",")} jours`
            : "0 jour"
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
                    colspan="10"
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

            const delai =
                formaterDelaiLivraison(
                    lireValeurFournisseur(
                        fournisseur,
                        [
                            "Délai Moyen de Livraison",
                            "delaiMoyenLivraison"
                        ]
                    )
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
                        </div>
                    </td>

                    <td>${contact}</td>
                    <td>${telephone}</td>
                    <td>${pays}</td>
                    <td>${ville}</td>
                    <td>${delai}</td>

                    <td>
                        <span
                            class="supplier-status product-status ${classeStatut}"
                        >
                            ${echapperHTML(statutBrut)}
                        </span>
                    </td>

                    <td>
                        <div
                            class="table-actions supplier-actions-cell"
                        >
                            <button
                                type="button"
                                class="table-action-btn view-btn view-supplier-btn"
                                data-supplier-id="${id}"
                                title="Voir le fournisseur"
                                aria-label="Voir le fournisseur"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                >
                                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>

                            <button
                                type="button"
                                class="table-action-btn edit-btn edit-supplier-btn"
                                data-supplier-id="${id}"
                                title="Modifier le fournisseur"
                                aria-label="Modifier le fournisseur"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                >
                                    <path d="M12 20h9"></path>
                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                                </svg>
                            </button>

                            <button
                                type="button"
                                class="table-action-btn delete-btn delete-supplier-btn"
                                data-supplier-id="${id}"
                                title="Supprimer le fournisseur"
                                aria-label="Supprimer le fournisseur"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                >
                                    <path d="M3 6h18"></path>
                                    <path d="M8 6V4h8v2"></path>
                                    <path d="M19 6l-1 14H6L5 6"></path>
                                    <path d="M10 11v6"></path>
                                    <path d="M14 11v6"></path>
                                </svg>
                            </button>
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
                    !statutRecherche ||
                    statut === statutRecherche
                )
            );
        });

    afficherFournisseurs(listeFiltree);
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

function ouvrirConsultationFournisseur(
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
        formaterDelaiLivraison(
            lireValeurFournisseur(
                fournisseur,
                [
                    "Délai Moyen de Livraison",
                    "delaiMoyenLivraison"
                ]
            )
        )
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
        document.getElementById(
            "notification-button"
        );

    const panneau =
        document.getElementById(
            "notification-panel"
        );

    if (!bouton || !panneau) {
        return;
    }

    bouton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            panneau.hidden =
                !panneau.hidden;

            bouton.setAttribute(
                "aria-expanded",
                panneau.hidden
                    ? "false"
                    : "true"
            );
        }
    );

    panneau.addEventListener(
        "click",
        event =>
            event.stopPropagation()
    );

    document.addEventListener(
        "click",
        event => {

            if (
                !event.target.closest(
                    ".notification-menu"
                )
            ) {
                panneau.hidden = true;

                bouton.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }
    );
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
                    colspan="10"
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
                    colspan="10"
                    class="table-message error-row"
                >
                    ${echapperHTML(message)}
                </td>
            </tr>
        `;
    }
}
