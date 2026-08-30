let clientsCharges = [];
let clientsAffiches = [];
let clientEnModificationId = null;
let clientASupprimer = null;

// État de consultation de la page Clients
let rechercheClients = "";
let filtresClients = {
    typeClient: "",
    statut: "",
    commune: ""
};

// ========================================
// INITIALISATION
// ========================================

function initialiserDeconnexion() {
    const logoutButton = document.getElementById("logout-button");
    if (!logoutButton) return;

    logoutButton.addEventListener("click", function (event) {
        event.preventDefault();

        try {
            if (typeof logoutUser === "function") {
                logoutUser();
            }
        } catch (error) {
            console.warn("Erreur pendant la déconnexion :", error);
        }

        try {
            sessionStorage.clear();
            [
                "visibl_user",
                "user",
                "utilisateur",
                "currentUser",
                "authUser",
                "isAuthenticated",
                "token",
                "authToken"
            ].forEach(cle => localStorage.removeItem(cle));
        } catch (error) {}

        window.location.replace("connexion.html");
    });
}


function initialiserClients() {

    if (
        typeof requireAuth === "function" &&
        !requireAuth()
    ) {
        return;
    }

    initialiserDeconnexion();

    // ========================================
    // FENÊTRE NOUVEAU CLIENT
    // ========================================

    const openModalBtn =
        document.getElementById("new-client-btn");

    const openToolbarBtn =
        document.getElementById("new-client-toolbar-btn");

    const closeModalBtn =
        document.getElementById("close-client-modal");

    const cancelModalBtn =
        document.getElementById("cancel-client-btn");

    const clientModal =
        document.getElementById("client-modal");

    const deleteModal =
        document.getElementById("delete-client-modal");

    const cancelDeleteBtn =
        document.getElementById("cancel-delete-client-btn");

    const confirmDeleteBtn =
        document.getElementById("confirm-delete-client-btn");


    function openModal() {

        if (!clientModal) {
            return;
        }

        clientModal.classList.add("active");
        clientModal.setAttribute("aria-hidden", "false");
    }


    function closeModal() {

    if (!clientModal) {
        return;
    }

    clientModal.classList.remove("active");
    clientModal.setAttribute("aria-hidden", "true");
}


function remplirFormulaireClient(client) {

    document.getElementById("client-type").value =
        client.typeClient || "";

    document.getElementById("client-status").value =
        client.statut || "actif";

    document.getElementById("client-lastname").value =
        client.nom || "";

    document.getElementById("client-firstname").value =
        client.prenom || "";

    document.getElementById("client-phone").value =
        client.telephone || "";

    document.getElementById("client-email").value =
        client.email || "";

    document.getElementById("client-commune").value =
        client.commune || "";

    document.getElementById("client-neighborhood").value =
        client.quartier || "";

    document.getElementById("client-comment").value =
        client.commentaire || "";

    document.getElementById("client-modal-title").textContent =
        "Modifier le client";

    document.getElementById("save-client-btn").textContent =
        "Enregistrer les modifications";
}


function ouvrirNouveauClient() {

    clientEnModificationId = null;

    const clientForm = document.getElementById("client-form");
    clientForm?.reset();

    const modalTitle = document.getElementById("client-modal-title");
    const saveButton = document.getElementById("save-client-btn");

    if (modalTitle) {
        modalTitle.textContent = "Nouveau client";
    }

    if (saveButton) {
        saveButton.textContent = "Enregistrer le client";
    }

    openModal();
}

openModalBtn?.addEventListener(
    "click",
    ouvrirNouveauClient
);

openToolbarBtn?.addEventListener(
    "click",
    ouvrirNouveauClient
);

    closeModalBtn?.addEventListener(
        "click",
        closeModal
    );

    cancelModalBtn?.addEventListener(
        "click",
        closeModal
    );

    cancelDeleteBtn?.addEventListener(
        "click",
        fermerModalSuppression
    );

    deleteModal?.addEventListener(
        "click",
        function (event) {

            if (event.target === deleteModal) {
                fermerModalSuppression();
            }
        }
    );

    confirmDeleteBtn?.addEventListener(
        "click",
        async function () {

            if (!clientASupprimer || confirmDeleteBtn.disabled) {
                return;
            }

            const idClient = clientASupprimer.idClient;
            let suppressionReussie = false;

            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.classList.add("is-loading");

            try {

                suppressionReussie =
                    await supprimerClient(idClient);

            } finally {

                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.classList.remove("is-loading");
            }

            if (suppressionReussie) {
                fermerModalSuppression();
            }
        }
    );


    // ========================================
    // FENÊTRE VOIR CLIENT
    // ========================================

    const closeViewBtn =
        document.getElementById("close-view-client-modal");

    const closeViewFooterBtn =
        document.getElementById("close-view-client-footer");


    closeViewBtn?.addEventListener(
        "click",
        fermerModalVoirClient
    );

    closeViewFooterBtn?.addEventListener(
        "click",
        fermerModalVoirClient
    );

// ========================================
// CLIC SUR LES ACTIONS DU TABLEAU
// ========================================

const clientsTableBody =
    document.getElementById("clients-table-body");

clientsTableBody?.addEventListener(
    "click",
    function (event) {

        const viewButton =
            event.target.closest(".view-btn");

        if (viewButton) {

            const clientId =
                viewButton.dataset.clientId;

            const client =
                clientsCharges.find(
                    function (element) {

                        return String(element.idClient) ===
                            String(clientId);
                    }
                );

            if (!client) {

                showToast(
                    "Impossible de retrouver les informations du client.",
                    "error"
                );

                return;
            }

            afficherDetailsClient(client);
            ouvrirModalVoirClient();

            return;
        }

        // ========================================
        // BOUTON MODIFIER
        // ========================================

        const editButton =
            event.target.closest(".edit-btn");

        if (editButton) {

            const clientId =
                editButton.dataset.clientId;

            const client =
                clientsCharges.find(
                    function (element) {

                        return String(element.idClient) ===
                            String(clientId);
                    }
                );

            if (!client) {

                showToast(
                    "Impossible de retrouver le client à modifier.",
                    "error"
                );

                return;
            }

clientEnModificationId = client.idClient;
            
            remplirFormulaireClient(client);
openModal();

            return;
        }

   // ========================================
// BOUTON SUPPRIMER
// ========================================

const deleteButton =
    event.target.closest(".delete-btn");

if (deleteButton) {

    const clientId =
        deleteButton.dataset.clientId;

    const client =
        clientsCharges.find(
            function (element) {

                return String(element.idClient) ===
                    String(clientId);
            }
        );

    if (!client) {

        showToast(
            "Impossible de retrouver le client à supprimer.",
            "error"
        );

        return;
    }

    ouvrirModalSuppression(client);

    return;
} 

    }
);

    // ========================================
    // FERMETURE AVEC LA TOUCHE ÉCHAP
    // ========================================

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {

                closeModal();

                fermerModalVoirClient();

                fermerModalSuppression();
            }
        }
    );


    // ========================================
    // RECHERCHE, FILTRES ET ACTUALISATION
    // ========================================

    initialiserRechercheEtFiltresClients();
    initialiserExportsClients();
    initialiserImpressionClients();

    // ========================================
    // FORMULAIRE CLIENT
    // ========================================

    const clientForm =
        document.getElementById("client-form");

    clientForm?.addEventListener(
        "submit",
        enregistrerClient
    );


    // Charger les clients au démarrage
    chargerClients();
}


