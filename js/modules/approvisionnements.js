/* ==========================================================
   VISIBL — MODULE APPROVISIONNEMENTS
   Fichier : js/modules/approvisionnements.js
========================================================== */

let approvisionnementsCharges = [];
let approvisionnementsAffiches = [];
let fournisseursCharges = [];
let transitairesCharges = [];
let produitsCharges = [];

let approvisionnementEnModificationId = null;
let approvisionnementASupprimer = null;
let lignesProduitsApprovisionnement = [];

let rechercheApprovisionnements = "";
let filtresApprovisionnements = {
    statut: "",
    modePaiement: "",
    devise: ""
};

let pageApprovisionnementsCourante = 1;
let approvisionnementsParPage = 10;

let modeSelectionApprovisionnements = false;
const approvisionnementsSelectionnes = new Set();

let approvisionnementAAnnuler = null;

let indexDetailReceptionProduitACreer = null;
let contexteCreationProduitApprovisionnement = "";
let imageProduitApprovisionnementURL = "";

let soldesCaisseApprovisionnement = {};
let comptesCaisseApprovisionnement = [];




/* ==========================================================
   INITIALISATION
========================================================== */

function initialiserApprovisionnements() {

    requireAuth();

    initialiserDeconnexionApprovisionnements();
    initialiserModalesApprovisionnements();
    initialiserActionsTableauApprovisionnements();
    initialiserRechercheEtFiltresApprovisionnements();
    initialiserEnteteMobileApprovisionnements();
    initialiserPaginationApprovisionnements();
    initialiserFormulaireApprovisionnement();
    initialiserProduitsApprovisionnement();
    initialiserAjoutsRapidesApprovisionnement();
    initialiserImpressionApprovisionnements();
    initialiserExportApprovisionnements();
    initialiserToolbarApprovisionnementsCommeVentes();
    initialiserSelectionApprovisionnements();
    initialiserAnnulationApprovisionnement();
    initialiserWorkflowApprovisionnements();
    initialiserModaleProduitApprovisionnement();


    chargerDonneesApprovisionnements();
}


function initialiserDeconnexionApprovisionnements() {

    const logoutButton =
        document.getElementById("logout-button");

    logoutButton?.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            logoutUser();
        }
    );
}


if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initialiserApprovisionnements
    );

} else {

    initialiserApprovisionnements();
}


/* ==========================================================
   CHARGEMENT GLOBAL
========================================================== */

async function chargerDonneesApprovisionnements(options = {}) {

    const afficherChargement =
        options.afficherChargement === true;

    if (afficherChargement) {
        afficherChargementActualisationApprovisionnements();
    }

    const debutChargement =
        Date.now();

    await Promise.allSettled([
        chargerFournisseursApprovisionnement(),
        chargerTransitairesApprovisionnement(),
        chargerProduitsApprovisionnement()
    ]);

    await chargerApprovisionnements();

    if (afficherChargement) {
        /*
         * On garde l'état de chargement un très court instant pour que
         * l'utilisateur perçoive clairement que la liste a été rechargée,
         * même si l'API répond presque instantanément.
         */
        const tempsEcoule =
            Date.now() - debutChargement;

        if (tempsEcoule < 350) {
            await new Promise(resolve =>
                setTimeout(
                    resolve,
                    350 - tempsEcoule
                )
            );
        }

        terminerChargementActualisationApprovisionnements();
    }
}


