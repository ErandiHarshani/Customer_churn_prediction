import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { rememberReturnPath } from "../utils/session";

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    rememberReturnPath(location.pathname + location.search, false);
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
