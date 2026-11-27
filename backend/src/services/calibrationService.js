
/**
 * Módulo de calibração e validação das dosagens.
 */

export const TEMPO_MAX_SEGURANCA_MS = 30000;
export const TEMPO_MIN_ACIONAMENTO_MS = 100;
export const VOLUME_MAX_ML = 999.99;

// Valida o formato e a precisão do volume.
export function validarVolume(volumeMl) {
  if (
    typeof volumeMl !== "number" &&
    typeof volumeMl !== "string"
  ) {
    throw new Error("Informe um volume válido.");
  }

  if (
    typeof volumeMl === "string" &&
    !/^\d+(\.\d{1,2})?$/.test(volumeMl.trim())
  ) {
    throw new Error(
      "Informe um volume numérico com até duas casas decimais."
    );
  }

  const volume = Number(volumeMl);

  if (!Number.isFinite(volume) || volume <= 0) {
    throw new Error(
      "O volume deve ser maior que zero."
    );
  }

  if (volume > VOLUME_MAX_ML) {
    throw new Error(
      `O volume não pode ultrapassar ${VOLUME_MAX_ML} ml.`
    );
  }

  if (
    Math.abs(volume * 100 - Math.round(volume * 100)) > 0.000001
  ) {
    throw new Error(
      "O volume deve possuir até duas casas decimais."
    );
  }

  return volume;
}

// Converte o volume solicitado em tempo de acionamento.
export function calcularTempoAcionamentoMs(
  volumeMl,
  vazaoMlMin
) {
  const volume = validarVolume(volumeMl);

  if (
    typeof vazaoMlMin !== "number" &&
    typeof vazaoMlMin !== "string"
  ) {
    throw new Error("Vazão da bomba inválida.");
  }

  const vazao = Number(vazaoMlMin);

  if (!Number.isFinite(vazao) || vazao <= 0) {
    throw new Error(
      "A vazão da bomba deve ser maior que zero."
    );
  }

  const tempoCalculado = (volume / vazao) * 60000;

  if (tempoCalculado < TEMPO_MIN_ACIONAMENTO_MS) {
    const volumeMinimo =
      Math.ceil(
        (vazao * TEMPO_MIN_ACIONAMENTO_MS / 60000) * 100
      ) / 100;

    throw new Error(
      `Volume abaixo do mínimo permitido para esta bomba: ${volumeMinimo.toFixed(2)} ml.`
    );
  }

  if (tempoCalculado > TEMPO_MAX_SEGURANCA_MS) {
    const volumeMaximo =
      Math.floor(
        (vazao * TEMPO_MAX_SEGURANCA_MS / 60000) * 100
      ) / 100;

    throw new Error(
      `Volume acima do máximo permitido para esta bomba: ${volumeMaximo.toFixed(2)} ml.`
    );
  }

  return Math.round(tempoCalculado);
}

// Valida a capacidade e o volume disponível no reservatório.
export function validarDosagem(
  volumeMl,
  bomba,
  verificarSaldo = true
) {
  const volume = validarVolume(volumeMl);

  const tempoMs = calcularTempoAcionamentoMs(
    volume,
    bomba.vazao_ml_min
  );

  const capacidade = Number(
    bomba.capacidade_recipiente_ml
  );

  const restante = Number(
    bomba.volume_restante_ml
  );

  if (!Number.isFinite(capacidade) || capacidade <= 0) {
    throw new Error(
      "Capacidade do reservatório inválida."
    );
  }

  if (volume > capacidade) {
    throw new Error(
      "O volume solicitado ultrapassa a capacidade do reservatório."
    );
  }

  if (verificarSaldo) {
    if (
      bomba.volume_restante_ml == null ||
      !Number.isFinite(restante) ||
      restante < 0 ||
      restante > capacidade
    ) {
      throw new Error(
        "Volume restante do reservatório inválido."
      );
    }

    if (volume > restante) {
      throw new Error(
        `Volume insuficiente no reservatório. Disponível: ${restante.toFixed(2)} ml.`
      );
    }
  }

  return {
    volume,
    tempoMs
  };
}
