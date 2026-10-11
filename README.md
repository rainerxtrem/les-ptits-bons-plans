# Les p'tits bons plans — thème Shopify

Thème Shopify Online Store 2.0 sur mesure pour la boutique **« Les p'tits bons plans »** : une enseigne de bonnes affaires généraliste, chaleureuse et soignée, avec une identité française (vert sauge, ivoire, touches d'or doux).

- 100 % natif Shopify : Liquid, modèles JSON, sections et blocs administrables, Ajax Cart API, Section Rendering API, filtres Search & Discovery, recherche prédictive, checkout Shopify.
- Aucun framework JavaScript, aucune dépendance externe. Les polices de la marque (DM Serif Display, Inter, licence OFL) sont hébergées dans le thème.
- Aucune donnée inventée : prix, remises, stocks et avis proviennent uniquement de Shopify.

## Arborescence

```
assets/      base.css (système de design), theme.js (interactions), polices woff2
config/      settings_schema.json (réglages du thème), settings_data.json
layout/      theme.liquid, password.liquid
locales/     fr.default.json (toutes les chaînes de l'interface)
sections/    sections de pages, groupes header-group.json / footer-group.json
snippets/    composants réutilisables (carte produit, prix, badges, panier, filtres…)
templates/   modèles JSON (accueil, produit, collections, pages, panier, recherche, comptes…)
docs/        guide d'installation, de personnalisation et rapport de tests
.github/     validation automatique (Theme Check) et déploiement manuel
```

## Démarrage rapide

```bash
# Prévisualiser le thème en local sur la boutique (connexion navigateur demandée la première fois)
shopify theme dev -e development

# Envoyer le thème comme nouveau thème non publié
shopify theme push -e development --unpublished --theme "Les p'tits bons plans"

# Valider le code
shopify theme check
```

Documentation complète :

- [Guide d'installation et de connexion Shopify](docs/INSTALLATION.md)
- [Guide de personnalisation (éditeur de thème)](docs/PERSONNALISATION.md)
- [Rapport de tests et limites connues](docs/TESTS.md)
