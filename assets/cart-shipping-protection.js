import { Component } from '@theme/component';
import { morphSection } from '@theme/section-renderer';
import { ThemeEvents, CartAddEvent, CartUpdateEvent, CartErrorEvent, VariantUpdateEvent, DiscountUpdateEvent } from '@theme/events';
import { cartPerformance } from '@theme/performance';

class CartShippingProtection extends Component {
  requiredRefs = ['shippingInput', 'shippingLabel'];
  #controller = new AbortController();
  
  connectedCallback() {
    super.connectedCallback();

    const { signal } = this.#controller;
    const { shippingInput, shippingLabel } = this.refs;

    document.addEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate);
    
    // Bind 'this' is correct: METHOD 1
    this.refs.shippingInput.addEventListener('change', this.#handleShippingChange.bind(this), { signal });
    
    // Arrow function ensures 'this' is correct: METHOD 2
    // this.refs.shippingInput.addEventListener('change', (event) => {
    //   this.#handleShippingChange(event);
    // }, { signal });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    this.#controller.abort();

    document.removeEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate);
  }

  /**
   * Handles the cart update.
   *
   * @param {CartUpdateEvent | CartAddEvent} event
   */
  #handleCartUpdate = (event) => {
    if (event instanceof CartAddEvent) {
      console.log('Add event called from cart-shipping-protection.js...');
      this.checkinCart(event, null, true);
      return;
    }
    if (event instanceof CartUpdateEvent) {
      console.log('Update event called from cart-shipping-protection.js...');
      this.checkinCart(event);
      return;
    }
  }
  
  /**
   * add shipping product in cart
   * event: input element
   * shipping_variant_id: shipping product variant id
   * shipping_product_id: shipping product id
   */
  addShippingInCart = async (event, shipping_variant_id, shipping_product_id) => {
    var formData = {};
    formData['id'] = shipping_variant_id;
    formData['quantity'] = 1;
    formData['properties'] = { _shipping_insurance: true };

    event.target.disabled = true;
      
    const cartItemsComponents = document.querySelectorAll('cart-items-component');
    let cartItemComponentsSectionIds = [];
    cartItemsComponents.forEach((item) => {
      if (item instanceof HTMLElement && item.dataset.sectionId) {
        cartItemComponentsSectionIds.push(item.dataset.sectionId);
      }
    });
    formData['sections'] = cartItemComponentsSectionIds.join(',');

    const fetchCfg = {
      method: 'POST',
      body: JSON.stringify(formData),
      headers: {
        'Content-Type': 'application/json', // For sending/expecting JSON (optional)
        'Accept': 'application/json', // Explicitly tell the server we're expecting JSON
      },
      credentials: 'same-origin', // Send cookies if necessary
      cache: 'no-cache', // Prevent the use of cached responses
    };
    
    fetch(Theme.routes.cart_add_url, {
      ...fetchCfg
    })
    .then((response) => response.json())
    .then((response) => {
      const newSectionHTML = new DOMParser().parseFromString(
        response.sections[this.sectionId],
        'text/html'
      );

      // Grab the new cart item count from a hidden element
      const newCartHiddenItemCount = newSectionHTML.querySelector('[ref="cartItemCount"]')?.textContent;
      const newCartItemCount = newCartHiddenItemCount ? parseInt(newCartHiddenItemCount, 10) : 0;
      
      if (response.status) {
        window.dispatchEvent(new CartErrorEvent(shipping_variant_id, response.message));

        // When we add more than the maximum amount of items to the cart, we need to dispatch a cart update event
        // because our back-end still adds the max allowed amount to the cart.
        this.dispatchEvent(
          new CartAddEvent({}, shipping_variant_id, {
            didError: true,
            source: 'product-form-component',
            itemCount: newCartItemCount,
            productId: shipping_product_id,
          })
        );
        return;
      } else {
        this.dispatchEvent(
          new CartAddEvent({}, shipping_variant_id, {
            source: 'shipping-protection',
            itemCount: newCartItemCount,
            productId: shipping_product_id,
            sections: response.sections,
          })
        );
      }
    })
    .catch((error) => {
      console.error(error);
    })
    .finally(() => {
      // add more thing to do in here if needed.
      cartPerformance.measureFromEvent('add:user-action', event);
    });
  }

  /**
   * remove shipping product from cart
   * event: input element
   * shipping_variant_id: shipping product variant id
   * shipping_product_id: shipping product id
   */
  removeShippingfromCart(event, shipping_variant_id, shipping_product_id) {
    const shippingRemoveElement = document.querySelector(`.cart-items__remove[data-line-id="${shipping_variant_id}"]`);
    if (!shippingRemoveElement) return;

    shippingRemoveElement.dispatchEvent(new CustomEvent('click', { bubbles: true }));
  }

  /**
   * check if the shipping product in cart
   * event: input element
   * state: input is checked or not
   */
  checkinCart(event, state = null, eventTrigger = null) {
    const autoAddEnable = this.dataset.autoAdd,
          shipping_product_id = this.dataset.productId,
          shipping_variant_id = this.dataset.variantId;

    const fetchCfg = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json', // For sending/expecting JSON (optional)
        'Accept': 'application/json', // Explicitly tell the server we're expecting JSON
      },
      credentials: 'same-origin', // Send cookies if necessary
      cache: 'no-cache', // Prevent the use of cached responses
    };
        
    fetch(Theme.routes.cart_json_url, {
      ...fetchCfg,
    })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then((data) => {
      const item = data.items.find(item => item.variant_id == shipping_variant_id),
            isInputElement = event.target.tagName === 'INPUT' && event.target.type === 'checkbox',
            isShippingAdded = localStorage.getItem('shipping_added');
      
      if(autoAddEnable == 'false') localStorage.removeItem('shipping_added');
      
      if (data.item_count == 1 && item) {
        this.removeShippingfromCart(event, shipping_variant_id, shipping_product_id);
        return;
      }    

      if (isInputElement) {
        if (!item && state) {
          this.addShippingInCart(event, shipping_variant_id, shipping_product_id);
        } else if (item && !state) {
          this.removeShippingfromCart(event, shipping_variant_id, shipping_product_id);
        }
      } else if (!item && !isShippingAdded && autoAddEnable == 'true' && eventTrigger) {
        this.addShippingInCart(event, shipping_variant_id, shipping_product_id);
        localStorage.setItem('shipping_added', 'Added');
      }
    })
    .catch((error) => {
      console.error('Fetch error:', error);
    });
  }

  /**
   * input change event
   */
  #handleShippingChange(event) {
    const isChecked = this.hasAttribute("checked");
    this.toggleAttribute("checked");
    this.checkinCart(event, event.target.checked);
  }
}

if (!customElements.get('shipping-protection')) {
  customElements.define('shipping-protection', CartShippingProtection);
}