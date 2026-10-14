/**
 * <s-before-after> — Image comparison slider.
 *
 * Required child markup:
 *   input[type="range"] — Native range (0–100); its value is the source of truth.
 *
 * Writes the value to the `--position` custom property (as a percentage) on the
 * element, which the block's utilities use to clip the before image and place the divider.
 */
class BeforeAfter extends HTMLElement {
  #controller = null;

  connectedCallback() {
    const input = this.querySelector('input[type="range"]');
    if (!input) return;

    this.#controller = new AbortController();
    const update = () => {
      this.style.setProperty('--position', `${input.value}%`);
    };

    input.addEventListener('input', update, { signal: this.#controller.signal });
    update();
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#controller = null;
  }
}

if (!customElements.get('s-before-after')) {
  customElements.define('s-before-after', BeforeAfter);
}