function afficherChargementActualisationApprovisionnements() {

    document.body.classList.add(
        "approvisionnements-refreshing"
    );

    const tbody =
        document.getElementById(
            "approvisionnements-table-body"
        );

    if (tbody) {
        tbody.innerHTML = `
            <tr class="approvisionnements-refresh-row">
                <td colspan="11">
                    <div class="approvisionnements-refresh-state">
                        <span
                            class="approvisionnements-refresh-spinner"
                            aria-hidden="true"
                        ></span>

                        <div>
                            <strong>
                                Actualisation des approvisionnements…
                            </strong>
                            <small>
                                Synchronisation des données en cours
                            </small>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    [
        "total-approvisionnements-value",
        "in-transit-approvisionnements-value",
        "received-approvisionnements-value",
        "total-purchases-value"
    ].forEach(id => {
        document
            .getElementById(id)
            ?.classList.add(
                "is-refreshing"
            );
    });
}


function terminerChargementActualisationApprovisionnements() {

    document.body.classList.remove(
        "approvisionnements-refreshing"
    );

    document
        .querySelectorAll(
            ".approvisionnements-kpi-grid .is-refreshing"
        )
        .forEach(element =>
            element.classList.remove(
                "is-refreshing"
            )
        );
}


async function chargerApprovisionnements() {

    try {

        const resultat =
            await apiGet("getApprovisionnements");

        if (!resultat.success) {

            showToast(
                resultat.message ||
                "Impossible de charger les approvisionnements.",
                "error"
            );

            approvisionnementsCharges = [];
            appliquerRechercheEtFiltresApprovisionnements();
            mettreAJourKPIsApprovisionnements();

            return;
        }

        approvisionnementsCharges =
            Array.isArray(resultat.approvisionnements)
                ? resultat.approvisionnements
                : Array.isArray(resultat.data)
                    ? resultat.data
                    : [];

        mettreAJourKPIsApprovisionnements();
        appliquerRechercheEtFiltresApprovisionnements();

    } catch (error) {

        console.error(
            "Erreur chargement approvisionnements :",
            error
        );

        approvisionnementsCharges = [];
        appliquerRechercheEtFiltresApprovisionnements();
        mettreAJourKPIsApprovisionnements();

        showToast(
            "Impossible de charger la liste des approvisionnements.",
            "error"
        );
    }
}


async function chargerFournisseursApprovisionnement() {

    try {

        const resultat =
            await apiGet("getFournisseurs");

        fournisseursCharges =
            Array.isArray(resultat.fournisseurs)
                ? resultat.fournisseurs
                : Array.isArray(resultat.data)
                    ? resultat.data
                    : [];

        remplirSelectFournisseurs();

    } catch (error) {

        console.error(
            "Erreur chargement fournisseurs :",
            error
        );

        fournisseursCharges = [];
        remplirSelectFournisseurs();
    }
}


async function chargerTransitairesApprovisionnement() {

    try {

        const resultat =
            await apiGet("getTransitaires");

        transitairesCharges =
            Array.isArray(resultat.transitaires)
                ? resultat.transitaires
                : Array.isArray(resultat.data)
                    ? resultat.data
                    : [];

        remplirSelectTransitaires();

    } catch (error) {

        console.error(
            "Erreur chargement transitaires :",
            error
        );

        transitairesCharges = [];
        remplirSelectTransitaires();
    }
}


async function chargerProduitsApprovisionnement() {

    try {

        const resultat =
            await apiGet("getProduits");

        produitsCharges =
            Array.isArray(resultat.produits)
                ? resultat.produits
                : Array.isArray(resultat.data)
                    ? resultat.data
                    : [];

        rendreLignesProduitsApprovisionnement();

    } catch (error) {

        console.error(
            "Erreur chargement produits :",
            error
        );

        produitsCharges = [];
        rendreLignesProduitsApprovisionnement();
    }
}


/* ==========================================================
   SELECTS FOURNISSEURS ET TRANSITAIRES
========================================================== */

function remplirSelectFournisseurs() {

    const select =
        document.getElementById("approvisionnement-fournisseur");

    if (!select) {
        return;
    }

    const valeurActuelle = select.value;

    select.innerHTML =
        '<option value="">Sélectionner un fournisseur</option>';

    fournisseursCharges.forEach(
        function (fournisseur) {

            const option =
                document.createElement("option");

            const idFournisseur =
                fournisseur.idFournisseur ||
                fournisseur["ID Fournisseur"] ||
                "";

            const nomFournisseur =
                fournisseur.nomFournisseur ||
                fournisseur["Nom Fournisseur"] ||
                fournisseur.nom ||
                fournisseur.raisonSociale ||
                idFournisseur ||
                "Fournisseur";

            option.value = idFournisseur;
            option.textContent = nomFournisseur;

            select.appendChild(option);
        }
    );

    select.value = valeurActuelle;
}


function remplirSelectTransitaires() {

    const select =
        document.getElementById("approvisionnement-transitaire");

    if (!select) {
        return;
    }

    const valeurActuelle = select.value;

    select.innerHTML =
        '<option value="">Aucun transitaire</option>';

    transitairesCharges.forEach(
        function (transitaire) {

            const option =
                document.createElement("option");

            const idTransitaire =
                transitaire.idTransitaire ||
                transitaire["ID Transitaire"] ||
                "";

            option.value = idTransitaire;

            option.textContent =
                transitaire.nomTransitaire ||
                transitaire["Nom Transitaire"] ||
                idTransitaire ||
                "Transitaire";

            select.appendChild(option);
        }
    );

    select.value = valeurActuelle;
}


/* ==========================================================
   MODALES
========================================================== */

function initialiserModalesApprovisionnements() {

    const modal =
        document.getElementById("approvisionnement-modal");

    const viewModal =
        document.getElementById("view-approvisionnement-modal");

    const deleteModal =
        document.getElementById("delete-approvisionnement-modal");

    document
        .getElementById("new-approvisionnement-btn")
        ?.addEventListener(
            "click",
            ouvrirNouvelApprovisionnement
        );

    document
        .getElementById("empty-new-approvisionnement-btn")
        ?.addEventListener(
            "click",
            ouvrirNouvelApprovisionnement
        );

    document
        .getElementById("close-approvisionnement-modal")
        ?.addEventListener(
            "click",
            fermerModalApprovisionnement
        );

    document
        .getElementById("cancel-approvisionnement-btn")
        ?.addEventListener(
            "click",
            fermerModalApprovisionnement
        );

    document
        .getElementById("close-view-approvisionnement-modal")
        ?.addEventListener(
            "click",
            fermerModalVoirApprovisionnement
        );

    document
        .getElementById("close-view-approvisionnement-footer")
        ?.addEventListener(
            "click",
            fermerModalVoirApprovisionnement
        );

    document
        .getElementById("cancel-delete-approvisionnement-btn")
        ?.addEventListener(
            "click",
            fermerModalSuppressionApprovisionnement
        );

    document
        .getElementById("confirm-delete-approvisionnement-btn")
        ?.addEventListener(
            "click",
            confirmerSuppressionApprovisionnement
        );

    modal?.addEventListener(
        "click",
        function (event) {

            if (event.target === modal) {
                fermerModalApprovisionnement();
            }
        }
    );

    viewModal?.addEventListener(
        "click",
        function (event) {

            if (event.target === viewModal) {
                fermerModalVoirApprovisionnement();
            }
        }
    );

    deleteModal?.addEventListener(
        "click",
        function (event) {

            if (event.target === deleteModal) {
                fermerModalSuppressionApprovisionnement();
            }
        }
    );

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key !== "Escape") {
                return;
            }

            fermerModalApprovisionnement();
            fermerModalVoirApprovisionnement();
            fermerModalSuppressionApprovisionnement();
            fermerModalAnnulationApprovisionnement();
        }
    );
}


function ouvrirModalApprovisionnement() {

    const modal =
        document.getElementById("approvisionnement-modal");

    modal?.classList.add("active");

    modal?.setAttribute(
        "aria-hidden",
        "false"
    );
}


function fermerModalApprovisionnement() {

    const modal =
        document.getElementById("approvisionnement-modal");

    modal?.classList.remove("active");

    modal?.setAttribute(
        "aria-hidden",
        "true"
    );
}


function ouvrirModalVoirApprovisionnement() {

    const modal =
        document.getElementById("view-approvisionnement-modal");

    modal?.classList.add("active");

    modal?.setAttribute(
        "aria-hidden",
        "false"
    );
}


function fermerModalVoirApprovisionnement() {

    const modal =
        document.getElementById("view-approvisionnement-modal");

    modal?.classList.remove("active");

    modal?.setAttribute(
        "aria-hidden",
        "true"
    );
}


function ouvrirModalSuppressionApprovisionnement(
    approvisionnement
) {

    approvisionnementASupprimer =
        approvisionnement;

    const modal =
        document.getElementById(
            "delete-approvisionnement-modal"
        );

    const label =
        document.getElementById(
            "delete-approvisionnement-name"
        );

    if (label) {

        label.textContent =
            approvisionnement.idApprovisionnement ||
            "cet approvisionnement";
    }

    modal?.classList.add("active");

    modal?.setAttribute(
        "aria-hidden",
        "false"
    );
}


function fermerModalSuppressionApprovisionnement() {

    const modal =
        document.getElementById(
            "delete-approvisionnement-modal"
        );

    const button =
        document.getElementById(
            "confirm-delete-approvisionnement-btn"
        );

    if (button?.disabled) {
        return;
    }

    approvisionnementASupprimer = null;

    modal?.classList.remove("active");

    modal?.setAttribute(
        "aria-hidden",
        "true"
    );
}


/* ==========================================================
   NOUVEAU / MODIFICATION
========================================================== */

function ouvrirNouvelApprovisionnement() {

    approvisionnementEnModificationId = null;
    lignesProduitsApprovisionnement = [];

    const form =
        document.getElementById("approvisionnement-form");

    form?.reset();

    definirDateHeureActuelleApprovisionnement();

    definirTexteApprovisionnement(
        "approvisionnement-modal-title",
        "Nouvel approvisionnement"
    );

    definirTexteApprovisionnement(
        "save-approvisionnement-btn",
        "Enregistrer l’approvisionnement"
    );

    const status =
        document.getElementById("approvisionnement-status");

    if (status) {
        status.value = "Brouillon";
        status.readOnly = true;
    }

    definirValeurChamp(
        "approvisionnement-frais-transport",
        ""
    );

    definirValeurChamp(
        "approvisionnement-frais-divers",
        ""
    );
    definirValeurChamp("approvisionnement-transport-gestionnaire","");
    definirValeurChamp("approvisionnement-frais-divers-paye-a","");
    synchroniserAttributionFraisApprovisionnement();

    rendreLignesProduitsApprovisionnement();
    recalculerTotauxApprovisionnement();
    ouvrirModalApprovisionnement();
}


function remplirFormulaireApprovisionnement(
    approvisionnement
) {

    approvisionnementEnModificationId =
        approvisionnement.idApprovisionnement;

    definirValeurChamp(
        "approvisionnement-id",
        approvisionnement.idApprovisionnement
    );

    definirValeurChamp(
        "approvisionnement-fournisseur",
        approvisionnement.idFournisseur
    );

    definirValeurChamp(
        "approvisionnement-transitaire",
        approvisionnement.idTransitaire
    );

    definirValeurChamp(
        "approvisionnement-date-achat",
        convertirDatePourInput(
            approvisionnement.dateAchat
        )
    );

    definirValeurChamp(
        "approvisionnement-heure-achat",
        approvisionnement.heureAchat
    );

    definirValeurChamp(
        "approvisionnement-date-reception-prevue",
        convertirDatePourInput(
            approvisionnement.dateReceptionPrevue
        )
    );

    definirValeurChamp(
        "approvisionnement-status",
        approvisionnement.statut || "Brouillon"
    );

    const champStatut =
        document.getElementById(
            "approvisionnement-status"
        );

    if (champStatut) {
        champStatut.readOnly = true;
    }

    definirValeurChamp(
        "approvisionnement-frais-transport",
        convertirMontantApprovisionnement(
            approvisionnement.fraisTransport
        )
    );

    definirValeurChamp(
        "approvisionnement-frais-divers",
        convertirMontantApprovisionnement(
            approvisionnement.fraisDivers
        )
    );
    definirValeurChamp("approvisionnement-transport-gestionnaire",approvisionnement.transportGerePar||"");
    definirValeurChamp("approvisionnement-frais-divers-paye-a",approvisionnement.fraisDiversPayeA||"");
    synchroniserAttributionFraisApprovisionnement();

    definirValeurChamp(
        "approvisionnement-payment-method",
        approvisionnement.modePaiement
    );

    definirValeurChamp(
        "approvisionnement-currency",
        approvisionnement.deviseAchat ||
        approvisionnement.deviseDeLAchat ||
        "FCFA"
    );

    definirValeurChamp(
        "approvisionnement-comment",
        approvisionnement.commentaire
    );

    lignesProduitsApprovisionnement =
        Array.isArray(approvisionnement.details)
            ? approvisionnement.details.map(
                normaliserLigneProduitApprovisionnement
            )
            : Array.isArray(
                approvisionnement.detailsApprovisionnement
            )
                ? approvisionnement
                    .detailsApprovisionnement
                    .map(
                        normaliserLigneProduitApprovisionnement
                    )
                : [];

    rendreLignesProduitsApprovisionnement();
    recalculerTotauxApprovisionnement();

    definirTexteApprovisionnement(
        "approvisionnement-modal-title",
        "Modifier l’approvisionnement"
    );

    definirTexteApprovisionnement(
        "save-approvisionnement-btn",
        "Enregistrer les modifications"
    );

    ouvrirModalApprovisionnement();
}


function definirDateHeureActuelleApprovisionnement() {

    const maintenant =
        new Date();

    const date =
        maintenant.toISOString().slice(0, 10);

    const heure =
        maintenant
            .toTimeString()
            .slice(0, 5);

    definirValeurChamp(
        "approvisionnement-date-achat",
        date
    );

    definirValeurChamp(
        "approvisionnement-heure-achat",
        heure
    );
}


/* ==========================================================
   PRODUITS DE L'APPROVISIONNEMENT
========================================================== */

function initialiserProduitsApprovisionnement() {

    document
        .getElementById(
            "add-approvisionnement-product-btn"
        )
        ?.addEventListener(
            "click",
            ajouterLigneProduitApprovisionnement
        );

    const tbody =
        document.getElementById(
            "approvisionnement-products-body"
        );

    tbody?.addEventListener(
        "input",
        gererModificationLigneProduit
    );

    tbody?.addEventListener(
        "change",
        gererModificationLigneProduit
    );

    tbody?.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    ".product-remove-btn"
                );

            if (!button) {
                return;
            }

            const index =
                Number(button.dataset.index);

            if (!Number.isInteger(index)) {
                return;
            }

            lignesProduitsApprovisionnement.splice(
                index,
                1
            );

            rendreLignesProduitsApprovisionnement();
            recalculerTotauxApprovisionnement();
        }
    );

    document
        .getElementById(
            "approvisionnement-frais-transport"
        )
        ?.addEventListener(
            "input",
            recalculerTotauxApprovisionnement
        );

    document
        .getElementById(
            "approvisionnement-frais-divers"
        )
        ?.addEventListener(
            "input",
            recalculerTotauxApprovisionnement
        );
}


function ajouterLigneProduitApprovisionnement() {

    lignesProduitsApprovisionnement.push({
        idProduit: "",
        quantiteCommandee: "",
        quantiteRecue: 0,
        prixAchatUnitaire: "",
        remise: "",
        sousTotal: 0,
        etatReception: "En attente",
        commentaire: ""
    });

    rendreLignesProduitsApprovisionnement();
}


function normaliserLigneProduitApprovisionnement(
    ligne
) {

    return {
        idDetailApprovisionnement:
            ligne.idDetailApprovisionnement || "",

        numeroLigne:
            ligne.numeroLigne || "",

        idProduit:
            ligne.idProduit || "",

        quantiteCommandee:
            convertirMontantApprovisionnement(
                ligne.quantiteCommandee
            ),

        quantiteRecue:
            convertirMontantApprovisionnement(
                ligne.quantiteRecue
            ),

        prixAchatUnitaire:
            convertirMontantApprovisionnement(
                ligne.prixAchatUnitaire
            ),

        remise:
            convertirMontantApprovisionnement(
                ligne.remise
            ),

        sousTotal:
            convertirMontantApprovisionnement(
                ligne.sousTotal
            ),

        etatReception:
            ligne.etatReception || "En attente",

        commentaire:
            ligne.commentaire || ""
    };
}


function rendreLignesProduitsApprovisionnement() {

    const tbody =
        document.getElementById(
            "approvisionnement-products-body"
        );

    if (!tbody) {
        return;
    }

    if (
        lignesProduitsApprovisionnement.length === 0
    ) {

        tbody.innerHTML = `
            <tr class="empty-product-row">
                <td colspan="6">
                    Aucun produit ajouté.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        lignesProduitsApprovisionnement
            .map(
                function (ligne, index) {

                    return `
                        <tr data-index="${index}">
                            <td>
                                <select
                                    class="detail-product-select"
                                    data-field="idProduit"
                                    data-index="${index}"
                                >
                                    ${genererOptionsProduits(
                                        ligne.idProduit
                                    )}
                                </select>
                            </td>

                            <td>
                                <input
                                    type="text"
                                    inputmode="numeric"
                                    autocomplete="off"
                                    value="${echapperHTML(
                                        ligne.quantiteCommandee
                                    )}"
                                    data-field="quantiteCommandee"
                                    data-index="${index}"
                                >
                            </td>

                            <td>
                                <div class="money-input-wrapper">
                                    <input
                                        type="text"
                                        inputmode="numeric"
                                        autocomplete="off"
                                        value="${echapperHTML(
                                            ligne.prixAchatUnitaire
                                        )}"
                                        data-field="prixAchatUnitaire"
                                        data-index="${index}"
                                    >
                                    <span class="money-input-suffix">FCFA</span>
                                </div>
                            </td>

                            <td>
                                <div class="money-input-wrapper">
                                    <input
                                        type="text"
                                        inputmode="numeric"
                                        autocomplete="off"
                                        value="${echapperHTML(
                                            ligne.remise
                                        )}"
                                        data-field="remise"
                                        data-index="${index}"
                                    >
                                    <span class="money-input-suffix">FCFA</span>
                                </div>
                            </td>

                            <td>
                                <strong data-subtotal-cell>
                                    ${echapperHTML(
                                        formaterMontantSansDevise(
                                            ligne.sousTotal
                                        )
                                    )}
                                </strong>
                            </td>

                            <td>
                                <button
                                    type="button"
                                    class="product-remove-btn"
                                    data-index="${index}"
                                    title="Supprimer la ligne"
                                    aria-label="Supprimer la ligne"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }
            )
            .join("");
}


function genererOptionsProduits(
    idSelectionne
) {

    const options = [
        '<option value="">Sélectionner un produit</option>'
    ];

    produitsCharges.forEach(
        function (produit) {

            const id =
                produit.idProduit ||
                produit["ID Produit"] ||
                "";

            const nom =
                produit.nomProduit ||
                produit["Désignation"] ||
                produit.designation ||
                produit.nom ||
                id ||
                "Produit";

            const selected =
                String(id) ===
                String(idSelectionne || "")
                    ? " selected"
                    : "";

            options.push(
                `<option value="${echapperHTML(id)}"${selected}>
                    ${echapperHTML(nom)}
                </option>`
            );
        }
    );

    return options.join("");
}


function genererOptionsEtatReception(
    etatSelectionne
) {

    const etats = [
        "En attente",
        "Partiellement reçu",
        "Reçu",
        "Refusé"
    ];

    return etats.map(
        function (etat) {

            const selected =
                normaliserValeurRecherche(etat) ===
                normaliserValeurRecherche(
                    etatSelectionne
                )
                    ? " selected"
                    : "";

            return `
                <option value="${echapperHTML(etat)}"${selected}>
                    ${echapperHTML(etat)}
                </option>
            `;
        }
    ).join("");
}


function gererModificationLigneProduit(
    event
) {

    const champ =
        event.target.closest(
            "[data-field][data-index]"
        );

    if (!champ) {
        return;
    }

    const index =
        Number(champ.dataset.index);

    const field =
        champ.dataset.field;

    if (
        !Number.isInteger(index) ||
        !lignesProduitsApprovisionnement[index]
    ) {
        return;
    }

    if (
        [
            "quantiteCommandee",
            "quantiteRecue",
            "prixAchatUnitaire",
            "remise"
        ].includes(field)
    ) {

        lignesProduitsApprovisionnement[index][field] =
            convertirMontantApprovisionnement(
                champ.value
            );

    } else {

        lignesProduitsApprovisionnement[index][field] =
            champ.value;
    }

    recalculerSousTotalLigne(index);
    recalculerTotauxApprovisionnement();

    /* Ne pas reconstruire la ligne pendant la saisie :
       cela préserver le focus et permet de taper plusieurs chiffres. */
    const row =
        champ.closest("tr");

    if (row) {
        const subtotalCell =
            row.querySelector(
                "[data-subtotal-cell]"
            );

        if (subtotalCell) {
            subtotalCell.textContent =
                formaterMontantSansDevise(
                    lignesProduitsApprovisionnement[index]
                        .sousTotal
                );
        }
    }
}


function recalculerSousTotalLigne(
    index
) {

    const ligne =
        lignesProduitsApprovisionnement[index];

    if (!ligne) {
        return;
    }

    const quantite =
        convertirMontantApprovisionnement(
            ligne.quantiteCommandee
        );

    const prix =
        convertirMontantApprovisionnement(
            ligne.prixAchatUnitaire
        );

    const remise =
        convertirMontantApprovisionnement(
            ligne.remise
        );

    ligne.sousTotal =
        Math.max(
            0,
            (quantite * prix) - remise
        );
}


function recalculerTotauxApprovisionnement() {

    lignesProduitsApprovisionnement.forEach(
        function (_, index) {

            recalculerSousTotalLigne(index);
        }
    );

    const montantTotal =
        lignesProduitsApprovisionnement.reduce(
            function (total, ligne) {

                return total +
                    convertirMontantApprovisionnement(
                        ligne.sousTotal
                    );
            },
            0
        );

    const fraisTransport =
        convertirMontantApprovisionnement(
            document
                .getElementById(
                    "approvisionnement-frais-transport"
                )
                ?.value
        );

    const fraisDivers =
        convertirMontantApprovisionnement(
            document
                .getElementById(
                    "approvisionnement-frais-divers"
                )
                ?.value
        );

    const montantGlobal =
        montantTotal +
        fraisTransport +
        fraisDivers;

    definirValeurChamp(
        "approvisionnement-montant-total",
        arrondirMontantApprovisionnement(
            montantTotal
        )
    );

    definirValeurChamp(
        "approvisionnement-montant-global",
        arrondirMontantApprovisionnement(
            montantGlobal
        )
    );
}




function estPaiementTotalApprovisionnement(montantPaye, montantAttendu) {
    const paye = arrondirMontantApprovisionnement(montantPaye);
    const attendu = arrondirMontantApprovisionnement(montantAttendu);

    return paye > 0 && paye >= attendu;
}


/* ==========================================================
   RÉPARTITION DES DÉCAISSEMENTS APPROVISIONNEMENT
========================================================== */

function normaliserBeneficiaireApprovisionnement(valeur) {
    return String(valeur || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}


function calculerObligationsBeneficiairesApprovisionnement(
    approvisionnement,
    valeurs = {}
) {
    const montantTotal =
        convertirMontantApprovisionnement(
            valeurs.montantTotal ??
            approvisionnement?.montantTotal
        );

    const fraisTransport =
        convertirMontantApprovisionnement(
            valeurs.fraisTransport ??
            approvisionnement?.fraisTransport
        );

    const fraisDivers =
        convertirMontantApprovisionnement(
            valeurs.fraisDivers ??
            approvisionnement?.fraisDivers
        );

    const transportGerePar =
        normaliserBeneficiaireApprovisionnement(
            valeurs.transportGerePar ??
            approvisionnement?.transportGerePar
        );

    const fraisDiversPayeA =
        normaliserBeneficiaireApprovisionnement(
            valeurs.fraisDiversPayeA ??
            approvisionnement?.fraisDiversPayeA
        );

    const obligations = {
        Fournisseur: montantTotal,
        Transitaire: 0,
        Douane: 0,
        Autre: 0
    };

    if (fraisTransport > 0) {
        if (transportGerePar === "fournisseur") {
            obligations.Fournisseur += fraisTransport;
        } else if (transportGerePar === "transitaire") {
            obligations.Transitaire += fraisTransport;
        } else {
            obligations.Autre += fraisTransport;
        }
    }

    if (fraisDivers > 0) {
        if (fraisDiversPayeA === "fournisseur") {
            obligations.Fournisseur += fraisDivers;
        } else if (fraisDiversPayeA === "transitaire") {
            obligations.Transitaire += fraisDivers;
        } else if (fraisDiversPayeA === "douane") {
            obligations.Douane += fraisDivers;
        } else {
            obligations.Autre += fraisDivers;
        }
    }

    return obligations;
}


function reinitialiserChampsRepartition(prefixe) {
    [
        "fournisseur",
        "transitaire",
        "douane",
        "autre"
    ].forEach(function (cle) {
        definirValeurChamp(
            `${prefixe}-allocation-${cle}`,
            0
        );
    });

    definirTexteApprovisionnement(
        `${prefixe}-allocation-total`,
        "0 FCFA"
    );
}


function lireRepartitionManuelle(prefixe) {
    const correspondances = [
        ["Fournisseur", "fournisseur"],
        ["Transitaire", "transitaire"],
        ["Douane", "douane"],
        ["Autre", "autre"]
    ];

    return correspondances
        .map(function ([beneficiaire, cle]) {
            return {
                beneficiaire,
                montant:
                    Math.max(
                        0,
                        convertirMontantApprovisionnement(
                            valeurChamp(
                                `${prefixe}-allocation-${cle}`
                            )
                        )
                    )
            };
        })
        .filter(function (item) {
            return item.montant > 0.000001;
        });
}


function sommeRepartitionManuelle(prefixe) {
    return lireRepartitionManuelle(prefixe)
        .reduce(
            function (total, item) {
                return total + item.montant;
            },
            0
        );
}


function mettreAJourTotalRepartition(prefixe) {
    definirTexteApprovisionnement(
        `${prefixe}-allocation-total`,
        formaterMontantApprovisionnement(
            sommeRepartitionManuelle(prefixe),
            "FCFA"
        )
    );
}


function appliquerVisibiliteBeneficiairesRepartition(
    selecteurLigne,
    obligations
) {
    document
        .querySelectorAll(selecteurLigne)
        .forEach(function (ligne) {
            const beneficiaire =
                ligne.dataset.allocationRow ||
                ligne.dataset.paymentAllocationRow ||
                "";

            const visible =
                convertirMontantApprovisionnement(
                    obligations[beneficiaire]
                ) > 0.000001;

            ligne.hidden = !visible;
        });
}


function mettreAJourRepartitionConfirmation() {
    if (!approvisionnementWorkflowActif) {
        return;
    }

    const montantGlobal =
        convertirMontantApprovisionnement(
            valeurChamp("confirm-order-montant-global")
        );

    const montantPaye =
        Math.max(
            0,
            convertirMontantApprovisionnement(
                valeurChamp("confirm-order-montant-paye")
            )
        );

    const auto =
        document.getElementById(
            "confirm-order-allocation-auto"
        );

    const manuel =
        document.getElementById(
            "confirm-order-allocation-manual"
        );

    const mode =
        document.getElementById(
            "confirm-order-allocation-mode"
        );

    if (montantPaye <= 0) {
        if (auto) auto.hidden = true;
        if (manuel) manuel.hidden = true;
        if (mode) mode.textContent = "Aucun décaissement";
        reinitialiserChampsRepartition("confirm-order");
        return;
    }

    const estTotal =
        estPaiementTotalApprovisionnement(
            montantPaye,
            montantGlobal
        );

    if (mode) {
        mode.textContent =
            estTotal
                ? "Automatique"
                : "Manuelle";
    }

    if (auto) auto.hidden = !estTotal;
    if (manuel) manuel.hidden = estTotal;

    if (estTotal) {
        reinitialiserChampsRepartition("confirm-order");
        return;
    }

    const obligations =
        calculerObligationsBeneficiairesApprovisionnement(
            approvisionnementWorkflowActif,
            {
                montantTotal:
                    valeurChamp("confirm-order-montant-total"),
                fraisTransport:
                    valeurChamp("confirm-order-frais-transport"),
                transportGerePar:
                    valeurChamp("confirm-order-transport-gestionnaire"),
                fraisDivers:
                    valeurChamp("confirm-order-frais-divers"),
                fraisDiversPayeA:
                    valeurChamp("confirm-order-frais-divers-paye-a")
            }
        );

    appliquerVisibiliteBeneficiairesRepartition(
        "[data-allocation-row]",
        obligations
    );

    mettreAJourTotalRepartition("confirm-order");
}


function mettreAJourRepartitionPaiement() {
    if (!approvisionnementWorkflowActif) {
        return;
    }

    const global =
        convertirMontantApprovisionnement(
            approvisionnementWorkflowActif.montantGlobal
        );

    const dejaPaye =
        convertirMontantApprovisionnement(
            approvisionnementWorkflowActif.montantPaye
        );

    const reste =
        Math.max(
            0,
            global - dejaPaye
        );

    const nouveau =
        Math.max(
            0,
            convertirMontantApprovisionnement(
                valeurChamp("payment-nouveau-montant")
            )
        );

    const auto =
        document.getElementById(
            "payment-allocation-auto"
        );

    const manuel =
        document.getElementById(
            "payment-allocation-manual"
        );

    const mode =
        document.getElementById(
            "payment-allocation-mode"
        );

    if (nouveau <= 0) {
        if (auto) auto.hidden = true;
        if (manuel) manuel.hidden = true;
        if (mode) mode.textContent = "Aucun décaissement";
        reinitialiserChampsRepartition("payment");
        return;
    }

    const paieToutLeReste =
        estPaiementTotalApprovisionnement(
            nouveau,
            reste
        );

    if (mode) {
        mode.textContent =
            paieToutLeReste
                ? "Automatique"
                : "Manuelle";
    }

    if (auto) auto.hidden = !paieToutLeReste;
    if (manuel) manuel.hidden = paieToutLeReste;

    if (paieToutLeReste) {
        reinitialiserChampsRepartition("payment");
        return;
    }

    const obligations =
        calculerObligationsBeneficiairesApprovisionnement(
            approvisionnementWorkflowActif
        );

    appliquerVisibiliteBeneficiairesRepartition(
        "[data-payment-allocation-row]",
        obligations
    );

    mettreAJourTotalRepartition("payment");
}


function preparerRepartitionPaiementFrontend(
    prefixe,
    montant,
    automatique
) {
    if (montant <= 0.000001) {
        return {
            modeRepartitionPaiement: "aucun",
            repartitionPaiement: []
        };
    }

    /*
     * Sécurise la détection du paiement total ici même.
     * Ainsi, une confirmation payée intégralement ne peut pas
     * être envoyée par erreur vers la répartition manuelle.
     */
    let estAutomatique = automatique === true;

    if (prefixe === "confirm-order") {
        const montantTotal =
            convertirMontantApprovisionnement(
                valeurChamp("confirm-order-montant-total")
            );

        const fraisTransport =
            convertirMontantApprovisionnement(
                valeurChamp("confirm-order-frais-transport")
            );

        const fraisDivers =
            convertirMontantApprovisionnement(
                valeurChamp("confirm-order-frais-divers")
            );

        const montantGlobal =
            montantTotal + fraisTransport + fraisDivers;

        estAutomatique =
            estAutomatique ||
            estPaiementTotalApprovisionnement(
                montant,
                montantGlobal
            );
    }

    if (prefixe === "payment" && approvisionnementWorkflowActif) {
        const global =
            convertirMontantApprovisionnement(
                approvisionnementWorkflowActif.montantGlobal
            );

        const dejaPaye =
            convertirMontantApprovisionnement(
                approvisionnementWorkflowActif.montantPaye
            );

        const reste = Math.max(0, global - dejaPaye);

        estAutomatique =
            estAutomatique ||
            estPaiementTotalApprovisionnement(
                montant,
                reste
            );
    }

    if (estAutomatique) {
        let repartitionAutomatique = [];

        /*
         * À la confirmation, toutes les obligations sont connues
         * dans la fenêtre : on peut donc envoyer le détail complet.
         * Pour un paiement ultérieur, le backend conserve la logique
         * de calcul du reste par bénéficiaire à partir de la Caisse.
         */
        if (prefixe === "confirm-order") {
            const obligations =
                calculerObligationsBeneficiairesApprovisionnement(
                    approvisionnementWorkflowActif,
                    {
                        montantTotal:
                            valeurChamp("confirm-order-montant-total"),
                        fraisTransport:
                            valeurChamp("confirm-order-frais-transport"),
                        transportGerePar:
                            valeurChamp("confirm-order-transport-gestionnaire"),
                        fraisDivers:
                            valeurChamp("confirm-order-frais-divers"),
                        fraisDiversPayeA:
                            valeurChamp("confirm-order-frais-divers-paye-a")
                    }
                );

            repartitionAutomatique =
                Object.entries(obligations)
                    .map(function ([beneficiaire, valeur]) {
                        return {
                            beneficiaire,
                            montant:
                                arrondirMontantApprovisionnement(valeur)
                        };
                    })
                    .filter(function (item) {
                        return item.montant > 0.000001;
                    });
        }

        return {
            modeRepartitionPaiement: "auto",
            repartitionPaiement: repartitionAutomatique
        };
    }

    const repartition =
        lireRepartitionManuelle(prefixe);

    const total =
        repartition.reduce(
            function (somme, item) {
                return somme + item.montant;
            },
            0
        );

    if (
        Math.abs(total - montant) >
        0.000001
    ) {
        showToast(
            "La somme de la répartition doit être exactement égale au montant payé.",
            "error"
        );
        return null;
    }

    return {
        modeRepartitionPaiement: "manuel",
        repartitionPaiement:
            repartition
    };
}


/* ==========================================================
   ATTRIBUTION DES FRAIS
========================================================== */
function synchroniserAttributionFraisApprovisionnement() {
    const fraisTransport=convertirMontantApprovisionnement(valeurChamp("approvisionnement-frais-transport"));
    const fraisDivers=convertirMontantApprovisionnement(valeurChamp("approvisionnement-frais-divers"));
    const transport=document.getElementById("approvisionnement-transport-gestionnaire");
    const divers=document.getElementById("approvisionnement-frais-divers-paye-a");
    if(transport){transport.required=fraisTransport>0;if(fraisTransport<=0)transport.value="";}
    if(divers){divers.required=fraisDivers>0;if(fraisDivers<=0)divers.value="";}
    const rt=document.getElementById("transport-gestionnaire-required");
    const rd=document.getElementById("frais-divers-paye-a-required");
    if(rt)rt.hidden=fraisTransport<=0;
    if(rd)rd.hidden=fraisDivers<=0;
}
function validerAttributionFraisApprovisionnement(){
    synchroniserAttributionFraisApprovisionnement();
    const ft=convertirMontantApprovisionnement(valeurChamp("approvisionnement-frais-transport"));
    const fd=convertirMontantApprovisionnement(valeurChamp("approvisionnement-frais-divers"));
    const tg=valeurChamp("approvisionnement-transport-gestionnaire");
    const pa=valeurChamp("approvisionnement-frais-divers-paye-a");
    const tr=valeurChamp("approvisionnement-transitaire");
    if(ft>0&&!tg){showToast("Sélectionnez qui gère le transport.","error");return false;}
    if(fd>0&&!pa){showToast("Sélectionnez à qui les frais divers sont payés.","error");return false;}
    if((tg==="Transitaire"||pa==="Transitaire")&&!tr){showToast("Sélectionnez un transitaire puisque des frais lui sont attribués.","error");return false;}
    return true;
}
function synchroniserAttributionFraisConfirmation(){
    const ft=convertirMontantApprovisionnement(valeurChamp("confirm-order-frais-transport"));
    const fd=convertirMontantApprovisionnement(valeurChamp("confirm-order-frais-divers"));
    const tg=document.getElementById("confirm-order-transport-gestionnaire");
    const pa=document.getElementById("confirm-order-frais-divers-paye-a");
    if(tg){tg.required=ft>0;if(ft<=0)tg.value="";}
    if(pa){pa.required=fd>0;if(fd<=0)pa.value="";}
    const rt=document.getElementById("confirm-order-transport-required");
    const rd=document.getElementById("confirm-order-divers-required");
    if(rt)rt.hidden=ft<=0;
    if(rd)rd.hidden=fd<=0;
}
function validerAttributionFraisConfirmation(a){
    synchroniserAttributionFraisConfirmation();
    const ft=convertirMontantApprovisionnement(valeurChamp("confirm-order-frais-transport"));
    const fd=convertirMontantApprovisionnement(valeurChamp("confirm-order-frais-divers"));
    const tg=valeurChamp("confirm-order-transport-gestionnaire");
    const pa=valeurChamp("confirm-order-frais-divers-paye-a");
    if(ft>0&&!tg){showToast("Sélectionnez qui gère le transport.","error");return false;}
    if(fd>0&&!pa){showToast("Sélectionnez à qui les frais divers sont payés.","error");return false;}
    if((tg==="Transitaire"||pa==="Transitaire")&&!String(a?.idTransitaire||"").trim()){showToast("Aucun transitaire n'est associé à cet approvisionnement. Ajoutez d'abord un transitaire.","error");return false;}
    return true;
}

/* ==========================================================
   ENREGISTREMENT
========================================================== */

function initialiserFormulaireApprovisionnement() {
    ["approvisionnement-frais-transport","approvisionnement-frais-divers"].forEach(function(id){
        document.getElementById(id)?.addEventListener("input",synchroniserAttributionFraisApprovisionnement);
    });

    document
        .getElementById("approvisionnement-form")
        ?.addEventListener(
            "submit",
            enregistrerApprovisionnement
        );
}


async function enregistrerApprovisionnement(
    event
) {

    event.preventDefault();

    const saveButton =
        document.getElementById(
            "save-approvisionnement-btn"
        );

    if (saveButton?.disabled) {
        return;
    }

    recalculerTotauxApprovisionnement();

    const lignesValides =
        lignesProduitsApprovisionnement.filter(
            function (ligne) {

                return Boolean(ligne.idProduit);
            }
        );

    if (lignesValides.length === 0) {

        showToast(
            "Ajoutez au moins un produit à l’approvisionnement.",
            "error"
        );

        return;
    }

    if (!validerAttributionFraisApprovisionnement()) {
        return;
    }

    const data = {
        idFournisseur:
            valeurChamp(
                "approvisionnement-fournisseur"
            ),

        idTransitaire:
            valeurChamp(
                "approvisionnement-transitaire"
            ),

        dateAchat:
            valeurChamp(
                "approvisionnement-date-achat"
            ),

        heureAchat:
            valeurChamp(
                "approvisionnement-heure-achat"
            ),

        dateReceptionPrevue:
            valeurChamp(
                "approvisionnement-date-reception-prevue"
            ),

        dateReceptionReelle: "",

        statut: approvisionnementEnModificationId ? valeurChamp("approvisionnement-status") : "Brouillon",

        montantTotal:
            convertirMontantApprovisionnement(
                valeurChamp(
                    "approvisionnement-montant-total"
                )
            ),

        fraisTransport:
            convertirMontantApprovisionnement(
                valeurChamp(
                    "approvisionnement-frais-transport"
                )
            ),

        transportGerePar:
            valeurChamp("approvisionnement-transport-gestionnaire"),

        fraisDivers:
            convertirMontantApprovisionnement(
                valeurChamp(
                    "approvisionnement-frais-divers"
                )
            ),

        fraisDiversPayeA:
            valeurChamp("approvisionnement-frais-divers-paye-a"),

        montantGlobal:
            convertirMontantApprovisionnement(
                valeurChamp(
                    "approvisionnement-montant-global"
                )
            ),

        modePaiement:
            valeurChamp(
                "approvisionnement-payment-method"
            ),

        deviseAchat:
            valeurChamp(
                "approvisionnement-currency"
            ),

        commentaire:
            valeurChamp(
                "approvisionnement-comment"
            ).trim(),

        details:
            lignesValides.map(
                function (ligne, index) {

                    return {
                        idDetailApprovisionnement:
                            ligne.idDetailApprovisionnement || "",

                        numeroLigne:
                            index + 1,

                        idProduit:
                            ligne.idProduit,

                        quantiteCommandee:
                            convertirMontantApprovisionnement(
                                ligne.quantiteCommandee
                            ),

                        quantiteRecue:
                            convertirMontantApprovisionnement(
                                ligne.quantiteRecue
                            ),

                        prixAchatUnitaire:
                            convertirMontantApprovisionnement(
                                ligne.prixAchatUnitaire
                            ),

                        remise:
                            convertirMontantApprovisionnement(
                                ligne.remise
                            ),

                        sousTotal:
                            convertirMontantApprovisionnement(
                                ligne.sousTotal
                            ),

                        etatReception:
                            ligne.etatReception ||
                            "En attente",

                        commentaire:
                            ligne.commentaire || ""
                    };
                }
            )
    };

    if (!data.idFournisseur) {

        showToast(
            "Sélectionnez un fournisseur.",
            "error"
        );

        return;
    }

    if (
        !data.dateAchat ||
        !data.heureAchat ||
        !data.statut
    ) {

        showToast(
            "Renseignez tous les champs obligatoires.",
            "error"
        );

        return;
    }

    const estModification =
        Boolean(
            approvisionnementEnModificationId
        );

    try {

        definirEtatChargementBoutonApprovisionnement(
            saveButton,
            true,
            estModification
                ? "Modification..."
                : "Enregistrement..."
        );

        const action =
            estModification
                ? "updateApprovisionnement"
                : "createApprovisionnement";

        if (approvisionnementEnModificationId) {

            data.idApprovisionnement =
                approvisionnementEnModificationId;
        }

        const resultat =
            await apiPost(
                action,
                data
            );

        if (!resultat.success) {

            showToast(
                resultat.message ||
                "Impossible d’enregistrer l’approvisionnement.",
                "error"
            );

            return;
        }

        afficherNotificationApprovisionnement(
            estModification
                ? "Approvisionnement modifié avec succès."
                : "Approvisionnement enregistré avec succès.",
            "success",
            estModification
                ? "Modification réussie"
                : "Enregistrement réussi"
        );

        fermerModalApprovisionnement();
        await chargerApprovisionnements();

    } catch (error) {

        console.error(
            "Erreur enregistrement approvisionnement :",
            error
        );

        showToast(
            "Impossible de communiquer avec le serveur.",
            "error"
        );

    } finally {

        definirEtatChargementBoutonApprovisionnement(
            saveButton,
            false
        );
    }
}


/* ==========================================================
   SUPPRESSION
========================================================== */

async function confirmerSuppressionApprovisionnement() {

    const button =
        document.getElementById(
            "confirm-delete-approvisionnement-btn"
        );

    if (
        !approvisionnementASupprimer ||
        button?.disabled
    ) {
        return;
    }

    try {

        definirEtatChargementBoutonApprovisionnement(
            button,
            true,
            "Suppression..."
        );

        const resultat =
            await apiPost(
                "deleteApprovisionnement",
                {
                    idApprovisionnement:
                        approvisionnementASupprimer
                            .idApprovisionnement
                }
            );

        if (!resultat.success) {

            showToast(
                resultat.message ||
                "Impossible de supprimer l’approvisionnement.",
                "error"
            );

            return;
        }

        afficherNotificationApprovisionnement(
            "Approvisionnement supprimé avec succès.",
            "success",
            "Suppression réussie"
        );

        /*
         * Réactive d'abord le bouton car la fonction de fermeture
         * protège la modale lorsqu'une suppression est en cours.
         */
        definirEtatChargementBoutonApprovisionnement(
            button,
            false
        );

        fermerModalSuppressionApprovisionnement();
        await chargerApprovisionnements();

    } catch (error) {

        console.error(
            "Erreur suppression approvisionnement :",
            error
        );

        showToast(
            "Impossible de communiquer avec le serveur.",
            "error"
        );

    } finally {

        definirEtatChargementBoutonApprovisionnement(
            button,
            false
        );
    }
}


/* ==========================================================
   ACTIONS DU TABLEAU
========================================================== */

function initialiserActionsTableauApprovisionnements() {

    const tbody =
        document.getElementById(
            "approvisionnements-table-body"
        );

    tbody?.addEventListener(
        "click",
        function (event) {

            const actionsTrigger =
                event.target.closest(".row-actions-trigger");

            if (actionsTrigger) {
                event.stopPropagation();

                const wrapper =
                    actionsTrigger.closest(".approvisionnement-row-actions");

                const menu =
                    wrapper?.querySelector(".row-actions-menu");

                document
                    .querySelectorAll(".approvisionnement-row-actions .row-actions-menu")
                    .forEach(function (autreMenu) {
                        if (autreMenu !== menu) autreMenu.hidden = true;
                    });

                document
                    .querySelectorAll(".approvisionnement-row-actions .row-actions-trigger")
                    .forEach(function (autreBouton) {
                        if (autreBouton !== actionsTrigger) {
                            autreBouton.setAttribute("aria-expanded", "false");
                        }
                    });

                if (menu) {

                    const doitOuvrir =
                        menu.hidden;

                    fermerMenusActionsApprovisionnements();

                    if (doitOuvrir) {
                        ouvrirMenuActionsApprovisionnement(
                            actionsTrigger,
                            menu
                        );
                    }
                }

                return;
            }

            const button =
                event.target.closest(".table-action-btn");

            if (!button) {
                return;
            }

            const menuOuvert =
                button.closest(".row-actions-menu");

            if (menuOuvert) {
                fermerMenusActionsApprovisionnements();
            }

            const id =
                button.dataset.approvisionnementId;

            const approvisionnement =
                approvisionnementsCharges.find(
                    function (element) {

                        return String(
                            element.idApprovisionnement
                        ) === String(id);
                    }
                );

            if (!approvisionnement) {

                showToast(
                    "Impossible de retrouver cet approvisionnement.",
                    "error"
                );

                return;
            }

            if (
                button.classList.contains("view-btn")
            ) {

                afficherDetailsApprovisionnement(
                    approvisionnement
                );

                ouvrirModalVoirApprovisionnement();
                return;
            }

            if (
                button.classList.contains("workflow-btn")
            ) {
                ouvrirEtapeWorkflowApprovisionnement(
                    approvisionnement
                );
                return;
            }

            if (
                button.classList.contains("payment-btn")
            ) {
                ouvrirPaiementApprovisionnement(
                    approvisionnement
                );
                return;
            }

            if (
                button.classList.contains("edit-btn")
            ) {

                remplirFormulaireApprovisionnement(
                    approvisionnement
                );

                return;
            }

            if (
                button.classList.contains("delete-btn")
            ) {

                ouvrirModalSuppressionApprovisionnement(
                    approvisionnement
                );
            }

            if (
                button.classList.contains("cancel-btn")
            ) {
                ouvrirModalAnnulationApprovisionnement(
                    approvisionnement
                );
            }
        }
    );
}


function fermerMenusActionsApprovisionnements() {

    document
        .querySelectorAll(
            ".approvisionnement-row-actions .row-actions-menu"
        )
        .forEach(function (menu) {

            menu.hidden = true;

            menu.classList.remove(
                "is-open",
                "opens-upward"
            );

            menu.style.removeProperty("top");
            menu.style.removeProperty("left");
            menu.style.removeProperty("right");
            menu.style.removeProperty("bottom");
            menu.style.removeProperty("width");
            menu.style.removeProperty("max-height");
        });


    document
        .querySelectorAll(
            ".approvisionnement-row-actions .row-actions-trigger"
        )
        .forEach(function (bouton) {

            bouton.setAttribute(
                "aria-expanded",
                "false"
            );
        });
}


function ouvrirMenuActionsApprovisionnement(
    bouton,
    menu
) {

    if (!bouton || !menu) {
        return;
    }


    menu.hidden = false;

    menu.classList.add(
        "is-open"
    );

    bouton.setAttribute(
        "aria-expanded",
        "true"
    );


    /*
     * Sur téléphone le menu devient une petite feuille d'actions
     * ancrée en bas de l'écran : aucune nécessité de faire défiler
     * le tableau pour voir les boutons.
     */
    if (
        window.matchMedia(
            "(max-width: 600px)"
        ).matches
    ) {

        menu.style.removeProperty("top");
        menu.style.removeProperty("left");
        menu.style.removeProperty("right");
        menu.style.removeProperty("width");
        menu.style.removeProperty("max-height");

        return;
    }


    /*
     * Sur ordinateur / tablette :
     * le menu est en position fixed afin de ne jamais être coupé
     * par le conteneur scrollable du tableau.
     */
    const rect =
        bouton.getBoundingClientRect();

    const marge =
        10;

    const largeurMenu =
        Math.min(
            230,
            Math.max(
                190,
                window.innerWidth - 2 * marge
            )
        );


    menu.style.width =
        `${largeurMenu}px`;

    /*
     * Il faut d'abord rendre le menu visible pour mesurer
     * correctement sa hauteur.
     */
    const hauteurMenu =
        Math.min(
            menu.scrollHeight,
            Math.max(
                150,
                window.innerHeight - 2 * marge
            )
        );


    const espaceBas =
        window.innerHeight -
        rect.bottom -
        marge;

    const espaceHaut =
        rect.top -
        marge;

    const ouvrirVersHaut =
        espaceBas < hauteurMenu &&
        espaceHaut > espaceBas;


    let top;

    if (ouvrirVersHaut) {

        top =
            Math.max(
                marge,
                rect.top -
                hauteurMenu -
                8
            );

        menu.classList.add(
            "opens-upward"
        );

    } else {

        top =
            Math.min(
                window.innerHeight -
                hauteurMenu -
                marge,
                rect.bottom +
                8
            );

        menu.classList.remove(
            "opens-upward"
        );
    }


    const left =
        Math.min(
            window.innerWidth -
            largeurMenu -
            marge,
            Math.max(
                marge,
                rect.right -
                largeurMenu
            )
        );


    menu.style.top =
        `${Math.max(marge, top)}px`;

    menu.style.left =
        `${left}px`;

    menu.style.right =
        "auto";

    menu.style.bottom =
        "auto";

    menu.style.maxHeight =
        `${Math.max(
            140,
            window.innerHeight -
            2 * marge
        )}px`;
}


document.addEventListener(
    "click",
    function (event) {

        if (
            event.target.closest(
                ".approvisionnement-row-actions"
            )
        ) {
            return;
        }

        fermerMenusActionsApprovisionnements();
    }
);


/*
 * Si l'utilisateur fait défiler la page ou redimensionne la fenêtre,
 * on ferme le menu plutôt que de le laisser flotter au mauvais endroit.
 */
window.addEventListener(
    "resize",
    fermerMenusActionsApprovisionnements
);

window.addEventListener(
    "scroll",
    fermerMenusActionsApprovisionnements,
    true
);




/* ==========================================================
   SUIVI DU CYCLE D'APPROVISIONNEMENT
   Brouillon → Commandé → En transit → Partiellement reçu → Reçu
   Annulé reste une sortie de cycle conservée dans l'historique.
========================================================== */

const workflowApprovisionnement = {
    "brouillon": {
        suivant: "commande",
        libelle: "Confirmer la commande",
        statutCible: "Commandé",
        type: "commande"
    },
    "commande": {
        suivant: "en-transit",
        libelle: "Confirmer le transit",
        statutCible: "En transit",
        type: "transit"
    },
    "en-transit": {
        suivant: "reception",
        libelle: "Enregistrer une réception",
        statutCible: "Partiellement reçu",
        type: "reception"
    },
    "partiellement-recu": {
        suivant: "reception",
        libelle: "Enregistrer une réception",
        statutCible: "Partiellement reçu",
        type: "reception"
    }
};

let approvisionnementWorkflowActif = null;
let typeWorkflowApprovisionnementActif = "";


function obtenirEtapeSuivanteApprovisionnement(
    approvisionnement
) {
    return workflowApprovisionnement[
        normaliserStatutApprovisionnement(
            approvisionnement?.statut
        )
    ] || null;
}


function construirePayloadChangementStatutApprovisionnement(
    approvisionnement,
    nouveauStatut,
    complements = {}
) {
    const details =
        Array.isArray(
            approvisionnement.details
        )
            ? approvisionnement.details
            : Array.isArray(
                approvisionnement.lignes
            )
                ? approvisionnement.lignes
                : [];

    return {
        idApprovisionnement:
            approvisionnement.idApprovisionnement,

        idFournisseur:
            approvisionnement.idFournisseur || "",

        idTransitaire:
            approvisionnement.idTransitaire || "",

        dateAchat:
            approvisionnement.dateAchat || "",

        heureAchat:
            approvisionnement.heureAchat || "",

        dateReceptionPrevue:
            approvisionnement.dateReceptionPrevue || "",

        dateReceptionReelle:
            complements.dateReceptionReelle ??
            approvisionnement.dateReceptionReelle ??
            "",

        /*
         * Nouveau champ envoyé au backend.
         * S'il n'existe pas encore dans la feuille/API, le backend devra
         * être étendu pour le persister.
         */
        heureReceptionReelle:
            complements.heureReceptionReelle ??
            approvisionnement.heureReceptionReelle ??
            "",

        statut:
            nouveauStatut,

        montantTotal:
            complements.montantTotal ??
            approvisionnement.montantTotal ??
            0,

        fraisTransport:
            complements.fraisTransport ??
            approvisionnement.fraisTransport ??
            0,

        transportGerePar:
            complements.transportGerePar ??
            approvisionnement.transportGerePar ??
            "",

        fraisDivers:
            complements.fraisDivers ??
            approvisionnement.fraisDivers ??
            0,

        fraisDiversPayeA:
            complements.fraisDiversPayeA ??
            approvisionnement.fraisDiversPayeA ??
            "",

        montantGlobal:
            complements.montantGlobal ??
            approvisionnement.montantGlobal ??
            0,

        montantPaye:
            complements.montantPaye ??
            approvisionnement.montantPaye ??
            0,

        resteAPayer:
            complements.resteAPayer ??
            approvisionnement.resteAPayer ??
            0,

        statutPaiement:
            complements.statutPaiement ??
            approvisionnement.statutPaiement ??
            "Non payé",

        modePaiement:
            complements.modePaiement ??
            approvisionnement.modePaiement ??
            "",

        deviseAchat:
            complements.deviseAchat ??
            approvisionnement.deviseAchat ??
            "",

        compteCaisse:
            complements.compteCaisse ??
            "",

        modeRepartitionPaiement:
            complements.modeRepartitionPaiement ??
            "",

        repartitionPaiement:
            Array.isArray(complements.repartitionPaiement)
                ? complements.repartitionPaiement
                : [],

        commentaire:
            approvisionnement.commentaire || "",

        details
    };
}


function fermerModaleWorkflowApprovisionnement(
    idModal
) {
    const modal =
        document.getElementById(
            idModal
        );

    modal?.classList.remove(
        "active"
    );

    modal?.setAttribute(
        "aria-hidden",
        "true"
    );
}


function ouvrirEtapeWorkflowApprovisionnement(
    approvisionnement
) {
    const etape =
        obtenirEtapeSuivanteApprovisionnement(
            approvisionnement
        );

    if (!etape) {
        return;
    }

    approvisionnementWorkflowActif =
        approvisionnement;

    typeWorkflowApprovisionnementActif =
        etape.type;

    if (etape.type === "commande") {
        ouvrirValidationCommandeApprovisionnement(
            approvisionnement
        );
        return;
    }

    if (etape.type === "transit") {
        ouvrirValidationTransitApprovisionnement(
            approvisionnement
        );
        return;
    }

    ouvrirValidationReceptionApprovisionnement(
        approvisionnement,
        etape
    );
}


function calculerStatutPaiementApprovisionnement(
    montantGlobal,
    montantPaye
) {
    const global =
        Math.max(0, convertirMontantApprovisionnement(montantGlobal));

    const paye =
        Math.max(0, convertirMontantApprovisionnement(montantPaye));

    if (global <= 0 || paye <= 0) {
        return "Non payé";
    }

    if (paye + 0.000001 >= global) {
        return "Payé";
    }

    return "Partiellement payé";
}


function appliquerApercuStatutPaiement(
    element,
    statut
) {
    if (!element) return;

    element.textContent = statut || "Non payé";
    element.classList.remove(
        "payment-status-unpaid",
        "payment-status-partial",
        "payment-status-paid"
    );

    element.classList.add(
        statut === "Payé"
            ? "payment-status-paid"
            : statut === "Partiellement payé"
                ? "payment-status-partial"
                : "payment-status-unpaid"
    );
}


async function chargerComptesCaisseApprovisionnement() {
    try {
        const resultat = await apiGet("getOperationsCaisse");

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger les comptes de caisse."
            );
        }

        soldesCaisseApprovisionnement =
            resultat.soldesParCompte || {};

        comptesCaisseApprovisionnement =
            Object.keys(soldesCaisseApprovisionnement);

        [
            "confirm-order-caisse-account",
            "payment-caisse-account"
        ].forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;

            const valeur = select.value;
            select.innerHTML =
                '<option value="">Sélectionner un compte</option>';

            comptesCaisseApprovisionnement.forEach(compte => {
                const option = document.createElement("option");
                option.value = compte;
                option.textContent =
                    compte + " — " +
                    formaterMontantApprovisionnement(
                        soldesCaisseApprovisionnement[compte],
                        "FCFA"
                    );
                select.appendChild(option);
            });

            if (
                valeur &&
                comptesCaisseApprovisionnement.includes(valeur)
            ) {
                select.value = valeur;
            }
        });

        mettreAJourSoldeCompteCaisseApprovisionnement(
            "confirm-order"
        );
        mettreAJourSoldeCompteCaisseApprovisionnement(
            "payment"
        );

    } catch (error) {
        console.error(
            "Erreur chargement comptes caisse :",
            error
        );

        showToast(
            error?.message ||
            "Impossible de charger les comptes de caisse.",
            "error"
        );
    }
}


function mettreAJourSoldeCompteCaisseApprovisionnement(contexte) {
    const estConfirmation = contexte === "confirm-order";

    const selectId = estConfirmation
        ? "confirm-order-caisse-account"
        : "payment-caisse-account";

    const aideId = estConfirmation
        ? "confirm-order-caisse-balance"
        : "payment-caisse-balance";

    const montantId = estConfirmation
        ? "confirm-order-montant-paye"
        : "payment-nouveau-montant";

    const select = document.getElementById(selectId);
    const aide = document.getElementById(aideId);

    if (!select || !aide) return;

    const montant =
        Math.max(
            0,
            convertirMontantApprovisionnement(
                valeurChamp(montantId)
            )
        );

    if (estConfirmation) {
        select.required = montant > 0;
    }

    const compte = String(select.value || "").trim();

    aide.classList.remove(
        "is-ok",
        "is-insufficient",
        "is-neutral"
    );

    if (montant <= 0 && estConfirmation) {
        aide.textContent =
            "Aucun débit de caisse : montant payé maintenant = 0 FCFA.";
        aide.classList.add("is-neutral");
        return;
    }

    if (!compte) {
        aide.textContent =
            "Sélectionnez le compte de caisse à débiter.";
        aide.classList.add("is-neutral");
        return;
    }

    const solde =
        convertirMontantApprovisionnement(
            soldesCaisseApprovisionnement[compte]
        );

    aide.textContent =
        "Solde disponible : " +
        formaterMontantApprovisionnement(solde, "FCFA");

    aide.classList.add(
        montant > solde + 0.000001
            ? "is-insufficient"
            : "is-ok"
    );
}


function verifierSoldeCaisseApprovisionnement(
    compte,
    montant
) {
    if (!(montant > 0)) return true;

    if (!compte) {
        showToast(
            "Sélectionnez le compte de caisse à débiter.",
            "error"
        );
        return false;
    }

    const solde =
        convertirMontantApprovisionnement(
            soldesCaisseApprovisionnement[compte]
        );

    if (montant > solde + 0.000001) {
        showToast(
            "Solde insuffisant sur le compte « " +
            compte +
            " ». Disponible : " +
            formaterMontantApprovisionnement(solde, "FCFA") +
            ".",
            "error"
        );
        return false;
    }

    return true;
}


function recalculerPaiementValidationCommande() {
    const global =
        convertirMontantApprovisionnement(
            valeurChamp("confirm-order-montant-global")
        );

    const paye =
        Math.max(
            0,
            convertirMontantApprovisionnement(
                valeurChamp("confirm-order-montant-paye")
            )
        );

    definirValeurChamp(
        "confirm-order-reste-a-payer",
        Math.max(0, global - paye)
    );

    appliquerApercuStatutPaiement(
        document.getElementById("confirm-order-payment-status"),
        calculerStatutPaiementApprovisionnement(global, paye)
    );

    mettreAJourSoldeCompteCaisseApprovisionnement(
        "confirm-order"
    );

    mettreAJourRepartitionConfirmation();
}


function ouvrirValidationCommandeApprovisionnement(
    approvisionnement
) {
    const modal =
        document.getElementById(
            "confirm-order-approvisionnement-modal"
        );

    definirTexteApprovisionnement(
        "confirm-order-approvisionnement-id",
        approvisionnement.idApprovisionnement || "—"
    );

    const montantTotal =
        convertirMontantApprovisionnement(
            approvisionnement.montantTotal
        );

    definirValeurChamp(
        "confirm-order-montant-total",
        montantTotal
    );

    definirValeurChamp(
        "confirm-order-frais-transport",
        convertirMontantApprovisionnement(
            approvisionnement.fraisTransport
        )
    );

    definirValeurChamp(
        "confirm-order-frais-divers",
        convertirMontantApprovisionnement(
            approvisionnement.fraisDivers
        )
    );
    definirValeurChamp("confirm-order-transport-gestionnaire",approvisionnement.transportGerePar||"");
    definirValeurChamp("confirm-order-frais-divers-paye-a",approvisionnement.fraisDiversPayeA||"");
    synchroniserAttributionFraisConfirmation();

    definirValeurChamp(
        "confirm-order-payment-method",
        approvisionnement.modePaiement || ""
    );

    definirValeurChamp(
        "confirm-order-currency",
        approvisionnement.deviseAchat || ""
    );

    definirValeurChamp(
        "confirm-order-montant-paye",
        convertirMontantApprovisionnement(
            approvisionnement.montantPaye
        )
    );

    definirValeurChamp(
        "confirm-order-caisse-account",
        ""
    );

    chargerComptesCaisseApprovisionnement();

    reinitialiserChampsRepartition("confirm-order");
    recalculerMontantGlobalValidationCommande();
    recalculerPaiementValidationCommande();

    modal?.classList.add("active");
    modal?.setAttribute("aria-hidden", "false");
}


function recalculerMontantGlobalValidationCommande() {
    const total =
        convertirMontantApprovisionnement(
            valeurChamp(
                "confirm-order-montant-total"
            )
        );

    const transport =
        convertirMontantApprovisionnement(
            valeurChamp(
                "confirm-order-frais-transport"
            )
        );

    const divers =
        convertirMontantApprovisionnement(
            valeurChamp(
                "confirm-order-frais-divers"
            )
        );

    definirValeurChamp(
        "confirm-order-montant-global",
        total + transport + divers
    );

    recalculerPaiementValidationCommande();
}


function ouvrirPaiementApprovisionnement(
    approvisionnement
) {
    const global =
        convertirMontantApprovisionnement(
            approvisionnement.montantGlobal
        );

    const dejaPaye =
        convertirMontantApprovisionnement(
            approvisionnement.montantPaye
        );

    const reste =
        Math.max(0, global - dejaPaye);

    definirTexteApprovisionnement(
        "payment-approvisionnement-id",
        approvisionnement.idApprovisionnement || "—"
    );

    definirTexteApprovisionnement(
        "payment-montant-global",
        formaterMontantApprovisionnement(global, "FCFA")
    );

    definirTexteApprovisionnement(
        "payment-montant-deja-paye",
        formaterMontantApprovisionnement(dejaPaye, "FCFA")
    );

    definirTexteApprovisionnement(
        "payment-reste-actuel",
        formaterMontantApprovisionnement(reste, "FCFA")
    );

    definirValeurChamp("payment-nouveau-montant", "");
    definirValeurChamp("payment-caisse-account", "");
    reinitialiserChampsRepartition("payment");

    chargerComptesCaisseApprovisionnement();

    appliquerApercuStatutPaiement(
        document.getElementById("payment-status-apres"),
        calculerStatutPaiementApprovisionnement(global, dejaPaye)
    );

    approvisionnementWorkflowActif = approvisionnement;

    const modal =
        document.getElementById("payment-approvisionnement-modal");

    modal?.classList.add("active");
    modal?.setAttribute("aria-hidden", "false");
}


function recalculerApercuNouveauPaiement() {
    if (!approvisionnementWorkflowActif) return;

    const global =
        convertirMontantApprovisionnement(
            approvisionnementWorkflowActif.montantGlobal
        );

    const dejaPaye =
        convertirMontantApprovisionnement(
            approvisionnementWorkflowActif.montantPaye
        );

    const nouveau =
        Math.max(
            0,
            convertirMontantApprovisionnement(
                valeurChamp("payment-nouveau-montant")
            )
        );

    appliquerApercuStatutPaiement(
        document.getElementById("payment-status-apres"),
        calculerStatutPaiementApprovisionnement(
            global,
            dejaPaye + nouveau
        )
    );

    mettreAJourSoldeCompteCaisseApprovisionnement(
        "payment"
    );

    mettreAJourRepartitionPaiement();
}


async function enregistrerPaiementApprovisionnement(
    event
) {
    event.preventDefault();

    const form = event.currentTarget;
    const bouton =
        document.getElementById(
            "save-payment-approvisionnement-btn"
        );

    if (!approvisionnementWorkflowActif || bouton?.disabled) return;

    synchroniserAttributionFraisConfirmation();
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    if (!validerAttributionFraisConfirmation(approvisionnementWorkflowActif)) {
        return;
    }

    const global =
        convertirMontantApprovisionnement(
            approvisionnementWorkflowActif.montantGlobal
        );

    const dejaPaye =
        Math.max(
            0,
            convertirMontantApprovisionnement(
                approvisionnementWorkflowActif.montantPaye
            )
        );

    const nouveauPaiement =
        Math.max(
            0,
            convertirMontantApprovisionnement(
                valeurChamp("payment-nouveau-montant")
            )
        );

    if (nouveauPaiement <= 0) {
        showToast(
            "Saisissez un paiement supérieur à 0.",
            "error"
        );
        return;
    }

    const montantPaye =
        dejaPaye + nouveauPaiement;

    if (montantPaye > global + 0.000001) {
        showToast(
            "Ce paiement dépasse le reste à payer.",
            "error"
        );
        return;
    }

    const compteCaisse =
        valeurChamp("payment-caisse-account").trim();

    if (
        !verifierSoldeCaisseApprovisionnement(
            compteCaisse,
            nouveauPaiement
        )
    ) {
        return;
    }

    const resteAPayer =
        Math.max(0, global - montantPaye);

    const statutPaiement =
        calculerStatutPaiementApprovisionnement(
            global,
            montantPaye
        );

    const repartitionPaiement =
        preparerRepartitionPaiementFrontend(
            "payment",
            nouveauPaiement,
            estPaiementTotalApprovisionnement(
                nouveauPaiement,
                Math.max(0, global - dejaPaye)
            )
        );

    if (!repartitionPaiement) {
        return;
    }

    try {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            true,
            "Enregistrement..."
        );

        const resultat =
            await apiPost(
                "enregistrerPaiementApprovisionnement",
                {
                    idApprovisionnement:
                        approvisionnementWorkflowActif.idApprovisionnement,
                    montantPaiement:
                        nouveauPaiement,
                    compteCaisse:
                        compteCaisse,
                    modeRepartitionPaiement:
                        repartitionPaiement.modeRepartitionPaiement,
                    repartitionPaiement:
                        repartitionPaiement.repartitionPaiement
                }
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le paiement."
            );
        }

        fermerModaleWorkflowApprovisionnement(
            "payment-approvisionnement-modal"
        );

        const paiementEnregistre =
            resultat.approvisionnement ||
            resultat.data ||
            {};

        const statutPaiementServeur =
            paiementEnregistre.statutPaiement ||
            statutPaiement;

        const resteAPayerServeur =
            paiementEnregistre.resteAPayer !== undefined
                ? paiementEnregistre.resteAPayer
                : resteAPayer;

        afficherNotificationApprovisionnement(
            "Paiement enregistré.",
            "success",
            `${statutPaiementServeur} · Reste : ${formaterMontantApprovisionnement(resteAPayerServeur, "FCFA")}`
        );

        approvisionnementWorkflowActif = null;
        await chargerApprovisionnements();

    } catch (error) {
        showToast(
            error?.message ||
            "Impossible d'enregistrer le paiement.",
            "error"
        );
    } finally {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            false
        );
    }
}


function ouvrirValidationTransitApprovisionnement(
    approvisionnement
) {
    definirTexteApprovisionnement(
        "confirm-transit-approvisionnement-id",
        approvisionnement.idApprovisionnement || "—"
    );

    const modal =
        document.getElementById(
            "confirm-transit-approvisionnement-modal"
        );

    modal?.classList.add("active");
    modal?.setAttribute("aria-hidden", "false");
}


function ouvrirValidationReceptionApprovisionnement(
    approvisionnement,
    etape
) {
    const maintenant =
        new Date();

    const date =
        [
            maintenant.getFullYear(),
            String(
                maintenant.getMonth() + 1
            ).padStart(2, "0"),
            String(
                maintenant.getDate()
            ).padStart(2, "0")
        ].join("-");

    const heure =
        [
            String(
                maintenant.getHours()
            ).padStart(2, "0"),
            String(
                maintenant.getMinutes()
            ).padStart(2, "0")
        ].join(":");

    definirTexteApprovisionnement(
        "confirm-reception-approvisionnement-id",
        approvisionnement.idApprovisionnement || "—"
    );

    definirTexteApprovisionnement(
        "confirm-reception-approvisionnement-title",
        "Enregistrer une réception"
    );

    definirTexteApprovisionnement(
        "confirm-reception-approvisionnement-description",
        "Saisissez les quantités réellement reçues. Le statut sera calculé automatiquement."
    );

    definirValeurChamp(
        "confirm-reception-date",
        date
    );

    definirValeurChamp(
        "confirm-reception-time",
        heure
    );

    rendreProduitsReceptionApprovisionnement(
        approvisionnement
    );

    const modal =
        document.getElementById(
            "confirm-reception-approvisionnement-modal"
        );

    modal?.classList.add("active");
    modal?.setAttribute("aria-hidden", "false");
}


async function enregistrerValidationCommandeApprovisionnement(
    event
) {
    event.preventDefault();

    const form =
        event.currentTarget;

    const bouton =
        document.getElementById(
            "save-confirm-order-approvisionnement-btn"
        );

    if (
        !approvisionnementWorkflowActif ||
        bouton?.disabled
    ) {
        return;
    }

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const montantTotal =
        convertirMontantApprovisionnement(
            valeurChamp(
                "confirm-order-montant-total"
            )
        );

    const fraisTransport =
        convertirMontantApprovisionnement(
            valeurChamp(
                "confirm-order-frais-transport"
            )
        );

    const fraisDivers =
        convertirMontantApprovisionnement(
            valeurChamp(
                "confirm-order-frais-divers"
            )
        );

    const montantGlobal =
        montantTotal +
        fraisTransport +
        fraisDivers;

    const montantPaye =
        Math.max(
            0,
            convertirMontantApprovisionnement(
                valeurChamp("confirm-order-montant-paye")
            )
        );

    if (montantPaye > montantGlobal + 0.000001) {
        showToast(
            "Le montant payé ne peut pas dépasser le montant global.",
            "error"
        );
        return;
    }

    const compteCaisse =
        valeurChamp("confirm-order-caisse-account").trim();

    if (
        !verifierSoldeCaisseApprovisionnement(
            compteCaisse,
            montantPaye
        )
    ) {
        return;
    }

    const resteAPayer =
        Math.max(0, montantGlobal - montantPaye);

    const statutPaiement =
        calculerStatutPaiementApprovisionnement(
            montantGlobal,
            montantPaye
        );

    const repartitionConfirmation =
        preparerRepartitionPaiementFrontend(
            "confirm-order",
            montantPaye,
            estPaiementTotalApprovisionnement(
                montantPaye,
                montantGlobal
            )
        );

    if (!repartitionConfirmation) {
        return;
    }

    try {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            true,
            "Confirmation..."
        );

        const resultat =
            await apiPost(
                "updateApprovisionnement",
                construirePayloadChangementStatutApprovisionnement(
                    approvisionnementWorkflowActif,
                    "Commandé",
                    {
                        montantTotal,
                        fraisTransport,
                        transportGerePar: valeurChamp("confirm-order-transport-gestionnaire"),
                        fraisDivers,
                        fraisDiversPayeA: valeurChamp("confirm-order-frais-divers-paye-a"),
                        montantGlobal,
                        montantPaye,
                        resteAPayer,
                        statutPaiement,
                        modePaiement:
                            valeurChamp(
                                "confirm-order-payment-method"
                            ),
                        deviseAchat:
                            valeurChamp(
                                "confirm-order-currency"
                            ),
                        compteCaisse:
                            compteCaisse,
                        modeRepartitionPaiement:
                            repartitionConfirmation.modeRepartitionPaiement,
                        repartitionPaiement:
                            repartitionConfirmation.repartitionPaiement
                    }
                )
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de confirmer la commande."
            );
        }

        fermerModaleWorkflowApprovisionnement(
            "confirm-order-approvisionnement-modal"
        );

        afficherNotificationApprovisionnement(
            "Commande d’approvisionnement confirmée.",
            "success",
            "Statut : Commandé"
        );

        approvisionnementWorkflowActif = null;
        typeWorkflowApprovisionnementActif = "";

        await chargerApprovisionnements();

    } catch (error) {
        showToast(
            error?.message ||
            "Impossible de confirmer la commande.",
            "error"
        );

    } finally {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            false
        );
    }
}


async function enregistrerValidationTransitApprovisionnement() {
    const bouton =
        document.getElementById(
            "save-confirm-transit-approvisionnement-btn"
        );

    if (
        !approvisionnementWorkflowActif ||
        bouton?.disabled
    ) {
        return;
    }

    try {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            true,
            "Confirmation..."
        );

        const resultat =
            await apiPost(
                "updateApprovisionnement",
                construirePayloadChangementStatutApprovisionnement(
                    approvisionnementWorkflowActif,
                    "En transit"
                )
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de confirmer le transit."
            );
        }

        fermerModaleWorkflowApprovisionnement(
            "confirm-transit-approvisionnement-modal"
        );

        afficherNotificationApprovisionnement(
            "Approvisionnement passé en transit.",
            "success",
            "Statut : En transit"
        );

        approvisionnementWorkflowActif = null;
        typeWorkflowApprovisionnementActif = "";

        await chargerApprovisionnements();

    } catch (error) {
        showToast(
            error?.message ||
            "Impossible de confirmer le transit.",
            "error"
        );

    } finally {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            false
        );
    }
}


function rendreProduitsReceptionApprovisionnement(
    approvisionnement
) {
    const conteneur =
        document.getElementById(
            "confirm-reception-products-list"
        );

    if (!conteneur) {
        return;
    }

    const details =
        Array.isArray(
            approvisionnement?.details
        )
            ? approvisionnement.details
            : [];

    if (!details.length) {
        conteneur.innerHTML = `
            <div class="empty-table">
                Aucun produit dans cet approvisionnement.
            </div>
        `;
        return;
    }

    conteneur.innerHTML =
        details.map(
            (detail, index) => {
                const idProduit =
                    String(
                        detail.idProduit || ""
                    ).trim();

                const produitExiste =
                    produitsCharges.some(
                        produit =>
                            String(
                                produit.idProduit ||
                                produit["ID Produit"] ||
                                ""
                            ).trim() === idProduit
                    );

                const commandee =
                    Math.max(
                        0,
                        Math.trunc(
                            convertirMontantApprovisionnement(
                                detail.quantiteCommandee
                            )
                        )
                    );

                const recue =
                    Math.max(
                        0,
                        Math.trunc(
                            convertirMontantApprovisionnement(
                                detail.quantiteRecue
                            )
                        )
                    );

                const restante =
                    Math.max(
                        0,
                        commandee - recue
                    );

                return `
                    <div class="reception-product-row ${produitExiste ? "" : "reception-product-missing"}">
                        <div class="reception-product-identity">
                            <strong>
                                ${echapperHTML(
                                    produitExiste
                                        ? obtenirNomProduit(idProduit)
                                        : "Produit à rattacher"
                                )}
                            </strong>
                            <small>
                                ${echapperHTML(idProduit || "Aucun ID produit")}
                            </small>
                        </div>

                        <div class="reception-product-stat">
                            <span>Commandé</span>
                            <strong>${commandee}</strong>
                        </div>

                        <div class="reception-product-stat">
                            <span>Déjà reçu</span>
                            <strong>${recue}</strong>
                        </div>

                        <div class="reception-product-stat">
                            <span>Reste</span>
                            <strong>${restante}</strong>
                        </div>

                        <div class="reception-product-action">
                            ${
                                produitExiste
                                    ? `
                                        <input
                                            type="number"
                                            class="reception-product-input"
                                            data-reception-detail-index="${index}"
                                            min="0"
                                            max="${restante}"
                                            step="1"
                                            value="0"
                                            ${restante <= 0 ? "disabled" : ""}
                                            aria-label="Quantité reçue maintenant"
                                        >
                                      `
                                    : `
                                        <button
                                            type="button"
                                            class="reception-create-product-btn"
                                            data-create-product-reception-index="${index}"
                                        >
                                            + Créer la fiche produit
                                        </button>
                                      `
                            }
                        </div>
                    </div>
                `;
            }
        ).join("");
}


function obtenirDetailsReceptionApprovisionnement() {
    const approvisionnement =
        approvisionnementWorkflowActif;

    const details =
        Array.isArray(
            approvisionnement?.details
        )
            ? approvisionnement.details
            : [];

    let totalNouvelleReception = 0;

    const nouveauxDetails =
        details.map(
            (detail, index) => {
                const champ =
                    document.querySelector(
                        `[data-reception-detail-index="${index}"]`
                    );

                const cetteReception =
                    champ
                        ? Math.max(
                            0,
                            Math.trunc(
                                convertirMontantApprovisionnement(
                                    champ.value
                                )
                            )
                        )
                        : 0;

                const commandee =
                    Math.max(
                        0,
                        Math.trunc(
                            convertirMontantApprovisionnement(
                                detail.quantiteCommandee
                            )
                        )
                    );

                const dejaRecue =
                    Math.max(
                        0,
                        Math.trunc(
                            convertirMontantApprovisionnement(
                                detail.quantiteRecue
                            )
                        )
                    );

                if (
                    cetteReception >
                    Math.max(
                        0,
                        commandee - dejaRecue
                    )
                ) {
                    throw new Error(
                        `La quantité reçue dépasse le reste à recevoir pour ${obtenirNomProduit(detail.idProduit)}.`
                    );
                }

                totalNouvelleReception +=
                    cetteReception;

                return {
                    ...detail,
                    quantiteCommandee:
                        commandee,
                    quantiteRecue:
                        dejaRecue +
                        cetteReception,
                    etatReception:
                        dejaRecue + cetteReception >= commandee
                            ? "Reçu"
                            : dejaRecue + cetteReception > 0
                                ? "Partiellement reçu"
                                : "En attente"
                };
            }
        );

    return {
        details: nouveauxDetails,
        totalNouvelleReception
    };
}


document.addEventListener(
    "click",
    event => {
        const bouton =
            event.target.closest(
                "[data-create-product-reception-index]"
            );

        if (!bouton) {
            return;
        }

        const index =
            Number(
                bouton.dataset
                    .createProductReceptionIndex
            );

        ouvrirModaleProduitApprovisionnement({
            contexte: "reception",
            indexDetail: index
        });
    }
);


async function enregistrerValidationReceptionApprovisionnement(
    event
) {
    event.preventDefault();

    const form =
        event.currentTarget;

    const bouton =
        document.getElementById(
            "save-confirm-reception-approvisionnement-btn"
        );

    if (
        !approvisionnementWorkflowActif ||
        bouton?.disabled
    ) {
        return;
    }

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    let reception;

    try {
        reception =
            obtenirDetailsReceptionApprovisionnement();
    } catch (error) {
        showToast(
            error.message,
            "error"
        );
        return;
    }

    if (
        reception.totalNouvelleReception <= 0
    ) {
        showToast(
            "Saisissez au moins une quantité réellement reçue.",
            "error"
        );
        return;
    }

    const produitManquant =
        reception.details.find(
            detail => {
                const id =
                    String(
                        detail.idProduit || ""
                    ).trim();

                return !produitsCharges.some(
                    produit =>
                        String(
                            produit.idProduit ||
                            produit["ID Produit"] ||
                            ""
                        ).trim() === id
                );
            }
        );

    if (produitManquant) {
        showToast(
            "Créez ou rattachez toutes les fiches Produit avant de confirmer la réception.",
            "error"
        );
        return;
    }

    try {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            true,
            "Réception..."
        );

        /*
         * Le backend recalcule lui-même le statut :
         * - au moins une quantité reçue mais pas tout = Partiellement reçu
         * - toutes les quantités reçues = Reçu
         *
         * Il crée aussi les mouvements de stock uniquement pour le delta reçu.
         */
        const payload =
            construirePayloadChangementStatutApprovisionnement(
                approvisionnementWorkflowActif,
                "Partiellement reçu",
                {
                    dateReceptionReelle:
                        valeurChamp(
                            "confirm-reception-date"
                        ),
                    heureReceptionReelle:
                        valeurChamp(
                            "confirm-reception-time"
                        )
                }
            );

        payload.details =
            reception.details;

        const resultat =
            await apiPost(
                "updateApprovisionnement",
                payload
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer la réception."
            );
        }

        fermerModaleWorkflowApprovisionnement(
            "confirm-reception-approvisionnement-modal"
        );

        const statutFinal =
            resultat?.data?.statut ||
            resultat?.approvisionnement?.statut ||
            "Réception enregistrée";

        afficherNotificationApprovisionnement(
            "Réception enregistrée et stock mis à jour.",
            "success",
            `Statut : ${statutFinal}`
        );

        approvisionnementWorkflowActif = null;
        typeWorkflowApprovisionnementActif = "";

        await chargerDonneesApprovisionnements();

    } catch (error) {
        showToast(
            error?.message ||
            "Impossible d'enregistrer la réception.",
            "error"
        );

    } finally {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            false
        );
    }
}


/* ==========================================================
   MODALE PRODUIT RÉUTILISÉE DANS APPROVISIONNEMENT
========================================================== */

const CLOUDINARY_APPROVISIONNEMENT = {
    cloudName: "yqfbfg84",
    uploadPreset: "visibl_upload",
    dossier: "visibl/produits"
};


function initialiserModaleProduitApprovisionnement() {
    const modal =
        document.getElementById(
            "product-modal"
        );

    if (!modal) {
        return;
    }

    document
        .getElementById(
            "close-product-modal"
        )
        ?.addEventListener(
            "click",
            fermerModaleProduitApprovisionnement
        );

    document
        .getElementById(
            "cancel-product-btn"
        )
        ?.addEventListener(
            "click",
            fermerModaleProduitApprovisionnement
        );

    modal.addEventListener(
        "click",
        event => {
            if (event.target === modal) {
                fermerModaleProduitApprovisionnement();
            }
        }
    );

    document
        .getElementById(
            "product-form"
        )
        ?.addEventListener(
            "submit",
            enregistrerProduitDepuisApprovisionnement
        );

    [
        "product-purchase-price",
        "product-transport-cost",
        "product-customs-cost",
        "product-other-costs",
        "product-sale-price"
    ].forEach(
        id =>
            document
                .getElementById(id)
                ?.addEventListener(
                    "input",
                    calculerProduitDepuisApprovisionnement
                )
    );

    const fichier =
        document.getElementById(
            "product-image-file"
        );

    const zone =
        document.getElementById(
            "product-image-drop-zone"
        );

    zone?.addEventListener(
        "click",
        event => {
            if (
                event.target.closest(
                    "#remove-product-image-btn"
                )
            ) {
                return;
            }
            fichier?.click();
        }
    );

    fichier?.addEventListener(
        "change",
        () =>
            previsualiserImageProduitApprovisionnement(
                fichier.files?.[0]
            )
    );

    document
        .getElementById(
            "remove-product-image-btn"
        )
        ?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                reinitialiserImageProduitApprovisionnement();
            }
        );
}


function ouvrirModaleProduitApprovisionnement(
    options = {}
) {
    contexteCreationProduitApprovisionnement =
        options.contexte || "formulaire";

    indexDetailReceptionProduitACreer =
        Number.isInteger(
            options.indexDetail
        )
            ? options.indexDetail
            : null;

    const form =
        document.getElementById(
            "product-form"
        );

    form?.reset();

    imageProduitApprovisionnementURL = "";
    reinitialiserImageProduitApprovisionnement();

    genererReferenceProduitApprovisionnement();

    const fournisseur =
        valeurChamp(
            "approvisionnement-fournisseur"
        );

    remplirFournisseursModaleProduitApprovisionnement(
        fournisseur
    );

    const stockInitial =
        document.getElementById(
            "product-initial-stock"
        );

    if (stockInitial) {
        stockInitial.value = "0";
        stockInitial.readOnly = true;
        stockInitial.title =
            "Le stock sera ajouté automatiquement lors de la réception.";
    }

    const detail =
        Number.isInteger(
            indexDetailReceptionProduitACreer
        )
            ? approvisionnementWorkflowActif
                ?.details?.[
                    indexDetailReceptionProduitACreer
                ]
            : null;

    if (detail) {
        definirValeurChamp(
            "product-purchase-price",
            convertirMontantApprovisionnement(
                detail.prixAchatUnitaire
            )
        );
    }

    calculerProduitDepuisApprovisionnement();

    const modal =
        document.getElementById(
            "product-modal"
        );

    modal?.classList.add("active");
    modal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    setTimeout(
        () =>
            document
                .getElementById(
                    "product-name"
                )
                ?.focus(),
        80
    );
}


function fermerModaleProduitApprovisionnement() {
    const modal =
        document.getElementById(
            "product-modal"
        );

    modal?.classList.remove("active");
    modal?.setAttribute("aria-hidden", "true");

    if (
        !document.querySelector(
            ".modal-overlay.active"
        )
    ) {
        document.body.classList.remove(
            "modal-open"
        );
    }
}


function genererReferenceProduitApprovisionnement() {
    let max = 0;

    produitsCharges.forEach(
        produit => {
            const reference =
                String(
                    produit.referenceProduit ||
                    produit["Référence Produit"] ||
                    produit.reference ||
                    ""
                ).trim();

            const match =
                reference.match(
                    /^PRO(\d+)$/i
                );

            if (match) {
                max =
                    Math.max(
                        max,
                        Number(
                            match[1]
                        ) || 0
                    );
            }
        }
    );

    definirValeurChamp(
        "product-reference",
        "PRO" +
        String(
            max + 1
        ).padStart(6, "0")
    );
}


function remplirFournisseursModaleProduitApprovisionnement(
    selection = ""
) {
    const select =
        document.getElementById(
            "product-main-supplier"
        );

    if (!select) {
        return;
    }

    select.innerHTML =
        '<option value="">Sélectionner un fournisseur</option>';

    fournisseursCharges.forEach(
        fournisseur => {
            const id =
                fournisseur.idFournisseur ||
                fournisseur["ID Fournisseur"] ||
                "";

            const nom =
                fournisseur.nomFournisseur ||
                fournisseur["Nom Fournisseur"] ||
                fournisseur.raisonSociale ||
                id;

            const option =
                document.createElement(
                    "option"
                );

            option.value = id;
            option.textContent = nom;

            select.appendChild(option);
        }
    );

    select.value =
        String(selection || "");
}


function valeurNombreProduitApprovisionnement(id) {
    return convertirMontantApprovisionnement(
        valeurChamp(id)
    );
}


function calculerProduitDepuisApprovisionnement() {
    const achat =
        valeurNombreProduitApprovisionnement(
            "product-purchase-price"
        );

    const transport =
        valeurNombreProduitApprovisionnement(
            "product-transport-cost"
        );

    const douane =
        valeurNombreProduitApprovisionnement(
            "product-customs-cost"
        );

    const autres =
        valeurNombreProduitApprovisionnement(
            "product-other-costs"
        );

    const vente =
        valeurNombreProduitApprovisionnement(
            "product-sale-price"
        );

    const revient =
        achat +
        transport +
        douane +
        autres;

    const marge =
        vente -
        revient;

    definirValeurChamp(
        "product-cost-price",
        revient
    );

    definirValeurChamp(
        "product-margin-amount",
        marge
    );

    definirValeurChamp(
        "product-margin-rate",
        revient > 0
            ? Math.round(
                marge /
                revient *
                10000
              ) / 100
            : 0
    );
}


function previsualiserImageProduitApprovisionnement(
    fichier
) {
    if (!fichier) {
        return;
    }

    const preview =
        document.getElementById(
            "product-image-preview"
        );

    const wrapper =
        document.getElementById(
            "product-image-preview-wrapper"
        );

    const placeholder =
        document.getElementById(
            "product-image-placeholder"
        );

    if (preview) {
        preview.src =
            URL.createObjectURL(
                fichier
            );
    }

    if (wrapper) {
        wrapper.hidden = false;
    }

    if (placeholder) {
        placeholder.hidden = true;
    }

    const nom =
        document.getElementById(
            "product-image-name"
        );

    if (nom) {
        nom.textContent =
            fichier.name;
    }
}


function reinitialiserImageProduitApprovisionnement() {
    imageProduitApprovisionnementURL = "";

    const fichier =
        document.getElementById(
            "product-image-file"
        );

    if (fichier) {
        fichier.value = "";
    }

    const wrapper =
        document.getElementById(
            "product-image-preview-wrapper"
        );

    const placeholder =
        document.getElementById(
            "product-image-placeholder"
        );

    if (wrapper) {
        wrapper.hidden = true;
    }

    if (placeholder) {
        placeholder.hidden = false;
    }
}


async function uploaderImageProduitApprovisionnement() {
    const fichier =
        document
            .getElementById(
                "product-image-file"
            )
            ?.files?.[0];

    if (!fichier) {
        return "";
    }

    const formData =
        new FormData();

    formData.append(
        "file",
        fichier
    );

    formData.append(
        "upload_preset",
        CLOUDINARY_APPROVISIONNEMENT
            .uploadPreset
    );

    formData.append(
        "folder",
        CLOUDINARY_APPROVISIONNEMENT
            .dossier
    );

    const response =
        await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_APPROVISIONNEMENT.cloudName}/image/upload`,
            {
                method: "POST",
                body: formData
            }
        );

    if (!response.ok) {
        throw new Error(
            "Impossible d'envoyer l'image du produit."
        );
    }

    const data =
        await response.json();

    return data.secure_url || "";
}


async function enregistrerProduitDepuisApprovisionnement(
    event
) {
    event.preventDefault();

    const form =
        event.currentTarget;

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const bouton =
        document.getElementById(
            "save-product-btn"
        );

    try {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            true,
            "Enregistrement..."
        );

        imageProduitApprovisionnementURL =
            await uploaderImageProduitApprovisionnement();

        calculerProduitDepuisApprovisionnement();

        const produit = {
            referenceProduit:
                valeurChamp(
                    "product-reference"
                ).trim(),

            reference:
                valeurChamp(
                    "product-reference"
                ).trim(),

            designation:
                valeurChamp(
                    "product-name"
                ).trim(),

            description:
                valeurChamp(
                    "product-description"
                ).trim(),

            prixAchat:
                valeurNombreProduitApprovisionnement(
                    "product-purchase-price"
                ),

            tauxTVA: 0,
            montantTVA: 0,

            fraisTransport:
                valeurNombreProduitApprovisionnement(
                    "product-transport-cost"
                ),

            fraisDouane:
                valeurNombreProduitApprovisionnement(
                    "product-customs-cost"
                ),

            autresFrais:
                valeurNombreProduitApprovisionnement(
                    "product-other-costs"
                ),

            prixRevient:
                valeurNombreProduitApprovisionnement(
                    "product-cost-price"
                ),

            prixVente:
                valeurNombreProduitApprovisionnement(
                    "product-sale-price"
                ),

            prixMinimumVente:
                valeurNombreProduitApprovisionnement(
                    "product-minimum-price"
                ),

            margeFCFA:
                valeurNombreProduitApprovisionnement(
                    "product-margin-amount"
                ),

            tauxMarge:
                valeurNombreProduitApprovisionnement(
                    "product-margin-rate"
                ),

            /*
             * Toujours 0 depuis Approvisionnement :
             * la réception crée ensuite le mouvement d'entrée.
             */
            stockInitial: 0,

            seuilAlerte:
                valeurNombreProduitApprovisionnement(
                    "product-alert-threshold"
                ),

            idFournisseurPrincipal:
                valeurChamp(
                    "product-main-supplier"
                ),

            garantieMois:
                valeurNombreProduitApprovisionnement(
                    "product-warranty"
                ),

            imageURL:
                imageProduitApprovisionnementURL,

            statut:
                valeurChamp(
                    "product-status"
                ) || "Actif",

            commentaire:
                valeurChamp(
                    "product-comment"
                ).trim()
        };

        const resultat =
            await apiPost(
                "createProduit",
                produit
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible de créer le produit."
            );
        }

        const produitCree =
            resultat.data || {};

        produitsCharges = [
            ...produitsCharges,
            produitCree
        ];

        const idProduit =
            produitCree.idProduit ||
            produitCree["ID Produit"] ||
            "";

        if (
            contexteCreationProduitApprovisionnement ===
            "reception" &&
            Number.isInteger(
                indexDetailReceptionProduitACreer
            )
        ) {
            const detail =
                approvisionnementWorkflowActif
                    ?.details?.[
                        indexDetailReceptionProduitACreer
                    ];

            if (detail) {
                detail.idProduit =
                    idProduit;
            }

            rendreProduitsReceptionApprovisionnement(
                approvisionnementWorkflowActif
            );

        } else {
            const ligneVide =
                lignesProduitsApprovisionnement
                    .find(
                        ligne =>
                            !ligne.idProduit
                    );

            if (ligneVide) {
                ligneVide.idProduit =
                    idProduit;
            }

            rendreLignesProduitsApprovisionnement();
        }

        fermerModaleProduitApprovisionnement();

        showToast(
            "Produit créé. Son stock sera alimenté par la réception.",
            "success"
        );

    } catch (error) {
        console.error(
            "Erreur création produit depuis approvisionnement :",
            error
        );

        showToast(
            error?.message ||
            "Impossible de créer le produit.",
            "error"
        );

    } finally {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            false
        );
    }
}




