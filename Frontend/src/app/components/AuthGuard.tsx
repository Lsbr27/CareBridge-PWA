"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const shouldRedirect = !loading && !user;

  useEffect(() => {
    if (!shouldRedirect) {
      return;
    }

    const next = encodeURIComponent(pathname);
    router.replace(`/auth?next=${next}`);
  }, [pathname, router, shouldRedirect]);

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

  if (shouldRedirect) {
    return null;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const router = useRouter();
  const shouldRedirect = !loading && !!user;

  useEffect(() => {
    if (!shouldRedirect) {
      return;
    }

    const nextPath = window.sessionStorage.getItem("auth_next_path");

    if (nextPath) {
      window.sessionStorage.removeItem("auth_next_path");
      router.replace(nextPath);
      return;
    }

    router.replace("/app");
  }, [router, shouldRedirect]);

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

  if (shouldRedirect) {
    return null;
  }

  return <>{children}</>;
}
