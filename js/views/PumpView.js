export default class PumpView {
  constructor(container) {
    this.container = container;
  }

  render({ id, nome, solucao, cor, volume, horario }) {
    const bombaId = Number(id);
    const cartao = document.createElement("article");
    cartao.className = "bomba";
    cartao.style.setProperty("--cor", cor);
    cartao.innerHTML = `
      <div class="topo-bomba">
        <div><h2 id="bomba-${bombaId}">Bomba ${bombaId}</h2><p class="solucao"></p></div>
        <span class="frasco" id="reservatorio-${bombaId}" aria-hidden="true"><span class="liquido"></span></span>
      </div>
      <form aria-labelledby="bomba-${bombaId}" data-bomba-id="${bombaId}">
        <label for="volume-${bombaId}">Quantidade (ml)</label>
        <input id="volume-${bombaId}" name="volume" type="number" inputmode="decimal"
               min="0.01" step="0.01" required>
        <label for="horario-${bombaId}">Horário (HH:MM)</label>
        <input id="horario-${bombaId}" name="horario" type="time" required>
        <button type="submit" class="agendar">Agendar Dosagem</button>
        <button type="button" class="dosar">Dosar Agora</button>
      </form>`;

    // Dados textuais são inseridos como texto, inclusive quando vierem da API.
    cartao.querySelector("h2").textContent = nome || `Bomba ${bombaId}`;
    cartao.querySelector(".solucao").textContent = solucao;
    cartao.querySelector('[name="volume"]').value = volume;
    cartao.querySelector('[name="horario"]').value = horario;
    this.container.append(cartao);
  }
}
