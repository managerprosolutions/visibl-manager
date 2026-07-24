const API_CONFIG = {
  BASE_URL: "https://script.google.com/macros/s/AKfycby4K4rEv1_LwiuE-WZKbsVL9VdenirtC-M3W3vZgQscyvJ2xR-7zeqygAm7ud6LhTOZXQ/exec"
};

/**
 * Envoie une requête GET vers VISIBL Backend.
 */
async function apiGet(action, params = {}) {
  const url = new URL(API_CONFIG.BASE_URL);

  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Erreur HTTP : ${response.status}`);
  }

  return response.json();
}

/**
 * Envoie une requête POST vers VISIBL Backend.
 */
async function apiPost(action, data = {}) {
  const response = await fetch(API_CONFIG.BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      ...data
    })
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP : ${response.status}`);
  }

  return response.json();
}

/**
 * Vérifie que VISIBL Backend est accessible.
 */
async function testApiConnection() {
  try {
    const result = await apiGet("health");
    console.log("VISIBL Backend connecté :", result);
    return result;
  } catch (error) {
    console.error("Connexion à VISIBL Backend impossible :", error);
    throw error;
  }
}
