# Visibl-Manager

## Vérification du frontend

Le frontend utilise HTML, CSS et JavaScript. Depuis la racine du projet, les
tests suivants s’exécutent avec Node.js 22 et sans installation de dépendances.

```powershell
node --test tests/frontend.test.cjs
node tests/browser-smoke.cjs "C:/Program Files/Google/Chrome/Application/chrome.exe"
```

Le test Chrome ouvre les pages locales à 360, 390, 768 et 1440 px. Le serveur
de test écoute uniquement sur l’interface de boucle locale. Le navigateur
reçoit des données fictives avec un réseau applicatif bloqué par CSP. Le
test couvre le débordement général, les exceptions JavaScript et des
interactions ciblées de Tableau de bord et Factures.

Pour une validation de livraison, utiliser un environnement de recette avec
des comptes et données fictifs. Vérifier la connexion et la fin de session,
les restrictions par rôle, les formulaires et transitions métier, les
indicateurs financiers après actualisation, la navigation clavier, les
graphiques et les exports dans les logiciels cibles.

## Contrat de session à faire évoluer côté serveur

Le transport actuel de `_session` reste compatible avec Apps Script. Sortir
le jeton des URL GET exige de convenir d’un transport accepté par le serveur
et compatible avec l’origine du frontend. Selon l’hébergement, une passerelle
de même origine et un cookie `HttpOnly`, `Secure` et `SameSite` sont à évaluer.
Prévoir côté serveur l’expiration, la révocation à la déconnexion, des codes
d’erreur publics et une vérification de l’autorisation pour chaque action.
Le filtrage des menus et les gardes frontend restent des contrôles d’interface.

Les pages privées attendent une réponse valide de l’action existante
`getPermissions` avec le jeton courant. Le dépôt frontend ne permet pas
d’attester que cette action vérifie l’expiration, la révocation et la
correspondance entre le rôle demandé et le titulaire du jeton. Ces contrôles
doivent être confirmés dans Apps Script. Les permissions obtenues doivent
inclure les autorisations des rôles administrateurs.

Aucune action de révocation existante n’est référencée dans le dépôt.
La déconnexion ferme la session localement et indique cette limite.

```powershell
node tests/browser-smoke.cjs "C:/Program Files/Google/Chrome/Application/chrome.exe" --session
```

Ce scénario sert le dossier de travail exact sur `http://localhost:5500`
par défaut. Définir `VISIBL_TEST_PORT=0` pour choisir un port libre si le
port 5500 est déjà utilisé. Les pages
sont comparées aux octets présents sur disque. Chrome utilise un profil
temporaire, contourne les service workers et désactive le cache HTTP.
Les réponses Apps Script sont injectées par DevTools. La politique CSP
interdit toute connexion réseau applicative.

Un quatrième argument, par exemple `../VISIBL-preuves-session`, enregistre
les captures et le résultat individuel des modules.

La branche de travail contient la protection des pages. Le Dashboard de
l’ancien instantané Git ne disposait pas du verrou HTML avant affichage.
Sur GitHub Pages, la version publiée dépend du dernier déploiement.
Sur localhost, lancer le serveur depuis `visibl-manager-main` et vérifier
que les fichiers servis contiennent `visibl-private-content` pour les pages privées.

Une navigation privée effectue une vérification serveur fraîche. Le loader
public du module est affiché dès cette vérification, puis repris par
l’initialisation métier sur le même élément. Une
vérification sans réponse utilise l’échéance HTTP de vingt secondes
d’`apiPost`, puis propose de réessayer. Chart.js est chargé après l’ouverture du tableau de bord pour
que son CDN ne retarde pas la navigation.
