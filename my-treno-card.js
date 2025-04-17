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
        ha-card {
          display: flex;
          flex-direction: column;
          font-family: 'Courier New', Courier, monospace;
          color: #ffcc00;
          padding: 1rem;
          border-radius: 10px;
          max-width: 800px;
          margin: auto;
          overflow: hidden;
          position: relative;
        }

        .nav-button {
          position: absolute;
          top: 8px;
          right: 16px;
          font-size: 1.6rem;
          cursor: pointer;
          user-select: none;
          z-index: 10;
        }

        .slider-wrapper {
          width: 100%;
          overflow: hidden;
        }

        .slider {
          display: flex;
          width: 200%;
          transition: transform 0.5s ease-in-out;
          transform: translateX(${this.page === 0 ? "0%" : "-50%"});
        }

        .page {
          width: 100%;
        }

        .title {
          font-size: 1.4rem;
          font-weight: bold;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 0.5rem;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.5rem;
        }

        th, td {
          text-align: center;
          padding: 0.3rem;
          border-bottom: 1px solid #333;
          font-size: 0.9rem;
        }

        th:nth-child(1), td:nth-child(1) { width: 30%; }
        th:nth-child(2), td:nth-child(2) { width: 15%; }
        th:nth-child(3), td:nth-child(3) { width: 20%; }
        th:nth-child(4), td:nth-child(4),
        th:nth-child(5), td:nth-child(5) { width: 17.5%; }

        .ritardo {
          font-size: 0.85rem;
        }

        .rosso { color: red; }
        .verde { color: #00ff00; }
        .giallo { color: #ffcc00; }
      </style>

      <ha-card>
        <div class="nav-button" id="nextBtn">→</div>
        <div class="slider-wrapper">
          <div class="slider">
            <div class="page">
              <div class="title">Partenze da ${stationName}</div>
              ${this._renderTable(partenze, "destinazione")}
            </div>
            <div class="page">
              <div class="title">Arrivi a ${stationName}</div>
              ${this._renderTable(arrivi, "provenienza")}
            </div>
          </div>
        </div>
      </ha-card>
    `;

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

  _renderTable(dati, label) {
    return `
      <table>
        <thead>
          <tr>
            <th>${label.charAt(0).toUpperCase() + label.slice(1)}</th>
            <th>Ora</th>
            <th>Ritardo</th>
            <th>Bin. previsto</th>
            <th>Bin. effettivo</th>
          </tr>
        </thead>
        <tbody>
          ${dati.map(t => `
            <tr>
              <td>${t[label]}</td>
              <td>${t.orario}</td>
              <td class="ritardo">${this._formatRitardo(t.ritardo)}</td>
              <td>${t.binario_previsto || "-"}</td>
              <td>${t.binario_effettivo || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  _formatRitardo(ritardo) {
    if (ritardo > 5) return `<span class="rosso">+${ritardo} min</span>`;
    if (ritardo > 0) return `<span class="giallo">+${ritardo} min</span>`;
    if (ritardo < 0) return `<span class="verde">-${Math.abs(ritardo)} min</span>`;
    return "In orario";
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
