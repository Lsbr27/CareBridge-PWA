import { Navigate, Outlet, useLocation } from "react-router";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";

function isProfileComplete(profile: {
  full_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
} | null) {
  return Boolean(profile?.full_name && profile.date_of_birth && profile.gender);
}

export function ProfileCompletionGuard() {
  const { loading, profile } = useAuth();
  const location = useLocation();
  const isSetupRoute = location.pathname === "/app/profile/setup";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="flex items-center gap-3 rounded-full bg-white/70 px-5 py-3 text-sm text-gray-700 shadow-lg backdrop-blur-xl">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Preparing your profile...
        </div>
      </div>
    );
  }

  const profileComplete = isProfileComplete(profile);

  if (!profileComplete && !isSetupRoute) {
    return <Navigate to="/app/profile/setup" replace />;
  }

  if (profileComplete && isSetupRoute) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
