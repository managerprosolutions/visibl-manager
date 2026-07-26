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

    document
        .getElementById("client-modal")
        .classList.remove("active");

    document
        .getElementById("client-modal")
        .setAttribute("aria-hidden", "true");

} else {

            showToast(resultat.message, "success");

        }

    } catch (error) {

        console.error(error);

        showToast("Impossible de communiquer avec le serveur.", "error");

    }

}
