/**
 * <s-collection-view> — Grid/list view toggle and products-per-page control for collections.
 *
 * Commands (on descendant buttons via commandfor/command):
 *   --view-grid — Switch to grid view.
 *   --view-list — Switch to list view.
 *
 * Attributes:
 *   data-view            — Current view ('grid' | 'list'); CSS group-data variants read it.
 *   data-cart-update-url — Liquid routes.cart_update_url; per-page is stored as a hidden cart attribute.
 *
 * Required child markup:
 *   button[data-view-option] — Toggle buttons; aria-pressed is kept in sync.
 *   select[data-per-page]    — Products-per-page select.
 *
 * View choice persists in localStorage. Per-page persists in the `_per_page` cart attribute,
 * which Liquid reads for `paginate ... by`, so the page reloads at page 1 after a change.
 */
const VIEW_KEY = 'theme:collection-view';

class CollectionView extends HTMLElement {
  #controller = null;

  connectedCallback() {
    this.#controller = new AbortController();
    const { signal } = this.#controller;

    let stored = null;
    try {
      stored = window.localStorage.getItem(VIEW_KEY);
    } catch {
      stored = null;
    }
    this.#setView(stored === 'list' ? 'list' : 'grid', false);

    this.addEventListener(
      'command',
      (event) => {
        if (event.command === '--view-grid') this.#setView('grid', true);
        if (event.command === '--view-list') this.#setView('list', true);
      },
      { signal }
    );

    const select = this.querySelector('select[data-per-page]');
    select?.addEventListener('change', () => this.#updatePerPage(select), { signal });
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#controller = null;
  }

  #setView(view, persist) {
    this.dataset.view = view;
    this.querySelectorAll('button[data-view-option]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.viewOption === view));
    });
    if (!persist) return;
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Storage unavailable: the view still switches for this page.
    }
  }

  async #updatePerPage(select) {
    const base = this.dataset.cartUpdateUrl;
    if (!base) return;

    select.disabled = true;
    this.setAttribute('aria-busy', 'true');
    try {
      // The .js suffix is the Ajax Cart API contract for a JSON response.
      await fetch(`${base}.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ attributes: { _per_page: select.value } }),
      });
      const url = new URL(window.location.href);
      url.searchParams.delete('page');
      window.location.assign(url.toString());
    } catch {
      select.disabled = false;
      this.removeAttribute('aria-busy');
    }
  }
}

if (!customElements.get('s-collection-view')) {
  customElements.define('s-collection-view', CollectionView);
}
