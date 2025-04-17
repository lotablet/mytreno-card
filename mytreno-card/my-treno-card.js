class MyTrenoCard extends HTMLElement {
  constructor() {
    super();
    this.page = 0;
  }

  setConfig(config) {
    if (!config || !config.sensor) {
      throw new Error("Config non valida: manca il sensore");
    }
    this._config = config;
    this._sensor = config.sensor;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass || !this._sensor) return;

    const entity = this._hass.states[this._sensor];
    if (!entity || !entity.attributes) return;

    const partenze = entity.attributes.partenze || [];
    const arrivi = entity.attributes.arrivi || [];
    const stationName = entity.attributes.friendly_name || "Stazione";

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

        .nav-button {
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

        .nav-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .slider-wrapper {
          width: 100%;
          overflow: hidden;
        }

        .slider {
          display: flex;
          width: 200%;
          transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          transform: translateX(${this.page === 0 ? "0%" : "-50%"});
        }

        .page {
          width: 100%;
        }

        .title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-right: 2rem;
        }

        .title::before {
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

        tr:last-child td {
          border-bottom: none;
        }

        tr:hover td {
          background: rgba(255, 255, 255, 0.03);
        }

        .desktop-view th:nth-child(1),
        .desktop-view td:nth-child(1) { width: 30%; }
        .desktop-view th:nth-child(2),
        .desktop-view td:nth-child(2) { width: 12%; }
        .desktop-view th:nth-child(3),
        .desktop-view td:nth-child(3) { width: 22%; }
        .desktop-view th:nth-child(4),
        .desktop-view td:nth-child(4) { width: 18%; }
        .desktop-view th:nth-child(5),
        .desktop-view td:nth-child(5) { width: 18%; }

        .mobile-view {
          display: none;
        }

        .ritardo-box {
          max-width: 90px;
          overflow: hidden;
          white-space: nowrap;
          position: relative;
          display: inline-block;
        }

        .ritardo-box span {
          display: block;
          will-change: transform;
        }

        .ritardo-box.scroll span {
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

        .scrollable-text {
          max-width: 140px;
          width: 140px;
          overflow: hidden;
          white-space: nowrap;
          position: relative;
          text-align: left;
        }

        .scrollable-text span {
          display: inline-block;
          will-change: transform;
          padding-right: 20px;
        }

        .scrollable-text.overflowing span {
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

        .status-chip {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          white-space: nowrap;
        }

        .status-chip.on-time {
          background: rgba(52, 211, 153, 0.1);
          color: #34D399;
        }

        .status-chip.delayed {
          background: rgba(251, 191, 36, 0.1);
          color: #FBB724;
          animation: pulse 2s infinite;
        }

        .status-chip.late {
          background: rgba(239, 68, 68, 0.1);
          color: #EF4444;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }

        .platform-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2rem;
          height: 2rem;
          padding: 0 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .platform-changed {
          background: rgba(239, 68, 68, 0.1);
          color: #EF4444;
        }

        .platform-arrow {
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0.25rem;
        }

        @media (max-width: 500px) {
          ha-card {
            padding: 1rem;
            border-radius: 12px;
          }

          .nav-button {
            top: 1rem;
            right: 1rem;
            width: 28px;
            height: 28px;
          }

          .title {
            font-size: 1.125rem;
            margin-bottom: 1rem;
          }

          .desktop-view {
            display: none;
          }

          .mobile-view {
            display: table;
          }

          .mobile-view th:nth-child(1),
          .mobile-view td:nth-child(1) { width: 40%; }
          .mobile-view th:nth-child(2),
          .mobile-view td:nth-child(2) { width: 20%; }
          .mobile-view th:nth-child(3),
          .mobile-view td:nth-child(3) { width: 40%; }

          th, td {
            padding: 0.75rem;
            font-size: 0.875rem;
          }

          .scrollable-text {
            max-width: 100px;
            width: 100px;
          }

          .scrollable-text.overflowing span {
            animation: scroll-text-mobile 5s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
          }

          @keyframes scroll-text-mobile {
            0% { transform: translateX(0); }
            5% { transform: translateX(0); }
            35% { transform: translateX(calc(-100% + 100px)); }
            65% { transform: translateX(calc(-100% + 100px)); }
            95% { transform: translateX(0); }
            100% { transform: translateX(0); }
          }

          .status-chip {
            padding: 0.25rem 0.5rem;
            font-size: 0.75rem;
          }

          .platform-badge {
            min-width: 1.75rem;
            height: 1.75rem;
            font-size: 0.75rem;
          }

          .platform-info {
            display: flex;
            align-items: center;
            gap: 0.25rem;
          }
        }
      </style>
      <ha-card>
        <div class="nav-button" id="nextBtn">→</div>
        <div class="slider-wrapper">
          <div class="slider">
            <div class="page">
              <div class="title">Partenze da ${stationName}</div>
              ${this._renderTable(partenze, "destinazione", "Destinazione", true)}
              ${this._renderTable(partenze, "destinazione", "Destinazione", false)}
            </div>
            <div class="page">
              <div class="title">Arrivi a ${stationName}</div>
              ${this._renderTable(arrivi, "provenienza", "Provenienza", true)}
              ${this._renderTable(arrivi, "provenienza", "Provenienza", false)}
            </div>
          </div>
        </div>
      </ha-card>
    `;

    requestAnimationFrame(() => {
      this.querySelectorAll(".scrollable-text").forEach(el => {
        const span = el.querySelector("span");
        if (span && span.scrollWidth > el.clientWidth) {
          el.classList.add("overflowing");
        } else {
          el.classList.remove("overflowing");
        }
      });

      this.querySelectorAll(".ritardo-box").forEach(el => {
        const span = el.querySelector("span");
        if (span && span.scrollWidth > el.clientWidth) {
          el.classList.add("scroll");
        } else {
          el.classList.remove("scroll");
        }
      });
    });

    this.querySelector("#nextBtn").addEventListener("click", () => {
      this.page = (this.page + 1) % 2;
      this._updateSlide();
    });
  }

  _updateSlide() {
    const slider = this.querySelector(".slider");
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
      <table class="${isDesktop ? 'desktop-view' : 'mobile-view'}">
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

            if (isDesktop) {
              return `
                <tr>
                  <td><div class="scrollable-text"><span>${name}</span></div></td>
                  <td>${t.orario}</td>
                  <td><div class="ritardo-box"><span>${this._formatDelay(t.ritardo)}</span></div></td>
                  <td><div class="platform-badge${platformChanged ? ' platform-changed' : ''}">${binarioPrevisto}</div></td>
                  <td>${binarioEffettivo !== "N/D" ? `<div class="platform-badge">${binarioEffettivo}</div>` : "N/D"}</td>
                </tr>`;
            } else {
              return `
                <tr>
                  <td><div class="scrollable-text"><span>${name}</span></div></td>
                  <td>${t.orario}</td>
                  <td>
                    <div class="ritardo-box"><span>${this._formatDelay(t.ritardo)}</span></div>
                    ${platformChanged
                      ? `<div class="platform-info">
                          <div class="platform-badge">${binarioPrevisto}</div>
                          <span class="platform-arrow">→</span>
                          <div class="platform-badge platform-changed">${binarioEffettivo}</div>
                        </div>`
                      : `<div class="platform-badge">${binarioPrevisto}</div>`
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
