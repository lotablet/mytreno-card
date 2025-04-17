class MyTrenoCard extends HTMLElement {
  constructor() {
    super();
    this.page = 0;
  }

  _showTrainDetails(treno) {
    const existing = this.querySelector(".treno-popup-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "treno-popup-overlay";

    const popup = document.createElement("div");
    popup.className = "treno-popup";

    popup.innerHTML = `
      <button class="close-btn">&times;</button>
      <div class="treno-popup-content">
        <h3>Treno ${treno.treno || "?"}</h3>
        <p><strong>Orario:</strong> ${treno.orario}</p>
        <p><strong>Destinazione:</strong> ${treno.destinazione || treno.provenienza || "-"}</p>
        <p><strong>Ritardo:</strong> ${treno.ritardo ? treno.ritardo + " min" : "In orario"}</p>
        <p><strong>Binario previsto:</strong> ${treno.binario_previsto || "-"}</p>
        <p><strong>Binario effettivo:</strong> ${treno.binario_effettivo || "-"}</p>
      </div>
    `;

    popup.querySelector(".close-btn").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.appendChild(popup);
    this.appendChild(overlay);
  }

  setConfig(config) {
    if (!config || !config.sensor) {
      throw new Error("Config non valida: manca il sensore");
    }
    this._config = config;
    this._sensor = config.sensor;
  }

  set hass(hass) {
    const oldState = JSON.stringify(this._hass?.states?.[this._sensor]);
    const newState = JSON.stringify(hass?.states?.[this._sensor]);
    if (oldState === newState) return;

    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass || !this._sensor) return;

    const entity = this._hass.states[this._sensor];
    if (!entity || !entity.attributes) return;

    const partenze = entity.attributes.partenze || [];
    const arrivi = entity.attributes.arrivi || [];
    const stationName = entity.attributes.friendly_name || "Station";

    this.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        ha-card {
          display: flex;
          flex-direction: column;
          background: linear-gradient(165deg, #1a1b1e 0%, #121316 100%);
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
          background: #1a1b1e;
          color: #fff;
          padding: 1.5rem;
          border-radius: 12px;
          max-width: 400px;
          width: 90%;
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
          z-index: 10;
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
    `;

    // Add click handlers for train details
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
