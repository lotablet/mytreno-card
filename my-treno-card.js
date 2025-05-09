import { html, css, LitElement } from "https://unpkg.com/lit@2.8.0/index.js?module";
import { loadHaComponents, DEFAULT_HA_COMPONENTS } from "https://cdn.jsdelivr.net/npm/@kipk/load-ha-components/+esm";

loadHaComponents([
  ...DEFAULT_HA_COMPONENTS,
  "ha-selector",
  "ha-entity-picker",
]).catch(() => {});

class MyTrenoCardEditor extends LitElement {
  static properties = {
    hass: { type: Object },
    _config: { type: Object },
  };

  constructor() {
    super();
    this._config = {};
  }

  setConfig(config) {
    // Imposta valore di default se mancante
    if (!config.extra_sensor) {
      config.extra_sensor = "sensor.mytreno_selected_train";
    }

    this._config = { ...config };
  }

  getConfig() {
    // Assicura che extra_sensor venga incluso
    return {
      ...this._config,
      extra_sensor: this._config.extra_sensor || "sensor.mytreno_selected_train",
    };
  }

  _updateConfig(changedProp, value) {
    const newConfig = { ...this._config, [changedProp]: value };
    this._config = newConfig;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.hass) return html``;
    const mytrenoEntities = Object.keys(this.hass.states)
      .filter(e => e.startsWith("sensor.mytreno"));
    return html`
      <div class="section-title">Seleziona la stazione</div>
      <ha-selector
        .hass=${this.hass}
        .selector=${{
          entity: {
            multiple: false,
            include_entities: mytrenoEntities,
          }
        }}
        .value=${this._config.sensor || ""}
        @value-changed=${e => this._updateConfig("sensor", e.detail.value)}>
      </ha-selector>
      <div class="editor-block">
        <ha-formfield label="Seleziona il tema">
          <ha-selector
            .hass=${this.hass}
            .selector=${{
              select: {
                mode: "dropdown",
                options: [
                  { value: "default", label: "Default" },
                  { value: "light", label: "Light (Chiaro)" },
                  { value: "neon", label: "Neon (Cyberpunk)" },
                  { value: "retro", label: "Retro (Classico)" },
                ]
              }
            }}
            .value=${this._config.theme || "default"}
            @value-changed=${e => this._updateConfig("theme", e.detail.value)}
          ></ha-selector>
        </ha-formfield>
      </div>
    `;
  }


  static styles = css`
    :host {
      display: block;
      padding: 16px;
    }
    .editor-block {
      margin-bottom: 1.5rem;
    }

    h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      font-weight: 500;
    }
  `;
}

customElements.define("my-treno-card-editor", MyTrenoCardEditor);