// ========================================
// DÉMARRAGE DE LA PAGE
// ========================================

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initialiserClients
    );

} else {

    initialiserClients();
}


// ========================================
// ENREGISTREMENT D'UN CLIENT
// ========================================

async function enregistrerClient(event) {

    event.preventDefault();

    const clientForm =
        document.getElementById("client-form");

    const data = {

        nom: document
            .getElementById("client-lastname")
            .value
            .trim(),

        prenom: document
            .getElementById("client-firstname")
            .value
            .trim(),

        telephone: document
            .getElementById("client-phone")
            .value
            .trim(),

        email: document
            .getElementById("client-email")
            .value
            .trim(),

        commune: document
            .getElementById("client-commune")
            .value,

        quartier: document
            .getElementById("client-neighborhood")
            .value
            .trim(),

        typeClient: document
            .getElementById("client-type")
            .value,

        statut: document
            .getElementById("client-status")
            .value,

        commentaire: document
            .getElementById("client-comment")
            .value
            .trim()
    };


    try {

        let resultat;

if (clientEnModificationId) {

    data.idClient =
        clientEnModificationId;

    resultat =
        await apiPost(
            "updateClient",
            data
        );

} else {

    resultat =
        await apiPost(
            "createClient",
            data
        );
}


        if (resultat.success) {

            showToast(
                resultat.message,
                "success"
            );

            clientForm?.reset();

            clientEnModificationId = null;

document.getElementById("client-modal-title").textContent =
    "Nouveau client";

document.getElementById("save-client-btn").textContent =
    "Enregistrer";

            await chargerClients();

            const clientModal =
                document.getElementById("client-modal");

            clientModal?.classList.remove("active");

            clientModal?.setAttribute(
                "aria-hidden",
                "true"
            );

        } else {

            showToast(
                resultat.message,
                "error"
            );
        }

    } catch (error) {

        console.error(error);

        showToast(
            "Impossible de communiquer avec le serveur.",
            "error"
        );
    }
}




// ========================================
// FENÊTRE DE CONFIRMATION DE SUPPRESSION
// ========================================

function ouvrirModalSuppression(client) {

    const modal =
        document.getElementById("delete-client-modal");

    const clientName =
        document.getElementById("delete-client-name");

    if (!modal || !clientName) {

        console.error(
            'La fenêtre de suppression est introuvable.'
        );

        showToast(
            "Impossible d’ouvrir la confirmation de suppression.",
            "error"
        );

        return;
    }

    clientASupprimer = client;

    const nomComplet = [
        client.nom,
        client.prenom
    ]
        .filter(Boolean)
        .join(" ")
        .trim();

    clientName.textContent =
        nomComplet || client.idClient || "Ce client";

    modal.classList.add("active");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    const confirmDeleteBtn =
        document.getElementById("confirm-delete-client-btn");

    window.setTimeout(
        function () {
            confirmDeleteBtn?.focus();
        },
        50
    );
}


function fermerModalSuppression() {

    const modal =
        document.getElementById("delete-client-modal");

    if (!modal) {
        return;
    }

    const confirmDeleteBtn =
        document.getElementById("confirm-delete-client-btn");

    if (confirmDeleteBtn?.disabled) {
        return;
    }

    modal.classList.remove("active");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    clientASupprimer = null;
}


// ========================================
// SUPPRESSION D'UN CLIENT
// ========================================

async function supprimerClient(idClient) {

    try {

        const resultat =
            await apiPost(
                "deleteClient",
                {
                    idClient: idClient
                }
            );

        if (resultat.success) {

            showToast(
                resultat.message,
                "success"
            );

            await chargerClients();

            return true;

        } else {

            showToast(
                resultat.message ||
                "Impossible de supprimer le client.",
                "error"
            );

            return false;
        }

    } catch (error) {

        console.error(
            "Erreur suppression client :",
            error
        );

        showToast(
            "Impossible de communiquer avec le serveur.",
            "error"
        );

        return false;
    }
}

// ========================================
// CHARGEMENT DES CLIENTS
// ========================================

async function chargerClients() {

    definirEtatChargementKPIsClients(true);

    try {

        const resultat =
            await apiGet("getClients");


        if (!resultat.success) {

            showToast(
                resultat.message ||
                "Impossible de charger les clients.",
                "error"
            );

            return;
        }


        clientsCharges =
            Array.isArray(resultat.clients)
                ? resultat.clients
                : [];

        mettreAJourKPIsClients();
        definirEtatChargementKPIsClients(false);
        appliquerRechercheEtFiltresClients();

    } catch (error) {

        console.error(
            "Erreur chargement clients :",
            error
        );

        showToast(
            "Impossible de charger la liste des clients.",
            "error"
        );
        definirEtatChargementKPIsClients(false);
    }
}



function definirEtatChargementKPIsClients(actif) {
    [
        "total-clients-value",
        "active-clients-value",
        "new-clients-value",
        "client-revenue-value"
    ].forEach(id => {
        const element = document.getElementById(id);
        element?.classList.toggle("is-loading", Boolean(actif));
        element?.setAttribute("aria-busy", String(Boolean(actif)));
    });
}

// ========================================
// KPI DYNAMIQUES DES CLIENTS
// ========================================

function mettreAJourKPIsClients() {

    const totalClients = clientsCharges.length;

    const clientsActifs = clientsCharges.filter(function (client) {
        return normaliserValeurRecherche(client.statut) === "actif";
    }).length;

    const pourcentageActifs = totalClients > 0
        ? Math.round((clientsActifs / totalClients) * 100)
        : 0;

    const maintenant = new Date();
    const moisActuel = maintenant.getMonth();
    const anneeActuelle = maintenant.getFullYear();

    const nouveauxCeMois = clientsCharges.filter(function (client) {

        const dateInscription = convertirDateClient(client.dateInscription);

        return dateInscription &&
            dateInscription.getMonth() === moisActuel &&
            dateInscription.getFullYear() === anneeActuelle;
    }).length;

    const achatsCumules = clientsCharges.reduce(function (total, client) {
        return total + convertirMontantClient(client.montantTotalAchats);
    }, 0);

    const moyenneAchats = totalClients > 0
        ? achatsCumules / totalClients
        : 0;

    definirTexteKPI("total-clients-value",
        totalClients.toLocaleString("fr-FR"));

    definirTexteKPI(
        "total-clients-description",
        `${nouveauxCeMois.toLocaleString("fr-FR")} nouveau${nouveauxCeMois > 1 ? "x" : ""} client${nouveauxCeMois > 1 ? "s" : ""} ce mois`
    );

    definirTexteKPI("active-clients-value",
        clientsActifs.toLocaleString("fr-FR"));

    definirTexteKPI(
        "active-clients-description",
        `${pourcentageActifs.toLocaleString("fr-FR")} % des clients`
    );

    definirTexteKPI("new-clients-value",
        nouveauxCeMois.toLocaleString("fr-FR"));

    definirTexteKPI(
        "new-clients-description",
        "Inscrits durant le mois en cours"
    );

    definirTexteKPI(
        "client-revenue-value",
        formaterMontantClient(achatsCumules)
    );

    definirTexteKPI(
        "client-revenue-description",
        `Moyenne : ${formaterMontantClient(moyenneAchats)} / client`
    );
}


function definirTexteKPI(idElement, texte) {

    const element = document.getElementById(idElement);

    if (element) {
        element.textContent = texte;
    }
}


