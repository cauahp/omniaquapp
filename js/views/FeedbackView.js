export default class FeedbackView {
  constructor(aviso) {
    this.aviso = aviso;
    this.temporizador = null;
    this.movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
  }

  showMessage(mensagem, duracao = 3500) {
    clearTimeout(this.temporizador);
    this.aviso.textContent = mensagem;
    if (!this.movimentoReduzido.matches) {
      this.aviso.getAnimations().forEach(animacao => animacao.cancel());
      this.aviso.animate([
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], { duration: 220, easing: "ease-out" });
    }
    if (duracao > 0) {
  this.temporizador = setTimeout(() => {
    this.aviso.textContent = "";
  }, duracao);
}
  }

  showDose(id, volume) {
    this.showMessage(`Bomba ${id} acionada com ${volume.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ml`);
    if (this.movimentoReduzido.matches) return;

    const liquido = document.querySelector(`#reservatorio-${id} .liquido`);
    if (!liquido) return;
    liquido.getAnimations().forEach(animacao => animacao.cancel());
    liquido.animate([
      { transform: "translateY(0) rotate(0)" },
      { transform: "translateY(5px) rotate(10deg)", offset: .42 },
      { transform: "translateY(2px) rotate(-6deg)", offset: .72 },
      { transform: "translateY(0) rotate(0)" }
    ], { duration: 920, easing: "ease-in-out" });
  }
}
