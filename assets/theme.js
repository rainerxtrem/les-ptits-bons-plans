/**
 * Les p'tits bons plans — interactions du thème.
 * JavaScript natif (aucune dépendance). Chaque interaction est un custom element
 * ou un gestionnaire délégué, chargé en `defer`. Le rendu HTML reste côté Shopify
 * (Section Rendering API) : le JS ne fabrique ni prix ni disponibilité.
 */
(() => {
  'use strict';

  const theme = window.theme || {};
  const routes = theme.routes || {};
  const strings = theme.strings || {};
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------ *
   * Utilitaires
   * ------------------------------------------------------------------ */
  const debounce = (fn, wait = 300) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  };

  const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');

  /** Contenu interne d'une section renvoyée par la Section Rendering API. */
  const sectionInner = (html) => {
    const doc = parseHTML(html);
    const wrapper = doc.querySelector('.shopify-section') || doc.body.firstElementChild;
    return wrapper ? wrapper.innerHTML : html;
  };

  const jsonFetch = async (url, body) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status) {
      const err = new Error(data.description || data.message || strings.cartError);
      err.data = data;
      throw err;
    }
    return data;
  };

  const toastEl = () => document.getElementById('ThemeToast');
  let toastTimer;
  const toast = (html) => {
    const el = toastEl();
    if (!el) return;
    el.innerHTML = html;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 4500);
  };

  const checkIcon =
    '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

  /** Verrouille le défilement lorsqu'un panneau modal est ouvert. */
  const lockScroll = (locked) => document.body.classList.toggle('is-locked', locked);

  /** Piège de focus pour les panneaux qui ne sont pas des <dialog>. */
  const focusableSelector =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const trapFocus = (container, event) => {
    if (event.key !== 'Tab') return;
    const items = [...container.querySelectorAll(focusableSelector)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  /* ------------------------------------------------------------------ *
   * Dialogues (menu mobile, recherche, panier, zoom)
   * <button data-dialog-open="DialogId"> ouvre un <dialog id="DialogId">.
   * ------------------------------------------------------------------ */
  const openDialog = (dialog, opener) => {
    if (!dialog || dialog.open) return;
    dialog._opener = opener || document.activeElement;
    dialog.showModal();
    lockScroll(true);
    if (opener) opener.setAttribute('aria-expanded', 'true');
    dialog.dispatchEvent(new CustomEvent('dialog:open'));
  };

  const closeDialog = (dialog) => {
    if (!dialog || !dialog.open) return;
    dialog.close();
  };

  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-dialog-open]');
    if (opener) {
      const dialog = document.getElementById(opener.dataset.dialogOpen);
      if (dialog) {
        event.preventDefault();
        openDialog(dialog, opener);
      }
      return;
    }
    const closer = event.target.closest('[data-drawer-close]');
    if (closer && closer.closest('dialog')) {
      closeDialog(closer.closest('dialog'));
      return;
    }
    // Clic sur le fond (::backdrop) d'un dialogue.
    if (event.target.tagName === 'DIALOG' && event.target.open) {
      const rect = event.target.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) closeDialog(event.target);
    }
  });

  document.addEventListener(
    'close',
    (event) => {
      const dialog = event.target;
      if (dialog.tagName !== 'DIALOG') return;
      if (!document.querySelector('dialog[open]')) lockScroll(false);
      const opener = dialog._opener;
      if (opener) {
        if (opener.hasAttribute('aria-expanded')) opener.setAttribute('aria-expanded', 'false');
        if (document.contains(opener)) opener.focus({ preventScroll: true });
      }
    },
    true
  );

  /* ------------------------------------------------------------------ *
   * En-tête : sticky, menus déroulants, méga-menu
   * ------------------------------------------------------------------ */
  class HeaderWrapper extends HTMLElement {
    connectedCallback() {
      this.mode = this.dataset.sticky || 'none';
      const root = this.closest('.shopify-section') || this;
      if (this.mode !== 'none') {
        root.classList.add('shopify-section-header-sticky');
      }
      this.lastY = window.scrollY;
      this.onScroll = this.onScroll.bind(this);
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.updateHeight();
      window.addEventListener('resize', debounce(() => this.updateHeight(), 150));

      this.menus = [...this.querySelectorAll('details[data-menu]')];
      this.menus.forEach((details) => {
        details.addEventListener('toggle', () => {
          if (details.open) this.menus.forEach((other) => other !== details && other.removeAttribute('open'));
        });
        if (window.matchMedia('(hover: hover)').matches) {
          let leaveTimer;
          details.addEventListener('mouseenter', () => {
            clearTimeout(leaveTimer);
            details.setAttribute('open', '');
          });
          details.addEventListener('mouseleave', () => {
            leaveTimer = setTimeout(() => details.removeAttribute('open'), 160);
          });
        }
      });

      document.addEventListener('click', (event) => {
        this.menus.forEach((details) => {
          if (details.open && !details.contains(event.target)) details.removeAttribute('open');
        });
      });
      this.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const open = this.menus.find((d) => d.open);
        if (open) {
          open.removeAttribute('open');
          open.querySelector('summary').focus();
        }
      });
      // Ferme un menu quand le focus clavier le quitte.
      this.addEventListener('focusout', (event) => {
        this.menus.forEach((details) => {
          if (details.open && !details.contains(event.relatedTarget)) details.removeAttribute('open');
        });
      });
    }

    updateHeight() {
      document.documentElement.style.setProperty('--header-height', `${this.offsetHeight}px`);
    }

    onScroll() {
      const y = window.scrollY;
      this.classList.toggle('is-scrolled', y > 10);
      if (this.mode === 'scroll-up') {
        const goingDown = y > this.lastY && y > this.offsetHeight + 40;
        const anyOpen = this.menus && this.menus.some((d) => d.open);
        this.classList.toggle('is-hidden', goingDown && !anyOpen);
      }
      this.lastY = y;
    }
  }
  customElements.define('header-wrapper', HeaderWrapper);

  /* ------------------------------------------------------------------ *
   * Barre d'annonce : défilement manuel, rotation facultative avec pause
   * ------------------------------------------------------------------ */
  class AnnouncementBar extends HTMLElement {
    connectedCallback() {
      this.items = [...this.querySelectorAll('.announcement__item')];
      if (this.items.length < 2) return;
      this.index = 0;
      this.querySelector('[data-prev]')?.addEventListener('click', () => this.go(-1));
      this.querySelector('[data-next]')?.addEventListener('click', () => this.go(1));
      this.pauseBtn = this.querySelector('[data-pause]');
      const speed = parseInt(this.dataset.autoplay, 10);
      if (speed > 0 && !reducedMotion.matches) {
        this.speed = speed * 1000;
        this.play();
        this.addEventListener('mouseenter', () => this.stop());
        this.addEventListener('mouseleave', () => !this.userPaused && this.play());
        this.addEventListener('focusin', () => this.stop());
        this.pauseBtn?.addEventListener('click', () => {
          this.userPaused = !this.userPaused;
          this.pauseBtn.setAttribute('aria-pressed', String(this.userPaused));
          this.userPaused ? this.stop() : this.play();
        });
      } else if (this.pauseBtn) {
        this.pauseBtn.hidden = true;
      }
    }
    go(step) {
      this.items[this.index].classList.remove('is-active');
      this.index = (this.index + step + this.items.length) % this.items.length;
      this.items[this.index].classList.add('is-active');
    }
    play() {
      this.stop();
      this.timer = setInterval(() => this.go(1), this.speed);
    }
    stop() {
      clearInterval(this.timer);
    }
  }
  customElements.define('announcement-bar', AnnouncementBar);

  /* ------------------------------------------------------------------ *
   * Recherche prédictive (API Shopify /search/suggest)
   * ------------------------------------------------------------------ */
  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input[type="search"]');
      this.results = this.querySelector('[data-predictive-results]');
      this.status = this.querySelector('[data-predictive-status]');
      if (!this.input || !this.results || this.dataset.enabled !== 'true') return;
      this.cache = new Map();
      this.input.addEventListener('input', debounce(() => this.onInput(), 250));
      this.input.addEventListener('keydown', (e) => this.onKeydown(e));
      this.closest('dialog')?.addEventListener('dialog:open', () => setTimeout(() => this.input.focus(), 50));
    }

    get term() {
      return this.input.value.trim();
    }

    async onInput() {
      const term = this.term;
      if (term.length < 2) {
        this.close();
        return;
      }
      if (this.cache.has(term)) {
        this.render(this.cache.get(term));
        return;
      }
      this.controller?.abort();
      this.controller = new AbortController();
      const params = new URLSearchParams({
        q: term,
        section_id: 'predictive-search',
        'resources[type]': 'product,collection,query,page',
        'resources[limit]': '6',
        'resources[limit_scope]': 'each',
        'resources[options][unavailable_products]': 'last',
      });
      try {
        const res = await fetch(`${routes.predictiveSearch}?${params}`, { signal: this.controller.signal });
        if (!res.ok) throw new Error(res.status);
        const html = sectionInner(await res.text());
        this.cache.set(term, html);
        this.render(html);
      } catch (e) {
        if (e.name !== 'AbortError') this.close();
      }
    }

    render(html) {
      this.results.innerHTML = html;
      this.results.hidden = false;
      this.input.setAttribute('aria-expanded', 'true');
      this.activeIndex = -1;
      const count = this.results.querySelectorAll('[role="option"]').length;
      if (this.status) this.status.textContent = this.results.querySelector('[data-predictive-live]')?.textContent || '';
      this.options = [...this.results.querySelectorAll('[role="option"]')];
      return count;
    }

    close() {
      this.results.hidden = true;
      this.results.innerHTML = '';
      this.input.setAttribute('aria-expanded', 'false');
      this.input.removeAttribute('aria-activedescendant');
    }

    onKeydown(event) {
      if (!this.options || this.results.hidden) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const dir = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex = (this.activeIndex + dir + this.options.length) % this.options.length;
        this.options.forEach((opt, i) => opt.setAttribute('aria-selected', String(i === this.activeIndex)));
        const active = this.options[this.activeIndex];
        this.input.setAttribute('aria-activedescendant', active.id);
        active.scrollIntoView({ block: 'nearest' });
      } else if (event.key === 'Enter' && this.activeIndex >= 0) {
        const link = this.options[this.activeIndex].querySelector('a');
        if (link) {
          event.preventDefault();
          link.click();
        }
      }
    }
  }
  customElements.define('predictive-search', PredictiveSearch);

  /* ------------------------------------------------------------------ *
   * Panier : API Ajax + Section Rendering API
   * ------------------------------------------------------------------ */
  const Cart = {
    sectionsToRender() {
      const ids = ['cart-icon-bubble'];
      if (document.getElementById('CartDrawer')) ids.push('cart-drawer');
      document.querySelectorAll('[data-main-cart]').forEach((el) => ids.push(el.dataset.sectionId));
      return ids;
    },

    render(sections, itemCount) {
      if (!sections) return;
      const focusedId = document.activeElement && document.activeElement.id;
      if (sections['cart-icon-bubble']) {
        const html = sectionInner(sections['cart-icon-bubble']);
        document.querySelectorAll('[data-cart-bubble-wrapper]').forEach((el) => {
          el.innerHTML = html;
          el.querySelector('.cart-bubble')?.classList.add('is-bumped');
        });
      }
      if (sections['cart-drawer']) {
        const target = document.getElementById('CartDrawer-Contents');
        if (target) target.innerHTML = sectionInner(sections['cart-drawer']);
      }
      document.querySelectorAll('[data-main-cart]').forEach((el) => {
        const html = sections[el.dataset.sectionId];
        if (html) {
          const doc = parseHTML(html);
          const fresh = doc.querySelector('[data-main-cart]');
          if (fresh) el.innerHTML = fresh.innerHTML;
        }
      });
      if (typeof itemCount === 'number') {
        document.querySelectorAll('[data-cart-count]').forEach((el) => (el.textContent = `(${itemCount})`));
      }
      if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: { itemCount } }));
    },

    async refresh() {
      const ids = this.sectionsToRender().join(',');
      const res = await fetch(`${window.location.pathname}?sections=${encodeURIComponent(ids)}`);
      const sections = await res.json();
      const cart = await (await fetch(`${routes.cart}.js`)).json();
      this.render(sections, cart.item_count);
    },

    async change(key, quantity) {
      const data = await jsonFetch(`${routes.cartChange}.js`, {
        id: key,
        quantity,
        sections: this.sectionsToRender(),
        sections_url: window.location.pathname,
      });
      this.render(data.sections, data.item_count);
      return data;
    },

    async update(body) {
      const data = await jsonFetch(`${routes.cartUpdate}.js`, {
        ...body,
        sections: this.sectionsToRender(),
        sections_url: window.location.pathname,
      });
      this.render(data.sections, data.item_count);
      return data;
    },

    open() {
      const dialog = document.getElementById('CartDrawer');
      if (dialog) {
        openDialog(dialog, document.querySelector('[data-cart-opener]'));
        return true;
      }
      return false;
    },
  };
  window.theme.cart = Cart;

  // Ouverture du tiroir depuis l'icône panier (lien réel vers /cart sans JS).
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-cart-opener]');
    if (opener && document.getElementById('CartDrawer') && theme.cartType === 'drawer') {
      event.preventDefault();
      Cart.open();
    }
  });

  // Suppression d'une ligne.
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-cart-remove]');
    if (!btn) return;
    event.preventDefault();
    const line = btn.closest('.cart-item');
    line?.classList.add('is-loading');
    try {
      await Cart.change(btn.dataset.cartRemove, 0);
    } catch (e) {
      line?.classList.remove('is-loading');
      showLineError(line, e.message);
    }
  });

  const showLineError = (line, message) => {
    const box = line?.querySelector('.cart-item__error');
    if (!box) return toast(message);
    box.textContent = message;
    box.hidden = false;
  };

  /* Sélecteur de quantité (fiche produit et panier) */
  class QuantityInput extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input');
      this.minus = this.querySelector('[name="minus"]');
      this.plus = this.querySelector('[name="plus"]');
      this.minus?.addEventListener('click', () => this.step(-1));
      this.plus?.addEventListener('click', () => this.step(1));
      this.input.addEventListener('change', () => this.onChange());
      this.updateButtons();
      if (this.hasAttribute('data-cart-quantity')) {
        this.commit = debounce(() => this.commitToCart(), 400);
      }
    }
    get min() {
      return parseInt(this.input.dataset.min || this.input.min || '1', 10);
    }
    step(dir) {
      const step = parseInt(this.input.step || '1', 10) || 1;
      const max = this.input.max ? parseInt(this.input.max, 10) : Infinity;
      const isCart = this.hasAttribute('data-cart-quantity');
      let value = (parseInt(this.input.value, 10) || 0) + dir * step;
      const floor = isCart ? 0 : this.min;
      if (isCart && dir < 0 && value < this.min) value = 0;
      value = Math.min(Math.max(value, floor), max);
      this.input.value = value;
      this.onChange();
    }
    onChange() {
      this.updateButtons();
      if (this.commit) this.commit();
    }
    updateButtons() {
      const value = parseInt(this.input.value, 10) || 0;
      const isCart = this.hasAttribute('data-cart-quantity');
      if (this.minus) this.minus.disabled = value <= (isCart ? 0 : this.min);
      if (this.plus && this.input.max) this.plus.disabled = value >= parseInt(this.input.max, 10);
    }
    async commitToCart() {
      const line = this.closest('.cart-item');
      line?.classList.add('is-loading');
      const quantity = Math.max(0, parseInt(this.input.value, 10) || 0);
      try {
        const data = await Cart.change(this.input.dataset.key, quantity);
        // Shopify peut plafonner la quantité au stock disponible.
        const item = data.items?.find((i) => i.key === this.input.dataset.key);
        if (item && item.quantity < quantity) {
          const fresh = document.querySelector(`.cart-item[data-key="${CSS.escape(item.key)}"]`);
          showLineError(fresh, strings.cartError);
        }
      } catch (e) {
        line?.classList.remove('is-loading');
        showLineError(line, e.message);
      }
    }
  }
  customElements.define('quantity-input', QuantityInput);

  /* Code de réduction (Ajax Cart API : paramètre `discount`) */
  class CartDiscount extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      this.error = this.querySelector('.form-message--error');
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = this.form.discount.value.trim();
        if (code) this.apply([...this.currentCodes(), code], code);
      });
      this.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-discount-remove]');
        if (!btn) return;
        const remaining = this.currentCodes().filter((c) => c !== btn.dataset.discountRemove);
        this.apply(remaining);
      });
    }
    currentCodes() {
      return [...this.querySelectorAll('[data-discount-remove]')].map((b) => b.dataset.discountRemove);
    }
    async apply(codes, added) {
      this.error.hidden = true;
      const button = this.form.querySelector('button');
      button.classList.add('is-loading');
      try {
        const data = await Cart.update({ discount: codes.join(',') });
        if (added) {
          const found = (data.discount_codes || []).find((d) => d.code.toLowerCase() === added.toLowerCase());
          if (!found || !found.applicable) {
            const box = document.querySelector('cart-discount .form-message--error');
            if (box) {
              box.textContent = strings.discountInvalid;
              box.hidden = false;
            }
          }
        }
      } catch (e) {
        this.error.textContent = e.message;
        this.error.hidden = false;
      } finally {
        button.classList.remove('is-loading');
      }
    }
  }
  customElements.define('cart-discount', CartDiscount);

  /* Note de commande */
  class CartNote extends HTMLElement {
    connectedCallback() {
      const field = this.querySelector('textarea');
      field.addEventListener(
        'input',
        debounce(() => {
          fetch(`${routes.cartUpdate}.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: field.value }),
          });
        }, 500)
      );
    }
  }
  customElements.define('cart-note', CartNote);

  /* ------------------------------------------------------------------ *
   * Formulaire produit : ajout au panier sans rechargement
   * ------------------------------------------------------------------ */
  class ProductForm extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      if (!this.form) return;
      this.submitBtn = this.form.querySelector('[type="submit"][name="add"]');
      this.error = this.querySelector('.form-message--error');
      this.success = this.querySelector('[data-add-success]');
      this.form.addEventListener('submit', (e) => this.onSubmit(e));
    }

    async onSubmit(event) {
      event.preventDefault();
      if (!this.submitBtn || this.submitBtn.disabled || this.submitBtn.classList.contains('is-loading')) return;
      this.setError(null);
      if (this.success) this.success.hidden = true;
      this.submitBtn.classList.add('is-loading');
      this.submitBtn.setAttribute('aria-busy', 'true');

      const formData = new FormData(this.form);
      const sections = Cart.sectionsToRender();
      formData.append('sections', sections.join(','));
      formData.append('sections_url', window.location.pathname);

      try {
        const res = await fetch(`${routes.cartAdd}.js`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || data.status) throw new Error(data.description || data.message || strings.cartError);

        const cart = await (await fetch(`${routes.cart}.js`)).json();
        Cart.render(data.sections, cart.item_count);

        if (theme.cartType === 'drawer' && Cart.open()) {
          // Le tiroir s'ouvre : il sert de confirmation.
        } else if (this.success) {
          this.success.hidden = false;
        } else {
          toast(`${checkIcon}<span>${strings.added}</span> <a href="${routes.cart}">${strings.viewCart}</a>`);
        }
      } catch (e) {
        this.setError(e.message);
      } finally {
        this.submitBtn.classList.remove('is-loading');
        this.submitBtn.removeAttribute('aria-busy');
      }
    }

    setError(message) {
      if (!this.error) {
        if (message) toast(message);
        return;
      }
      this.error.textContent = message || '';
      this.error.hidden = !message;
    }
  }
  customElements.define('product-form', ProductForm);

  /* ------------------------------------------------------------------ *
   * Sélecteur de variantes
   * Les valeurs d'option envoient leurs identifiants à Shopify (paramètre
   * option_values) : le serveur renvoie la variante, le prix, la disponibilité,
   * la référence et l'état du bouton. Rien n'est calculé côté client.
   * ------------------------------------------------------------------ */
  class VariantPicker extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      this.productUrl = this.dataset.productUrl;
      this.addEventListener('change', () => this.onChange());
    }

    selectedOptionValueIds() {
      return [...this.querySelectorAll('input[type="radio"]:checked, select option:checked')].map(
        (el) => el.dataset.optionValueId
      );
    }

    async onChange() {
      const ids = this.selectedOptionValueIds().filter(Boolean);
      const section = document.getElementById(`MainProduct-${this.sectionId}`);
      section?.classList.add('is-updating');
      this.controller?.abort();
      this.controller = new AbortController();
      const url = `${this.productUrl}?option_values=${ids.join(',')}&section_id=${this.sectionId}`;
      try {
        const html = await (await fetch(url, { signal: this.controller.signal })).text();
        const doc = parseHTML(html);
        const fresh = doc.getElementById(`MainProduct-${this.sectionId}`);
        if (!fresh || !section) return;

        // Remplace les zones dépendantes de la variante, en conservant le focus.
        const focusedId = document.activeElement?.id;
        section.querySelectorAll('[data-variant-update]').forEach((el) => {
          const key = el.dataset.variantUpdate;
          const next = fresh.querySelector(`[data-variant-update="${key}"]`);
          if (next) el.innerHTML = next.innerHTML;
        });
        if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });

        const variantId = fresh.dataset.variantId;
        section.dataset.variantId = variantId;
        section.querySelectorAll('input[name="id"]').forEach((input) => {
          input.value = variantId || '';
        });
        if (variantId) {
          const next = new URL(window.location.href);
          next.searchParams.set('variant', variantId);
          window.history.replaceState({}, '', next.toString());
        }
        const mediaId = fresh.dataset.featuredMediaId;
        if (mediaId) section.querySelector('product-gallery')?.showMedia(mediaId);
        section.dispatchEvent(new CustomEvent('variant:change', { bubbles: true, detail: { variantId } }));
      } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
      } finally {
        section?.classList.remove('is-updating');
      }
    }
  }
  customElements.define('variant-picker', VariantPicker);

  /* ------------------------------------------------------------------ *
   * Galerie produit : défilement, vignettes, zoom
   * ------------------------------------------------------------------ */
  class ProductGallery extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-gallery-track]');
      this.slides = [...this.querySelectorAll('[data-media-id]')];
      this.thumbs = [...this.querySelectorAll('[data-thumb]')];
      this.counter = this.querySelector('[data-gallery-counter]');
      this.lightbox = this.querySelector('dialog.lightbox');
      if (!this.track) return;

      this.thumbs.forEach((thumb) =>
        thumb.addEventListener('click', () => this.showMedia(thumb.dataset.thumb, true))
      );
      this.querySelector('[data-gallery-prev]')?.addEventListener('click', () => this.go(-1));
      this.querySelector('[data-gallery-next]')?.addEventListener('click', () => this.go(1));
      this.track.addEventListener('scroll', debounce(() => this.syncFromScroll(), 60), { passive: true });
      this.track.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') this.go(1);
        if (e.key === 'ArrowLeft') this.go(-1);
      });

      this.querySelectorAll('[data-zoom]').forEach((btn) =>
        btn.addEventListener('click', () => this.openZoom(btn.dataset.zoom, btn))
      );

      // Affiche directement le média de la variante sélectionnée (lien ?variant=…).
      const initial = this.slides.findIndex((s) => s.dataset.mediaId === this.dataset.initialMedia);
      if (initial > 0 && !this.isGridLayout()) {
        this.track.scrollLeft = this.slides[initial].offsetLeft;
        this.setActive(initial);
      }
    }

    get index() {
      return Math.round(this.track.scrollLeft / Math.max(this.track.clientWidth, 1));
    }

    isGridLayout() {
      return this.classList.contains('gallery--grid') && window.matchMedia('(min-width: 990px)').matches;
    }

    go(dir) {
      const next = Math.min(Math.max(this.index + dir, 0), this.slides.length - 1);
      this.scrollTo(next);
    }

    scrollTo(i, focus) {
      const slide = this.slides[i];
      if (!slide) return;
      this.pauseVideos();
      if (this.isGridLayout()) {
        slide.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
      } else {
        this.track.scrollTo({ left: slide.offsetLeft, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      }
      this.setActive(i);
      if (focus) slide.querySelector('button, video, iframe')?.focus({ preventScroll: true });
    }

    showMedia(mediaId, focus) {
      const i = this.slides.findIndex((s) => s.dataset.mediaId === String(mediaId));
      if (i >= 0) this.scrollTo(i, focus);
    }

    syncFromScroll() {
      if (!this.isGridLayout()) this.setActive(this.index);
    }

    setActive(i) {
      this.thumbs.forEach((t, n) => t.setAttribute('aria-current', String(n === i)));
      this.thumbs[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (this.counter) this.counter.textContent = `${i + 1} / ${this.slides.length}`;
    }

    pauseVideos() {
      this.querySelectorAll('video').forEach((v) => v.pause());
      this.querySelectorAll('iframe[src*="youtube"]').forEach((f) =>
        f.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*')
      );
      this.querySelectorAll('iframe[src*="vimeo"]').forEach((f) =>
        f.contentWindow?.postMessage('{"method":"pause"}', '*')
      );
    }

    openZoom(mediaId, opener) {
      if (!this.lightbox) return;
      openDialog(this.lightbox, opener);
      const target = this.lightbox.querySelector(`[data-lightbox-id="${mediaId}"]`);
      requestAnimationFrame(() => target?.scrollIntoView({ block: 'start' }));
    }
  }
  customElements.define('product-gallery', ProductGallery);

  /* ------------------------------------------------------------------ *
   * Barre d'achat collante sur mobile
   * ------------------------------------------------------------------ */
  class StickyAtc extends HTMLElement {
    connectedCallback() {
      const target = document.getElementById(this.dataset.target);
      if (!target || !('IntersectionObserver' in window)) return;
      new IntersectionObserver(([entry]) => {
        const above = entry.boundingClientRect.top < 0;
        this.classList.toggle('is-visible', !entry.isIntersecting && above);
        this.setAttribute('aria-hidden', String(!(!entry.isIntersecting && above)));
      }).observe(target);
      this.querySelector('button')?.addEventListener('click', () => {
        target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
        target.querySelector('[name="add"]')?.focus({ preventScroll: true });
      });
    }
  }
  customElements.define('sticky-atc', StickyAtc);

  /* ------------------------------------------------------------------ *
   * Recommandations produit (API Shopify /recommendations/products)
   * ------------------------------------------------------------------ */
  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      if (!this.dataset.url) return;
      const load = async () => {
        try {
          const html = await (await fetch(this.dataset.url)).text();
          const doc = parseHTML(html);
          const fresh = doc.querySelector('product-recommendations');
          if (fresh && fresh.querySelector('.card-product')) {
            this.innerHTML = fresh.innerHTML;
            this.closest('.section')?.removeAttribute('hidden');
          } else {
            this.closest('.section')?.setAttribute('hidden', '');
          }
        } catch (e) {
          this.closest('.section')?.setAttribute('hidden', '');
        }
      };
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting) {
              io.disconnect();
              load();
            }
          },
          { rootMargin: '0px 0px 400px 0px' }
        );
        // La section est masquée tant qu'elle est vide : on observe son conteneur Shopify.
        io.observe(this.closest('.shopify-section') || this);
      } else {
        load();
      }
    }
  }
  customElements.define('product-recommendations', ProductRecommendations);

  /* ------------------------------------------------------------------ *
   * Filtres et tri (Section Rendering API, historique conservé)
   * ------------------------------------------------------------------ */
  class FacetFilters extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      this.form = this.querySelector('form');
      this.panel = this.querySelector('[data-facets-panel]');
      this.overlay = this.querySelector('.facets__overlay');
      this.openBtn = this.querySelector('[data-facets-open]');

      const update = debounce(() => this.submit(), 450);
      this.form.addEventListener('input', (e) => {
        if (e.target.type === 'number') update();
      });
      this.form.addEventListener('change', (e) => {
        if (e.target.type !== 'number') this.submit();
      });
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submit();
        this.closePanel();
      });
      this.addEventListener('click', (e) => {
        const link = e.target.closest('[data-facet-link]');
        if (link) {
          e.preventDefault();
          this.load(link.href);
          return;
        }
        if (e.target.closest('[data-facets-open]')) this.openPanel();
        if (e.target.closest('[data-facets-close]')) this.closePanel();
      });
      this.panel?.addEventListener('keydown', (e) => {
        if (!this.panel.classList.contains('is-open')) return;
        if (e.key === 'Escape') this.closePanel();
        trapFocus(this.panel, e);
      });

      window.addEventListener('popstate', (e) => {
        if (e.state && e.state.facets) this.load(window.location.href, false);
      });
    }

    isDrawer() {
      return !this.closest('.collection-layout--sidebar') || !window.matchMedia('(min-width: 990px)').matches;
    }

    openPanel() {
      if (!this.panel) return;
      this.panel.classList.add('is-open');
      this.panel.setAttribute('role', 'dialog');
      this.panel.setAttribute('aria-modal', 'true');
      this.overlay.hidden = false;
      this.openBtn?.setAttribute('aria-expanded', 'true');
      lockScroll(true);
      this.panel.querySelector('summary, input, button')?.focus();
    }

    closePanel() {
      if (!this.panel || !this.panel.classList.contains('is-open')) return;
      this.panel.classList.remove('is-open');
      this.panel.removeAttribute('role');
      this.panel.removeAttribute('aria-modal');
      this.overlay.hidden = true;
      this.openBtn?.setAttribute('aria-expanded', 'false');
      lockScroll(false);
      this.querySelector('[data-facets-open]')?.focus();
    }

    submit() {
      const params = new URLSearchParams(new FormData(this.form));
      // Supprime les champs vides (prix non renseignés).
      [...params.keys()].forEach((key) => {
        if (params.get(key) === '') params.delete(key);
      });
      const url = `${this.form.action}?${params.toString()}`;
      this.load(url);
    }

    async load(url, push = true) {
      const target = new URL(url, window.location.origin);
      const fetchUrl = new URL(target);
      fetchUrl.searchParams.set('section_id', this.sectionId);
      const results = document.querySelector(`[data-results="${this.sectionId}"]`);
      results?.classList.add('is-loading');
      try {
        const html = await (await fetch(fetchUrl)).text();
        const doc = parseHTML(html);
        const openStates = {};
        this.querySelectorAll('details.facet').forEach((d) => (openStates[d.dataset.filterId] = d.open));

        // Résultats
        const freshResults = doc.querySelector(`[data-results="${this.sectionId}"]`);
        if (results && freshResults) results.innerHTML = freshResults.innerHTML;

        // Barre, filtres actifs, groupes de filtres
        ['[data-facets-count]', '[data-facets-active]', '.facets__open'].forEach((sel) => {
          const cur = this.querySelector(sel);
          const next = doc.querySelector(`facet-filters[data-section-id="${this.sectionId}"] ${sel}`);
          if (cur && next) cur.innerHTML = next.innerHTML;
        });
        this.querySelectorAll('[data-facet-body]').forEach((body) => {
          const next = doc.querySelector(
            `facet-filters[data-section-id="${this.sectionId}"] [data-facet-body="${body.dataset.facetBody}"]`
          );
          if (next && !body.contains(document.activeElement)) body.innerHTML = next.innerHTML;
          else if (next) this.syncInputs(body, next);
        });
        this.querySelectorAll('details.facet').forEach((d) => {
          if (d.dataset.filterId in openStates) d.open = openStates[d.dataset.filterId];
        });

        if (push) window.history.pushState({ facets: true }, '', target.toString());
        if (!this.isDrawer()) {
          results?.closest('.section')?.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      } catch (e) {
        window.location.href = target.toString();
      } finally {
        results?.classList.remove('is-loading');
      }
    }

    /** Met à jour les compteurs sans remplacer le champ qui a le focus. */
    syncInputs(body, next) {
      body.querySelectorAll('.checkbox').forEach((box, i) => {
        const fresh = next.querySelectorAll('.checkbox')[i];
        if (!fresh) return;
        const count = box.querySelector('.checkbox__count');
        const freshCount = fresh.querySelector('.checkbox__count');
        if (count && freshCount) count.textContent = freshCount.textContent;
      });
    }
  }
  customElements.define('facet-filters', FacetFilters);

  /* ------------------------------------------------------------------ *
   * Carrousel accessible (défilement natif + boutons)
   * ------------------------------------------------------------------ */
  class SliderComponent extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-slider-track]');
      this.prev = this.querySelector('[data-slider-prev]');
      this.next = this.querySelector('[data-slider-next]');
      if (!this.track) return;
      this.prev?.addEventListener('click', () => this.move(-1));
      this.next?.addEventListener('click', () => this.move(1));
      this.track.addEventListener('scroll', debounce(() => this.update(), 50), { passive: true });
      window.addEventListener('resize', debounce(() => this.update(), 150));
      this.update();
    }
    move(dir) {
      const item = this.track.firstElementChild;
      const step = item ? item.getBoundingClientRect().width + parseFloat(getComputedStyle(this.track).columnGap || 0) : 300;
      const visible = Math.max(1, Math.floor(this.track.clientWidth / step));
      this.track.scrollBy({ left: dir * step * visible, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
    update() {
      const max = this.track.scrollWidth - this.track.clientWidth - 2;
      if (this.prev) this.prev.disabled = this.track.scrollLeft <= 2;
      if (this.next) this.next.disabled = this.track.scrollLeft >= max;
      const controls = this.querySelector('.slider-controls');
      if (controls) controls.hidden = max <= 0;
    }
  }
  customElements.define('slider-component', SliderComponent);

  /* ------------------------------------------------------------------ *
   * Pied de page : accordéons sur mobile, colonnes ouvertes sur ordinateur
   * ------------------------------------------------------------------ */
  const footerMq = window.matchMedia('(min-width: 990px)');
  const syncFooter = () => {
    document.querySelectorAll('.footer__column').forEach((d) => {
      if (footerMq.matches) d.setAttribute('open', '');
      else if (!d.dataset.userOpened) d.removeAttribute('open');
      const summary = d.querySelector('summary');
      if (footerMq.matches) summary?.setAttribute('tabindex', '-1');
      else summary?.removeAttribute('tabindex');
    });
  };
  document.addEventListener('click', (e) => {
    const summary = e.target.closest('.footer__column summary');
    if (summary && footerMq.matches) e.preventDefault();
    else if (summary) summary.parentElement.dataset.userOpened = 'true';
  });
  footerMq.addEventListener('change', syncFooter);

  /* ------------------------------------------------------------------ *
   * Sélecteurs de pays / langue : envoi automatique
   * ------------------------------------------------------------------ */
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-localization-select]')) e.target.form.submit();
  });

  /* ------------------------------------------------------------------ *
   * Partage : copie du lien
   * ------------------------------------------------------------------ */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-share]');
    if (!btn) return;
    const url = btn.dataset.share;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
      } catch (err) {
        /* annulé par l'utilisateur */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      const msg = btn.parentElement.querySelector('[data-share-message]');
      if (msg) {
        msg.hidden = false;
        setTimeout(() => (msg.hidden = true), 3000);
      }
    } catch (err) {
      window.prompt('', url);
    }
  });

  /* ------------------------------------------------------------------ *
   * Apparition discrète des sections
   * ------------------------------------------------------------------ */
  const initReveal = () => {
    if (!document.body.classList.contains('has-reveal') || reducedMotion.matches || !('IntersectionObserver' in window)) return;
    if (window.Shopify && window.Shopify.designMode) return;
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    document.body.classList.add('js-ready');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    els.forEach((el) => {
      // Les éléments déjà visibles au chargement apparaissent immédiatement.
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-visible');
      io.observe(el);
    });
  };

  /* ------------------------------------------------------------------ *
   * Formulaires : validation accessible côté client (complète celle de Shopify)
   * ------------------------------------------------------------------ */
  document.addEventListener(
    'submit',
    (e) => {
      const form = e.target;
      if (!form.matches('[data-validate]')) return;
      let firstInvalid = null;
      form.querySelectorAll('[required]').forEach((field) => {
        const errorEl = document.getElementById(field.getAttribute('aria-describedby')?.split(' ')[0] || '');
        const valid = field.checkValidity();
        field.setAttribute('aria-invalid', String(!valid));
        if (errorEl && errorEl.classList.contains('field__error')) {
          errorEl.hidden = valid;
        }
        if (!valid && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) {
        e.preventDefault();
        firstInvalid.focus();
      }
    },
    true
  );

  /* ------------------------------------------------------------------ *
   * Éditeur de thème : réinitialisation à chaque modification de section
   * ------------------------------------------------------------------ */
  document.addEventListener('shopify:section:load', () => {
    syncFooter();
  });
  document.addEventListener('shopify:block:select', (e) => {
    const announcement = e.target.closest('announcement-bar');
    if (announcement) {
      announcement.querySelectorAll('.announcement__item').forEach((i) => i.classList.remove('is-active'));
      e.target.classList.add('is-active');
    }
  });

  const init = () => {
    syncFooter();
    initReveal();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
