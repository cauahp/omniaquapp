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
      <div class="informacoes-reservatorio">
  <div class="saldo-reservatorio">
    <span>Volume restante</span>
    <strong id="saldo-${bombaId}">Carregando...</strong>
  </div>

  <div class="barra-reservatorio">
    <div id="nivel-${bombaId}" class="nivel-reservatorio"></div>
  </div>

  <small id="percentual-${bombaId}"></small>
</div>
      <form aria-labelledby="bomba-${bombaId}" data-bomba-id="${bombaId}">
        <label for="volume-${bombaId}">Quantidade (ml)</label>
        <input id="volume-${bombaId}" name="volume" type="number" inputmode="decimal"
               min="0.01" step="0.01" required>
        <label for="horario-${bombaId}">Horário (HH:MM)</label>
        <input id="horario-${bombaId}" name="horario" type="time" required>

<fieldset class="dias-semana">
  <legend>Dias da semana</legend>

  <div class="seletor-dias">
    <label>
      <input type="checkbox" name="dias_semana" value="1" checked>
      <span>Seg</span>
    </label>

    <label>
      <input type="checkbox" name="dias_semana" value="2" checked>
      <span>Ter</span>
    </label>

    <label>
      <input type="checkbox" name="dias_semana" value="3" checked>
      <span>Qua</span>
    </label>

    <label>
      <input type="checkbox" name="dias_semana" value="4" checked>
      <span>Qui</span>
    </label>

    <label>
      <input type="checkbox" name="dias_semana" value="5" checked>
      <span>Sex</span>
    </label>

    <label>
      <input type="checkbox" name="dias_semana" value="6" checked>
      <span>Sáb</span>
    </label>

    <label>
      <input type="checkbox" name="dias_semana" value="7" checked>
      <span>Dom</span>
    </label>
  </div>
</fieldset>

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

atualizarReservatorio(bomba) {
  const id = Number(bomba.id);
  const restante = Number(bomba.volumeRestante);
  const capacidade = Number(bomba.capacidade);

  const saldo = document.getElementById(`saldo-${id}`);
  const nivel = document.getElementById(`nivel-${id}`);
  const percentual = document.getElementById(
    `percentual-${id}`
  );

  if (!saldo || !nivel || !percentual) return;

  if (
    !Number.isFinite(restante) ||
    !Number.isFinite(capacidade) ||
    capacidade <= 0 ||
    restante < 0 ||
    restante > capacidade
  ) {
    saldo.textContent = "Indisponível";
    nivel.style.width = "0%";
    percentual.textContent = "Dados inválidos";
    return;
  }

  const porcentagem = restante / capacidade * 100;

  saldo.textContent =
    `${restante.toLocaleString("pt-BR")} / ` +
    `${capacidade.toLocaleString("pt-BR")} ml`;

  nivel.style.width = `${porcentagem}%`;

  nivel.classList.toggle(
    "nivel-baixo",
    porcentagem <= 20
  );

  percentual.textContent =
    `${porcentagem.toFixed(1)}% disponível`;
}

}
