/**
 * Gemini Live Translate - Video Overlay Component
 * Injects and manages the floating subtitle and quick audio controls on the video player.
 */
class VideoOverlay {
  constructor() {
    this.container = null;
    this.originalTextEl = null;
    this.translatedTextEl = null;
    this.statusDotEl = null;
    this.statusTextEl = null;
    this.isVisible = true;
    this.onOriginalVolumeChange = null;
    this.onTranslatedVolumeChange = null;
    this.onClose = null;
  }

  /**
   * Find suitable host container (YouTube movie player or video container)
   */
  findPlayerContainer() {
    return document.getElementById("movie_player") || 
           document.querySelector(".html5-video-player") || 
           document.querySelector("video")?.parentElement || 
           document.body;
  }

  /**
   * Render or inject overlay into player
   */
  mount() {
    if (document.getElementById("gemini-translate-overlay")) {
      this.container = document.getElementById("gemini-translate-overlay");
      return;
    }

    const host = this.findPlayerContainer();
    if (!host) return;

    const overlayDiv = document.createElement("div");
    overlayDiv.id = "gemini-translate-overlay";
    overlayDiv.innerHTML = `
      <div class="gto-header" id="gto-drag-header">
        <div class="gto-brand">
          <div class="gto-status-dot" id="gto-status-dot"></div>
          <span>Anlık Dublaj</span>
        </div>
        <div class="gto-actions">
          <button class="gto-btn" id="gto-btn-minimize" title="Gizle/Göster">_</button>
          <button class="gto-btn" id="gto-btn-close" title="Kapat">✕</button>
        </div>
      </div>
      <div class="gto-body" id="gto-body">
        <div class="gto-original-text" id="gto-original-text">Orijinal ses bekleniyor...</div>
        <div class="gto-translated-text" id="gto-translated-text">Anlık Dublaj Hazır</div>
      </div>
      <div class="gto-controls-bar" id="gto-controls-bar">
        <div class="gto-mini-slider" title="Orijinal Video Sesi">
          <span>🎵 Video:</span>
          <input type="range" id="gto-orig-vol" min="0" max="100" value="15">
          <span id="gto-orig-vol-val">15%</span>
        </div>
        <div class="gto-mini-slider" title="Türkçe Çeviri Sesi">
          <span>🗣️ Çeviri:</span>
          <input type="range" id="gto-trans-vol" min="0" max="100" value="100">
          <span id="gto-trans-vol-val">100%</span>
        </div>
      </div>
    `;

    host.appendChild(overlayDiv);
    this.container = overlayDiv;
    this.originalTextEl = overlayDiv.querySelector("#gto-original-text");
    this.translatedTextEl = overlayDiv.querySelector("#gto-translated-text");
    this.statusDotEl = overlayDiv.querySelector("#gto-status-dot");

    this.bindEvents();
    this.setupDraggable();
  }

  /**
   * Setup event listeners on overlay controls
   */
  bindEvents() {
    const origSlider = this.container.querySelector("#gto-orig-vol");
    const origVal = this.container.querySelector("#gto-orig-vol-val");
    const transSlider = this.container.querySelector("#gto-trans-vol");
    const transVal = this.container.querySelector("#gto-trans-vol-val");
    const minBtn = this.container.querySelector("#gto-btn-minimize");
    const closeBtn = this.container.querySelector("#gto-btn-close");
    const bodyEl = this.container.querySelector("#gto-body");
    const controlsEl = this.container.querySelector("#gto-controls-bar");

    origSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      origVal.textContent = `${val}%`;
      if (this.onOriginalVolumeChange) this.onOriginalVolumeChange(val);
    });

    transSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      transVal.textContent = `${val}%`;
      if (this.onTranslatedVolumeChange) this.onTranslatedVolumeChange(val);
    });

    let minimized = false;
    minBtn.addEventListener("click", () => {
      minimized = !minimized;
      bodyEl.style.display = minimized ? "none" : "block";
      controlsEl.style.display = minimized ? "none" : "flex";
      minBtn.textContent = minimized ? "□" : "_";
    });

    closeBtn.addEventListener("click", () => {
      this.hide();
      if (this.onClose) this.onClose();
    });
  }

  /**
   * Make the overlay draggable across the video player
   */
  setupDraggable() {
    const header = this.container.querySelector("#gto-drag-header");
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener("mousedown", (e) => {
      if (e.target.tagName.toLowerCase() === "button") return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      this.container.style.transform = "none";
      this.container.style.left = `${initialLeft}px`;
      this.container.style.top = `${initialTop}px`;
      this.container.style.bottom = "auto";

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        this.container.style.left = `${initialLeft + dx}px`;
        this.container.style.top = `${initialTop + dy}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  /**
   * Update original and translated text display
   */
  updateContent(original, translated) {
    if (!this.container) this.mount();
    if (this.originalTextEl && original !== undefined) {
      this.originalTextEl.textContent = original;
    }
    if (this.translatedTextEl && translated !== undefined) {
      this.translatedTextEl.textContent = translated;
    }
  }

  /**
   * Update status indicator
   */
  setStatus(status) { // 'idle', 'translating', 'speaking', 'error'
    if (!this.statusDotEl) return;
    this.statusDotEl.className = "gto-status-dot";
    if (status) {
      this.statusDotEl.classList.add(status);
    }
  }

  /**
   * Update volume sliders from settings
   */
  setVolumes(origVol, transVol) {
    if (!this.container) return;
    if (origVol !== undefined) {
      const origSlider = this.container.querySelector("#gto-orig-vol");
      const origVal = this.container.querySelector("#gto-orig-vol-val");
      if (origSlider) origSlider.value = origVol;
      if (origVal) origVal.textContent = `${origVol}%`;
    }
    if (transVol !== undefined) {
      const transSlider = this.container.querySelector("#gto-trans-vol");
      const transVal = this.container.querySelector("#gto-trans-vol-val");
      if (transSlider) transSlider.value = transVol;
      if (transVal) transVal.textContent = `${transVol}%`;
    }
  }

  show() {
    if (!this.container) this.mount();
    if (this.container) {
      this.container.classList.remove("hidden");
      this.isVisible = true;
    }
  }

  hide() {
    if (this.container) {
      this.container.classList.add("hidden");
      this.isVisible = false;
    }
  }

  unmount() {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
      this.container = null;
    }
  }
}

window.GeminiOverlay = new VideoOverlay();
