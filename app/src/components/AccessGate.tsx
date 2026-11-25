import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import type { AppRole } from "../types/database";

export function AccessGate({ children, roles }: { children: ReactNode; roles?: AppRole[] }) {
  const { user, roles: userRoles, loading } = useAuth();
  if (loading) return <p className="status-message">Verificando acesso…</p>;
  if (!user) return <p className="status-message">Entre na sua conta para acessar esta área.</p>;
  if (roles && !roles.some((role) => userRoles.includes(role))) {
    return <p className="status-message">Seu perfil não possui permissão para esta área.</p>;
  }
  return <>{children}</>;
}
