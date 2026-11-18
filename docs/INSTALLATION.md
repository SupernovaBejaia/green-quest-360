# Green Quest 360 — mise en place (organisateur)

Une web app installable (Android + iPhone) qui prend des **photos 360 hors ligne**,
les **assemble sur le téléphone**, et les **envoie dans ton Google Drive** dès qu'il y a du réseau,
avec une ligne par photo (GPS compris) dans un Google Sheet pour la cartographie.

Il y a 3 étapes, à faire une seule fois.

---

## 1. Le réceptacle Google Drive (≈ 5 min)

1. Dans Google Drive, crée un dossier, par exemple **Green Quest 360**.
   Ouvre-le et copie son identifiant : la fin de l'adresse, après `/folders/`.
2. Va sur <https://script.google.com>, puis **Nouveau projet**.
   Remplace tout le code par le contenu de `apps-script/Code.gs`.
3. En haut du fichier, remplis :
   - `ROOT_FOLDER_ID` : l'identifiant du dossier ;
   - `KEY` : une clé secrète de ton choix, longue, par exemple `gq360-Alger-2026-k8Pq2vX`.
4. Clique sur **Déployer**, puis **Nouveau déploiement**, puis l'engrenage et **Application Web**.
   - *Exécuter en tant que* : **Moi**
   - *Qui a accès* : **Tout le monde**. C'est nécessaire pour que les téléphones puissent envoyer sans compte Google.
5. Autorise l'accès à Drive quand Google le demande.
   Sur l'écran « Google n'a pas validé cette application », clique sur **Paramètres avancés**, puis **Accéder au projet**. C'est ton propre script.
6. Copie l'**URL de l'application Web**, qui se termine par `/exec`.

> Les fichiers arrivent dans **ton** Drive, sous ton compte. Les participants n'ont besoin d'aucun compte Google.
> Le Google Sheet « Relevés Green Quest 360 » est créé automatiquement à la première photo reçue.

## 2. Configurer l'app

Ouvre `app/js/config.js` et remplis :

```js
uploadUrl: 'https://script.google.com/macros/s/XXXXXXXX/exec',
uploadKey: 'la même clé que KEY',
```

## 3. Mettre l'app en ligne (HTTPS obligatoire)

La caméra et le gyroscope ne fonctionnent que sur une adresse **https**.
Il suffit d'héberger le dossier `app/`, qui ne contient que des fichiers statiques.
Une fois l'app ouverte sur le téléphone, **plus besoin d'Internet**.

**Option A, GitHub Pages (gratuit, durable)** : crée un dépôt, mets le contenu de `app/` à la racine, puis active
*Settings*, *Pages* et *Deploy from branch*. L'adresse sera du type `https://<compte>.github.io/<depot>/`.
(Claude peut le faire pour toi avec `gh` une fois que tu t'es connecté avec `gh auth login`.)

**Option B, Netlify Drop** : glisse le dossier `app/` sur <https://app.netlify.com/drop>.

**À chaque mise à jour** de l'app, change `VERSION` dans `app/sw.js` (par exemple `gq360-v2`).
Sans ça, les téléphones garderaient l'ancienne version en cache.

## 4. Tester avant l'événement

1. Ouvre l'adresse sur ton téléphone, mets ton nom et ton équipe.
2. Va dans ⚙ **Réglages** et appuie sur **Tester l'envoi**. Tu dois voir « Connexion au Drive OK ».
3. Fais une photo 360 complète dehors, enregistre-la, puis vérifie qu'elle arrive dans le Drive et dans le Sheet.
4. Active le mode avion, refais une photo : elle reste « Sur le téléphone ».
   Coupe le mode avion, rouvre l'app : elle part toute seule.

## Ce que tu reçois

```
Green Quest 360/
  Relevés Green Quest 360        ← Google Sheet : date, participant, équipe, GPS, liens
  2026-11-20/
    2026-11-20_10h32_Amina_Equipe-Casbah_ab12/
      …_360.jpg                  ← photo 360 (4096×2048), reconnue comme 360 par Google Photos, Facebook, Kuula…
      meta.json                  ← infos + orientation de chaque photo source
      sources/source_01.jpg …    ← photos sources (si l'option est activée)
```

- **Carte** : dans Google My Maps, *Importer* le Sheet et choisir *Latitude/Longitude* comme position.
- **Version HD** : ouvre `hd.html` sur ton ordinateur (même adresse que l'app, ajoute `/hd.html`),
  télécharge le dossier d'une photo depuis Drive et dépose-le. La photo 360 est refaite en 8192 px.

## Bon à savoir

- **Appareils** : il faut un téléphone avec gyroscope (la quasi-totalité des téléphones récents).
  - Android : Chrome.
  - iPhone : Safari, iOS 15 ou plus récent. iOS demande d'autoriser « Mouvement et orientation » au démarrage.
- **Qualité** : l'app aligne automatiquement les photos sur leur contenu, ce qui corrige les erreurs du gyroscope,
  et égalise les expositions. Les raccords restent visibles sur les objets **très proches** (moins d'un mètre)
  et sur les gens qui bougent. C'est inhérent à la photo 360 faite au téléphone.
- **Données mobiles** : environ 3 Mo par photo 360, 15 à 25 Mo de plus si l'envoi des photos sources est activé.
  Ça se désactive dans les Réglages.
- **Sécurité** : la clé est visible dans le code de l'app. Elle empêche les envois au hasard, pas un attaquant déterminé.
  Change-la et redéploie le script après l'événement si besoin.