class MyTrenoCard extends HTMLElement {
  constructor() {
    super();
    this.page = 0;
    this._preventRender = false;
  }
  async _showTrainDetails(treno) {
    const trainNum = (treno.treno || "").match(/\d+/)?.[0];
    if (!trainNum) return;

    // Rimuovi eventuali popup già aperti
    const existing = this.querySelector(".treno-popup-overlay");
    if (existing) existing.remove();

    // Mostra popup di caricamento
    const loadingOverlay = document.createElement("div");
    loadingOverlay.className = "treno-popup-overlay";

    const loadingPopup = document.createElement("div");
    loadingPopup.className = `treno-popup theme-${this._theme}`;
    loadingPopup.innerHTML = `<div class="treno-popup-content">⏳ Caricamento dati...</div>`;
    loadingOverlay.appendChild(loadingPopup);
    this.appendChild(loadingOverlay);

    // Call service solo dopo aver mostrato il popup
    await this._hass.callService("mytreno", "set_train", { train_number: trainNum });

    // Aspetta che il sensore venga aggiornato
    const waitForSensorUpdate = async () => {
      const maxTries = 20;
      for (let i = 0; i < maxTries; i++) {
        const attrs = this._hass.states["sensor.mytreno_selected_train"]?.attributes ?? {};
        if (attrs.train_number === trainNum && Array.isArray(attrs.fermate) && attrs.fermate.length > 0) {
          return attrs;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      return null;
    };

    const attrs = await waitForSensorUpdate();

    // Chiudi il popup di caricamento
    loadingOverlay.remove();

    if (!attrs) {
      const errorOverlay = document.createElement("div");
      errorOverlay.className = "treno-popup-overlay";

      const errorPopup = document.createElement("div");
      errorPopup.className = `treno-popup theme-${this._theme}`;
      errorPopup.innerHTML = `<div class="treno-popup-content" style="color:red;">⚠️ Dati non disponibili</div>`;
      errorOverlay.appendChild(errorPopup);
      this.appendChild(errorOverlay);
      errorOverlay.addEventListener("click", e => { if (e.target === errorOverlay) errorOverlay.remove(); });
      return;
    }

    // Crea popup con i dati del treno
    this._popupOpen = true;
    const overlay = document.createElement("div");
    overlay.className = "treno-popup-overlay";

    const popup = document.createElement("div");
    popup.className = `treno-popup theme-${this._theme}`;

    const fermateHTML = `
      <div class="treno-timeline-scroll">
        <div class="treno-timeline">
          ${attrs.fermate.map((f, i) => `
            <div class="treno-stop ${f.arrivato ? 'done' : ''} ${attrs.prossima_stazione === f.stazione ? 'next' : ''}">
              <div class="label">${f.stazione}</div>
              <div class="dot"></div>
              <div class="info">
                <span>${f.programmata?.substring(11, 16) ?? "--"}</span>
                ${f.binario ? `<span>bin ${f.binario}</span>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    popup.innerHTML = `
      <button class="close-btn">&times;</button>
      <div class="treno-popup-content">
        <h3>Treno ${attrs.train_number}</h3>
        <p><strong>Ritardo:</strong> ${attrs.ritardo ?? "-"} min</p>
        <p><strong>Prossima:</strong> ${attrs.prossima_stazione ?? "-"} (${attrs.orario_previsto_prossima?.substring(11, 16) ?? "--"})</p>
        <h4>Percorso</h4>
        <div class="fermate">${fermateHTML}</div>
      </div>
      <style>
        .fermate {
          margin: 0;
          padding: 0;
          overflow: visible !important;
          max-height: none !important;
        }
        .fermate li { line-height:1.4em; }
        .fermate li.done { opacity:.4; text-decoration:line-through; }
        .bin { font-size:.8em; opacity:.7; }
        .treno-popup-content p {
          margin: 0.75rem 0;
          line-height: 1.4;
        }
        .treno-timeline-scroll {
          overflow-x: auto;
          overflow-y: visible;
          padding: 0;
          margin-top: 1rem;
          position: relative;
          scrollbar-width: thin;
          scrollbar-color: #999 transparent;
        }
        .treno-timeline-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .treno-timeline-scroll::-webkit-scrollbar-thumb {
          background-color: #999;
          border-radius: 10px;
        }
        .treno-timeline {
        	display: flex;
        	position: relative;
        	flex-direction: row;
        	min-height: 200px;
        	width: fit-content;
        	align-items: end;
        	gap: 0;
        	justify-content: center;
        	margin-bottom: 20px;
        }
        .treno-timeline::before {
        	content: '';
        	position: absolute;
        	top: 77.5%;
        	transform: translateY(-50%);
        	left: 0;
        	width: var(--timeline-line-width, 100%);
        	height: 8px;
        	background: #0010ff;
        	z-index: 0;
        }
        .treno-stop {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 80px;
          max-width: 80px;
          min-height: 100px;
          max-height: 100px;

        }
        .treno-stop .label {
        	transform: rotate(-35deg);
        	transform-origin: bottom left;
        	font-size: 0.7rem;
        	font-weight: 800;
        	white-space: nowrap;
        	text-overflow: ellipsis;
        	overflow: visible;
        	max-width: 70px;
        	margin-bottom: 1.2rem;
        	height: 2rem;
        	line-height: 8;
        	text-align: left;
        	color: var(--mytreno-text-color, #ffffff);
        	margin-left: 50px;
        }
        .treno-stop .dot {
          width: 16px;
          height: 16px;
          background: #ccc;
          border-radius: 50%;
          position: relative;
          z-index: 1;
          border: 2px solid #fff;
          transition: transform 0.3s ease, background 0.3s ease, box-shadow 0.3s ease;
        }

        .treno-stop:hover .dot {
          transform: scale(1.2);
          box-shadow: 0 0 6px rgba(255, 255, 255, 0.4);
        }

        .treno-stop.done .dot {
          background: #4caf50;
          opacity: 0.4;
        }
        .treno-stop.next .dot {
          background: #ff9800;
          box-shadow: 0 0 6px #ff9800, 0 0 12px rgba(255, 152, 0, 0.4);
          animation: pulse-dot 1.5s infinite;
        }

        @keyframes pulse-dot {
          0% { box-shadow: 0 0 0 0 rgba(255,152,0,0.6); }
          70% { box-shadow: 0 0 0 10px rgba(255,152,0,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,152,0,0); }
        }

        .treno-stop .info {
          font-size: 0.8rem;
          margin-top: 0.6rem;
          color: var(--mytreno-info-color, #ffffff);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          text-align: center;
          line-height: 1.2;
        }

        .treno-stop .info span:first-child {
          font-weight: 600;
        }

        .treno-stop .info span:last-child {
          font-style: italic;
          font-size: 0.75rem;
          opacity: 0.8;
        }

        .treno-popup-content p {
          margin: 0.75rem 0;
          line-height: 1.4;
        }
        .treno-popup.theme-light {
          --mytreno-text-color: #000;
          --mytreno-info-color: #000;
          background: #fff;
          color: #111;
          font-family: 'Inter', sans-serif;
        }

        .treno-popup.theme-retro .treno-timeline::before {
          background: #d00000;
        }
        .treno-popup.theme-neon .treno-timeline::before {
        	background: #e0e2ff;
        	box-shadow: 15px 0px 17px #1af4ff, 0 0 20px #2060f6;
        	border-radius: 36px;
        }
        .treno-popup.theme-light .treno-timeline::before {
          background: #5679ff;
        }
        .treno-popup.theme-light h3 {
          color: #007aff;
        }
        .treno-popup.theme-light .close-btn {
          color: #000;
        }
        .treno-popup.theme-light .treno-popup-content strong {
          color: #444;
        }

        .treno-popup.theme-neon {
          --mytreno-text-color: #66ffe0;
          --mytreno-info-color: #ff00cc;
          background: #0f0f23;
          color: #00ffcc;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 0 20px #00ffcc55;
        }
        .treno-popup.theme-neon h3 {
          color: #ff00cc;
        }
        .treno-popup.theme-neon .close-btn {
          color: #00ffcc;
        }
        .treno-popup.theme-neon .treno-popup-content strong {
          color: #66ffe0;
        }

        .treno-popup.theme-retro {
          --mytreno-text-color: #ffffff;
          --mytreno-info-color: #ffffff;
          background: #202020;
          color: #ffcc00;
          font-family: 'Press Start 2P', monospace;
          border: 2px solid #333;
          box-shadow: inset 0 0 6px #111;
        }
        .treno-popup.theme-retro h3 {
          color: #ffffff;
          font-size: 0.85rem;
        }
        .treno-popup.theme-retro .close-btn {
          color: #ffcc00;
        }
        .treno-popup.theme-retro .treno-popup-content strong {
          color: #ffcc00;
        }
      </style>
    `;

    overlay.appendChild(popup);
    this.appendChild(overlay);
    overlay.addEventListener("click", e => {
      if (e.target === overlay) overlay.remove();
    this._popupOpen = false;
    });

    popup.querySelector(".close-btn").addEventListener("click", () => overlay.remove());
    const scrollContainer = popup.querySelector(".treno-timeline-scroll");
    const nextStop = popup.querySelector(".treno-stop.next");

    if (scrollContainer && nextStop) {
      const offsetLeft = nextStop.offsetLeft - scrollContainer.offsetWidth / 2 + nextStop.offsetWidth / 2;
      scrollContainer.scrollTo({ left: offsetLeft, behavior: "smooth" });
    }
  }

  set hass(hass) {
    if (this._preventRender || this._popupOpen) return;

    const changed =
      JSON.stringify(this._hass?.states?.[this._sensor]) !== JSON.stringify(hass?.states?.[this._sensor]) ||
      JSON.stringify(this._hass?.states?.[this._extra]) !== JSON.stringify(hass?.states?.[this._extra]);

    if (!changed) return;

    this._hass = hass;
    this._render();
  }

  static getConfigElement() {
    return document.createElement("my-treno-card-editor");
  }

  setConfig(config) {
    if (!config.sensor && config.entity) {
      config.sensor = config.entity;
    }

    if (!config.sensor) {
      throw new Error("Config non valida: manca il sensore");
    }

    if (!config.extra_sensor) {
      config.extra_sensor = "sensor.mytreno_selected_train";
    }

    this._config = { ...config };
    this._sensor = config.sensor;
    this._extra  = config.extra_sensor;
    this._theme  = config.theme || "default";
  }
  _render() {
    if (!this._hass || !this._sensor) return;

    const entity = this._hass.states[this._sensor];
    if (!entity || !entity.attributes) return;

    const partenze = entity.attributes.partenze || [];
    const arrivi = entity.attributes.arrivi || [];
    const stationName = entity.attributes.friendly_name || "Station";

    this.innerHTML = `
      <div class="theme-${this._config.theme || 'default'}">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
          .theme-default ha-card {
            background: linear-gradient(140deg, #111728 0%, #1a1d26 100%);
            color: #ffffff;
          }
          .theme-retro ha-card {
            background: #202020;
            color: #ffcc00;
            font-family: 'Press Start 2P', monospace;
            border: 2px solid #333;
            border-radius: 4px;
            box-shadow: inset 0 0 6px #111;
          }

          .theme-retro .treno-title {
            font-size: 1.2rem;
            font-weight: bold;
            letter-spacing: 1px;
            color: #ffffff;
            font-family: 'Press Start 2P', monospace;
          }

          .theme-retro .treno-title::before {
            background: none;
          }

          .theme-retro .treno-nav-button {
            background: #111;
            border: 1px solid #666;
            color: #ffcc00;
          }
          .theme-retro table {
            background: black;
          }
          .theme-retro th,
          .theme-retro td {
            font-family: 'Press Start 2P', monospace;
            color: #ffcc00;
            font-size: 0.95rem;
            font-weight: bold;
            border-bottom: 1px solid #222;
          }

          .theme-retro th {
            font-size: 0.75rem;
            font-weight: normal;
            color: #bbbbbb;
            text-transform: uppercase;
          }

          .theme-retro .status-chip {
            background: transparent !important;
            padding: 0 !important;
            font-family: 'Press Start 2P', monospace;
            font-weight: bold;
          }

          .theme-retro .status-chip.on-time {
            color: #00ff00;
          }
          .theme-retro .status-chip.delayed {
            color: #ffaa00;
          }
          .theme-retro .status-chip.late {
            color: #ff4444;
          }

          .theme-retro .treno-platform-badge,
          .theme-retro .treno-platform-info,
          .theme-retro .treno-platform-arrow {
            all: unset;
          }

          .theme-light ha-card {
            background: #f9f9f9;
            color: #111;
          }

          .theme-light .treno-title {
            color: #111;
          }

          .theme-light .treno-title::before {
            background: #007aff;
          }

          .theme-light th,
          .theme-light td {
            color: #222;
            border-bottom: 1px solid #ddd;
          }

          .theme-light .treno-nav-button {
            background: rgba(0, 0, 0, 0.05);
            color: #000;
          }

          .theme-light .status-chip.on-time {
            background: rgba(0, 128, 0, 0.1);
            color: #008000;
          }

          .theme-light .status-chip.delayed {
            background: rgba(255, 165, 0, 0.15);
            color: #ff9800;
          }

          .theme-light .status-chip.late {
            background: rgba(255, 0, 0, 0.15);
            color: #d32f2f;
          }

          .theme-light .treno-scrollable-text span,
          .theme-light .treno-ritardo-box span {
            color: #111;
          }

          .theme-neon ha-card {
            background: #0f0f23;
            color: #00ffcc;
            box-shadow: 0 0 15px #00ffcc44;
          }
          .theme-neon .treno-title::before {
            background: #ff00cc;
          }
          .theme-neon .treno-nav-button {
            background: #ff00cc33;
            color: #00ffcc;
          }
          .theme-neon .status-chip.on-time {
            background: #003322;
            color: #00ff99;
          }
          .theme-neon .status-chip.delayed {
            background: #331a00;
            color: #ffaa00;
          }
          .theme-neon .status-chip.late {
            background: #330000;
            color: #ff4444;
          }

          ha-card {
            display: flex;
            flex-direction: column;
            background: linear-gradient(140deg, #111728 0%, #1a1d26 100%);
            color: #ffffff;
            font-family: 'Inter', sans-serif;
            padding: 1.5rem;
            border-radius: 16px;
            max-width: 500px;
            margin: auto;
            overflow: hidden;
            position: relative;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
          }

          .treno-popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
          }

          .treno-popup {
            --mytreno-text-color: #ffffff;
            --mytreno-info-color: #edbd00;
            background: linear-gradient(140deg, #111728 0%, #1a1d26 100%);
            color: #fff;
            padding: 1.5rem;
            border-radius: 12px;
            max-width: 400px;
            width: 90%;
            min-height: 300px;
            max-height: none;
            overflow: visible;
            box-shadow: 0 0 20px rgba(0,0,0,0.4);
            animation: scaleIn 0.3s ease;
            font-family: 'Inter', sans-serif;
            position: relative;
          }

          .treno-popup h3 {
            margin-top: 0;
            margin-bottom: 1rem;
            font-size: 1.25rem;
            color: #edbd00;
          }

          .treno-popup .close-btn {
            position: absolute;
            top: 1rem;
            right: 1.5rem;
            background: transparent;
            border: none;
            font-size: 1.5rem;
            color: #fff;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s ease;
          }

          .treno-popup .close-btn:hover {
            transform: scale(1.1);
          }

          .treno-popup-content p {
            margin: 0.75rem 0;
            line-height: 1.4;
          }

          .treno-popup-content strong {
            color: rgba(255, 255, 255, 0.7);
            margin-right: 0.5rem;
          }

          @keyframes fadeIn {
            from { opacity: 0 }
            to { opacity: 1 }
          }

          @keyframes scaleIn {
            from { transform: scale(0.9); opacity: 0 }
            to { transform: scale(1); opacity: 1 }
          }

          .treno-nav-button {
            position: absolute;
            top: 0.5rem;
            right: 1.2rem;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            cursor: pointer;
            user-select: none;
            z-index: 1;
            transition: background 0.2s ease;
            font-size: 1rem;
          }

          .treno-nav-button:hover {
            background: rgba(255, 255, 255, 0.2);
          }

          .treno-slider-wrapper {
            width: 100%;
            overflow: hidden;
          }

          .treno-slider {
            display: flex;
            width: 200%;
            transform: translateX(${this.page === 0 ? "0%" : "-50%"});
            transition: transform 0.3s ease;
          }

          .treno-page {
            width: 100%;
          }

          .treno-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 1.25rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding-right: 2rem;
          }

          .treno-title::before {
            content: '';
            display: inline-block;
            width: 4px;
            height: 1.25rem;
            background: #edbd00;
            border-radius: 2px;
            flex-shrink: 0;
          }

          table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-top: 0.5rem;
          }

          th {
            text-align: left;
            padding: 0.75rem 1vh;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 500;
            font-size: 0.875rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          td {
            text-align: left;
            padding: 0.875rem 1vh;
            font-size: 0.9375rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }

          tr {
            cursor: pointer;
            transition: background-color 0.2s ease;
          }

          tr:last-child td {
            border-bottom: none;
          }

          tr:hover td {
            background: rgba(255, 255, 255, 0.03);
          }

          .status-chip {
            display: inline-flex;
            align-items: center;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.875rem;
            font-weight: 500;
          }

          .status-chip.on-time {
            background: rgba(0, 200, 83, 0.15);
            color: #00c853;
          }
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          .status-chip.delayed {
            background: rgba(255, 152, 0, 0.15);
            color: #ffa000;
            animation: pulse 2s infinite;
          }

          .status-chip.late {
            background: rgba(244, 67, 54, 0.15);
            color: #f44336;
            animation: pulse 0.7s infinite;
          }

          .treno-desktop-view th:nth-child(1),
          .treno-desktop-view td:nth-child(1) { width: 30%; }
          .treno-desktop-view th:nth-child(2),
          .treno-desktop-view td:nth-child(2) { width: 12%; }
          .treno-desktop-view th:nth-child(3),
          .treno-desktop-view td:nth-child(3) { width: 22%; }
          .treno-desktop-view th:nth-child(4),
          .treno-desktop-view td:nth-child(4) { width: 18%; }
          .treno-desktop-view th:nth-child(5),
          .treno-desktop-view td:nth-child(5) { width: 18%; }

          .treno-mobile-view {
            display: none;
          }
          .treno-ritardo-box {
            max-width: 90px;
            overflow: hidden;
            white-space: nowrap;
            position: relative;
            display: inline-block;
          }

          .treno-ritardo-box span {
            display: block;
            will-change: transform;
          }

          .treno-ritardo-box.treno-scroll span {
            animation: scroll-delay 3s linear infinite alternate;
          }

          @keyframes scroll-delay {
            0% { transform: translateX(100%); }
            10% { transform: translateX(100%); }
            45% { transform: translateX(-100%); }
            55% { transform: translateX(-100%); }
            90% { transform: translateX(100%); }
            100% { transform: translateX(100%); }
          }

          .treno-scrollable-text {
            max-width: 140px;
            width: 140px;
            overflow: hidden;
            white-space: nowrap;
            position: relative;
            text-align: left;
          }

          .treno-scrollable-text span {
            display: inline-block;
            will-change: transform;
            padding-right: 20px;
          }

          .treno-scrollable-text.treno-overflowing span {
            animation: scroll-text 5s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
          }

          @keyframes scroll-text {
            0% { transform: translateX(0); }
            5% { transform: translateX(0); }
            35% { transform: translateX(calc(-100% + 140px)); }
            65% { transform: translateX(calc(-100% + 140px)); }
            95% { transform: translateX(0); }
            100% { transform: translateX(0); }
          }

          @media (max-width: 500px) {
            .treno-desktop-view {
              display: none;
            }

            .treno-mobile-view {
              display: table;
            }

            .treno-popup {
              width: calc(100% - 2rem);
              margin: 1rem;
              max-width: none;
            }
          }
        </style>
        <ha-card>
          <div class="treno-nav-button" id="nextBtn">→</div>
          <div class="treno-slider-wrapper">
            <div class="treno-slider">
              <div class="treno-page">
                <div class="treno-title">Partenze da ${stationName}</div>
                ${this._renderTable(partenze, "destinazione", "Destinazione", true)}
                ${this._renderTable(partenze, "destinazione", "Destinazione", false)}
              </div>
              <div class="treno-page">
                <div class="treno-title">Arrivi a ${stationName}</div>
                ${this._renderTable(arrivi, "provenienza", "Provenienza", true)}
                ${this._renderTable(arrivi, "provenienza", "Provenienza", false)}
              </div>
            </div>
          </div>
        </ha-card>
      </div>
    `;
    this.querySelectorAll('table').forEach(table => {
      table.addEventListener('click', (event) => {
        const tr = event.target.closest('tr');
        if (tr) {
          const trenoData = tr.dataset.treno;
          if (trenoData) {
            this._showTrainDetails(JSON.parse(decodeURIComponent(trenoData)));
          }
        }
      });
    });

    requestAnimationFrame(() => {
      this.querySelectorAll(".treno-scrollable-text").forEach(el => {
        const span = el.querySelector("span");
        if (span && span.scrollWidth > el.clientWidth) {
          el.classList.add("treno-overflowing");
        } else {
          el.classList.remove("treno-overflowing");
        }
      });

      this.querySelectorAll(".treno-ritardo-box").forEach(el => {
        const span = el.querySelector("span");
        if (span && span.scrollWidth > el.clientWidth) {
          el.classList.add("treno-scroll");
        } else {
          el.classList.remove("treno-scroll");
        }
      });
    });

    this.querySelector("#nextBtn").addEventListener("click", () => {
      this.page = (this.page + 1) % 2;
      this._updateSlide();
    });
  }

  _updateSlide() {
    const slider = this.querySelector(".treno-slider");
    if (slider) {
      slider.style.transform = `translateX(${this.page === 0 ? "0%" : "-50%"})`;
    }
  }

  _sanitizePlatform(value) {
    if (!value || typeof value !== "string" || value.trim() === "") return "-";
    return value.replace(/ tronco/i, "/T");
  }

  _renderTable(data, field, label, isDesktop) {
    return `
      <table class="${isDesktop ? 'treno-desktop-view' : 'treno-mobile-view'}">
        <thead>
          <tr>
            <th>${label}</th>
            <th>Orario</th>
            ${isDesktop ? '<th>Ritardo</th>' : ''}
            ${isDesktop ? '<th>Binario</th>' : '<th>Info</th>'}
            ${isDesktop ? '<th>Reale</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${data.map(t => {
            const name = t[field] || "-";
            const binarioPrevisto = this._sanitizePlatform(t.binario_previsto);
            const binarioEffettivo = this._sanitizePlatform(t.binario_effettivo);
            const platformChanged = binarioEffettivo !== binarioPrevisto && binarioEffettivo !== "-";
            const tEncoded = encodeURIComponent(JSON.stringify(t));

            if (isDesktop) {
              return `
                <tr data-treno="${tEncoded}">
                  <td><div class="treno-scrollable-text"><span>${name}</span></div></td>
                  <td>${t.orario}</td>
                  <td><div class="treno-ritardo-box"><span>${this._formatDelay(t.ritardo)}</span></div></td>
                  <td><div class="treno-platform-badge${platformChanged ? ' treno-platform-changed' : ''}">${binarioPrevisto}</div></td>
                  <td>${binarioEffettivo !== "-" ? `<div class="treno-platform-badge">${binarioEffettivo}</div>` : "-"}</td>
                </tr>`;
            } else {
              return `
                <tr data-treno="${tEncoded}">
                  <td><div class="treno-scrollable-text"><span>${name}</span></div></td>
                  <td>${t.orario}</td>
                  <td>
                    <div class="treno-ritardo-box"><span>${this._formatDelay(t.ritardo)}</span></div>
                    ${platformChanged
                      ? `<div class="treno-platform-info">
                          <div class="treno-platform-badge">${binarioPrevisto}</div>
                          <span class="treno-platform-arrow">→</span>
                          <div class="treno-platform-badge treno-platform-changed">${binarioEffettivo}</div>
                        </div>`
                      : `<div class="treno-platform-badge">${binarioPrevisto}</div>`
                    }
                  </td>
                </tr>`;
            }
          }).join("")}
        </tbody>
      </table>
    `;
  }

  _formatDelay(delay) {
    if (delay > 5) {
      return `<div class="status-chip late">+${delay} min</div>`;
    }
    if (delay > 0) {
      return `<div class="status-chip delayed">+${delay} min</div>`;
    }
    if (delay < 0) {
      return `<div class="status-chip delayed">${delay} min</div>`;
    }
    return '<div class="status-chip on-time">In orario</div>';
  }

  getCardSize() {
    return 3;
  }
}

customElements.define("my-treno-card", MyTrenoCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "my-treno-card",
  name: "MyTreno Card",
  description: "Visualizza treni in partenza e arrivo da una stazione ViaggiaTreno"
});
