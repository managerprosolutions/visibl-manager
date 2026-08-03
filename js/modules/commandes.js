document.addEventListener("DOMContentLoaded", () => {
    initialiserModaleCommande();
});

function initialiserModaleCommande() {
    const boutonNouveau = document.getElementById("new-order-btn");
    const boutonNouveauToolbar = document.getElementById("new-order-toolbar-btn");
    const boutonFermer = document.getElementById("close-order-modal");
    const boutonAnnuler = document.getElementById("cancel-order-btn");
    const modale = document.getElementById("order-modal");

    if (!modale) {
        console.error("La modale #order-modal est introuvable.");
        return;
    }

    const ouvrirModale = () => {
        modale.classList.add("active");
        modale.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    };

    const fermerModale = () => {
        modale.classList.remove("active");
        modale.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    };

    boutonNouveau?.addEventListener("click", ouvrirModale);
    boutonNouveauToolbar?.addEventListener("click", ouvrirModale);
    boutonFermer?.addEventListener("click", fermerModale);
    boutonAnnuler?.addEventListener("click", fermerModale);

    modale.addEventListener("click", event => {
        if (event.target === modale) {
            fermerModale();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            modale.classList.contains("active")
        ) {
            fermerModale();
        }
    });
}
