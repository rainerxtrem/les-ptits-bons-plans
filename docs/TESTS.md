# Rapport de tests

## Vérifications exécutées

| Vérification | Outil | Résultat |
| --- | --- | --- |
| Validation du thème : syntaxe Liquid, schémas des sections, objets, filtres, traductions, fichiers manquants, bonnes pratiques de performance | `shopify theme check` (Shopify CLI 3.94) | **87 fichiers, 0 erreur, 0 avertissement** |
| Syntaxe JavaScript | `node --check assets/theme.js` | OK |
| Validité JSON (réglages, modèles, groupes, traductions) | analyseur JSON Python | OK, tous les fichiers |
| Polices | contrôle des fichiers woff2 (sous-ensemble latin : accents français, œ, guillemets) | OK |
| Contrastes des couleurs (WCAG 2.1) | calcul de luminance relative | Bouton `#5B6C60` / blanc : 5,59:1 ; rouge promo `#B04A3F` / blanc : 5,39:1 ; anthracite / sauge : 6,33:1 ; or profond `#84662A` / ivoire : 4,92:1 ; ivoire / vert du pied de page : 9,54:1. Le `#6E7F73` de la charte sur blanc (4,25:1) est insuffisant pour du texte, d'où la teinte ajustée des boutons |

La validation automatique est relancée à chaque push par le workflow GitHub **Theme Check**.

## À tester sur la boutique

Ces tests demandent un accès à la boutique, avec des produits, collections et réglages réels. Ils n'ont pas encore pu être exécutés : la session Shopify CLI de l'environnement de développement n'avait pas accès à `10vqni-hy.myshopify.com`.

### Parcours d'achat
- [ ] Fiche produit avec variantes : le changement d'option met à jour le prix, le prix barré, le badge, la disponibilité, la référence, l'image et l'URL (`?variant=`).
- [ ] Combinaison inexistante : bouton « Indisponible » désactivé.
- [ ] Variante épuisée (suivi de stock, vente hors stock désactivée) : bouton « Épuisé » désactivé.
- [ ] Ajout au panier depuis la fiche, puis depuis l'ajout rapide d'une carte : ouverture du tiroir, compteur mis à jour.
- [ ] Erreur d'ajout (quantité supérieure au stock) : message affiché sous le bouton.
- [ ] Panier tiroir et page panier : + / −, saisie directe, suppression, total mis à jour, code de réduction valide et invalide, note de commande.
- [ ] Passage en caisse : redirection vers le checkout Shopify.
- [ ] Boutons de paiement express : affichés uniquement si activés dans Shopify.

### Navigation et recherche
- [ ] Menu principal avec sous-menus (liste déroulante) et 3ᵉ niveau (méga-menu), à la souris et au clavier (Tab, Entrée, Échap).
- [ ] Menu mobile (tiroir), recherche (modale), en-tête fixe « en remontant ».
- [ ] Recherche prédictive : produits, collections, pages ; flèches haut et bas, Entrée.
- [ ] Page de recherche : résultats, filtres, aucun résultat.

### Collections
- [ ] Filtres Search & Discovery (cases à cocher, prix), tri, puces de filtres actifs, « Tout effacer », boutons précédent et suivant du navigateur.
- [ ] Filtres sur mobile (panneau), pagination.

### Formulaires
- [ ] Contact et demande professionnelle : champs obligatoires, messages d'erreur, message de confirmation, réception de l'e-mail.
- [ ] Newsletter (section et pied de page) : inscription réelle visible dans **Clients**, e-mail déjà inscrit, e-mail invalide.

### Responsive et accessibilité
- [ ] Largeurs 320, 375, 390, 430, 768, 1280 et 1440 px : pas de défilement horizontal ni de chevauchement.
- [ ] Navigation complète au clavier, focus visible, lecteur d'écran (NVDA / VoiceOver) sur le panier et les variantes.
- [ ] `prefers-reduced-motion` : animations désactivées.

### Performance et SEO
- [ ] Lighthouse (mobile) sur l'accueil, une collection et une fiche produit ; corriger les points relevés.
- [ ] Test des résultats enrichis Google sur une fiche produit (données structurées générées par le filtre Shopify `structured_data`).

## Limites connues

- **Variantes** : les combinaisons d'options sont résolues par Shopify via `option_values`, ce qui fonctionne jusqu'à 2 048 variantes. La liste de secours sans JavaScript affiche les 250 premières.
- **Filtre « en promotion »** de la section *Produits mis en avant* : analyse les 50 premiers produits de la collection choisie. Pour un grand catalogue, utilisez une collection automatique « Prix avant réduction > 0 ».
- **Modèles 3D** : affichés sous forme d'image d'aperçu.
- **Comptes clients** : les modèles `customers/*` servent aux comptes classiques. Avec les nouveaux comptes clients Shopify, ce sont les pages hébergées par Shopify qui s'affichent.
- **Langues** : l'interface est en français (`fr.default.json`). Pour une autre langue, ajoutez un fichier `locales/xx.json` ou utilisez l'application Translate & Adapt.