function initialiserWorkflowApprovisionnements() {
    [
        "confirm-order-frais-transport",
        "confirm-order-frais-divers"
    ].forEach(id => {
        document.getElementById(id)?.addEventListener("input",function(){
            recalculerMontantGlobalValidationCommande();
            synchroniserAttributionFraisConfirmation();
        });
    });

    document
        .getElementById("confirm-order-montant-paye")
        ?.addEventListener(
            "input",
            recalculerPaiementValidationCommande
        );

    document
        .getElementById("payment-nouveau-montant")
        ?.addEventListener(
            "input",
            recalculerApercuNouveauPaiement
        );

    [
        "confirm-order-allocation-fournisseur",
        "confirm-order-allocation-transitaire",
        "confirm-order-allocation-douane",
        "confirm-order-allocation-autre"
    ].forEach(function (id) {
        document
            .getElementById(id)
            ?.addEventListener(
                "input",
                function () {
                    mettreAJourTotalRepartition(
                        "confirm-order"
                    );
                }
            );
    });

    [
        "payment-allocation-fournisseur",
        "payment-allocation-transitaire",
        "payment-allocation-douane",
        "payment-allocation-autre"
    ].forEach(function (id) {
        document
            .getElementById(id)
            ?.addEventListener(
                "input",
                function () {
                    mettreAJourTotalRepartition(
                        "payment"
                    );
                }
            );
    });

    document
        .getElementById("confirm-order-caisse-account")
        ?.addEventListener(
            "change",
            () => mettreAJourSoldeCompteCaisseApprovisionnement(
                "confirm-order"
            )
        );

    document
        .getElementById("payment-caisse-account")
        ?.addEventListener(
            "change",
            () => mettreAJourSoldeCompteCaisseApprovisionnement(
                "payment"
            )
        );

    document
        .getElementById("payment-approvisionnement-form")
        ?.addEventListener(
            "submit",
            enregistrerPaiementApprovisionnement
        );

    document
        .getElementById(
            "confirm-order-approvisionnement-form"
        )
        ?.addEventListener(
            "submit",
            enregistrerValidationCommandeApprovisionnement
        );

    document
        .getElementById(
            "save-confirm-transit-approvisionnement-btn"
        )
        ?.addEventListener(
            "click",
            enregistrerValidationTransitApprovisionnement
        );

    document
        .getElementById(
            "confirm-reception-approvisionnement-form"
        )
        ?.addEventListener(
            "submit",
            enregistrerValidationReceptionApprovisionnement
        );

    [
        [
            "close-confirm-order-approvisionnement-btn",
            "confirm-order-approvisionnement-modal"
        ],
        [
            "cancel-confirm-order-approvisionnement-btn",
            "confirm-order-approvisionnement-modal"
        ],
        [
            "close-payment-approvisionnement-btn",
            "payment-approvisionnement-modal"
        ],
        [
            "cancel-payment-approvisionnement-btn",
            "payment-approvisionnement-modal"
        ],
        [
            "cancel-confirm-transit-approvisionnement-btn",
            "confirm-transit-approvisionnement-modal"
        ],
        [
            "close-confirm-reception-approvisionnement-btn",
            "confirm-reception-approvisionnement-modal"
        ],
        [
            "cancel-confirm-reception-approvisionnement-btn",
            "confirm-reception-approvisionnement-modal"
        ]
    ].forEach(([boutonId, modalId]) => {
        document
            .getElementById(
                boutonId
            )
            ?.addEventListener(
                "click",
                () =>
                    fermerModaleWorkflowApprovisionnement(
                        modalId
                    )
            );
    });

    [
        "confirm-order-approvisionnement-modal",
        "payment-approvisionnement-modal",
        "confirm-transit-approvisionnement-modal",
        "confirm-reception-approvisionnement-modal"
    ].forEach(modalId => {
        const modal =
            document.getElementById(
                modalId
            );

        modal?.addEventListener(
            "click",
            event => {
                if (event.target === modal) {
                    fermerModaleWorkflowApprovisionnement(
                        modalId
                    );
                }
            }
        );
    });
}


