import { Navigate, Outlet, useLocation } from "react-router";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";

export function AuthGuard() {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="flex items-center gap-3 rounded-full bg-white/70 px-5 py-3 text-sm text-gray-700 shadow-lg backdrop-blur-xl">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading your CareMosaic space...
        </div>
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="flex items-center gap-3 rounded-full bg-white/70 px-5 py-3 text-sm text-gray-700 shadow-lg backdrop-blur-xl">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Checking your session...
        </div>
      </div>
    );
  }

  if (user) {
    const nextPath = window.sessionStorage.getItem("auth_next_path");

    if (nextPath) {
      window.sessionStorage.removeItem("auth_next_path");
      return <Navigate to={nextPath} replace />;
    }

    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