function convertirMontantClient(montant) {

    if (typeof montant === "number") {
        return Number.isFinite(montant) ? montant : 0;
    }

    const valeurNettoyee = String(montant ?? "")
        .replace(/\s/g, "")
        .replace(/FCFA/gi, "")
        .replace(/[^0-9,.-]/g, "")
        .replace(/,/g, ".");

    const valeur = Number(valeurNettoyee);

    return Number.isFinite(valeur) ? valeur : 0;
}


function convertirDateClient(date) {

    if (!date) {
        return null;
    }

    const dateClient = date instanceof Date
        ? new Date(date.getTime())
        : new Date(date);

    return Number.isNaN(dateClient.getTime())
        ? null
        : dateClient;
}




// ========================================
// IMPRESSION DES CLIENTS
// ========================================

function initialiserImpressionClients() {
    const boutonImprimer = document.getElementById("print-clients-btn");
    if (!boutonImprimer) return;

    boutonImprimer.addEventListener("click", function () {
        imprimerClients();
    });
}

function imprimerClients() {
    if (!Array.isArray(clientsAffiches) || clientsAffiches.length === 0) {
        showToast("Aucun client à imprimer.", "error");
        return;
    }

    const fenetreImpression = window.open("", "_blank", "width=1200,height=800");
    if (!fenetreImpression) {
        showToast("Autorisez les fenêtres contextuelles pour lancer l’impression.", "error");
        return;
    }

    const echapperHTML = function (valeur) {
        return String(valeur ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const lignes = clientsAffiches.map(function (client, index) {
        const nomComplet = `${client.nom || ""} ${client.prenom || ""}`.trim();
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${echapperHTML(client.idClient || "")}</td>
                <td>${echapperHTML(nomComplet)}</td>
                <td>${echapperHTML(formaterTelephone(client.telephone))}</td>
                <td>${echapperHTML(client.email || "")}</td>
                <td>${echapperHTML(mettreMajuscule(client.commune))}</td>
                <td>${echapperHTML(mettreMajuscule(client.typeClient))}</td>
                <td>${echapperHTML(formaterDateClient(client.dateInscription))}</td>
                <td>${echapperHTML(client.nombreCommandes || 0)}</td>
                <td>${echapperHTML(formaterMontantClient(convertirMontantClient(client.montantTotalAchats)))}</td>
                <td>${echapperHTML(mettreMajuscule(client.statut))}</td>
            </tr>`;
    }).join("");

    const dateImpression = new Date().toLocaleString("fr-FR");

    fenetreImpression.document.open();
    fenetreImpression.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>VISIBL — Liste des clients</title>
    <style>
        @page { size: landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; color: #111827; }
        .print-header { margin-bottom: 16px; }
        h1 { margin: 0 0 6px; font-size: 22px; }
        .meta { color: #4b5563; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #d1d5db; padding: 6px; font-size: 9px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
        th { background: #e5e7eb; font-weight: 700; }
        tbody tr:nth-child(even) { background: #f9fafb; }
        th:nth-child(1), td:nth-child(1) { width: 3%; text-align: center; }
        th:nth-child(2), td:nth-child(2) { width: 8%; }
        th:nth-child(3), td:nth-child(3) { width: 13%; }
        th:nth-child(4), td:nth-child(4) { width: 10%; }
        th:nth-child(5), td:nth-child(5) { width: 15%; }
        th:nth-child(6), td:nth-child(6) { width: 9%; }
        th:nth-child(7), td:nth-child(7) { width: 8%; }
        th:nth-child(8), td:nth-child(8) { width: 10%; }
        th:nth-child(9), td:nth-child(9) { width: 6%; text-align: center; }
        th:nth-child(10), td:nth-child(10) { width: 10%; text-align: right; }
        th:nth-child(11), td:nth-child(11) { width: 8%; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; }
        .no-print { margin-top: 12px; font-size: 11px; color: #6b7280; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="print-header">
        <h1>VISIBL — Liste des clients</h1>
        <div class="meta">Imprimé le ${echapperHTML(dateImpression)} • ${clientsAffiches.length} client(s)</div>
    </div>
    <table>
        <thead>
            <tr>
                <th>N°</th><th>ID</th><th>Client</th><th>Téléphone</th><th>Email</th>
                <th>Commune</th><th>Type</th><th>Inscription</th><th>Cmd.</th><th>Achats</th><th>Crédit</th><th>Statut</th>
            </tr>
        </thead>
        <tbody>${lignes}</tbody>
    </table>
    <p class="no-print">La fenêtre d’impression va s’ouvrir automatiquement.</p>
</body>
</html>`);
    fenetreImpression.document.close();

    fenetreImpression.onload = function () {
        fenetreImpression.focus();
        fenetreImpression.print();
        fenetreImpression.onafterprint = function () {
            fenetreImpression.close();
        };
    };
}


// ========================================
// EXPORT DES CLIENTS (PDF, EXCEL ET CSV)
// ========================================

function initialiserExportsClients() {

    const menu = document.getElementById("export-clients-menu");
    const bouton = document.getElementById("export-clients-btn");
    const liste = document.getElementById("export-clients-dropdown");

    if (!menu || !bouton || !liste) return;

    const fermerMenu = function () {
        menu.classList.remove("is-open");
        liste.hidden = true;
        bouton.setAttribute("aria-expanded", "false");
    };

    const ouvrirMenu = function () {
        menu.classList.add("is-open");
        liste.hidden = false;
        bouton.setAttribute("aria-expanded", "true");
        liste.querySelector(".export-option")?.focus();
    };

    bouton.addEventListener("click", function (event) {
        event.stopPropagation();
        liste.hidden ? ouvrirMenu() : fermerMenu();
    });

    liste.addEventListener("click", async function (event) {
        const option = event.target.closest("[data-export-format]");
        if (!option) return;

        const format = option.dataset.exportFormat;
        fermerMenu();

        if (clientsAffiches.length === 0) {
            showToast("Aucun client à exporter.", "error");
            return;
        }

        try {
            if (format === "pdf") exporterClientsPDF();
            if (format === "xlsx") exporterClientsExcel();
            if (format === "csv") exporterClientsCSV();
        } catch (error) {
            console.error("Erreur export clients :", error);
            showToast("Impossible de générer le fichier d’export.", "error");
        }
    });

    document.addEventListener("click", function (event) {
        if (!menu.contains(event.target)) fermerMenu();
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !liste.hidden) {
            fermerMenu();
            bouton.focus();
        }
    });
}

function obtenirDonneesExportClients() {
    return clientsAffiches.map(function (client) {
        return {
            "Identifiant": client.idClient || "",
            "Nom": client.nom || "",
            "Prénom": client.prenom || "",
            "Téléphone": formaterTelephone(client.telephone),
            "Email": client.email || "",
            "Commune": mettreMajuscule(client.commune),
            "Quartier": client.quartier || "",
            "Type": mettreMajuscule(client.typeClient),
            "Date d’inscription": formaterDateClient(client.dateInscription),
            "Commandes": Number(client.nombreCommandes || 0),
            "Total achats (FCFA)": convertirMontantClient(client.montantTotalAchats),
            "Crédit client (FCFA)": convertirMontantClient(
                client.creditClient ?? client.soldeAvoir ?? 0
            ),
            "Statut": mettreMajuscule(client.statut)
        };
    });
}

function obtenirNomFichierExport(extension) {
    const date = new Date();
    const estampille = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
    return `VISIBL_clients_${estampille}.${extension}`;
}

function exporterClientsCSV() {
    const donnees = obtenirDonneesExportClients();
    const colonnes = Object.keys(donnees[0]);
    const separateur = ";";

    const protegerCSV = function (valeur) {
        const texte = String(valeur ?? "").replace(/"/g, '""');
        return `"${texte}"`;
    };

    const lignes = [
        colonnes.map(protegerCSV).join(separateur),
        ...donnees.map(function (ligne) {
            return colonnes.map(function (colonne) {
                return protegerCSV(ligne[colonne]);
            }).join(separateur);
        })
    ];

    telechargerBlob(
        new Blob(["\ufeff" + lignes.join("\r\n")], { type: "text/csv;charset=utf-8;" }),
        obtenirNomFichierExport("csv")
    );

    showToast(`${donnees.length} client(s) exporté(s) en CSV.`, "success");
}

function exporterClientsExcel() {
    if (typeof XLSX === "undefined") {
        throw new Error("La bibliothèque Excel n’est pas chargée.");
    }

    const donnees = obtenirDonneesExportClients();
    const feuille = XLSX.utils.json_to_sheet(donnees);
    feuille["!cols"] = [
        { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
        { wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 14 },
        { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 14 }
    ];
    feuille["!autofilter"] = { ref: feuille["!ref"] };

    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, "Clients");
    XLSX.writeFile(classeur, obtenirNomFichierExport("xlsx"));

    showToast(`${donnees.length} client(s) exporté(s) vers Excel.`, "success");
}

function exporterClientsPDF() {
    if (!window.jspdf?.jsPDF) {
        throw new Error("La bibliothèque PDF n’est pas chargée.");
    }

    const donnees = obtenirDonneesExportClients();
    const { jsPDF } = window.jspdf;
    const documentPDF = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const dateExport = new Date().toLocaleString("fr-FR");

    documentPDF.setFontSize(18);
    documentPDF.text("VISIBL — Liste des clients", 14, 16);
    documentPDF.setFontSize(9);
    documentPDF.text(`Exporté le ${dateExport} • ${donnees.length} client(s)`, 14, 23);

    documentPDF.autoTable({
        startY: 29,
        head: [["ID", "Client", "Téléphone", "Email", "Commune", "Type", "Inscription", "Cmd.", "Achats", "Crédit", "Statut"]],
        body: donnees.map(function (client) {
            return [
                client["Identifiant"],
                `${client["Nom"]} ${client["Prénom"]}`.trim(),
                client["Téléphone"],
                client["Email"],
                client["Commune"],
                client["Type"],
                client["Date d’inscription"],
                client["Commandes"],
                formaterMontantClient(client["Total achats (FCFA)"]),
                formaterMontantClient(client["Crédit client (FCFA)"]),
                client["Statut"]
            ];
        }),
        styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [30, 64, 175] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 10, right: 10 },
        didDrawPage: function () {
            const numeroPage = documentPDF.internal.getNumberOfPages();
            documentPDF.setFontSize(8);
            documentPDF.text(
                `VISIBL • Page ${numeroPage}`,
                documentPDF.internal.pageSize.getWidth() - 10,
                documentPDF.internal.pageSize.getHeight() - 6,
                { align: "right" }
            );
        }
    });

    documentPDF.save(obtenirNomFichierExport("pdf"));
    showToast(`${donnees.length} client(s) exporté(s) en PDF.`, "success");
}

function telechargerBlob(blob, nomFichier) {
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}


// ========================================
// RECHERCHE ET FILTRES DES CLIENTS
// ========================================

function initialiserRechercheEtFiltresClients() {

    const recherchePage =
        document.getElementById("clients-search-input");

    const rechercheHeader =
        document.querySelector(".header .search-input");

    const boutonRechercheHeader =
        document.querySelector(".header .search-btn");

    const filtreType =
        document.getElementById("client-type-filter");

    const filtreStatut =
        document.getElementById("client-status-filter");

    const filtreCommune =
        document.getElementById("client-commune-filter");

    const boutonEffacer =
        document.getElementById("reset-client-filters");

    const boutonActualiser =
        document.getElementById("refresh-clients-btn");

    const synchroniserRecherche = function (valeur, source) {

        rechercheClients = String(valeur ?? "");

        if (source !== recherchePage && recherchePage) {
            recherchePage.value = rechercheClients;
        }

        if (source !== rechercheHeader && rechercheHeader) {
            rechercheHeader.value = rechercheClients;
        }

        appliquerRechercheEtFiltresClients();
    };

    recherchePage?.addEventListener("input", function () {
        synchroniserRecherche(recherchePage.value, recherchePage);
    });

    rechercheHeader?.addEventListener("input", function () {
        synchroniserRecherche(rechercheHeader.value, rechercheHeader);
    });

    boutonRechercheHeader?.addEventListener("click", function (event) {
        event.preventDefault();
        synchroniserRecherche(rechercheHeader?.value || "", rechercheHeader);
    });

    rechercheHeader?.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            synchroniserRecherche(rechercheHeader.value, rechercheHeader);
        }
    });

    filtreType?.addEventListener("change", function () {
        filtresClients.typeClient = filtreType.value;
        appliquerRechercheEtFiltresClients();
    });

    filtreStatut?.addEventListener("change", function () {
        filtresClients.statut = filtreStatut.value;
        appliquerRechercheEtFiltresClients();
    });

    filtreCommune?.addEventListener("change", function () {
        filtresClients.commune = filtreCommune.value;
        appliquerRechercheEtFiltresClients();
    });

    boutonEffacer?.addEventListener("click", function () {

        rechercheClients = "";
        filtresClients = {
            typeClient: "",
            statut: "",
            commune: ""
        };

        if (recherchePage) recherchePage.value = "";
        if (rechercheHeader) rechercheHeader.value = "";
        if (filtreType) filtreType.value = "";
        if (filtreStatut) filtreStatut.value = "";
        if (filtreCommune) filtreCommune.value = "";

        appliquerRechercheEtFiltresClients();
    });

    boutonActualiser?.addEventListener("click", async function () {

        if (boutonActualiser.disabled) return;

        boutonActualiser.disabled = true;
        boutonActualiser.classList.add("is-loading");

        try {
            await chargerClients();
            showToast("Liste des clients actualisée.", "success");
        } finally {
            boutonActualiser.disabled = false;
            boutonActualiser.classList.remove("is-loading");
        }
    });
}


