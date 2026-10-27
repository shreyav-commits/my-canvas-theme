import { Component } from '@theme/component';
import { debounce, onAnimationEnd, prefersReducedMotion, onDocumentReady } from '@theme/utilities';
import { sectionRenderer } from '@theme/section-renderer';
import { morph } from '@theme/morph';
import { ThemeEvents } from '@theme/events';
import { RecentlyViewed } from '@theme/recently-viewed-products';

class ProductRecentlyViewed extends HTMLElement {
  /**
   * The observer for the product recommendations
   * @type {IntersectionObserver}
   */
  #intersectionObserver = new IntersectionObserver(
    (entries, observer) => {
      if (!entries[0]?.isIntersecting) return;

      observer.disconnect();
      this.#loadRecentlyViewed();
    },
    { rootMargin: '0px 0px 400px 0px' }
  );

  /**
   * Observing changes to the elements attributes
   * @type {MutationObserver}
   */
  #mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Only attribute changes are interesting
      if (mutation.target !== this || mutation.type !== 'attributes') continue;

      // Ignore when the data-recommendations-performed attribute has been set to 'true'
      if (
        mutation.attributeName === 'data-recently-performed' &&
        this.dataset.recentlyPerformed === 'true'
      )
        continue;

      // All other attribute changes trigger a reload
      this.#loadRecentlyViewed();
      break;
    }
  });

  /**
   * An abort controller for the active fetch (if there is one)
   * @type {AbortController | null}
   */
  #activeFetch = null;

  connectedCallback() {
    this.#intersectionObserver.observe(this);
    this.#mutationObserver.observe(this, { attributes: true });
  }

  #createAbortController() {
    const abortController = new AbortController();
    if (this.#activeFetch) {
      this.#activeFetch.abort();
    }
    this.#activeFetch = abortController;
    return abortController;
  }
  
  /**
   * Fetch the markup for the recently viewed products.
   * @returns {Promise<string | null>} The markup for the recently viewed products.
   */
  async #getRecentlyViewedProductsMarkup() {
    if (!this.dataset.sectionId) return null;

    const viewedProducts = RecentlyViewed.getProducts();
    if (viewedProducts.length === 0) return null;

    const url = new URL(Theme.routes.search_url, location.origin),
          current_product_id = this.dataset.productId;
    url.searchParams.set('q', viewedProducts.map(/** @param {string} id */ (id) => `id:${id}`).join(' OR '));
    url.searchParams.set('resources[type]', 'product');

    return sectionRenderer.getSectionHTML(this.dataset.sectionId, false, url);
  }
  
  /**
   * Load the product recommendations
   */
  #loadRecentlyViewed = async () => {
    console.log('Recently Viewed Init...');
    
    // Get the initial height before the results are rendered
    const abortController = this.#createAbortController();

    try {
      const viewedProducts = RecentlyViewed.getProducts();
      if (viewedProducts.length === 0) return null;
      
      const url = new URL(Theme.routes.search_url, location.origin),
            current_product_id = this.dataset.productId;
      url.searchParams.set('q', viewedProducts.map(/** @param {string} id */ (id) => `id:${id}`).join(' OR '));
      url.searchParams.set('resources[type]', 'product');
      url.searchParams.set('view', 'recently-viewed');
    
      const response = await fetch(url, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch product page: HTTP error ${response.status}`);
      }

      const responseText = await response.text();
      const html = new DOMParser().parseFromString(responseText, 'text/html');
      
      const RecentlyProductsHtml = html.querySelector('recently-viewed .recently-list')
      const recentlyElement = document.querySelector('.recently-list');
      
      if (recentlyElement && RecentlyProductsHtml) recentlyElement.replaceWith(RecentlyProductsHtml);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      } else {
        throw error;
      }
    }
  };
}

if (!customElements.get('recently-viewed')) {
  customElements.define('recently-viewed', ProductRecentlyViewed);
}