"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";

function isProfileComplete(profile: {
  full_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
} | null) {
  return Boolean(profile?.full_name && profile.date_of_birth && profile.gender);
}

export function ProfileCompletionGuard({ children }: { children: ReactNode }) {
  const { loading, profile } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isSetupRoute = pathname === "/app/profile/setup";
  const isEditMode = searchParams.get("mode") === "edit";
  const profileComplete = isProfileComplete(profile);
  const shouldGoToSetup = !loading && !profileComplete && !isSetupRoute;
  const shouldGoHome = !loading && profileComplete && isSetupRoute && !isEditMode;

  useEffect(() => {
    if (shouldGoToSetup) {
      router.replace("/app/profile/setup");
      return;
    }

    if (shouldGoHome) {
      router.replace("/app");
    }
  }, [router, shouldGoHome, shouldGoToSetup]);

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

  if (shouldGoToSetup || shouldGoHome) {
    return null;
  }

  return <>{children}</>;
}
