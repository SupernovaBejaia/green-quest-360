#!/usr/bin/env bash
# Republie l'app sur GitHub Pages : bash tools/publish.sh
# Pense à changer VERSION dans app/sw.js avant, sinon les téléphones gardent l'ancienne version.
set -euo pipefail
cd "$(dirname "$0")/.."
git add -A
git commit -m "${1:-Mise a jour}" || true
git push origin main
git push origin "$(git subtree split --prefix app main)":gh-pages --force
echo "Publié : https://supernovabejaia.github.io/green-quest-360/ (1 à 2 minutes)"
