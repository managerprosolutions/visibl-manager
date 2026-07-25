const PERMISSIONS_STORAGE_KEY = "visibl_permissions";

function normaliserPermission(valeur) {
  return String(valeur || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function chargerPermissionsUtilisateur() {
  const utilisateur = getCurrentUser();

  if (!utilisateur || !utilisateur.roleId) {
    localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
    return [];
  }

  try {
    const resultat = await apiPost("getPermissions", {
      roleId: utilisateur.roleId
    });

    if (!resultat.success) {
      console.error(resultat.message);
      return [];
    }

    const permissions = resultat.permissions || [];

    console.log("Permissions chargées :", permissions);
    
    localStorage.setItem(
      PERMISSIONS_STORAGE_KEY,
      JSON.stringify(permissions)
    );

    return permissions;
  } catch (error) {
    console.error("Erreur de chargement des permissions :", error);
    return [];
  }
}

function getPermissionsUtilisateur() {
  try {
    return JSON.parse(
      localStorage.getItem(PERMISSIONS_STORAGE_KEY)
    ) || [];
  } catch (error) {
    return [];
  }
}

function utilisateurPeut(module, action = "Voir") {
  const utilisateur = getCurrentUser();

  if (!utilisateur) {
    return false;
  }

  if (
    normaliserPermission(utilisateur.role) ===
    "administrateur"
  ) {
    return true;
  }

  const permissions = getPermissionsUtilisateur();

  return permissions.some(function(permission) {
    return (
      normaliserPermission(permission.module) ===
        normaliserPermission(module) &&
      normaliserPermission(permission.action) ===
        normaliserPermission(action)
    );
  });
}

function protegerPage(module, action = "Voir") {
  if (!isAuthenticated()) {
    requireAuth();
    return false;
  }

  if (!utilisateurPeut(module, action)) {
    alert("Vous n’avez pas accès à cette page.");
    window.location.href = "dashboard.html";
    return false;
  }

  return true;
}

function appliquerPermissionsMenu() {
  const elements = document.querySelectorAll("[data-module]");

  elements.forEach(function(element) {
    const module = element.dataset.module;
    const action = element.dataset.action || "Voir";

    if (!utilisateurPeut(module, action)) {
      element.style.display = "none";
    }
  });
}
