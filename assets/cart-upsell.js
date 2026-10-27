import { Component } from '@theme/component';
import { fetchConfig, debounce, onAnimationEnd, prefersReducedMotion, resetShimmer, scheduler } from '@theme/utilities';
import {
  ThemeEvents,
  CartUpdateEvent,
  QuantitySelectorUpdateEvent,
  CartAddEvent,
  DiscountUpdateEvent,
  SlideshowSelectEvent,
} from '@theme/events';
import { Scroller, scrollIntoView } from '@theme/scrolling';

class CartUpsell extends Component {
  #activeFetch = null;
  #controller = new AbortController();
  #isInitialLoad = false;

  
  #createAbortController() {
    const abortController = new AbortController();
    if (this.#activeFetch) {
      this.#activeFetch?.abort();
    }
    this.#activeFetch = abortController;
    return abortController;
  }
  
  connectedCallback() {
    super.connectedCallback();    

    const { signal } = this.#controller;

    if (!this.#isInitialLoad) {
      this.fetchCartPage(); // Fetch only once
    }
    
    document.addEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate);
    // document.addEventListener(ThemeEvents.cartUpdate, this.onCartUpdate); // not using as we are using instanceof to check add to cart event
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#controller.abort();
    document.removeEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate);
    // document.removeEventListener(ThemeEvents.cartUpdate, this.onCartUpdate); // not using as we are using instanceof to check add to cart event
  }
  
  /**
   * Handles the cart update event.
   * @param {CartUpdateEvent} event - The cart update event.
   */
  onCartUpdate = async (event) => {
    this.fetchCartPage(event);
  };
  
  /**
   * Handles the cart update.
   *
   * @param {CartUpdateEvent | CartAddEvent} event
   */
  #handleCartUpdate = (event) => {
    if (event instanceof CartAddEvent) {
      console.log('Add event called from cart-upsell.js...');
      this.fetchCartPage();
      return;
    }
    if (event instanceof CartUpdateEvent) {
      console.log('Update event called from cart-upsell.js...');
      this.fetchCartPage();
      return;
    }
  }
  
  /**
   * Handles the cart upsell update event.
   * @param {#cartPageUrl} event - The cart url.
   */
  fetchCartPage = async () => {
    // We use this to abort the previous fetch request if it's still pending.
    const cartPageUrl = Theme.routes.cart_url + '?view=cart-upsell';

    const abortController = this.#createAbortController();
    
    try {
      const response = await fetch(cartPageUrl, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch product page: HTTP error ${response.status}`);
      }

      const responseText = await response.text();
      const html = new DOMParser().parseFromString(responseText, 'text/html');
      const upsellProductsHtml = html.querySelector('cart-upsell-component #upsell-inner');

      const upsellElement = document.querySelector('#upsell-inner');
      
      if (upsellElement && upsellProductsHtml) {
        upsellElement.replaceWith(upsellProductsHtml);

        // S.V USING SLIDESHOW FUNCTION AGAIN TO DISPLAY THE SLIDE IMAGE
        requestAnimationFrame(() => {
          const SlideshowElement = document.querySelector('slideshow-component');
          
          if (SlideshowElement && typeof SlideshowElement.initializeSlideshow === 'function') {
            console.log('Slideshow function reinit on upsell...');
            SlideshowElement.initializeSlideshow();
          }
        });
        // S.V USING SLIDESHOW FUNCTION AGAIN TO DISPLAY THE SLIDE IMAGE
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      } else {
        throw error;
      }
    } finally {
      this.#isInitialLoad = true;
      this.#activeFetch = null;
    }
  }
}

if (!customElements.get('cart-upsell-component')) {
  customElements.define('cart-upsell-component', CartUpsell);
}