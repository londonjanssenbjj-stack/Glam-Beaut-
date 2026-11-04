export default function App() {
  return (
    <main className="setup-screen">
      <header className="setup-header">
        <a className="brand" href="#inicio" aria-label="Glam Beaut — início">
          glam<span>.</span>
        </a>
        <span className="setup-label">Nova estrutura em desenvolvimento</span>
      </header>

      <section className="setup-hero" id="inicio">
        <p className="eyebrow">BELEZA • ESTÉTICA • BEM-ESTAR</p>
        <h1>A sua experiência Glam está sendo preparada.</h1>
        <p className="intro">
          Estamos organizando a nova plataforma para oferecer uma experiência
          de compra e agendamento mais simples, segura e completa.
        </p>
        <div className="setup-note">
          Esta versão está em ambiente de desenvolvimento e ainda não substitui
          a loja publicada.
        </div>
      </section>

      <footer className="setup-footer">
        Glam Beleza Estética e Bem-estar · Corumbá — Mato Grosso do Sul
      </footer>
    </main>
  );
}
