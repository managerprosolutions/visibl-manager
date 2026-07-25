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
