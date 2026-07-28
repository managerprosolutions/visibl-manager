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

    const logoutButton =
        document.getElementById("logout-button");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            logoutUser();
        }
    );
}


function initialiserClients() {

    requireAuth();

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
    }
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
                <th>Commune</th><th>Type</th><th>Inscription</th><th>Cmd.</th><th>Achats</th><th>Statut</th>
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
        { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 14 }
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
        head: [["ID", "Client", "Téléphone", "Email", "Commune", "Type", "Inscription", "Cmd.", "Achats", "Statut"]],
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
            <td>
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

            <td class="table-actions">

                <button
                    type="button"
                    class="table-action-btn view-btn"
                    data-client-id="${echapperHTML(client.idClient)}"
                    title="Voir"
                    aria-label="Voir le client"
                >
                    <i class="fa-solid fa-eye"></i>
                </button>

                <button
                    type="button"
                    class="table-action-btn edit-btn"
                    data-client-id="${echapperHTML(client.idClient)}"
                    title="Modifier"
                    aria-label="Modifier le client"
                >
                    <i class="fa-solid fa-pen"></i>
                </button>

                <button
                    type="button"
                    class="table-action-btn delete-btn"
                    data-client-id="${echapperHTML(client.idClient)}"
                    title="Supprimer"
                    aria-label="Supprimer le client"
                >
                    <i class="fa-solid fa-trash"></i>
                </button>

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
