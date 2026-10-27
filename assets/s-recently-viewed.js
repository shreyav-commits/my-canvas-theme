/**
 * <s-recently-viewed> — Recently viewed products, stored in localStorage.
 *
 * Attributes:
 *   data-current — JSON card data for the product on this page ({ handle, url, title, price, image, alt, currency }).
 *   data-limit   — Max cards to render (default 8).
 *
 * Required child markup:
 *   template[data-rv-template] — One card; fills [data-rv-link], [data-rv-image], [data-rv-title], [data-rv-price].
 *   [data-carousel-track]      — Where cards are appended (the carousel track).
 *
 * The element stays hidden until at least one previously viewed product exists, then
 * records the current product at the front of the list for the next page view.
 */
const STORAGE_KEY = 'theme:recently-viewed';
const MAX_STORED = 12;

class RecentlyViewed extends HTMLElement {
  connectedCallback() {
    const current = this.#parse(this.dataset.current);
    const limit = Number(this.dataset.limit) || 8;
    const stored = this.#read();

    const items = stored
      .filter((item) => item && item.handle && (!current || item.handle !== current.handle))
      .filter((item) => !current || item.currency === current.currency)
      .slice(0, limit);

    this.#render(items);

    if (current) {
      const next = [current, ...stored.filter((item) => item && item.handle !== current.handle)].slice(0, MAX_STORED);
      this.#write(next);
    }
  }

  #render(items) {
    const template = this.querySelector('template[data-rv-template]');
    const track = this.querySelector('[data-carousel-track]');
    if (!template || !track) return;

    track.replaceChildren();
    for (const item of items) {
      const fragment = template.content.cloneNode(true);
      fragment.querySelectorAll('[data-rv-link]').forEach((link) => {
        link.href = item.url;
      });
      const image = fragment.querySelector('[data-rv-image]');
      if (image) {
        if (item.image) {
          image.src = item.image;
          image.alt = item.alt || item.title || '';
        } else {
          image.remove();
        }
      }
      const title = fragment.querySelector('[data-rv-title]');
      if (title) title.textContent = item.title || '';
      const price = fragment.querySelector('[data-rv-price]');
      if (price) price.textContent = item.price || '';
      track.append(fragment);
    }

    this.hidden = items.length === 0;
  }

  #parse(value) {
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  #read() {
    try {
      const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  #write(list) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Storage can be unavailable (private mode, quota); recently viewed simply stays empty.
    }
  }
}

if (!customElements.get('s-recently-viewed')) {
  customElements.define('s-recently-viewed', RecentlyViewed);
}