function appliquerRechercheEtFiltresClients() {

    const terme = normaliserValeurRecherche(rechercheClients);

    const clientsFiltres = clientsCharges.filter(function (client) {

        const correspondRecherche = !terme || [
            client.idClient,
            client.nom,
            client.prenom,
            client.telephone,
            client.email,
            client.commune,
            client.quartier,
            client.typeClient,
            client.statut
        ].some(function (valeur) {
            return normaliserValeurRecherche(valeur).includes(terme);
        });

        const correspondType =
            !filtresClients.typeClient ||
            normaliserValeurRecherche(client.typeClient) ===
            normaliserValeurRecherche(filtresClients.typeClient);

        const correspondStatut =
            !filtresClients.statut ||
            normaliserValeurRecherche(client.statut) ===
            normaliserValeurRecherche(filtresClients.statut);

        const correspondCommune =
            !filtresClients.commune ||
            normaliserValeurRecherche(client.commune) ===
            normaliserValeurRecherche(filtresClients.commune);

        return correspondRecherche &&
            correspondType &&
            correspondStatut &&
            correspondCommune;
    });

    clientsAffiches = clientsFiltres.slice();
    afficherClients(clientsAffiches);
    mettreAJourCompteurClients(clientsFiltres.length);
    mettreAJourEtatBoutonEffacer();
}


