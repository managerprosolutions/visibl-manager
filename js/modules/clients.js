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
    <div>${echapperHTML(formaterTelephone(client.telephone))}</div>
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
    ${echapperHTML(mettreMajuscule(client.commune))}
</td>

            <td>
    ${echapperHTML(mettreMajuscule(client.typeClient))}
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
    <span class="status-badge status-${obtenirClasseStatut(client.statut)}">
        ${echapperHTML(mettreMajuscule(client.statut))}
    </span>
</td>

            <td class="table-actions">

    <button
        type="button"
        class="table-action-btn view-btn"
        data-client-id="${echapperHTML(client.idClient)}"
        title="Voir"
    >
        👁️
    </button>

    <button
        type="button"
        class="table-action-btn edit-btn"
        data-client-id="${echapperHTML(client.idClient)}"
        title="Modifier"
    >
        ✏️
    </button>

    <button
        type="button"
        class="table-action-btn delete-btn"
        data-client-id="${echapperHTML(client.idClient)}"
        title="Supprimer"
    >
        🗑️
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

function obtenirClasseStatut(statut) {

    const valeur = String(statut ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const classes = {
        actif: "actif",
        inactif: "inactif",
        prospect: "prospect",
        bloque: "bloque"
    };

    return classes[valeur] || "inconnu";
}


function mettreMajuscule(valeur) {

    const texte = String(valeur ?? "").trim();

    if (!texte) {
        return "";
    }

    return texte.charAt(0).toUpperCase()
        + texte.slice(1).toLowerCase();
}

function formaterTelephone(telephone) {

    let numero = String(telephone ?? "").replace(/\s+/g, "");

    if (!numero) {
        return "";
    }

    // Cas : +225XXXXXXXXXX
    if (numero.startsWith("+225")) {

        const reste = numero.substring(4);

        if (reste.length === 10) {
            return "+225 " + reste.match(/.{1,2}/g).join(" ");
        }

        return numero;
    }

    // Cas : numéro ivoirien sur 8 ou 10 chiffres
    if (numero.length === 8 || numero.length === 10) {
        return numero.match(/.{1,2}/g).join(" ");
    }

    return numero;
}

function echapperHTML(valeur) {

    return String(valeur ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