/* ==========================================================
   SÉLECTION — UNIQUEMENT LES BROUILLONS
========================================================== */

function normaliserStatutApprovisionnement(statut) {
    return String(statut || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


function estBrouillonApprovisionnement(approvisionnement) {
    return normaliserStatutApprovisionnement(
        approvisionnement?.statut
    ) === "brouillon";
}


function initialiserSelectionApprovisionnements() {

    const bouton =
        document.getElementById(
            "selection-approvisionnements-btn"
        );

    const toutSelectionner =
        document.getElementById(
            "select-all-approvisionnements"
        );

    bouton?.addEventListener(
        "click",
        () => {
            definirModeSelectionApprovisionnements(
                !modeSelectionApprovisionnements
            );
        }
    );

    document
        .getElementById(
            "close-approvisionnements-selection-btn"
        )
        ?.addEventListener(
            "click",
            () =>
                definirModeSelectionApprovisionnements(
                    false
                )
        );

    document
        .getElementById(
            "clear-approvisionnements-selection-btn"
        )
        ?.addEventListener(
            "click",
            () => {
                approvisionnementsSelectionnes.clear();
                synchroniserSelectionApprovisionnements();
            }
        );

    document
        .getElementById(
            "select-visible-approvisionnements-btn"
        )
        ?.addEventListener(
            "click",
            () => {
                obtenirBrouillonsVisiblesApprovisionnements()
                    .forEach(item => {
                        approvisionnementsSelectionnes.add(
                            String(
                                item.idApprovisionnement
                            )
                        );
                    });

                synchroniserSelectionApprovisionnements();
            }
        );

    toutSelectionner?.addEventListener(
        "change",
        event => {
            const brouillons =
                obtenirBrouillonsVisiblesApprovisionnements();

            brouillons.forEach(item => {
                const id =
                    String(
                        item.idApprovisionnement
                    );

                if (event.target.checked) {
                    approvisionnementsSelectionnes.add(id);
                } else {
                    approvisionnementsSelectionnes.delete(id);
                }
            });

            synchroniserSelectionApprovisionnements();
        }
    );

    document
        .getElementById(
            "approvisionnements-table-body"
        )
        ?.addEventListener(
            "change",
            event => {
                const checkbox =
                    event.target.closest(
                        ".approvisionnement-row-checkbox"
                    );

                if (!checkbox) {
                    return;
                }

                const id =
                    String(
                        checkbox.dataset
                            .approvisionnementId ||
                        ""
                    );

                if (checkbox.checked) {
                    approvisionnementsSelectionnes.add(id);
                } else {
                    approvisionnementsSelectionnes.delete(id);
                }

                synchroniserSelectionApprovisionnements();
            }
        );

    document
        .getElementById(
            "delete-selected-approvisionnements-btn"
        )
        ?.addEventListener(
            "click",
            supprimerApprovisionnementsSelectionnes
        );

    synchroniserSelectionApprovisionnements();
}


function definirModeSelectionApprovisionnements(actif) {

    modeSelectionApprovisionnements =
        Boolean(actif);

    document.body.classList.toggle(
        "approvisionnements-selection-mode",
        modeSelectionApprovisionnements
    );

    const bouton =
        document.getElementById(
            "selection-approvisionnements-btn"
        );

    bouton?.setAttribute(
        "aria-pressed",
        String(modeSelectionApprovisionnements)
    );

    const barre =
        document.getElementById(
            "approvisionnements-selection-bar"
        );

    if (barre) {
        barre.hidden =
            !modeSelectionApprovisionnements;
    }

    if (!modeSelectionApprovisionnements) {
        approvisionnementsSelectionnes.clear();
    }

    synchroniserSelectionApprovisionnements();
}


function obtenirBrouillonsVisiblesApprovisionnements() {
    return approvisionnementsAffiches.filter(
        estBrouillonApprovisionnement
    );
}


function synchroniserSelectionApprovisionnements() {

    document
        .querySelectorAll(
            ".approvisionnement-row-checkbox"
        )
        .forEach(checkbox => {
            const id =
                String(
                    checkbox.dataset
                        .approvisionnementId ||
                    ""
                );

            checkbox.checked =
                approvisionnementsSelectionnes.has(id);

            checkbox.closest("tr")
                ?.classList.toggle(
                    "is-selected",
                    checkbox.checked
                );
        });

    const count =
        document.getElementById(
            "selected-approvisionnements-count"
        );

    if (count) {
        count.textContent =
            String(
                approvisionnementsSelectionnes.size
            );
    }

    const visibles =
        obtenirBrouillonsVisiblesApprovisionnements();

    const tout =
        document.getElementById(
            "select-all-approvisionnements"
        );

    if (tout) {
        const selectionnesVisibles =
            visibles.filter(item =>
                approvisionnementsSelectionnes.has(
                    String(
                        item.idApprovisionnement
                    )
                )
            ).length;

        tout.checked =
            visibles.length > 0 &&
            selectionnesVisibles === visibles.length;

        tout.indeterminate =
            selectionnesVisibles > 0 &&
            selectionnesVisibles < visibles.length;
    }

    const supprimer =
        document.getElementById(
            "delete-selected-approvisionnements-btn"
        );

    if (supprimer) {
        supprimer.disabled =
            approvisionnementsSelectionnes.size === 0;
    }
}


async function supprimerApprovisionnementsSelectionnes() {

    const ids =
        [...approvisionnementsSelectionnes];

    if (!ids.length) {
        return;
    }

    const valides =
        ids
            .map(id =>
                approvisionnementsCharges.find(
                    item =>
                        String(
                            item.idApprovisionnement
                        ) === String(id)
                )
            )
            .filter(Boolean)
            .filter(estBrouillonApprovisionnement);

    if (!valides.length) {
        showToast(
            "Aucun brouillon sélectionnable.",
            "info"
        );
        return;
    }

    if (
        !window.confirm(
            `Supprimer définitivement ${valides.length} brouillon(s) ?`
        )
    ) {
        return;
    }

    const bouton =
        document.getElementById(
            "delete-selected-approvisionnements-btn"
        );

    try {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            true,
            "Suppression..."
        );

        let echecs = 0;

        for (const item of valides) {
            try {
                const resultat =
                    await apiPost(
                        "deleteApprovisionnement",
                        {
                            idApprovisionnement:
                                item.idApprovisionnement
                        }
                    );

                if (!resultat?.success) {
                    echecs++;
                }

            } catch (error) {
                echecs++;
            }
        }

        approvisionnementsSelectionnes.clear();

        await chargerApprovisionnements();

        if (echecs) {
            showToast(
                `${valides.length - echecs} brouillon(s) supprimé(s), ${echecs} échec(s).`,
                "warning"
            );
        } else {
            afficherNotificationApprovisionnement(
                `${valides.length} brouillon(s) supprimé(s).`,
                "success",
                "Suppression terminée"
            );
        }

        definirModeSelectionApprovisionnements(false);

    } finally {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            false
        );
    }
}


