import { PublicOnlyRoute } from "../../src/app/components/AuthGuard";
import { OnboardingCTA } from "../../src/app/screens/onboarding/OnboardingCTA";

export default function AuthPage() {
  return (
    <PublicOnlyRoute>
      <OnboardingCTA />
    </PublicOnlyRoute>
  );
}
