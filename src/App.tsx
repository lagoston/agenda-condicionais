import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Carregando } from "./components/ui";
import { sistemaConfigurado } from "./lib/api";
import { useAuth } from "./lib/auth";
import { ehFinanceiro } from "./lib/permissoes";
import Buscar from "./pages/Buscar";
import EmAberto from "./pages/EmAberto";
import { Login, PrimeiroAcesso, SemAcesso } from "./pages/Entrada";
import Lista from "./pages/Lista";
import Listas from "./pages/Listas";
import Usuarios from "./pages/Usuarios";

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
        <Route path="/lista/:data" element={<Lista />} />
        <Route path="/buscar" element={<Buscar />} />
        {ehFinanceiro(perfil.papel) && <Route path="/em-aberto" element={<EmAberto />} />}
        {perfil.papel === "admin" && <Route path="/usuarios" element={<Usuarios />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
