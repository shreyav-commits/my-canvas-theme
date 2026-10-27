/**
 * <s-fbt> — "Frequently bought together": checkbox list of this product plus a few
 * companions, a live combined total, and one button that adds every checked item.
 *
 * Required child markup:
 *   input[type=checkbox][data-fbt-item]  — data-variant-id, data-price (cents). The current
 *                                          product's row also has data-fbt-main.
 *   [data-fbt-image="<index>"]           — Optional image tile dimmed when its item is unchecked.
 *   [data-fbt-total]                     — Combined total text.
 *   [data-fbt-count]                     — Number of checked items in the button label.
 *   button[data-fbt-add]                 — Adds checked items.
 *   [data-fbt-error]                     — Error / prompt text (role="alert").
 *
 * Element dataset:
 *   data-money-sample   — `{{ 123456 | money }}` so totals follow the store's money format.
 *   data-main-prices    — JSON {variantId: priceCents} for the current product's variants.
 *   data-product-id     — Current product id; finds the main product form for the chosen variant.
 *   data-cart-add-url   — routes.cart_add_url, fallback when the cart API rejects a variant.
 *   data-select-message — Prompt shown when the main product still needs its options chosen.
 *   data-error-message  — Generic add failure text.
 *
 * External coupling:
 *   [data-product-form][data-product-id] input[name="id"] — main product's chosen variant.
 *   [data-add-button][disabled]          — options not yet chosen on the main product.
 *   Shopify.actions.updateCart / openCart, s-cart.refreshMountedCarts.
 */
class SFbt extends HTMLElement {
  #ac;
  #observer;

  connectedCallback() {
    this.#ac = new AbortController();
    const opts = { signal: this.#ac.signal };

    this.addEventListener('change', (event) => {
      if (event.target.matches?.('[data-fbt-item]')) this.#render();
    }, opts);
    this.querySelector('[data-fbt-add]')?.addEventListener('click', () => this.#add(), opts);

    // The main product form is swapped on variant change; keep the main row's price in step.
    const mainForm = this.#mainForm();
    if (mainForm) {
      this.#observer = new MutationObserver(() => this.#render());
      this.#observer.observe(mainForm, { childList: true, subtree: true, attributes: true, attributeFilter: ['value', 'disabled'] });
    }
    this.#render();
  }

  disconnectedCallback() {
    this.#ac?.abort();
    this.#observer?.disconnect();
  }

  #mainForm() {
    return document.querySelector(`[data-product-form][data-product-id="${this.dataset.productId}"]`);
  }

  #mainVariantId() {
    return this.#mainForm()?.querySelector('input[name="id"]')?.value || '';
  }

  #mainNeedsOptions() {
    return Boolean(this.#mainForm()?.querySelector('[data-add-button][disabled]'));
  }

  #items() {
    return Array.from(this.querySelectorAll('[data-fbt-item]'));
  }

  #render() {
    let prices = {};
    try { prices = JSON.parse(this.dataset.mainPrices || '{}'); } catch { prices = {}; }

    const main = this.querySelector('[data-fbt-main]');
    const mainId = this.#mainVariantId();
    if (main && mainId && prices[mainId] != null) {
      main.dataset.variantId = mainId;
      main.dataset.price = String(prices[mainId]);
      const priceEl = this.querySelector('[data-fbt-main-price]');
      if (priceEl) priceEl.textContent = this.#format(prices[mainId]);
    }

    let total = 0;
    let count = 0;
    this.#items().forEach((input, index) => {
      if (input.checked) {
        total += Number(input.dataset.price || 0);
        count += 1;
      }
      this.querySelector(`[data-fbt-image="${index}"]`)?.classList.toggle('opacity-30', !input.checked);
    });

    const totalEl = this.querySelector('[data-fbt-total]');
    if (totalEl) totalEl.textContent = this.#format(total);
    const countEl = this.querySelector('[data-fbt-count]');
    if (countEl) countEl.textContent = String(count);
    const button = this.querySelector('[data-fbt-add]');
    if (button) button.disabled = count === 0;
  }

  /** Formats cents using the rendered money sample (e.g. "Rs. 1,234.56" or "€1.234,56"). */
  #format(cents) {
    const sample = this.dataset.moneySample || '';
    const withDecimals = sample.match(/1(\D?)234(\D)56/);
    if (withDecimals) {
      const [, thousands, decimal] = withDecimals;
      const whole = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      const fraction = String(cents % 100).padStart(2, '0');
      return sample.replace(withDecimals[0], `${whole}${decimal}${fraction}`);
    }
    const noDecimals = sample.match(/1(\D?)235/);
    if (noDecimals) {
      const whole = Math.round(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, noDecimals[1]);
      return sample.replace(noDecimals[0], whole);
    }
    return (cents / 100).toFixed(2);
  }

  #showError(message) {
    const el = this.querySelector('[data-fbt-error]');
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
  }

  async #add() {
    const checked = this.#items().filter((input) => input.checked);
    if (checked.length === 0) return;

    if (checked.some((input) => input.hasAttribute('data-fbt-main')) && this.#mainNeedsOptions()) {
      this.#showError(this.dataset.selectMessage || '');
      this.#mainForm()?.querySelector('select[data-option-select]')?.focus();
      return;
    }

    const lines = checked
      .map((input) => input.dataset.variantId)
      .filter(Boolean)
      .map((id) => ({ merchandiseId: id, quantity: 1 }));

    const button = this.querySelector('[data-fbt-add]');
    button.disabled = true;
    this.setAttribute('aria-busy', 'true');
    this.#showError('');

    try {
      let message = '';
      if (window.Shopify?.actions?.updateCart) {
        const result = await window.Shopify.actions.updateCart({ lines }, { event: { context: 'product', detail: { source: 's-fbt' } } });
        message = result?.userErrors?.[0]?.message || '';
        if (message && /merchandise.*does not exist/i.test(message)) message = await this.#addWithCartEndpoint(lines);
      } else {
        message = await this.#addWithCartEndpoint(lines);
      }

      if (message) {
        this.#showError(message);
      } else {
        await window.Shopify?.actions?.openCart?.();
      }
    } catch {
      this.#showError(this.dataset.errorMessage || '');
    } finally {
      this.removeAttribute('aria-busy');
      this.#render();
    }
  }

  async #addWithCartEndpoint(lines) {
    const response = await fetch(`${this.dataset.cartAddUrl}.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: lines.map((line) => ({ id: Number(line.merchandiseId), quantity: line.quantity })) }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return data?.description || data?.message || this.dataset.errorMessage || '';
    }
    try {
      await customElements.whenDefined('s-cart');
      await customElements.get('s-cart')?.refreshMountedCarts?.();
    } catch {
      // The cart drawer refresh is best effort; the items are in the cart.
    }
    return '';
  }
}

if (!customElements.get('s-fbt')) customElements.define('s-fbt', SFbt);
