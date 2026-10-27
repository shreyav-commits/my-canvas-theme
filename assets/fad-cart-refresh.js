window.FAD_refresh = function () {
  console.log('FAD CART RELOADED...');  
  const theme_scheme_name = Shopify?.theme?.schema_name;
  if (theme_scheme_name === 'Horizon' || theme_scheme_name === 'Savor'
     || theme_scheme_name === 'Tinker' || theme_scheme_name === 'Dwell'
     || theme_scheme_name === 'Fabric' || theme_scheme_name === 'Vessel'
     || theme_scheme_name === 'Atelier' || theme_scheme_name === 'Pitch' 
     || theme_scheme_name === 'Heritage' || theme_scheme_name === 'Ritual' ) {
    // For Horizon version
    console.log('* '+ theme_scheme_name +' THEME DETECTED *');  
    import('@theme/events').then(({ CartUpdateEvent }) => {
      const cartDrawer = document.querySelector('cart-drawer-component');    
      fetch('/cart.js')
      .then(res => res.json())
      .then(cart => {
        console.log('Dispatching cart:update with cart:', cart);
        const event = new CartUpdateEvent(cart, 'manual-trigger', {
          itemCount: cart.item_count,
          source: 'fad-refresh',
          sections: {}
        });
        document.dispatchEvent(event);
        if (cartDrawer?.hasAttribute('auto-open')) {
          cartDrawer.open();
        }
      });  
    });
  } else if (theme_scheme_name === 'Dawn' || theme_scheme_name == 'Spotlight' || theme_scheme_name == 'Trade' || theme_scheme_name == 'Ride' || theme_scheme_name == 'Origin'
            || theme_scheme_name === 'Craft' || theme_scheme_name == 'Sense' || theme_scheme_name == 'Refresh' || theme_scheme_name == 'Studio' || theme_scheme_name == 'Taste'
            || theme_scheme_name === 'Publisher' || theme_scheme_name == 'Crave' || theme_scheme_name == 'Colorblock') {
    console.log('* '+ theme_scheme_name +' THEME DETECTED *');
    fetch(`${routes.cart_url}?sections=cart-drawer`)
    .then((response) => response.json())
    .then((sections) => {
      const sectionIds = ['cart-drawer'];
      for (const sectionId of sectionIds) {
        const htmlString = sections[sectionId];
        const html = new DOMParser().parseFromString(htmlString, 'text/html');
        const sourceElement = html.querySelector(`${sectionId}`);
        const targetElement = document.querySelector(`${sectionId}`);
  
        if (targetElement && sourceElement) {
          targetElement.replaceWith(sourceElement);
        }
      }
      document.body.classList.add('overflow-hidden');
      const theme_cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
      if (theme_cart && theme_cart.classList.contains('is-empty')) theme_cart.classList.remove('is-empty');
      theme_cart.classList.add('active');
    })
    .catch((e) => {
      console.error('Error updating cart sections:', e);
    });
    // For Dawn version
  } else {
    console.log('* OTHER THEME DETECTED *');  
    $('body').trigger('added.ajaxProduct');
  }
};