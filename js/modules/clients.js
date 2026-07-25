document.addEventListener("DOMContentLoaded", () => {
    const openModalBtn = document.getElementById("openClientModal");
    const closeModalBtn = document.getElementById("closeClientModal");
    const cancelModalBtn = document.getElementById("cancelClientModal");
    const clientModal = document.getElementById("clientModal");

    function openModal() {
        clientModal.classList.add("active");
        clientModal.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
        clientModal.classList.remove("active");
        clientModal.setAttribute("aria-hidden", "true");
    }

    openModalBtn?.addEventListener("click", openModal);
    closeModalBtn?.addEventListener("click", closeModal);
    cancelModalBtn?.addEventListener("click", closeModal);

    clientModal?.addEventListener("click", (event) => {
        if (event.target === clientModal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeModal();
        }
    });
});
