# Installation et connexion à Shopify

Boutique : `10vqni-hy.myshopify.com` (domaine principal : `globaldeals-3082.myshopify.com`).

Trois méthodes sont possibles. La **méthode 1** est recommandée : chaque `git push` met le thème à jour dans Shopify, et les modifications faites dans l'éditeur de thème sont renvoyées dans GitHub.

---

## Méthode 1 — Intégration GitHub native de Shopify (recommandée)

Le thème est à la racine du dépôt (dossiers `assets/`, `config/`, `layout/`…), comme l'exige l'intégration.

1. Dans l'administration Shopify : **Boutique en ligne > Thèmes**.
2. Dans la bibliothèque de thèmes, cliquez sur **Ajouter un thème > Se connecter depuis GitHub**.
3. Connectez votre compte GitHub `rainerxtrem` et autorisez l'application Shopify sur le dépôt `les-ptits-bons-plans`.
4. Choisissez le dépôt `rainerxtrem/les-ptits-bons-plans` et la branche `main`.
5. Le thème apparaît dans la bibliothèque : **Personnaliser** pour le configurer, puis **Publier** quand il est prêt.

Fonctionnement :

- un commit sur `main` met automatiquement le thème à jour dans Shopify ;
- les modifications faites dans l'éditeur de thème sont commitées par Shopify dans `config/settings_data.json` et `templates/*.json` : pensez à faire un `git pull` avant de modifier ces fichiers localement ;
- pour tester des changements sans toucher le thème en ligne, créez une branche (par exemple `develop`) et connectez-la comme second thème.

## Méthode 2 — Shopify CLI (développement local)

Prérequis : Node.js 18 ou plus, puis `npm install -g @shopify/cli@latest`.

```bash
git clone https://github.com/rainerxtrem/les-ptits-bons-plans.git
cd les-ptits-bons-plans

# Prévisualisation en direct (rechargement à chaque modification)
shopify theme dev -e development

# Envoi comme nouveau thème non publié
shopify theme push -e development --unpublished --theme "Les p'tits bons plans"

# Mise à jour d'un thème existant (ID visible avec : shopify theme list -e development)
shopify theme push -e development --theme <ID>
```

Le fichier `shopify.theme.toml` contient déjà l'adresse de la boutique. La première commande ouvre une page de connexion Shopify dans le navigateur ; aucune clé n'est stockée dans le dépôt.

## Méthode 3 — Déploiement depuis GitHub Actions

Utile pour déployer sans poste local.

1. Dans Shopify, installez l'application **Theme Access** et générez un mot de passe pour votre adresse e-mail.
2. Dans GitHub : **Settings > Secrets and variables > Actions**, créez :
   - `SHOPIFY_CLI_THEME_TOKEN` : le mot de passe Theme Access ;
   - `SHOPIFY_FLAG_STORE` : `10vqni-hy.myshopify.com`.
3. Onglet **Actions > Déployer sur Shopify > Run workflow**. Laissez « thème » vide pour créer un thème non publié, ou indiquez l'ID d'un thème existant. Le thème publié n'est modifié que si l'option `allow_live` est cochée.

À chaque push, le workflow **Theme Check** valide aussi automatiquement le code (Liquid, schémas JSON, traductions, syntaxe JavaScript).

## Import manuel (archive .zip)

```bash
git archive --format=zip -o les-ptits-bons-plans.zip HEAD assets config layout locales sections snippets templates
```

Puis, dans **Boutique en ligne > Thèmes > Ajouter un thème > Importer un fichier .zip**.

---

## Configuration Shopify à faire après l'installation

Le thème lit les données réelles de la boutique. Pour que chaque page soit complète :

### 1. Menus (Boutique en ligne > Navigation)

**Menu principal** (`main-menu`), dans l'ordre souhaité :

| Entrée | Lien |
| --- | --- |
| Accueil | Page d'accueil |
| Catalogue | Collections > Toutes les collections (ajoutez les sous-catégories en sous-menus : un 3ᵉ niveau active le méga-menu) |
| Nouveautés | Collection « Nouveautés » |
| Les bons plans | Collection « Les bons plans » |
| Cadeaux d'entreprise | Page « Cadeaux d'entreprise » |
| À propos | Page « À propos » |
| Contact | Page « Contact » |

**Pied de page** (`footer`) : FAQ, Livraison et retours, Suivi de commande, Contact.

### 2. Collections (Produits > Collections)

| Collection | Type | Conditions | Modèle de thème |
| --- | --- | --- | --- |
| Les bons plans | Automatique | « Prix avant réduction » *est supérieur à* 0 | `collection.bons-plans` |
| Nouveautés | Automatique (par ex. étiquette `nouveau`) ou manuelle, tri « Plus récent » | `collection.nouveautes` |
| Meilleures ventes | Automatique, tri **Meilleures ventes** | `collection` |
| Catégories (Maison, Accessoires…) | Au choix | `collection` |

Le tri « Meilleures ventes » est calculé par Shopify à partir des ventes réelles : la collection n'a de sens qu'une fois des commandes passées.

### 3. Pages (Boutique en ligne > Pages)

Créez les pages et choisissez le **modèle de thème** indiqué :

| Page | Modèle |
| --- | --- |
| À propos | `page.about` |
| Contact | `page.contact` |
| FAQ | `page.faq` |
| Cadeaux d'entreprise | `page.corporate-gifts` |
| Suivi de commande | `page.order-info` |
| Mentions légales | `page.legal` |

### 4. Politiques légales (Paramètres > Politiques)

Renseignez les conditions générales de vente, la politique de confidentialité, la politique de remboursement, la politique d'expédition et les mentions légales **avec les informations exactes de l'entreprise** (raison sociale, SIRET, adresse, médiateur de la consommation…). Elles s'affichent automatiquement dans le pied de page et sur les pages `/policies/…`, mises en forme par le thème.

### 5. Filtres (application Shopify Search & Discovery)

Installez l'application gratuite **Search & Discovery** et activez les filtres : Disponibilité, Prix, Type de produit, Marque, Options (taille, couleur…). Ils apparaissent automatiquement sur les collections et la recherche.

### 6. Réglages du thème

Voir le [guide de personnalisation](PERSONNALISATION.md) : logo, coordonnées, réseaux sociaux, type de panier, etc.
