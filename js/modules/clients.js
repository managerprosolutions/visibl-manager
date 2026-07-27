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

    chargerClients();

    const openModalBtn = document.getElementById("new-client-btn");
    const openToolbarBtn = document.getElementById("new-client-toolbar-btn");
    const closeModalBtn = document.getElementById("close-client-modal");
    const cancelModalBtn = document.getElementById("cancel-client-btn");
    const clientModal = document.getElementById("client-modal");

    function openModal() {
        clientModal.classList.add("active");
        clientModal.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
        clientModal.classList.remove("active");
        clientModal.setAttribute("aria-hidden", "true");
    }

    openModalBtn?.addEventListener("click", openModal);
    openToolbarBtn?.addEventListener("click", openModal);
    closeModalBtn?.addEventListener("click", closeModal);
    cancelModalBtn?.addEventListener("click", closeModal);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeModal();
        }
    });
}

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

const clientForm =
    document.getElementById("client-form");

clientForm?.addEventListener(
    "submit",
    enregistrerClient
);

async function enregistrerClient(event) {

    event.preventDefault();

    const data = {
        nom: document.getElementById("client-lastname").value.trim(),
        prenom: document.getElementById("client-firstname").value.trim(),
        telephone: document.getElementById("client-phone").value.trim(),
        email: document.getElementById("client-email").value.trim(),
        commune: document.getElementById("client-commune").value,
        quartier: document.getElementById("client-neighborhood").value.trim(),
        typeClient: document.getElementById("client-type").value,
        statut: document.getElementById("client-status").value,
        commentaire: document.getElementById("client-comment").value.trim()
    };

    try {

        const resultat =
            await apiPost(
                "createClient",
                data
            );

        if (resultat.success) {

    showToast(resultat.message, "success");

    clientForm.reset();

    await chargerClients();        

    document
        .getElementById("client-modal")
        .classList.remove("active");

    document
        .getElementById("client-modal")
        .setAttribute("aria-hidden", "true");

} else {

            showToast(resultat.message, "error");

        }

    } catch (error) {

        console.error(error);

        showToast("Impossible de communiquer avec le serveur.", "error");

    }

}

// ========================================
// CHARGEMENT DES CLIENTS
// ========================================

async function chargerClients() {

    try {

        const resultat = await apiGet("getClients");

        if (!resultat.success) {
            showToast(
                resultat.message || "Impossible de charger les clients.",
                "error"
            );
            return;
        }

        afficherClients(resultat.clients || []);

    } catch (error) {

        console.error("Erreur chargement clients :", error);

        showToast(
            "Impossible de charger la liste des clients.",
            "error"
        );
    }
}


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

    clients.forEach(client => {

        const ligne = document.createElement("tr");

        const nomComplet = [
            client.nom,
            client.prenom
        ]
            .filter(Boolean)
            .join(" ");

        const contact = `
            <div>${echapperHTML(client.telephone)}</div>
            <div>${echapperHTML(client.email)}</div>
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
                <div>${echapperHTML(nomComplet)}</div>
                <small>${echapperHTML(client.idClient)}</small>
            </td>

            <td>
                ${contact}
            </td>

            <td>
                ${echapperHTML(client.commune)}
            </td>

            <td>
                ${echapperHTML(client.typeClient)}
            </td>

            <td>
                ${formaterDateClient(client.dateInscription)}
            </td>

            <td>
                ${echapperHTML(client.nombreCommandes ?? 0)}
            </td>

            <td>
                ${formaterMontantClient(client.montantTotalAchats)}
            </td>

            <td>
                ${echapperHTML(client.quartier)}
            </td>

            <td>
                <span class="status-badge">
                    ${echapperHTML(client.statut)}
                </span>
            </td>

            <td>
                <button
                    type="button"
                    class="table-action-btn"
                    data-client-id="${echapperHTML(client.idClient)}"
                >
                    Voir
                </button>
            </td>
        `;

        tbody.appendChild(ligne);
    });
}

function formaterDateClient(date) {

    if (!date) {
        return "";
    }

    const dateClient = new Date(date);

    if (Number.isNaN(dateClient.getTime())) {
        return echapperHTML(date);
    }

    return dateClient.toLocaleDateString("fr-FR");
}


function formaterMontantClient(montant) {

    const valeur = Number(montant || 0);

    return valeur.toLocaleString("fr-FR") + " FCFA";
}

function echapperHTML(valeur) {

    return String(valeur ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