/* ==========================================================
   ANNULATION — APPROVISIONNEMENT NON BROUILLON
   La fiche reste dans l'historique avec le statut Annulé.
========================================================== */

function initialiserAnnulationApprovisionnement() {

    document
        .getElementById(
            "close-cancel-approvisionnement-btn"
        )
        ?.addEventListener(
            "click",
            fermerModalAnnulationApprovisionnement
        );

    document
        .getElementById(
            "confirm-cancel-approvisionnement-btn"
        )
        ?.addEventListener(
            "click",
            confirmerAnnulationApprovisionnement
        );

    document
        .getElementById(
            "cancel-approvisionnement-modal"
        )
        ?.addEventListener(
            "click",
            event => {
                if (
                    event.target.id ===
                    "cancel-approvisionnement-modal"
                ) {
                    fermerModalAnnulationApprovisionnement();
                }
            }
        );
}


function ouvrirModalAnnulationApprovisionnement(
    approvisionnement
) {

    if (
        !approvisionnement ||
        estBrouillonApprovisionnement(
            approvisionnement
        ) ||
        normaliserStatutApprovisionnement(
            approvisionnement.statut
        ) === "annule"
    ) {
        return;
    }

    approvisionnementAAnnuler =
        approvisionnement;

    const label =
        document.getElementById(
            "cancel-approvisionnement-name"
        );

    if (label) {
        label.textContent =
            approvisionnement.idApprovisionnement ||
            "—";
    }

    const modal =
        document.getElementById(
            "cancel-approvisionnement-modal"
        );

    modal?.classList.add("active");

    modal?.setAttribute(
        "aria-hidden",
        "false"
    );
}


