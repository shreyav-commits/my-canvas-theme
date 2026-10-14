import { partials } from "@shopify/partial-rendering";
import { transition } from "@theme/view-transition";

// <s-product-recommendations> lazily fetches related/complementary products and swaps them
// into its {% partial %} region using the base theme's partial-rendering stack — the same
// @shopify/partial-rendering + view-transition that <s-live-form> (filters) is built on.
// One component per file, framework-free.
//
// When the block was already rendered in the recommendations context (data-performed="true"),
// the server markup is kept and no fetch happens. Otherwise, once the block nears the
// viewport, it fetches data-url and applies the named partial, replacing the skeletons.
class ProductRecommendations extends HTMLElement {
  #observer = null;
  #controller = null;

  connectedCallback() {
    if (this.dataset.performed === "true") {
      this.#syncVisibility();
      return;
    }
    if (!this.dataset.url || !this.dataset.productId || !this.dataset.partial) return;

    this.#observer = new IntersectionObserver(
      (entries, observer) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        this.#load();
      },
      { rootMargin: "0px 0px 400px 0px" },
    );
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#controller?.abort();
  }

  async #load() {
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    const url = `${this.dataset.url}&product_id=${encodeURIComponent(this.dataset.productId)}`;
    const name = this.dataset.partial;

    this.setAttribute("aria-busy", "true");
    try {
      // Fetch the named {% partial %} region from the recommendations endpoint and apply it.
      const html = await partials.fetch(name, { url, signal });
      await transition(() => partials.apply(html));
      this.dataset.performed = "true";
      this.#syncVisibility();
    } catch (error) {
      // No recommendations / fetch failed: collapse quietly instead of showing skeletons forever.
      if (error.name !== "AbortError") this.hidden = true;
    } finally {
      this.removeAttribute("aria-busy");
      this.#controller = null;
    }
  }

  #syncVisibility() {
    const region = partials.getAll(this).find(({ name }) => name === this.dataset.partial);
    const content = region?.range.cloneContents();
    this.hidden = !content || (!content.firstElementChild && !content.textContent.trim());
  }
}

if (!customElements.get("s-product-recommendations")) {
  customElements.define("s-product-recommendations", ProductRecommendations);
}
