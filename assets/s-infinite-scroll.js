/**
 * <s-infinite-scroll> — Loads the next paginated page and appends its items as the shopper scrolls.
 *
 * Attributes:
 *   data-target          — CSS selector of the list to append into (same selector in the fetched page).
 *   data-next-url        — URL of the next page (Liquid paginate.next.url, keeps filters and sort).
 *   data-loading-label   — Text shown on the button while loading.
 *   data-loaded-message  — Screen reader announcement after items are appended.
 *
 * Required child markup:
 *   a[data-load-more] — Next-page link; works without JS and as a manual trigger.
 *   [data-status]     — Polite live region for announcements.
 *
 * After each load the element copies the next URL from the fetched page's own
 * <s-infinite-scroll>, and removes itself when there are no more pages.
 */
class InfiniteScroll extends HTMLElement {
  #observer = null;
  #controller = null;
  #loading = false;

  connectedCallback() {
    this.#controller = new AbortController();
    const link = this.querySelector('a[data-load-more]');
    link?.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
        this.#load();
      },
      { signal: this.#controller.signal }
    );

    this.#observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) this.#load();
      },
      { rootMargin: '0px 0px 600px 0px' }
    );
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#controller?.abort();
    this.#controller = null;
  }

  async #load() {
    const url = this.dataset.nextUrl;
    const target = this.dataset.target ? document.querySelector(this.dataset.target) : null;
    if (this.#loading || !url || !target) return;

    this.#loading = true;
    const link = this.querySelector('a[data-load-more]');
    const label = link?.textContent;
    link?.setAttribute('aria-busy', 'true');
    if (link && this.dataset.loadingLabel) link.textContent = this.dataset.loadingLabel;

    try {
      const response = await fetch(url, { signal: this.#controller?.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const incoming = doc.querySelector(this.dataset.target);
      if (incoming) target.append(...Array.from(incoming.children).map((node) => document.importNode(node, true)));

      const status = this.querySelector('[data-status]');
      if (status && this.dataset.loadedMessage) status.textContent = this.dataset.loadedMessage;

      const nextScroller = doc.querySelector('s-infinite-scroll[data-next-url]');
      if (!nextScroller) {
        this.remove();
        return;
      }
      this.dataset.nextUrl = nextScroller.dataset.nextUrl;
      if (link) link.href = nextScroller.dataset.nextUrl;
    } catch (error) {
      if (error?.name === 'AbortError') return;
      // On failure the link stays as a normal next-page link the shopper can follow.
      this.#observer?.disconnect();
      if (link) link.replaceWith(link.cloneNode(true));
    } finally {
      this.#loading = false;
      if (link) {
        link.removeAttribute('aria-busy');
        if (label) link.textContent = label;
      }
    }

    // Keep loading while the sentinel is still in view (short pages on tall screens).
    if (this.isConnected) {
      this.#observer?.disconnect();
      this.#observer?.observe(this);
    }
  }
}

if (!customElements.get('s-infinite-scroll')) {
  customElements.define('s-infinite-scroll', InfiniteScroll);
}
