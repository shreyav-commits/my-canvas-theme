/**
 * <s-carousel> — a horizontally-scrollable "swim lane" that shows multiple items at once.
 *
 * UI-only: it wires the optional prev/next buttons to scroll the track by roughly one page
 * and toggles their `disabled` state at the start/end of the scroll range. The track is a
 * native scroll-snap container, so scrolling, touch/trackpad swiping, and keyboard focus
 * all work without JS — this component only enhances the arrow controls.
 *
 * Expected DOM (rendered by blocks/carousel.liquid):
 *   <s-carousel>
 *     [<button data-carousel-prev> / <button data-carousel-next>]
 *     <div data-carousel-track> …items… </div>
 *   </s-carousel>
 */
class SCarousel extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector("[data-carousel-track]");
    this.prevButton = this.querySelector("[data-carousel-prev]");
    this.nextButton = this.querySelector("[data-carousel-next]");

    if (!this.track) return;

    this.onPrev = () => this.scrollByPage(-1);
    this.onNext = () => this.scrollByPage(1);
    this.onScroll = () => this.updateControls();

    this.prevButton?.addEventListener("click", this.onPrev);
    this.nextButton?.addEventListener("click", this.onNext);
    this.track.addEventListener("scroll", this.onScroll, { passive: true });

    this.resizeObserver = new ResizeObserver(() => this.updateControls());
    this.resizeObserver.observe(this.track);

    this.updateControls();
  }

  disconnectedCallback() {
    this.prevButton?.removeEventListener("click", this.onPrev);
    this.nextButton?.removeEventListener("click", this.onNext);
    this.track?.removeEventListener("scroll", this.onScroll);
    this.resizeObserver?.disconnect();
  }

  /**
   * Scroll the track by ~80% of its visible width in the given direction.
   * @param {number} direction -1 for previous, 1 for next.
   */
  scrollByPage(direction) {
    const amount = this.track.clientWidth * 0.8 * direction;
    this.track.scrollBy({ left: amount, behavior: "smooth" });
  }

  /** Disable prev/next when the track is at its respective end. */
  updateControls() {
    if (!this.prevButton && !this.nextButton) return;

    const maxScroll = this.track.scrollWidth - this.track.clientWidth;
    const atStart = this.track.scrollLeft <= 1;
    const atEnd = this.track.scrollLeft >= maxScroll - 1;
    const overflowing = maxScroll > 1;

    if (this.prevButton) this.prevButton.disabled = !overflowing || atStart;
    if (this.nextButton) this.nextButton.disabled = !overflowing || atEnd;
  }
}

if (!customElements.get("s-carousel")) {
  customElements.define("s-carousel", SCarousel);
}