function normaliserValeurRecherche(valeur) {

    return String(valeur ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9@.+-]+/g, " ")
        .replace(/\s+/g, " ");
}


function mettreAJourCompteurClients(nombre) {

    const compteur =
        document.getElementById("filtered-client-count");

    if (compteur) {
        compteur.textContent = String(nombre);
    }
}


function mettreAJourEtatBoutonEffacer() {

    const bouton =
        document.getElementById("reset-client-filters");

    if (!bouton) return;

    const filtreActif = Boolean(
        rechercheClients.trim() ||
        filtresClients.typeClient ||
        filtresClients.statut ||
        filtresClients.commune
    );

    bouton.disabled = !filtreActif;
    bouton.setAttribute(
        "aria-disabled",
        filtreActif ? "false" : "true"
    );
}


// ========================================
// FENÊTRE VOIR CLIENT
// ========================================

function ouvrirModalVoirClient() {

    const modal =
        document.getElementById("view-client-modal");

    if (!modal) {

        console.error(
            'La fenêtre avec id="view-client-modal" est introuvable.'
        );

        return;
    }

    modal.classList.add("active");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );
}


function fermerModalVoirClient() {

    const modal =
        document.getElementById("view-client-modal");

    if (!modal) {
        return;
    }

    modal.classList.remove("active");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );
}



// ========================================
// INFORMATIONS DU CLIENT DANS LA FENÊTRE
// ========================================

function afficherDetailsClient(client) {

    const nomComplet = [
        client.nom,
        client.prenom
    ]
        .filter(Boolean)
        .join(" ");

    definirTexteClient(
        "view-client-id",
        client.idClient
    );

    definirTexteClient(
        "view-client-name",
        nomComplet
    );

    definirTexteClient(
        "view-client-phone",
        formaterTelephone(client.telephone)
    );

    definirTexteClient(
        "view-client-email",
        client.email
    );

    definirTexteClient(
        "view-client-type",
        mettreMajuscule(client.typeClient)
    );

    definirTexteClient(
        "view-client-status",
        mettreMajuscule(client.statut)
    );

    definirTexteClient(
        "view-client-commune",
        mettreMajuscule(client.commune)
    );

    definirTexteClient(
        "view-client-neighborhood",
        client.quartier
    );

    definirTexteClient(
        "view-client-date",
        formaterDateClient(
            client.dateInscription
        )
    );

    definirTexteClient(
        "view-client-orders",
        client.nombreCommandes ?? 0
    );

    definirTexteClient(
        "view-client-purchases",
        formaterMontantClient(
            client.montantTotalAchats
        )
    );

    definirTexteClient(
        "view-client-credit",
        formaterMontantClient(
            client.creditClient ?? client.soldeAvoir ?? 0
        )
    );

    definirTexteClient(
        "view-client-comment",
        client.commentaire
    );
}


function definirTexteClient(idElement, valeur) {

    const element =
        document.getElementById(idElement);

    if (!element) {

        console.warn(
            `Élément introuvable : ${idElement}`
        );

        return;
    }

    const texte =
        String(valeur ?? "")
            .trim();

    element.textContent =
        texte || "—";
}


// ========================================
// AFFICHAGE DES CLIENTS
// ========================================

function afficherClients(clients) {

    const tbody =
        document.getElementById("clients-table-body");

    const emptyState =
        document.getElementById("clients-empty-state");


    if (!tbody) {

        console.error(
            'Le tableau doit contenir un tbody avec id="clients-table-body".'
        );

        return;
    }


    tbody.innerHTML = "";


    if (clients.length === 0) {

        if (emptyState) {
            emptyState.hidden = false;
        }

        return;
    }


    if (emptyState) {
        emptyState.hidden = true;
    }


    clients.forEach(function (client) {

        const ligne =
            document.createElement("tr");


        const nomComplet = [

            client.nom,
            client.prenom

        ]
            .filter(Boolean)
            .join(" ");


        const contact = `
            <div>
                ${echapperHTML(
                    formaterTelephone(client.telephone)
                )}
            </div>

            <div>
                ${echapperHTML(client.email)}
            </div>
        `;


        ligne.innerHTML = `
            <td class="client-selection-column">
                <input
                    type="checkbox"
                    class="client-checkbox"
                    value="${echapperHTML(client.idClient)}"
                    aria-label="Sélectionner ${echapperHTML(nomComplet)}"
                >
            </td>

            <td>
                <div>
                    ${echapperHTML(nomComplet)}
                </div>

                <small>
                    ${echapperHTML(client.idClient)}
                </small>
            </td>

            <td>
                ${contact}
            </td>

            <td>
                ${echapperHTML(
                    mettreMajuscule(client.commune)
                )}
            </td>

            <td>
                ${echapperHTML(
                    mettreMajuscule(client.typeClient)
                )}
            </td>

            <td>
                ${formaterDateClient(
                    client.dateInscription
                )}
            </td>

            <td>
                ${echapperHTML(
                    client.nombreCommandes ?? 0
                )}
            </td>

            <td>
                ${formaterMontantClient(
                    client.montantTotalAchats
                )}
            </td>

            <td>
                <span class="${
                    convertirMontantClient(
                        client.creditClient ?? client.soldeAvoir ?? 0
                    ) > 0
                        ? "client-credit-positive"
                        : "client-credit-zero"
                }">
                    ${formaterMontantClient(
                        client.creditClient ?? client.soldeAvoir ?? 0
                    )}
                </span>
            </td>

            <td>
                ${echapperHTML(client.quartier)}
            </td>

            <td>
                <span
                    class="
                        status-badge
                        status-${obtenirClasseStatut(client.statut)}
                    "
                >
                    ${echapperHTML(
                        mettreMajuscule(client.statut)
                    )}
                </span>
            </td>

            <td class="client-actions-cell">
                <div class="client-row-menu">
                    <button
                        type="button"
                        class="client-row-menu-trigger"
                        data-client-actions-toggle="${echapperHTML(client.idClient)}"
                        aria-expanded="false"
                        aria-label="Actions du client"
                    >⋮</button>

                    <div
                        class="client-row-menu-dropdown"
                        data-client-actions-menu="${echapperHTML(client.idClient)}"
                        hidden
                    >
                        <button
                            type="button"
                            class="view-btn"
                            data-client-id="${echapperHTML(client.idClient)}"
                        >
                            <i class="fa-solid fa-eye"></i>
                            <span>Voir</span>
                        </button>

                        <button
                            type="button"
                            class="edit-btn"
                            data-client-id="${echapperHTML(client.idClient)}"
                        >
                            <i class="fa-solid fa-pen"></i>
                            <span>Modifier</span>
                        </button>

                        <button
                            type="button"
                            class="delete-btn danger-action"
                            data-client-id="${echapperHTML(client.idClient)}"
                        >
                            <i class="fa-solid fa-trash"></i>
                            <span>Supprimer</span>
                        </button>
                    </div>
                </div>
            </td>
        `;


        tbody.appendChild(ligne);
    });
}


