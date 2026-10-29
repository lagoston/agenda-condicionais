import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Carregando } from "./components/ui";
import { sistemaConfigurado } from "./lib/api";
import { useAuth } from "./lib/auth";
import Buscar from "./pages/Buscar";
import EmAberto from "./pages/EmAberto";
import { Login, PrimeiroAcesso, SemAcesso } from "./pages/Entrada";
import Lista from "./pages/Lista";
import Listas from "./pages/Listas";
import Usuarios from "./pages/Usuarios";

/** Endereço antigo (/lista/AAAA-MM-DD) leva para a lista de Entregas */
function RedirecionarParaEntregas() {
  const { data = "" } = useParams();
  return <Navigate to={`/lista/entrega/${data}`} replace />;
}

export default function App() {
  const { carregando, sessao, perfil } = useAuth();
  const [configurado, setConfigurado] = useState<boolean | null>(null);

  useEffect(() => {
    if (sessao) return;
    sistemaConfigurado()
      .then(setConfigurado)
      .catch(() => setConfigurado(true));
  }, [sessao]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-papel">
        <Carregando />
      </div>
    );
  }

  if (!sessao) {
    if (configurado === null) {
      return (
        <div className="min-h-screen bg-papel">
          <Carregando />
        </div>
      );
    }
    return configurado ? <Login /> : <PrimeiroAcesso aoConcluir={() => setConfigurado(true)} />;
  }

  if (!perfil || !perfil.ativo) return <SemAcesso />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Listas />} />
        <Route path="/lista/:modalidade/:data" element={<Lista />} />
        <Route path="/lista/:data" element={<RedirecionarParaEntregas />} />
        <Route path="/buscar" element={<Buscar />} />
        <Route path="/em-aberto" element={<EmAberto />} />
        {perfil.papel === "admin" && <Route path="/usuarios" element={<Usuarios />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