function fermerModalAnnulationApprovisionnement() {

    const bouton =
        document.getElementById(
            "confirm-cancel-approvisionnement-btn"
        );

    if (bouton?.disabled) {
        return;
    }

    approvisionnementAAnnuler = null;

    const modal =
        document.getElementById(
            "cancel-approvisionnement-modal"
        );

    modal?.classList.remove("active");

    modal?.setAttribute(
        "aria-hidden",
        "true"
    );
}


function construirePayloadAnnulationApprovisionnement(
    approvisionnement
) {

    const details =
        Array.isArray(
            approvisionnement.details
        )
            ? approvisionnement.details
            : Array.isArray(
                approvisionnement.lignes
            )
                ? approvisionnement.lignes
                : [];

    return {
        idApprovisionnement:
            approvisionnement.idApprovisionnement,

        idFournisseur:
            approvisionnement.idFournisseur || "",

        idTransitaire:
            approvisionnement.idTransitaire || "",

        dateAchat:
            approvisionnement.dateAchat || "",

        heureAchat:
            approvisionnement.heureAchat || "",

        dateReceptionPrevue:
            approvisionnement.dateReceptionPrevue || "",

        dateReceptionReelle:
            approvisionnement.dateReceptionReelle || "",

        statut: "Annulé",

        montantTotal:
            approvisionnement.montantTotal || 0,

        fraisTransport:
            approvisionnement.fraisTransport || 0,

        fraisDivers:
            approvisionnement.fraisDivers || 0,

        montantGlobal:
            approvisionnement.montantGlobal || 0,

        modePaiement:
            approvisionnement.modePaiement || "",

        deviseAchat:
            approvisionnement.deviseAchat || "FCFA",

        commentaire:
            approvisionnement.commentaire || "",

        details
    };
}


async function confirmerAnnulationApprovisionnement() {

    const bouton =
        document.getElementById(
            "confirm-cancel-approvisionnement-btn"
        );

    if (
        !approvisionnementAAnnuler ||
        bouton?.disabled
    ) {
        return;
    }

    const item =
        approvisionnementAAnnuler;

    try {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            true,
            "Annulation..."
        );

        const resultat =
            await apiPost(
                "updateApprovisionnement",
                construirePayloadAnnulationApprovisionnement(
                    item
                )
            );

        if (!resultat?.success) {
            throw new Error(
                resultat?.message ||
                "Impossible d’annuler cet approvisionnement."
            );
        }

        afficherNotificationApprovisionnement(
            "Approvisionnement annulé. La trace a été conservée.",
            "success",
            "Annulation enregistrée"
        );

        definirEtatChargementBoutonApprovisionnement(
            bouton,
            false
        );

        fermerModalAnnulationApprovisionnement();

        await chargerApprovisionnements();

    } catch (error) {
        showToast(
            error.message ||
            "Impossible d’annuler cet approvisionnement.",
            "error"
        );

    } finally {
        definirEtatChargementBoutonApprovisionnement(
            bouton,
            false
        );
    }
}


/* ==========================================================
   RECHERCHE ET FILTRES
========================================================== */

function initialiserRechercheEtFiltresApprovisionnements() {

    const recherchePage =
        document.getElementById(
            "approvisionnements-search-input"
        );

    const rechercheHeader =
        document.getElementById(
            "header-approvisionnements-search-input"
        );

    const boutonRechercheHeader =
        document.getElementById(
            "header-approvisionnements-search-btn"
        );

    const filtreStatut =
        document.getElementById(
            "approvisionnement-status-filter"
        );

    const filtrePaiement =
        document.getElementById(
            "approvisionnement-payment-filter"
        );

    const filtreDevise =
        document.getElementById(
            "approvisionnement-currency-filter"
        );

    const resetButton =
        document.getElementById(
            "reset-approvisionnement-filters"
        );

    const refreshButton =
        document.getElementById(
            "refresh-approvisionnements-btn"
        );

    const synchroniserRecherche =
        function (valeur, source) {

            rechercheApprovisionnements =
                String(valeur || "");

            if (
                source !== recherchePage &&
                recherchePage
            ) {

                recherchePage.value =
                    rechercheApprovisionnements;
            }

            if (
                source !== rechercheHeader &&
                rechercheHeader
            ) {

                rechercheHeader.value =
                    rechercheApprovisionnements;
            }

            pageApprovisionnementsCourante = 1;
            appliquerRechercheEtFiltresApprovisionnements();
        };

    recherchePage?.addEventListener(
        "input",
        function () {

            synchroniserRecherche(
                recherchePage.value,
                recherchePage
            );
        }
    );

    rechercheHeader?.addEventListener(
        "input",
        function () {

            synchroniserRecherche(
                rechercheHeader.value,
                rechercheHeader
            );
        }
    );

    boutonRechercheHeader?.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            synchroniserRecherche(
                rechercheHeader?.value || "",
                rechercheHeader
            );
        }
    );

    filtreStatut?.addEventListener(
        "change",
        function () {

            filtresApprovisionnements.statut =
                filtreStatut.value;

            pageApprovisionnementsCourante = 1;
            appliquerRechercheEtFiltresApprovisionnements();
        }
    );

    filtrePaiement?.addEventListener(
        "change",
        function () {

            filtresApprovisionnements.modePaiement =
                filtrePaiement.value;

            pageApprovisionnementsCourante = 1;
            appliquerRechercheEtFiltresApprovisionnements();
        }
    );

    filtreDevise?.addEventListener(
        "change",
        function () {

            filtresApprovisionnements.devise =
                filtreDevise.value;

            pageApprovisionnementsCourante = 1;
            appliquerRechercheEtFiltresApprovisionnements();
        }
    );

    resetButton?.addEventListener(
        "click",
        function () {

            rechercheApprovisionnements = "";

            filtresApprovisionnements = {
                statut: "",
                modePaiement: "",
                devise: ""
            };

            if (recherchePage) recherchePage.value = "";
            if (rechercheHeader) rechercheHeader.value = "";
            if (filtreStatut) filtreStatut.value = "";
            if (filtrePaiement) filtrePaiement.value = "";
            if (filtreDevise) filtreDevise.value = "";

            pageApprovisionnementsCourante = 1;
            appliquerRechercheEtFiltresApprovisionnements();
        }
    );
}


function appliquerRechercheEtFiltresApprovisionnements() {

    const terme =
        normaliserValeurRecherche(
            rechercheApprovisionnements
        );

    const liste =
        approvisionnementsCharges.filter(
            function (approvisionnement) {

                const fournisseur =
                    obtenirNomFournisseur(
                        approvisionnement.idFournisseur
                    );

                const transitaire =
                    obtenirNomTransitaire(
                        approvisionnement.idTransitaire
                    );

                const correspondRecherche =
                    !terme ||
                    [
                        approvisionnement.idApprovisionnement,
                        fournisseur,
                        transitaire,
                        approvisionnement.dateAchat,
                        approvisionnement.dateReceptionPrevue,
                        approvisionnement.modePaiement,
                        approvisionnement.deviseAchat,
                        approvisionnement.statut
                    ].some(
                        function (valeur) {

                            return normaliserValeurRecherche(
                                valeur
                            ).includes(terme);
                        }
                    );

                const correspondStatut =
                    !filtresApprovisionnements.statut ||
                    normaliserValeurRecherche(
                        approvisionnement.statut
                    ) ===
                    normaliserValeurRecherche(
                        filtresApprovisionnements.statut
                    );

                const correspondPaiement =
                    !filtresApprovisionnements.modePaiement ||
                    normaliserValeurRecherche(
                        approvisionnement.modePaiement
                    ).includes(
                        normaliserValeurRecherche(
                            filtresApprovisionnements
                                .modePaiement
                        )
                    );

                const correspondDevise =
                    !filtresApprovisionnements.devise ||
                    normaliserValeurRecherche(
                        approvisionnement.deviseAchat
                    ) ===
                    normaliserValeurRecherche(
                        filtresApprovisionnements.devise
                    );

                return correspondRecherche &&
                    correspondStatut &&
                    correspondPaiement &&
                    correspondDevise;
            }
        );

    approvisionnementsAffiches =
        liste.slice();

    afficherApprovisionnements();
    mettreAJourCompteurApprovisionnements(
        liste.length
    );
}


/* ==========================================================
   AFFICHAGE TABLEAU
========================================================== */