// ========================================
// FORMATAGE DE LA DATE
// ========================================

function formaterDateClient(date) {

    if (!date) {
        return "";
    }


    const dateClient =
        new Date(date);


    if (Number.isNaN(dateClient.getTime())) {

        return echapperHTML(date);
    }


    return dateClient.toLocaleDateString(
        "fr-FR"
    );
}


// ========================================
// FORMATAGE DU MONTANT
// ========================================

function formaterMontantClient(montant) {

    const valeur =
        Number(montant || 0);


    return valeur.toLocaleString("fr-FR")
        + " FCFA";
}


// ========================================
// CLASSE CSS DU STATUT
// ========================================

function obtenirClasseStatut(statut) {

    const valeur =
        String(statut ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            );


    const classes = {

        actif: "actif",
        inactif: "inactif",
        prospect: "prospect",
        bloque: "bloque"
    };


    return classes[valeur] || "inconnu";
}


// ========================================
// PREMIÈRE LETTRE EN MAJUSCULE
// ========================================

function mettreMajuscule(valeur) {

    const texte =
        String(valeur ?? "")
            .trim();


    if (!texte) {
        return "";
    }


    return texte
        .charAt(0)
        .toUpperCase()
        + texte
            .slice(1)
            .toLowerCase();
}


// ========================================
// FORMATAGE DU TÉLÉPHONE
// ========================================

function formaterTelephone(telephone) {

    let numero =
        String(telephone ?? "")
            .replace(/\s+/g, "");


    if (!numero) {
        return "";
    }


    // Cas : +225XXXXXXXXXX
    if (numero.startsWith("+225")) {

        const reste =
            numero.substring(4);


        if (reste.length === 10) {

            return "+225 "
                + reste
                    .match(/.{1,2}/g)
                    .join(" ");
        }


        return numero;
    }


    // Cas : numéro ivoirien sur 8 ou 10 chiffres
    if (
        numero.length === 8 ||
        numero.length === 10
    ) {

        return numero
            .match(/.{1,2}/g)
            .join(" ");
    }


    return numero;
}


// ========================================
// PROTECTION HTML
// ========================================

