(() => {
    const dialogSelector = '[role="dialog"][aria-modal="true"]';
    const controlSelector = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';
    const dialogStack = [];

    function isVisible(element) {
        return element.getClientRects().length > 0 &&
            !element.closest('[hidden], [aria-hidden="true"], [inert]') &&
            getComputedStyle(element).visibility === "visible";
    }

    function controlsIn(dialog) {
        return [...dialog.querySelectorAll(controlSelector)].filter(control =>
            !control.matches(":disabled") && control.tabIndex >= 0 && isVisible(control));
    }

    function synchronizeDialogs() {
        const visible = [...document.querySelectorAll(dialogSelector)].filter(isVisible);
        const previous = dialogStack.at(-1);
        const retained = dialogStack.filter(entry => visible.includes(entry.dialog));
        const opened = visible.filter(dialog => !retained.some(entry => entry.dialog === dialog));
        const trigger = document.activeElement;
        dialogStack.splice(0, dialogStack.length, ...retained);
        for (const dialog of opened) {
            const close = dialog.querySelector('.modal-close, .settings-modal-close');
            if (close && !close.hasAttribute("aria-label")) close.setAttribute("aria-label", "Fermer");
            if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;
            dialogStack.push({ dialog, trigger });
        }
        const current = dialogStack.at(-1);
        if (current === previous) return;
        if (current) {
            if (!current.dialog.contains(document.activeElement)) {
                (controlsIn(current.dialog)[0] || current.dialog).focus();
            }
        } else if (previous?.trigger instanceof HTMLElement && isVisible(previous.trigger)) {
            previous.trigger.focus();
        }
    }

    function handleDialogKeys(event) {
        const dialog = dialogStack.at(-1)?.dialog;
        if (!dialog || event.defaultPrevented) return;

        if (event.key === 'Escape') {
            const close = dialog.querySelector('.modal-close, .settings-modal-close');
            if (close && isVisible(close)) {
                event.preventDefault();
                event.stopPropagation();
                close.click();
            }
        }
        if (event.key !== 'Tab') return;
        const controls = controlsIn(dialog);
        const first = controls[0];
        const last = controls.at(-1);
        const active = document.activeElement;
        if (!first || !controls.includes(active) || (event.shiftKey ? active === first : active === last)) {
            event.preventDefault();
            ((event.shiftKey ? last : first) || dialog).focus();
        }
    }

    function initializeNavigation() {
        const sidebar = document.getElementById("sidebar");
        const toggle = document.getElementById("sidebar-toggle");
        const close = document.getElementById("sidebar-close");
        if (!sidebar || !toggle) return;
        toggle.setAttribute("aria-label", "Ouvrir le menu");
        toggle.setAttribute("aria-controls", sidebar.id);
        close?.setAttribute("aria-label", "Fermer le menu");
        const synchronize = () => toggle.setAttribute("aria-expanded", String(sidebar.classList.contains("active")));
        new MutationObserver(synchronize).observe(sidebar, { attributes: true, attributeFilter: ["class"] });
        synchronize();
        sidebar.addEventListener("keydown", event => {
            if (event.key !== "Escape" || !sidebar.classList.contains("active")) return;
            close?.click();
            toggle.focus();
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        initializeNavigation();
        for (const container of document.querySelectorAll("#toast-container")) {
            container.setAttribute("aria-live", "polite");
            container.setAttribute("aria-relevant", "additions text");
        }
        document.addEventListener("keydown", handleDialogKeys, true);
        new MutationObserver(synchronizeDialogs).observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["class", "hidden", "aria-hidden"]
        });
        synchronizeDialogs();
    });
})();