function afficherApprovisionnements() {

    const tbody =
        document.getElementById(
            "approvisionnements-table-body"
        );

    const emptyState =
        document.getElementById(
            "approvisionnements-empty-state"
        );

    if (!tbody) {
        return;
    }

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                approvisionnementsAffiches.length /
                approvisionnementsParPage
            )
        );

    pageApprovisionnementsCourante =
        Math.min(
            Math.max(
                1,
                pageApprovisionnementsCourante
            ),
            totalPages
        );

    const debut =
        (
            pageApprovisionnementsCourante - 1
        ) * approvisionnementsParPage;

    const page =
        approvisionnementsAffiches.slice(
            debut,
            debut + approvisionnementsParPage
        );

    tbody.innerHTML = "";

    if (page.length === 0) {

        emptyState?.removeAttribute("hidden");

        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="11" class="empty-table">
                    Aucun approvisionnement enregistré.
                </td>
            </tr>
        `;

        mettreAJourPaginationApprovisionnements(
            approvisionnementsAffiches.length,
            totalPages
        );

        return;
    }

    if (emptyState) {
        emptyState.hidden = true;
    }

    page.forEach(
        function (approvisionnement) {

            const ligne =
                document.createElement("tr");

            const devise =
                approvisionnement.deviseAchat ||
                "FCFA";

            const estBrouillon =
                normaliserStatutApprovisionnement(
                    approvisionnement.statut
                ) === "brouillon";

            const estAnnule =
                normaliserStatutApprovisionnement(
                    approvisionnement.statut
                ) === "annule";

            const estRecu =
                normaliserStatutApprovisionnement(
                    approvisionnement.statut
                ) === "recu";

            const montantGlobalPaiement =
                convertirMontantApprovisionnement(
                    approvisionnement.montantGlobal
                );

            const montantPayeActuel =
                convertirMontantApprovisionnement(
                    approvisionnement.montantPaye
                );

            const resteAPayerActuel =
                Math.max(
                    0,
                    montantGlobalPaiement - montantPayeActuel
                );

            const peutEnregistrerPaiement =
                !estBrouillon &&
                !estAnnule &&
                resteAPayerActuel > 0.000001;

            ligne.dataset.approvisionnementId =
                String(
                    approvisionnement.idApprovisionnement ||
                    ""
                );

            ligne.innerHTML = `
                <td class="approvisionnement-selection-column">
                    ${estBrouillon ? `
                        <input
                            type="checkbox"
                            class="approvisionnement-row-checkbox"
                            data-approvisionnement-id="${echapperHTML(approvisionnement.idApprovisionnement)}"
                            aria-label="Sélectionner le brouillon ${echapperHTML(approvisionnement.idApprovisionnement)}"
                            ${approvisionnementsSelectionnes.has(String(approvisionnement.idApprovisionnement)) ? "checked" : ""}
                        >
                    ` : ""}
                </td>

                <td>
                    <strong>
                        ${echapperHTML(
                            approvisionnement
                                .idApprovisionnement
                        )}
                    </strong>
                </td>

                <td>
                    ${echapperHTML(
                        obtenirNomFournisseur(
                            approvisionnement
                                .idFournisseur
                        )
                    )}
                </td>

                <td>
                    ${echapperHTML(
                        obtenirNomTransitaire(
                            approvisionnement
                                .idTransitaire
                        ) || "—"
                    )}
                </td>

                <td>
                    ${echapperHTML(
                        formaterDateApprovisionnement(
                            approvisionnement.dateAchat
                        )
                    )}
                </td>

                <td>
                    ${echapperHTML(
                        formaterDateApprovisionnement(
                            approvisionnement
                                .dateReceptionPrevue
                        ) || "—"
                    )}
                </td>

                <td>
                    <span class="amount-value">
                        ${echapperHTML(
                            formaterMontantApprovisionnement(
                                approvisionnement
                                    .montantGlobal,
                                devise
                            )
                        )}
                    </span>
                </td>

                <td>
                    <span class="payment-badge">
                        ${echapperHTML(
                            approvisionnement
                                .modePaiement || "—"
                        )}
                    </span>
                </td>

                <td>
                    <span class="currency-badge">
                        ${echapperHTML(devise)}
                    </span>
                </td>

                <td>
                    <span class="
                        status-badge
                        status-${obtenirClasseStatutApprovisionnement(
                            approvisionnement.statut
                        )}
                    ">
                        ${echapperHTML(
                            approvisionnement.statut ||
                            "Inconnu"
                        )}
                    </span>
                </td>

                <td class="table-actions">
                    <div class="approvisionnement-row-actions">
                        <button type="button" class="row-actions-trigger"
                            aria-label="Actions" aria-haspopup="menu" aria-expanded="false">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                        <div class="row-actions-menu" role="menu" hidden>
                            <button type="button" class="table-action-btn view-btn"
                                data-approvisionnement-id="${echapperHTML(approvisionnement.idApprovisionnement)}">
                                <i class="fa-solid fa-eye"></i><span>Voir</span>
                            </button>
                            ${obtenirEtapeSuivanteApprovisionnement(approvisionnement) ? `
                            <button type="button" class="table-action-btn workflow-btn"
                                data-approvisionnement-id="${echapperHTML(approvisionnement.idApprovisionnement)}">
                                <i class="fa-solid fa-circle-check"></i>
                                <span>${echapperHTML(obtenirEtapeSuivanteApprovisionnement(approvisionnement).libelle)}</span>
                            </button>` : ""}
                            ${peutEnregistrerPaiement ? `
                            <button type="button" class="table-action-btn payment-btn"
                                data-approvisionnement-id="${echapperHTML(approvisionnement.idApprovisionnement)}">
                                <i class="fa-solid fa-money-bill-wave"></i>
                                <span>Enregistrer un paiement</span>
                            </button>` : ""}
                            ${!estAnnule && !estRecu ? `
                            <button type="button" class="table-action-btn edit-btn"
                                data-approvisionnement-id="${echapperHTML(approvisionnement.idApprovisionnement)}">
                                <i class="fa-solid fa-pen"></i><span>Modifier</span>
                            </button>` : ""}
                            ${estBrouillon ? `
                            <button type="button" class="table-action-btn delete-btn row-action-danger"
                                data-approvisionnement-id="${echapperHTML(approvisionnement.idApprovisionnement)}">
                                <i class="fa-solid fa-trash"></i><span>Supprimer</span>
                            </button>` : (!estAnnule && !estRecu ? `
                            <button type="button" class="table-action-btn cancel-btn row-action-warning"
                                data-approvisionnement-id="${echapperHTML(approvisionnement.idApprovisionnement)}">
                                <i class="fa-solid fa-ban"></i><span>Annuler</span>
                            </button>` : "")}
                        </div>
                    </div>
                </td>
            `;

            tbody.appendChild(ligne);
        }
    );

    mettreAJourPaginationApprovisionnements(
        approvisionnementsAffiches.length,
        totalPages
    );

    synchroniserSelectionApprovisionnements();
}


/* ==========================================================
   PAGINATION
========================================================== */

function initialiserPaginationApprovisionnements() {

    const select =
        document.getElementById(
            "approvisionnements-per-page"
        );

    approvisionnementsParPage =
        Number(select?.value) || 10;

    select?.addEventListener(
        "change",
        function () {

            approvisionnementsParPage =
                Number(select.value) || 10;

            pageApprovisionnementsCourante = 1;
            afficherApprovisionnements();
        }
    );

    document
        .getElementById(
            "previous-approvisionnement-page-btn"
        )
        ?.addEventListener(
            "click",
            function () {

                if (
                    pageApprovisionnementsCourante > 1
                ) {

                    pageApprovisionnementsCourante--;
                    afficherApprovisionnements();
                }
            }
        );

    document
        .getElementById(
            "next-approvisionnement-page-btn"
        )
        ?.addEventListener(
            "click",
            function () {

                const totalPages =
                    Math.max(
                        1,
                        Math.ceil(
                            approvisionnementsAffiches
                                .length /
                            approvisionnementsParPage
                        )
                    );

                if (
                    pageApprovisionnementsCourante <
                    totalPages
                ) {

                    pageApprovisionnementsCourante++;
                    afficherApprovisionnements();
                }
            }
        );
}


function mettreAJourPaginationApprovisionnements(
    total,
    totalPages
) {

    const container =
        document.getElementById(
            "approvisionnements-page-buttons"
        );

    if (container) {

        container.innerHTML = "";

        for (
            let page = 1;
            page <= totalPages;
            page++
        ) {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "pagination-btn" +
                (
                    page ===
                    pageApprovisionnementsCourante
                        ? " active"
                        : ""
                );

            button.textContent =
                String(page);

            button.addEventListener(
                "click",
                function () {

                    pageApprovisionnementsCourante =
                        page;

                    afficherApprovisionnements();
                }
            );

            container.appendChild(button);
        }
    }

    const debut =
        total
            ? (
                pageApprovisionnementsCourante - 1
            ) * approvisionnementsParPage + 1
            : 0;

    const fin =
        Math.min(
            pageApprovisionnementsCourante *
            approvisionnementsParPage,
            total
        );

    definirTexteApprovisionnement(
        "approvisionnements-pagination-summary",
        `${debut}–${fin} sur ${total}`
    );

    const previous =
        document.getElementById(
            "previous-approvisionnement-page-btn"
        );

    const next =
        document.getElementById(
            "next-approvisionnement-page-btn"
        );

    if (previous) {

        previous.disabled =
            pageApprovisionnementsCourante <= 1;
    }

    if (next) {

        next.disabled =
            pageApprovisionnementsCourante >=
            totalPages;
    }
}


/* ==========================================================
   KPIs
========================================================== */

function mettreAJourKPIsApprovisionnements() {

    const total =
        approvisionnementsCharges.length;

    const enTransit =
        approvisionnementsCharges.filter(
            function (item) {

                return normaliserValeurRecherche(
                    item.statut
                ) === "en transit";
            }
        ).length;

    const receptionnes =
        approvisionnementsCharges.filter(
            function (item) {

                return normaliserValeurRecherche(
                    item.statut
                ) === "recu";
            }
        ).length;

    const montantGlobal =
        approvisionnementsCharges
            .filter(function (item) {

                const statut =
                    normaliserValeurRecherche(
                        item.statut
                    );

                return (
                    statut !== "brouillon" &&
                    statut !== "annule"
                );
            })
            .reduce(
                function (totalMontant, item) {

                    return totalMontant +
                        convertirMontantApprovisionnement(
                            item.montantGlobal
                        );
                },
                0
            );

    definirTexteApprovisionnement(
        "total-approvisionnements-value",
        total.toLocaleString("fr-FR")
    );

    definirTexteApprovisionnement(
        "in-transit-approvisionnements-value",
        enTransit.toLocaleString("fr-FR")
    );

    definirTexteApprovisionnement(
        "received-approvisionnements-value",
        receptionnes.toLocaleString("fr-FR")
    );

    definirTexteApprovisionnement(
        "total-approvisionnements-amount-value",
        formaterMontantApprovisionnement(
            montantGlobal,
            "FCFA"
        )
    );
}


/* ==========================================================
   VUE DÉTAILLÉE
========================================================== */

function afficherDetailsApprovisionnement(
    approvisionnement
) {

    const devise =
        approvisionnement.deviseAchat ||
        "FCFA";

    definirTexteApprovisionnement(
        "view-approvisionnement-id",
        approvisionnement.idApprovisionnement
    );

    definirTexteApprovisionnement(
        "view-approvisionnement-fournisseur",
        obtenirNomFournisseur(
            approvisionnement.idFournisseur
        )
    );

    definirTexteApprovisionnement(
        "view-approvisionnement-transitaire",
        obtenirNomTransitaire(
            approvisionnement.idTransitaire
        ) || "Aucun transitaire"
    );

    definirTexteApprovisionnement(
        "view-approvisionnement-date-achat",
        formaterDateApprovisionnement(
            approvisionnement.dateAchat
        )
    );

    definirTexteApprovisionnement(
        "view-approvisionnement-time",
        approvisionnement.heureAchat
    );

    definirTexteApprovisionnement(
        "view-approvisionnement-expected-date",
        formaterDateApprovisionnement(
            approvisionnement.dateReceptionPrevue
        )
    );

    definirTexteApprovisionnement(
        "view-approvisionnement-actual-date",
        formaterDateApprovisionnement(
            approvisionnement.dateReceptionReelle
        )
    );

    definirTexteApprovisionnement(
        "view-approvisionnement-payment-method",
        approvisionnement.modePaiement
    );

    definirTexteApprovisionnement(
        "view-approvisionnement-currency",
        devise
    );

    definirTexteApprovisionnement(
        "view-approvisionnement-transport-fees",
        formaterMontantApprovisionnement(
            approvisionnement.fraisTransport,
            devise
        )
    );
    definirTexteApprovisionnement("view-approvisionnement-transport-manager",approvisionnement.transportGerePar||"Non renseigné");

    definirTexteApprovisionnement(
        "view-approvisionnement-other-fees",
        formaterMontantApprovisionnement(
            approvisionnement.fraisDivers,
            devise
        )
    );
    definirTexteApprovisionnement("view-approvisionnement-other-fees-payee",approvisionnement.fraisDiversPayeA||"Non renseigné");

    definirTexteApprovisionnement(
        "view-approvisionnement-global-amount",
        formaterMontantApprovisionnement(
            approvisionnement.montantGlobal,
            devise
        )
    );

    definirTexteApprovisionnement(
        "view-approvisionnement-status",
        approvisionnement.statut
    );

    definirTexteApprovisionnement(
        "view-approvisionnement-comment",
        approvisionnement.commentaire
    );

    const details =
        Array.isArray(approvisionnement.details)
            ? approvisionnement.details
            : Array.isArray(
                approvisionnement.detailsApprovisionnement
            )
                ? approvisionnement
                    .detailsApprovisionnement
                : [];

    definirTexteApprovisionnement(
        "view-approvisionnement-products-count",
        details.length
    );

    afficherProduitsVueApprovisionnement(
        details,
        devise
    );

    const statusElement =
        document.getElementById(
            "view-approvisionnement-status"
        );

    if (statusElement) {

        statusElement.className =
            "view-approvisionnement-status " +
            "status-" +
            obtenirClasseStatutApprovisionnement(
                approvisionnement.statut
            );
    }
}


function afficherProduitsVueApprovisionnement(
    details,
    devise
) {

    const tbody =
        document.getElementById(
            "view-approvisionnement-products-body"
        );

    if (!tbody) {
        return;
    }

    if (!details.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-table">
                    Aucun produit enregistré.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        details.map(
            function (detail) {

                return `
                    <tr>
                        <td>
                            ${echapperHTML(
                                obtenirNomProduit(
                                    detail.idProduit
                                )
                            )}
                        </td>

                        <td>
                            ${echapperHTML(
                                detail.quantiteCommandee || 0
                            )}
                        </td>

                        <td>
                            ${echapperHTML(
                                detail.quantiteRecue || 0
                            )}
                        </td>

                        <td>
                            ${echapperHTML(
                                formaterMontantApprovisionnement(
                                    detail.prixAchatUnitaire,
                                    devise
                                )
                            )}
                        </td>

                        <td>
                            ${echapperHTML(
                                formaterMontantApprovisionnement(
                                    detail.remise,
                                    devise
                                )
                            )}
                        </td>

                        <td>
                            ${echapperHTML(
                                formaterMontantApprovisionnement(
                                    detail.sousTotal,
                                    devise
                                )
                            )}
                        </td>

                        <td>
                            <span class="reception-badge">
                                ${echapperHTML(
                                    detail.etatReception ||
                                    "En attente"
                                )}
                            </span>
                        </td>
                    </tr>
                `;
            }
        ).join("");
}


/* ==========================================================
   EXPORT ET IMPRESSION
========================================================== */

function initialiserExportApprovisionnements() {

    document
        .getElementById(
            "export-approvisionnements-btn"
        )
        ?.addEventListener(
            "click",
            exporterApprovisionnementsCSV
        );
}


function exporterApprovisionnementsCSV() {

    if (
        approvisionnementsAffiches.length === 0
    ) {

        showToast(
            "Aucun approvisionnement à exporter.",
            "error"
        );

        return;
    }

    const colonnes = [
        "ID Approvisionnement",
        "Fournisseur",
        "Transitaire",
        "Date d’Achat",
        "Réception prévue",
        "Montant global",
        "Mode de Paiement",
        "Devise",
        "Statut"
    ];

    const lignes = [
        colonnes,
        ...approvisionnementsAffiches.map(
            function (item) {

                return [
                    item.idApprovisionnement || "",
                    obtenirNomFournisseur(
                        item.idFournisseur
                    ),
                    obtenirNomTransitaire(
                        item.idTransitaire
                    ),
                    formaterDateApprovisionnement(
                        item.dateAchat
                    ),
                    formaterDateApprovisionnement(
                        item.dateReceptionPrevue
                    ),
                    convertirMontantApprovisionnement(
                        item.montantGlobal
                    ),
                    item.modePaiement || "",
                    item.deviseAchat || "",
                    item.statut || ""
                ];
            }
        )
    ];

    const contenu =
        lignes.map(
            function (ligne) {

                return ligne.map(
                    function (valeur) {

                        return `"${String(
                            valeur ?? ""
                        ).replace(/"/g, '""')}"`;
                    }
                ).join(";");
            }
        ).join("\r\n");

    telechargerBlobApprovisionnement(
        new Blob(
            ["\ufeff" + contenu],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        ),
        genererNomFichierApprovisionnement(
            "csv"
        )
    );

    showToast(
        "Export CSV généré avec succès.",
        "success"
    );
}


function initialiserImpressionApprovisionnements() {

    document
        .getElementById(
            "print-approvisionnements-btn"
        )
        ?.addEventListener(
            "click",
            imprimerApprovisionnements
        );
}


function imprimerApprovisionnements() {

    if (
        approvisionnementsAffiches.length === 0
    ) {

        showToast(
            "Aucun approvisionnement à imprimer.",
            "error"
        );

        return;
    }

    const fenetre =
        window.open(
            "",
            "_blank",
            "width=1200,height=800"
        );

    if (!fenetre) {

        showToast(
            "Autorisez les fenêtres contextuelles.",
            "error"
        );

        return;
    }

    const lignes =
        approvisionnementsAffiches.map(
            function (item, index) {

                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${echapperHTML(
                            item.idApprovisionnement
                        )}</td>
                        <td>${echapperHTML(
                            obtenirNomFournisseur(
                                item.idFournisseur
                            )
                        )}</td>
                        <td>${echapperHTML(
                            obtenirNomTransitaire(
                                item.idTransitaire
                            )
                        )}</td>
                        <td>${echapperHTML(
                            formaterDateApprovisionnement(
                                item.dateAchat
                            )
                        )}</td>
                        <td>${echapperHTML(
                            formaterMontantApprovisionnement(
                                item.montantGlobal,
                                item.deviseAchat || "FCFA"
                            )
                        )}</td>
                        <td>${echapperHTML(
                            item.statut
                        )}</td>
                    </tr>
                `;
            }
        ).join("");

    fenetre.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>VISIBL — Approvisionnements</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    color: #111827;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                th,
                td {
                    padding: 7px;
                    font-size: 10px;
                    border: 1px solid #d1d5db;
                    text-align: left;
                }

                th {
                    background: #e5e7eb;
                }
            </style>
        </head>

        <body>
            <h1>VISIBL — Liste des approvisionnements</h1>

            <p>
                ${approvisionnementsAffiches.length}
                approvisionnement(s)
            </p>

            <table>
                <thead>
                    <tr>
                        <th>N°</th>
                        <th>ID</th>
                        <th>Fournisseur</th>
                        <th>Transitaire</th>
                        <th>Date</th>
                        <th>Montant global</th>
                        <th>Statut</th>
                    </tr>
                </thead>

                <tbody>
                    ${lignes}
                </tbody>
            </table>
        </body>
        </html>
    `);

    fenetre.document.close();

    fenetre.onload =
        function () {

            fenetre.focus();
            fenetre.print();
        };
}


/* ==========================================================
   UTILITAIRES
========================================================== */

function obtenirNomFournisseur(
    idFournisseur
) {

    const fournisseur =
        fournisseursCharges.find(
            function (element) {

                return String(
                    element.idFournisseur ||
                    element["ID Fournisseur"] ||
                    ""
                ) === String(idFournisseur);
            }
        );

    return fournisseur
        ? (
            fournisseur.nomFournisseur ||
            fournisseur["Nom Fournisseur"] ||
            fournisseur.nom ||
            fournisseur.raisonSociale ||
            fournisseur.idFournisseur ||
            fournisseur["ID Fournisseur"]
        )
        : idFournisseur || "";
}


function obtenirNomTransitaire(
    idTransitaire
) {

    const transitaire =
        transitairesCharges.find(
            function (element) {

                return String(
                    element.idTransitaire
                ) === String(idTransitaire);
            }
        );

    return transitaire
        ? (
            transitaire.nomTransitaire ||
            transitaire.idTransitaire
        )
        : idTransitaire || "";
}


function obtenirNomProduit(
    idProduit
) {

    const produit =
        produitsCharges.find(
            function (element) {

                return String(
                    element.idProduit ||
                    element["ID Produit"] ||
                    ""
                ) === String(idProduit);
            }
        );

    return produit
        ? (
            produit.nomProduit ||
            produit["Désignation"] ||
            produit.designation ||
            produit.nom ||
            produit.idProduit ||
            produit["ID Produit"]
        )
        : idProduit || "";
}


function obtenirClasseStatutApprovisionnement(
    statut
) {

    const valeur =
        normaliserValeurRecherche(statut)
            .replace(/\s+/g, "-");

    const classes = {
        brouillon: "brouillon",
        commande: "commande",
        "en-transit": "en-transit",
        "partiellement-recu":
            "partiellement-recu",
        recu: "recu",
        annule: "annule"
    };

    return classes[valeur] || "inconnu";
}


function formaterDateApprovisionnement(
    date
) {

    if (!date) {
        return "";
    }

    const valeur =
        new Date(date);

    if (
        Number.isNaN(
            valeur.getTime()
        )
    ) {
        return String(date);
    }

    return valeur.toLocaleDateString(
        "fr-FR"
    );
}


function convertirDatePourInput(
    date
) {

    if (!date) {
        return "";
    }

    const valeur =
        new Date(date);

    if (
        Number.isNaN(
            valeur.getTime()
        )
    ) {

        return String(date).slice(0, 10);
    }

    return valeur
        .toISOString()
        .slice(0, 10);
}


function convertirMontantApprovisionnement(
    montant
) {

    if (typeof montant === "number") {

        return Number.isFinite(montant)
            ? montant
            : 0;
    }

    const texte =
        String(montant ?? "")
            .replace(/\s/g, "")
            .replace(/[^0-9,.-]/g, "")
            .replace(/,/g, ".");

    const valeur =
        Number(texte);

    return Number.isFinite(valeur)
        ? valeur
        : 0;
}


function arrondirMontantApprovisionnement(
    montant
) {

    return Math.round(
        (
            convertirMontantApprovisionnement(
                montant
            ) +
            Number.EPSILON
        ) * 100
    ) / 100;
}


function formaterMontantApprovisionnement(
    montant,
    devise
) {

    /*
     * RÈGLE VISIBL :
     * La devise d'achat est uniquement informative.
     * Tous les montants du logiciel sont saisis, calculés
     * et affichés en FCFA, sans conversion automatique.
     *
     * Le paramètre "devise" est conservé pour compatibilité
     * avec les appels existants, mais n'influence jamais
     * l'unité monétaire affichée.
     */
    const valeur =
        convertirMontantApprovisionnement(
            montant
        );

    return (
        valeur.toLocaleString(
            "fr-FR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        ) +
        " FCFA"
    );
}


function formaterMontantSansDevise(
    montant
) {

    return convertirMontantApprovisionnement(
        montant
    ).toLocaleString(
        "fr-FR",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    );
}


function normaliserValeurRecherche(
    valeur
) {

    return String(valeur ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-z0-9@.+-]+/g,
            " "
        )
        .replace(/\s+/g, " ");
}


function definirTexteApprovisionnement(
    id,
    valeur
) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    const texte =
        String(valeur ?? "").trim();

    element.textContent =
        texte || "—";
}


function definirValeurChamp(
    id,
    valeur
) {

    const element =
        document.getElementById(id);

    if (element) {

        element.value =
            valeur ?? "";
    }
}


function valeurChamp(
    id
) {

    const element =
        document.getElementById(id);

    return element
        ? String(element.value ?? "")
        : "";
}


function mettreAJourCompteurApprovisionnements(
    nombre
) {

    definirTexteApprovisionnement(
        "filtered-approvisionnement-count",
        nombre
    );
}


function genererNomFichierApprovisionnement(
    extension
) {

    const date =
        new Date();

    const suffixe = [
        date.getFullYear(),
        String(
            date.getMonth() + 1
        ).padStart(2, "0"),
        String(
            date.getDate()
        ).padStart(2, "0")
    ].join("-");

    return (
        `VISIBL_approvisionnements_${suffixe}.${extension}`
    );
}


function telechargerBlobApprovisionnement(
    blob,
    nomFichier
) {

    const url =
        URL.createObjectURL(blob);

    const lien =
        document.createElement("a");

    lien.href = url;
    lien.download = nomFichier;

    document.body.appendChild(lien);
    lien.click();
    lien.remove();

    window.setTimeout(
        function () {

            URL.revokeObjectURL(url);
        },
        1000
    );
}


function echapperHTML(
    valeur
) {

    return String(valeur ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}



/* ==========================================================
   AJOUT RAPIDE FOURNISSEUR / PRODUIT
========================================================== */

function initialiserAjoutsRapidesApprovisionnement() {

    document
        .getElementById("quick-add-fournisseur-btn")
        ?.addEventListener(
            "click",
            ouvrirQuickFournisseurModal
        );

    document
        .getElementById("close-quick-fournisseur-modal")
        ?.addEventListener(
            "click",
            fermerQuickFournisseurModal
        );

    document
        .getElementById("cancel-quick-fournisseur-btn")
        ?.addEventListener(
            "click",
            fermerQuickFournisseurModal
        );

    document
        .getElementById("quick-fournisseur-form")
        ?.addEventListener(
            "submit",
            enregistrerQuickFournisseur
        );

    document
        .getElementById("quick-add-produit-btn")
        ?.addEventListener(
            "click",
            () => ouvrirModaleProduitApprovisionnement({
                contexte: "formulaire"
            })
        );

    document
        .getElementById("close-quick-produit-modal")
        ?.addEventListener(
            "click",
            fermerQuickProduitModal
        );

    document
        .getElementById("cancel-quick-produit-btn")
        ?.addEventListener(
            "click",
            fermerQuickProduitModal
        );

    document
        .getElementById("quick-produit-form")
        ?.addEventListener(
            "submit",
            enregistrerQuickProduit
        );
}


function ouvrirQuickFournisseurModal() {

    const modal =
        document.getElementById(
            "quick-fournisseur-modal"
        );

    document
        .getElementById("quick-fournisseur-form")
        ?.reset();

    const devise =
        document.getElementById(
            "quick-fournisseur-devise"
        );

    if (devise) {
        devise.value = "FCFA";
    }

    modal?.classList.add("active");
    modal?.setAttribute("aria-hidden", "false");
}


function fermerQuickFournisseurModal() {

    const modal =
        document.getElementById(
            "quick-fournisseur-modal"
        );

    modal?.classList.remove("active");
    modal?.setAttribute("aria-hidden", "true");
}


async function enregistrerQuickFournisseur(event) {

    event.preventDefault();

    const button =
        document.getElementById(
            "save-quick-fournisseur-btn"
        );

    const data = {
        nomFournisseur:
            valeurChamp(
                "quick-fournisseur-nom"
            ).trim(),

        telephone:
            valeurChamp(
                "quick-fournisseur-telephone"
            ).trim(),

        pays:
            valeurChamp(
                "quick-fournisseur-pays"
            ).trim(),

        ville:
            valeurChamp(
                "quick-fournisseur-ville"
            ).trim(),

        nomContact:
            valeurChamp(
                "quick-fournisseur-contact"
            ).trim(),

        devise:
            valeurChamp(
                "quick-fournisseur-devise"
            ) || "FCFA",

        statut: "Actif"
    };

    if (
        !data.nomFournisseur ||
        !data.telephone ||
        !data.pays
    ) {

        showToast(
            "Nom, téléphone et pays sont obligatoires.",
            "error"
        );

        return;
    }

    try {

        if (button) {
            button.disabled = true;
            button.textContent =
                "Enregistrement...";
        }

        const resultat =
            await apiPost(
                "createFournisseur",
                data
            );

        if (!resultat?.success) {

            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le fournisseur."
            );
        }

        const fournisseurCree =
            resultat.data || {};

        fournisseursCharges = [
            ...fournisseursCharges.filter(
                function (fournisseur) {

                    const idExistant =
                        fournisseur.idFournisseur ||
                        fournisseur["ID Fournisseur"] ||
                        "";

                    const idNouveau =
                        fournisseurCree.idFournisseur ||
                        fournisseurCree["ID Fournisseur"] ||
                        "";

                    return String(idExistant) !==
                        String(idNouveau);
                }
            ),
            fournisseurCree
        ];

        remplirSelectFournisseurs();

        const idFournisseur =
            fournisseurCree.idFournisseur ||
            fournisseurCree["ID Fournisseur"] ||
            "";

        definirValeurChamp(
            "approvisionnement-fournisseur",
            idFournisseur
        );

        fermerQuickFournisseurModal();

        showToast(
            "Fournisseur ajouté et sélectionné.",
            "success"
        );

    } catch (error) {

        console.error(
            "Erreur ajout rapide fournisseur :",
            error
        );

        showToast(
            error.message ||
            "Impossible d'enregistrer le fournisseur.",
            "error"
        );

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent =
                "Enregistrer le fournisseur";
        }
    }
}


function ouvrirQuickProduitModal() {

    const modal =
        document.getElementById(
            "quick-produit-modal"
        );

    document
        .getElementById("quick-produit-form")
        ?.reset();

    modal?.classList.add("active");
    modal?.setAttribute("aria-hidden", "false");

    genererReferenceQuickProduit();
}


function fermerQuickProduitModal() {

    const modal =
        document.getElementById(
            "quick-produit-modal"
        );

    modal?.classList.remove("active");
    modal?.setAttribute("aria-hidden", "true");
}


function genererReferenceQuickProduit() {

    const champ =
        document.getElementById(
            "quick-produit-reference"
        );

    if (!champ || champ.value.trim()) {
        return;
    }

    const maintenant =
        new Date();

    champ.value =
        "PRO-" +
        maintenant
            .getFullYear()
            .toString()
            .slice(-2) +
        String(
            maintenant.getMonth() + 1
        ).padStart(2, "0") +
        String(
            maintenant.getDate()
        ).padStart(2, "0") +
        "-" +
        String(
            maintenant.getTime()
        ).slice(-4);
}


async function enregistrerQuickProduit(event) {

    event.preventDefault();

    const button =
        document.getElementById(
            "save-quick-produit-btn"
        );

    const data = {
        referenceProduit:
            valeurChamp(
                "quick-produit-reference"
            ).trim(),

        designation:
            valeurChamp(
                "quick-produit-designation"
            ).trim(),

        prixAchat:
            convertirMontantApprovisionnement(
                valeurChamp(
                    "quick-produit-prix-achat"
                )
            ),

        prixVente:
            convertirMontantApprovisionnement(
                valeurChamp(
                    "quick-produit-prix-vente"
                )
            ),

        prixMinimumVente: 0,
        tauxTVA: 0,
        montantTVA: 0,
        fraisTransport: 0,
        fraisDouane: 0,
        autresFrais: 0,
        prixRevient: 0,
        margeFCFA: 0,
        tauxMarge: 0,

        stockInitial:
            convertirMontantApprovisionnement(
                valeurChamp(
                    "quick-produit-stock-initial"
                )
            ),

        seuilAlerte:
            convertirMontantApprovisionnement(
                valeurChamp(
                    "quick-produit-seuil"
                )
            ),

        garantieMois: 0,
        statut: "Actif",
        commentaire: ""
    };

    if (
        !data.referenceProduit ||
        !data.designation
    ) {

        showToast(
            "La référence et la désignation sont obligatoires.",
            "error"
        );

        return;
    }

    try {

        if (button) {
            button.disabled = true;
            button.textContent =
                "Enregistrement...";
        }

        const resultat =
            await apiPost(
                "createProduit",
                data
            );

        if (!resultat?.success) {

            throw new Error(
                resultat?.message ||
                "Impossible d'enregistrer le produit."
            );
        }

        const produitCree =
            resultat.data || {};

        produitsCharges = [
            ...produitsCharges.filter(
                function (produit) {

                    const idExistant =
                        produit.idProduit ||
                        produit["ID Produit"] ||
                        "";

                    const idNouveau =
                        produitCree.idProduit ||
                        produitCree["ID Produit"] ||
                        "";

                    return String(idExistant) !==
                        String(idNouveau);
                }
            ),
            produitCree
        ];

        const idProduitCree =
            produitCree.idProduit ||
            produitCree["ID Produit"] ||
            "";

        const ligneVide =
            lignesProduitsApprovisionnement.find(
                function (ligne) {
                    return !ligne.idProduit;
                }
            );

        if (ligneVide && idProduitCree) {
            ligneVide.idProduit = idProduitCree;
        }

        rendreLignesProduitsApprovisionnement();

        fermerQuickProduitModal();

        showToast(
            ligneVide
                ? "Produit ajouté et sélectionné."
                : "Produit ajouté. Il est disponible dans la liste.",
            "success"
        );

    } catch (error) {

        console.error(
            "Erreur ajout rapide produit :",
            error
        );

        showToast(
            error.message ||
            "Impossible d'enregistrer le produit.",
            "error"
        );

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent =
                "Enregistrer le produit";
        }
    }
}



/* ==========================================================
   UX — CHARGEMENT, NOTIFICATIONS ET HEADER MOBILE
   MODULE APPROVISIONNEMENTS UNIQUEMENT
========================================================== */

function definirEtatChargementBoutonApprovisionnement(
    bouton,
    enChargement,
    texteChargement = ""
) {

    if (!bouton) {
        return;
    }

    if (enChargement) {

        if (!bouton.dataset.texteOriginal) {
            bouton.dataset.texteOriginal =
                bouton.innerHTML;
        }

        bouton.disabled = true;
        bouton.classList.add(
            "is-loading"
        );

        bouton.innerHTML = `
            <span
                class="approvisionnement-btn-spinner"
                aria-hidden="true"
            ></span>
            <span>
                ${echapperHTML(
                    texteChargement ||
                    "Traitement..."
                )}
            </span>
        `;

        return;
    }

    bouton.disabled = false;
    bouton.classList.remove(
        "is-loading"
    );

    if (bouton.dataset.texteOriginal) {

        bouton.innerHTML =
            bouton.dataset.texteOriginal;

        delete bouton.dataset.texteOriginal;
    }
}


function afficherNotificationApprovisionnement(
    message,
    type = "success",
    titre = ""
) {

    let container =
        document.getElementById(
            "approvisionnement-toast-container"
        );

    if (!container) {

        container =
            document.createElement("div");

        container.id =
            "approvisionnement-toast-container";

        container.setAttribute(
            "aria-live",
            "polite"
        );

        document.body.appendChild(
            container
        );
    }

    const configurations = {
        success: {
            titre: "Succès",
            icone: "fa-solid fa-check"
        },
        error: {
            titre: "Erreur",
            icone: "fa-solid fa-xmark"
        },
        warning: {
            titre: "Attention",
            icone: "fa-solid fa-triangle-exclamation"
        },
        info: {
            titre: "Information",
            icone: "fa-solid fa-circle-info"
        }
    };

    const configuration =
        configurations[type] ||
        configurations.info;

    const notification =
        document.createElement("div");

    notification.className =
        `approvisionnement-toast approvisionnement-toast-${type}`;

    notification.innerHTML = `
        <div class="approvisionnement-toast-icon">
            <i class="${configuration.icone}"></i>
        </div>

        <div class="approvisionnement-toast-content">
            <strong class="approvisionnement-toast-title">
                ${echapperHTML(
                    titre ||
                    configuration.titre
                )}
            </strong>

            <p class="approvisionnement-toast-message">
                ${echapperHTML(
                    message || ""
                )}
            </p>
        </div>

        <button
            type="button"
            class="approvisionnement-toast-close"
            aria-label="Fermer la notification"
        >
            <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="approvisionnement-toast-progress"></div>
    `;

    container.appendChild(
        notification
    );

    const fermer =
        function () {

            if (
                notification.classList.contains(
                    "is-leaving"
                )
            ) {
                return;
            }

            notification.classList.add(
                "is-leaving"
            );

            window.setTimeout(
                function () {
                    notification.remove();
                },
                260
            );
        };

    notification
        .querySelector(
            ".approvisionnement-toast-close"
        )
        ?.addEventListener(
            "click",
            fermer
        );

    requestAnimationFrame(
        function () {

            notification.classList.add(
                "is-visible"
            );
        }
    );

    window.setTimeout(
        fermer,
        4200
    );
}


function initialiserEnteteMobileApprovisionnements() {

    const boutonRecherche =
        document.getElementById(
            "mobile-search-btn"
        );

    const boutonNotification =
        document.getElementById(
            "notification-button"
        );

    const panneauNotification =
        document.getElementById(
            "notification-panel"
        );

    const zoneRecherche =
        document.querySelector(
            ".header-right .search-box"
        );

    const conteneurRecherche =
        zoneRecherche?.querySelector(
            ".search-container"
        );

    if (
        !boutonRecherche &&
        !boutonNotification
    ) {
        return;
    }

    /*
     * Sur téléphone : l'ouverture de la recherche ferme
     * systématiquement les notifications.
     */
    boutonRecherche?.addEventListener(
        "click",
        function () {

            if (
                window.innerWidth > 768
            ) {
                return;
            }

            if (panneauNotification) {
                panneauNotification.hidden = true;
            }

            boutonNotification?.setAttribute(
                "aria-expanded",
                "false"
            );
        },
        true
    );

    /*
     * Sur téléphone : l'ouverture des notifications ferme
     * systématiquement la recherche mobile.
     */
    boutonNotification?.addEventListener(
        "click",
        function () {

            if (
                window.innerWidth > 768
            ) {
                return;
            }

            [
                zoneRecherche,
                conteneurRecherche
            ]
                .filter(Boolean)
                .forEach(
                    function (element) {

                        element.classList.remove(
                            "active",
                            "open",
                            "show",
                            "visible",
                            "expanded",
                            "is-open"
                        );
                    }
                );

            boutonRecherche?.setAttribute(
                "aria-expanded",
                "false"
            );

            document
                .getElementById(
                    "header-approvisionnements-search-input"
                )
                ?.blur();
        },
        true
    );
}


/* ===== VISIBL COMMON HARMONISATION — référence Ventes/Commandes ===== */
document.addEventListener("DOMContentLoaded",()=>{
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const searchBox=q(".header .search-box"), search=q(".header .search-container");
  const mobileSearch=q("#mobile-search-btn");
  const notifBtn=q("#notification-button"), notif=q("#notification-panel");

  const closeSearch=()=>search?.classList.remove("active");
  const closeNotif=()=>{if(notif)notif.hidden=true;notifBtn?.setAttribute("aria-expanded","false")};

  mobileSearch?.addEventListener("click",e=>{
    e.stopPropagation(); const open=!search?.classList.contains("active");
    closeNotif(); if(search)search.classList.toggle("active",open);
    if(open)setTimeout(()=>q("input",search)?.focus(),40);
  },true);
  notifBtn?.addEventListener("click",e=>{
    e.stopPropagation(); const open=!!notif?.hidden;
    closeSearch(); if(notif)notif.hidden=!open;
    notifBtn.setAttribute("aria-expanded",String(open));
  },true);
  document.addEventListener("click",e=>{
    if(!e.target.closest(".header .search-box")&&!e.target.closest(".header .notification-menu")){
      closeSearch();closeNotif();
    }
  });

  /* Déconnexion robuste et redirection directe. */
  q("#logout-button")?.addEventListener("click",e=>{
    e.preventDefault();e.stopImmediatePropagation();
    try{ if(typeof logoutUser==="function") logoutUser(); }catch(_){}
    try{
      sessionStorage.clear();
      ["visibl_user","user","utilisateur","currentUser","authUser","isAuthenticated","token","authToken"]
        .forEach(k=>localStorage.removeItem(k));
    }catch(_){}
    location.replace("connexion.html");
  },true);

  /* Supprime les notifications de démonstration, conserve une cloche vide. */
  if(notif){
    qa(".notification-item",notif).forEach(x=>x.remove());
    if(!q(".notification-empty-state",notif)){
      const d=document.createElement("div"); d.className="notification-empty-state";
      d.innerHTML='<span aria-hidden="true">🔔</span><p>Aucune notification pour le moment.</p>';
      notif.appendChild(d);
    }
  }
  qa(".notification-badge").forEach(b=>{b.hidden=true;b.textContent="0"});

  /* Une seule recherche : celle du header pilote l'ancien champ filtre caché. */
  const headerInput=q(".header .search-container input");
  const filterSearch=qa('section.content input[type="search"],section.content input[type="text"]')
    .find(el=>/search|recher/i.test(el.id||"") && el!==headerInput);
  if(filterSearch){
    const holder=filterSearch.closest(".sales-search,.clients-search,.search-field,.filter-search,.search-box")||filterSearch.parentElement;
    if(holder) holder.style.display="none";
    const sync=()=>{
      filterSearch.value=headerInput?.value||"";
      filterSearch.dispatchEvent(new Event("input",{bubbles:true}));
      filterSearch.dispatchEvent(new Event("change",{bubbles:true}));
    };
    headerInput?.addEventListener("input",sync);
    q(".header .search-btn")?.addEventListener("click",sync);
  }
});


/* ==========================================================
   TOOLBAR APPROVISIONNEMENTS — COMPORTEMENT ALIGNÉ SUR VENTES
========================================================== */

function initialiserToolbarApprovisionnementsCommeVentes() {

    const declencheur =
        document.getElementById(
            "approvisionnements-actions-trigger"
        );

    const menu =
        document.getElementById(
            "approvisionnements-actions-dropdown"
        );

    const boutonSelection =
        document.getElementById(
            "selection-approvisionnements-btn"
        );

    if (declencheur && menu) {

        const boutonActualiser =
            document.getElementById(
                "refresh-approvisionnements-btn"
            );

        const fermerMenu = () => {
            menu.hidden = true;
            declencheur.setAttribute(
                "aria-expanded",
                "false"
            );
        };

        const basculerMenu = event => {
            event?.preventDefault();
            event?.stopPropagation();

            const vaOuvrir = menu.hidden;

            menu.hidden = !vaOuvrir;

            declencheur.setAttribute(
                "aria-expanded",
                String(vaOuvrir)
            );
        };

        declencheur.addEventListener(
            "click",
            basculerMenu
        );

        menu.addEventListener(
            "click",
            event => {
                if (event.target.closest("button")) {
                    fermerMenu();
                }
            }
        );

        document.addEventListener(
            "click",
            event => {
                if (
                    !event.target.closest(
                        ".approvisionnements-actions-menu"
                    )
                ) {
                    fermerMenu();
                }
            }
        );

        boutonActualiser?.addEventListener(
            "click",
            async event => {
                event.preventDefault();
                event.stopPropagation();

                if (boutonActualiser.disabled) {
                    return;
                }

                const contenuInitial =
                    boutonActualiser.innerHTML;

                try {
                    boutonActualiser.disabled = true;
                    boutonActualiser.setAttribute(
                        "aria-busy",
                        "true"
                    );
                    boutonActualiser.innerHTML =
                        '⏳ <span>Actualisation...</span>';

                    fermerMenu();

                    /*
                     * Recharge toutes les dépendances affichées dans
                     * Approvisionnements, puis la liste elle-même.
                     */
                    await chargerDonneesApprovisionnements({ afficherChargement: true });

                    if (typeof showToast === "function") {
                        showToast(
                            "Liste des approvisionnements actualisée.",
                            "success"
                        );
                    } else if (
                        typeof afficherNotificationApprovisionnement ===
                        "function"
                    ) {
                        afficherNotificationApprovisionnement(
                            "Liste des approvisionnements actualisée.",
                            "success",
                            "Actualisation terminée"
                        );
                    }

                } catch (error) {
                    console.error(
                        "Erreur actualisation approvisionnements :",
                        error
                    );

                    if (typeof showToast === "function") {
                        showToast(
                            error?.message ||
                            "Impossible d'actualiser les approvisionnements.",
                            "error"
                        );
                    }

                } finally {
                    boutonActualiser.disabled = false;
                    boutonActualiser.removeAttribute(
                        "aria-busy"
                    );
                    boutonActualiser.innerHTML =
                        contenuInitial;
                }
            }
        );

        document.addEventListener(
            "keydown",
            event => {
                if (event.key === "Escape") {
                    fermerMenu();
                }
            }
        );
    }
}