function echapperHTML(valeur) {

    return String(valeur ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
// ========================================
// ÉTAPE 4 — TRI, PAGINATION, SÉLECTION ET COLONNES
// ========================================
let pageClientsCourante = 1;
let clientsParPage = 10;
let triClients = { cle: "", direction: "asc" };
const idsClientsSelectionnes = new Set();
let clientsPageCourante = [];

const colonnesClients = [
    { id: "client", label: "Client", index: 1, visible: true },
    { id: "contact", label: "Contact", index: 2, visible: true },
    { id: "commune", label: "Commune", index: 3, visible: true },
    { id: "type", label: "Type", index: 4, visible: true },
    { id: "date", label: "Date d’inscription", index: 5, visible: true },
    { id: "commandes", label: "Commandes", index: 6, visible: true },
    { id: "achats", label: "Total achats", index: 7, visible: true },
    { id: "credit", label: "Crédit client", index: 8, visible: true },
    { id: "quartier", label: "Quartier", index: 9, visible: true },
    { id: "statut", label: "Statut", index: 10, visible: true },
    { id: "actions", label: "Actions", index: 11, visible: true }
];

function initialiserFonctionsAvanceesClients() {
    const selectParPage = document.getElementById("clients-per-page");
    clientsParPage = Number(selectParPage?.value) || 10;
    selectParPage?.addEventListener("change", function () {
        clientsParPage = Number(selectParPage.value) || 10;
        pageClientsCourante = 1;
        afficherClients(clientsAffiches);
    });

    document.getElementById("previous-page-btn")?.addEventListener("click", function () {
        if (pageClientsCourante > 1) { pageClientsCourante--; afficherClients(clientsAffiches); }
    });
    document.getElementById("next-page-btn")?.addEventListener("click", function () {
        const totalPages = Math.max(1, Math.ceil(clientsAffiches.length / clientsParPage));
        if (pageClientsCourante < totalPages) { pageClientsCourante++; afficherClients(clientsAffiches); }
    });

    document.querySelector(".clients-table thead")?.addEventListener("click", function (event) {
        const entete = event.target.closest("th[data-sort-key]");
        if (!entete) return;
        const cle = entete.dataset.sortKey;
        triClients.direction = triClients.cle === cle && triClients.direction === "asc" ? "desc" : "asc";
        triClients.cle = cle;
        pageClientsCourante = 1;
        afficherClients(clientsAffiches);
    });

    const tbody = document.getElementById("clients-table-body");
    tbody?.addEventListener("change", function (event) {
        const checkbox = event.target.closest(".client-checkbox");
        if (!checkbox) return;
        const id = String(checkbox.value);
        checkbox.checked ? idsClientsSelectionnes.add(id) : idsClientsSelectionnes.delete(id);
        checkbox.closest("tr")?.classList.toggle("is-selected", checkbox.checked);
        mettreAJourSelectionClients();
    });

    document.getElementById("select-all-clients")?.addEventListener("change", function (event) {
        const cocher = event.target.checked;
        clientsPageCourante.forEach(function (client) {
            const id = String(client.idClient);
            cocher ? idsClientsSelectionnes.add(id) : idsClientsSelectionnes.delete(id);
        });
        afficherClients(clientsAffiches);
    });

    document.getElementById("bulk-clear-selection")?.addEventListener("click", function () {
        idsClientsSelectionnes.clear(); afficherClients(clientsAffiches);
    });
    document.getElementById("bulk-export-pdf")?.addEventListener("click", function () { exporterSelectionClients("pdf"); });
    document.getElementById("bulk-export-xlsx")?.addEventListener("click", function () { exporterSelectionClients("xlsx"); });
    document.getElementById("bulk-export-csv")?.addEventListener("click", function () { exporterSelectionClients("csv"); });
    document.getElementById("bulk-delete-clients")?.addEventListener("click", ouvrirModalSuppressionMultiple);
    document.getElementById("cancel-bulk-delete-client-btn")?.addEventListener("click", fermerModalSuppressionMultiple);
    document.getElementById("close-bulk-delete-client-btn")?.addEventListener("click", fermerModalSuppressionMultiple);
    document.getElementById("bulk-delete-client-modal")?.addEventListener("click", function (event) { if (event.target === event.currentTarget) fermerModalSuppressionMultiple(); });
    document.getElementById("confirm-bulk-delete-client-btn")?.addEventListener("click", supprimerClientsSelectionnes);

}

function comparerClients(a, b, cle) {
    if (["nombreCommandes", "montantTotalAchats"].includes(cle)) {
        return convertirMontantClient(a[cle]) - convertirMontantClient(b[cle]);
    }
    if (cle === "dateInscription") {
        const da = convertirDateClient(a[cle])?.getTime?.() || 0;
        const db = convertirDateClient(b[cle])?.getTime?.() || 0;
        return da - db;
    }
    const va = normaliserValeurRecherche(cle === "nom" ? `${a.nom || ""} ${a.prenom || ""}` : a[cle]);
    const vb = normaliserValeurRecherche(cle === "nom" ? `${b.nom || ""} ${b.prenom || ""}` : b[cle]);
    return va.localeCompare(vb, "fr", { numeric: true });
}

const afficherClientsOriginal = afficherClients;
afficherClients = function (clients) {
    const liste = Array.isArray(clients) ? clients.slice() : [];
    if (triClients.cle) {
        liste.sort(function (a, b) {
            const valeur = comparerClients(a, b, triClients.cle);
            return triClients.direction === "asc" ? valeur : -valeur;
        });
    }
    const totalPages = Math.max(1, Math.ceil(liste.length / clientsParPage));
    pageClientsCourante = Math.min(Math.max(1, pageClientsCourante), totalPages);
    const debut = (pageClientsCourante - 1) * clientsParPage;
    clientsPageCourante = liste.slice(debut, debut + clientsParPage);
    afficherClientsOriginal(clientsPageCourante);
    restaurerSelectionDansTableau();
    appliquerVisibiliteColonnes();
    mettreAJourPagination(liste.length, totalPages);
    mettreAJourIndicateursTri();
    mettreAJourSelectionClients();
};

function mettreAJourPagination(total, totalPages) {
    const zone = document.getElementById("clients-page-buttons");
    if (zone) {
        zone.innerHTML = "";
        const pages = [];
        for (let p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || Math.abs(p - pageClientsCourante) <= 1) pages.push(p);
        }
        let precedente = 0;
        pages.forEach(function (p) {
            if (precedente && p - precedente > 1) { const dots=document.createElement("span"); dots.textContent="…"; zone.appendChild(dots); }
            const bouton=document.createElement("button"); bouton.type="button"; bouton.className="pagination-btn"+(p===pageClientsCourante?" active":""); bouton.textContent=String(p);
            bouton.addEventListener("click", function(){ pageClientsCourante=p; afficherClients(clientsAffiches); }); zone.appendChild(bouton); precedente=p;
        });
    }
    const debut = total ? (pageClientsCourante - 1) * clientsParPage + 1 : 0;
    const fin = Math.min(pageClientsCourante * clientsParPage, total);
    const resume = document.getElementById("clients-pagination-summary");
    if (resume) resume.textContent = `${debut}–${fin} sur ${total}`;
    const precedent=document.getElementById("previous-page-btn"), suivant=document.getElementById("next-page-btn");
    if (precedent) precedent.disabled = pageClientsCourante <= 1;
    if (suivant) suivant.disabled = pageClientsCourante >= totalPages;
}

function mettreAJourIndicateursTri() {
    document.querySelectorAll("th[data-sort-key]").forEach(function(th){
        const indicateur=th.querySelector(".sort-indicator");
        if (indicateur) indicateur.textContent = th.dataset.sortKey === triClients.cle ? (triClients.direction === "asc" ? "▲" : "▼") : "↕";
        th.setAttribute("aria-sort", th.dataset.sortKey === triClients.cle ? (triClients.direction === "asc" ? "ascending" : "descending") : "none");
    });
}

function restaurerSelectionDansTableau() {
    document.querySelectorAll(".client-checkbox").forEach(function(cb){
        cb.checked = idsClientsSelectionnes.has(String(cb.value));
        cb.closest("tr")?.classList.toggle("is-selected", cb.checked);
    });
}

function mettreAJourSelectionClients() {
    const selectionValide = new Set(clientsCharges.map(c => String(c.idClient)));
    [...idsClientsSelectionnes].forEach(id => { if (!selectionValide.has(id)) idsClientsSelectionnes.delete(id); });
    const nombre = idsClientsSelectionnes.size;
    const barre=document.getElementById("bulk-clients-bar"), compteur=document.getElementById("selected-clients-count");
    if (barre) barre.hidden = nombre === 0;
    if (compteur) compteur.textContent = String(nombre);
    const selectAll=document.getElementById("select-all-clients");
    if (selectAll) {
        const coches=clientsPageCourante.filter(c=>idsClientsSelectionnes.has(String(c.idClient))).length;
        selectAll.checked = clientsPageCourante.length > 0 && coches === clientsPageCourante.length;
        selectAll.indeterminate = coches > 0 && coches < clientsPageCourante.length;
    }
}

function obtenirClientsSelectionnes() {
    return clientsCharges.filter(c => idsClientsSelectionnes.has(String(c.idClient)));
}

function exporterSelectionClients(format) {
    const selection = obtenirClientsSelectionnes();
    if (!selection.length) return showToast("Sélectionnez au moins un client.", "error");
    const sauvegarde = clientsAffiches;
    clientsAffiches = selection;
    try { if(format==="pdf") exporterClientsPDF(); if(format==="xlsx") exporterClientsExcel(); if(format==="csv") exporterClientsCSV(); }
    finally { clientsAffiches = sauvegarde; }
}

function ouvrirModalSuppressionMultiple() {
    const nombre=idsClientsSelectionnes.size; if(!nombre) return;
    const modal=document.getElementById("bulk-delete-client-modal"), message=document.getElementById("bulk-delete-client-message");
    if(message) message.textContent=`Vous allez supprimer définitivement ${nombre} client(s). Cette action est irréversible.`;
    modal?.classList.add("active"); modal?.setAttribute("aria-hidden","false");
}
function fermerModalSuppressionMultiple() { const modal=document.getElementById("bulk-delete-client-modal"); modal?.classList.remove("active"); modal?.setAttribute("aria-hidden","true"); }

async function supprimerClientsSelectionnes() {
    const bouton=document.getElementById("confirm-bulk-delete-client-btn");
    const ids=[...idsClientsSelectionnes]; if(!ids.length || bouton?.disabled) return;
    if(bouton){ bouton.disabled=true; bouton.classList.add("is-loading"); }
    let succes=0, echecs=0;
    try {
        for (const idClient of ids) {
            try { const r=await apiPost("deleteClient",{idClient}); r?.success ? succes++ : echecs++; } catch(e){ echecs++; }
        }
        idsClientsSelectionnes.clear();
        await chargerClients();
        fermerModalSuppressionMultiple();
        if(succes) showToast(`${succes} client(s) supprimé(s).`,"success");
        if(echecs) showToast(`${echecs} suppression(s) ont échoué.`,"error");
    } finally { if(bouton){ bouton.disabled=false; bouton.classList.remove("is-loading"); } }
}

function initialiserMenuColonnesClients() {
    const menu=document.getElementById("columns-clients-menu"), bouton=document.getElementById("columns-clients-btn"), liste=document.getElementById("columns-clients-dropdown");
    if(!menu||!bouton||!liste) return;
    liste.innerHTML = colonnesClients.map(c=>`<label class="column-option"><input type="checkbox" data-column-toggle="${c.id}" checked> <span>${c.label}</span></label>`).join("");
    bouton.addEventListener("click",function(e){ e.stopPropagation(); const ouvrir=liste.hidden; liste.hidden=!ouvrir; bouton.setAttribute("aria-expanded",String(ouvrir)); });
    liste.addEventListener("change",function(e){ const cb=e.target.closest("[data-column-toggle]"); if(!cb)return; const c=colonnesClients.find(x=>x.id===cb.dataset.columnToggle); if(c)c.visible=cb.checked; appliquerVisibiliteColonnes(); });
    document.addEventListener("click",function(e){ if(!menu.contains(e.target)){liste.hidden=true; bouton.setAttribute("aria-expanded","false");} });
}

function appliquerVisibiliteColonnes() {
    colonnesClients.forEach(function(c){
        document.querySelectorAll(`.clients-table tr`).forEach(function(tr){ const cell=tr.children[c.index]; if(cell) cell.hidden=!c.visible; });
    });
}

// Réinitialiser la page lors d'une nouvelle recherche ou d'un nouveau filtre.
const appliquerRechercheEtFiltresClientsOriginal = appliquerRechercheEtFiltresClients;
appliquerRechercheEtFiltresClients = function () { pageClientsCourante = 1; appliquerRechercheEtFiltresClientsOriginal(); };

// L'initialisation principale a déjà été enregistrée : ajouter nos fonctions après le chargement du DOM.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialiserFonctionsAvanceesClients);
else initialiserFonctionsAvanceesClients();


/* ===========================================================
   CORRECTIONS CLIENTS — modèle Ventes / Commandes
=========================================================== */
let modeSelectionClients = false;

function definirModeSelectionClients(actif) {
    modeSelectionClients = Boolean(actif);
    document.body.classList.toggle("clients-selection-mode", modeSelectionClients);

    const bouton = document.getElementById("selection-clients-btn");
    const barre = document.getElementById("bulk-clients-bar");

    bouton?.setAttribute("aria-pressed", String(modeSelectionClients));
    if (barre) barre.hidden = !modeSelectionClients;

    if (!modeSelectionClients) {
        idsClientsSelectionnes.clear();
    }

    afficherClients(clientsAffiches);
}

function obtenirPorteeActionClients() {
    const selection = obtenirClientsSelectionnes();
    return selection.length ? selection : clientsAffiches;
}

function executerAvecPorteeClients(action) {
    const portee = obtenirPorteeActionClients();

    if (!Array.isArray(portee) || !portee.length) {
        showToast("Aucun client disponible pour cette action.", "error");
        return;
    }

    const sauvegarde = clientsAffiches;
    clientsAffiches = portee;

    try {
        action();
    } finally {
        clientsAffiches = sauvegarde;
    }
}

function initialiserToolbarClientsReference() {
    const boutonSelection = document.getElementById("selection-clients-btn");
    const declencheurActions = document.getElementById("clients-actions-trigger");
    const menuActions = document.getElementById("clients-actions-dropdown");

    boutonSelection?.addEventListener("click", () => {
        if (!modeSelectionClients) {
            if (menuActions) menuActions.hidden = true;
            declencheurActions?.setAttribute("aria-expanded", "false");
        }
        definirModeSelectionClients(!modeSelectionClients);
    });

    document.getElementById("close-clients-selection-btn")
        ?.addEventListener("click", () => definirModeSelectionClients(false));

    document.getElementById("select-visible-clients-btn")
        ?.addEventListener("click", () => {
            clientsPageCourante.forEach(client => {
                idsClientsSelectionnes.add(String(client.idClient));
            });
            afficherClients(clientsAffiches);
        });

    declencheurActions?.addEventListener("click", event => {
        event.stopPropagation();
        const ouvrir = Boolean(menuActions?.hidden);
        if (ouvrir && modeSelectionClients) {
            definirModeSelectionClients(false);
        }
        if (menuActions) menuActions.hidden = !ouvrir;
        declencheurActions.setAttribute("aria-expanded", String(ouvrir));
    });

    menuActions?.addEventListener("click", event => event.stopPropagation());

    document.addEventListener("click", event => {
        if (!event.target.closest(".clients-actions-menu")) {
            if (menuActions) menuActions.hidden = true;
            declencheurActions?.setAttribute("aria-expanded", "false");
        }
    });

    document.getElementById("clients-action-pdf")
        ?.addEventListener("click", () => executerAvecPorteeClients(exporterClientsPDF));

    document.getElementById("clients-action-xlsx")
        ?.addEventListener("click", () => executerAvecPorteeClients(exporterClientsExcel));

    document.getElementById("clients-action-csv")
        ?.addEventListener("click", () => executerAvecPorteeClients(exporterClientsCSV));

    document.getElementById("clients-action-print")
        ?.addEventListener("click", () => executerAvecPorteeClients(imprimerClients));

    document.getElementById("clients-action-refresh")
        ?.addEventListener("click", async () => {
            if (menuActions) menuActions.hidden = true;
            declencheurActions?.setAttribute("aria-expanded", "false");
            await chargerClients();
        });

    menuActions?.querySelectorAll("button").forEach(button => {
        button.addEventListener("click", () => {
            menuActions.hidden = true;
            declencheurActions?.setAttribute("aria-expanded", "false");
        });
    });
}

/* La barre de sélection reste visible dès que le mode Sélection est actif,
   même avant d'avoir coché une ligne. */
const mettreAJourSelectionClientsReference = mettreAJourSelectionClients;
mettreAJourSelectionClients = function () {
    mettreAJourSelectionClientsReference();

    const barre = document.getElementById("bulk-clients-bar");
    if (barre) {
        barre.hidden = !modeSelectionClients;
    }
};

/* Le bouton Colonnes est supprimé : aucun masquage dynamique de colonnes
   ne doit déplacer les données du tableau. */
appliquerVisibiliteColonnes = function () {};

/* Menus ⋮ de chaque ligne. */
function fermerMenusActionsClients() {
    document.querySelectorAll("[data-client-actions-menu]").forEach(menu => {
        menu.hidden = true;
    });
    document.querySelectorAll("[data-client-actions-toggle]").forEach(button => {
        button.setAttribute("aria-expanded", "false");
    });
}

document.getElementById("clients-table-body")?.addEventListener("click", event => {
    const trigger = event.target.closest("[data-client-actions-toggle]");

    if (trigger) {
        event.stopPropagation();

        const id = String(trigger.dataset.clientActionsToggle || "");
        const menu = document.querySelector(
            `[data-client-actions-menu="${CSS.escape(id)}"]`
        );

        const ouvrir = Boolean(menu?.hidden);
        fermerMenusActionsClients();

        if (menu) {
            menu.hidden = !ouvrir;
        }

        trigger.setAttribute("aria-expanded", String(ouvrir));
        return;
    }

    if (event.target.closest(".client-row-menu-dropdown button")) {
        fermerMenusActionsClients();
    }
});

document.addEventListener("click", event => {
    if (!event.target.closest(".client-row-menu")) {
        fermerMenusActionsClients();
    }
});

/* Header : recherche et notifications mutuellement exclusives,
   avec le même fonctionnement que Ventes et Commandes. */
function initialiserHeaderClientsReference() {
    const boutonRecherche = document.getElementById("mobile-search-btn");
    const conteneurRecherche = document.querySelector(".header .search-container");
    const boutonNotification = document.getElementById("notification-button");
    const panneauNotification = document.getElementById("notification-panel");

    const fermerRecherche = () => {
        conteneurRecherche?.classList.remove("active");
    };

    const fermerNotifications = () => {
        if (panneauNotification) panneauNotification.hidden = true;
        boutonNotification?.setAttribute("aria-expanded", "false");
    };

    boutonRecherche?.addEventListener("click", () => {
        fermerNotifications();
    });

    boutonNotification?.addEventListener("click", () => {
        fermerRecherche();
    });

    document.addEventListener("click", event => {
        const dansRecherche = event.target.closest(".header .search-box");
        const dansNotifications = event.target.closest(".header .notification-menu");

        if (!dansRecherche && !dansNotifications) {
            fermerRecherche();
            fermerNotifications();
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initialiserToolbarClientsReference();
        initialiserHeaderClientsReference();
        definirModeSelectionClients(false);
    });
} else {
    initialiserToolbarClientsReference();
    initialiserHeaderClientsReference();
    definirModeSelectionClients(false);
}
