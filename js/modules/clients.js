let clientsCharges = [];

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


    openModalBtn?.addEventListener(
        "click",
        openModal
    );

    openToolbarBtn?.addEventListener(
        "click",
        openModal
    );

    closeModalBtn?.addEventListener(
        "click",
        closeModal
    );

    cancelModalBtn?.addEventListener(
        "click",
        closeModal
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

            console.log(
                "Client à modifier :",
                client
            );

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

        const resultat =
            await apiPost(
                "createClient",
                data
            );


        if (resultat.success) {

            showToast(
                resultat.message,
                "success"
            );

            clientForm?.reset();

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
