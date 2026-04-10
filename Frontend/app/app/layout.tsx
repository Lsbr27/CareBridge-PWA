import type { ReactNode } from "react";
import { AuthGuard } from "../../src/app/components/AuthGuard";
import { ProfileCompletionGuard } from "../../src/app/components/ProfileCompletionGuard";
import { MainLayout } from "../../src/app/layouts/MainLayout";

export default function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGuard>
      <ProfileCompletionGuard>
        <MainLayout>{children}</MainLayout>
      </ProfileCompletionGuard>
    </AuthGuard>
  );
}
