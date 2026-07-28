let clientsCharges = [];
let clientEnModificationId = null;
let clientASupprimer = null;

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

    console.log("Mode création");

    openModal();
}


    function ouvrirNouveauClient() {

    console.log("Mode création");

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

        afficherClients(
            clientsCharges
        );

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
