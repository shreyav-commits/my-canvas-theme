/**
 * <s-shipping-protection> — Adds or removes the shipping protection line when its
 * switch changes. Mutations go through Shopify.actions.updateCart, whose theme
 * override refreshes every mounted <s-cart> partial (the block re-renders with
 * the new state). Falls back to the classic cart endpoint for adds when the
 * Standard Actions cart rejects the variant.
 *
 * Element dataset:
 *   data-variant-id   — Protection variant id (numeric).
 *   data-line-key     — Present when the protection line is already in the cart.
 *   data-cart-add-url — routes.cart_add_url, used only for the add fallback.
 */
class SShippingProtection extends HTMLElement {
  #ac;

  connectedCallback() {
    this.#ac = new AbortController();
    this.addEventListener('change', (event) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'checkbox') return;
      this.#toggle(event.target);
    }, { signal: this.#ac.signal });
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  async #toggle(input) {
    const adding = input.checked;
    this.setAttribute('aria-busy', 'true');
    this.#showError('');

    try {
      let errorMessage = '';
      if (window.Shopify?.actions?.updateCart) {
        const lines = adding
          ? [{ merchandiseId: `gid://shopify/ProductVariant/${this.dataset.variantId}`, quantity: 1 }]
          : [{ id: this.dataset.lineKey, quantity: 0 }];
        const result = await window.Shopify.actions.updateCart({ lines }, { event: { context: 'cart' } });
        errorMessage = result?.userErrors?.[0]?.message || '';
      } else {
        errorMessage = 'unavailable';
      }

      if (errorMessage && adding) errorMessage = await this.#addWithCartEndpoint();
      if (errorMessage) throw new Error(errorMessage);
    } catch (error) {
      input.checked = !adding;
      this.#showError(error?.message === 'unavailable' ? '' : error?.message || '');
    } finally {
      if (this.isConnected) this.removeAttribute('aria-busy');
    }
  }

  async #addWithCartEndpoint() {
    if (!this.dataset.cartAddUrl) return 'unavailable';
    const response = await fetch(`${this.dataset.cartAddUrl}.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(this.dataset.variantId), quantity: 1 }] }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return data?.description || data?.message || 'unavailable';
    }
    await customElements.whenDefined('s-cart');
    await customElements.get('s-cart')?.refreshMountedCarts?.();
    return '';
  }

  #showError(message) {
    const error = this.querySelector('[data-protection-error]');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  }
}

if (!customElements.get('s-shipping-protection')) {
  customElements.define('s-shipping-protection', SShippingProtection);
}
