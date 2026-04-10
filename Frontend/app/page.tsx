import { PublicOnlyRoute } from "../src/app/components/AuthGuard";
import { OnboardingPuzzleClean } from "../src/app/screens/onboarding/OnboardingPuzzleClean";

export default function HomePage() {
  return (
    <PublicOnlyRoute>
      <OnboardingPuzzleClean />
    </PublicOnlyRoute>
  );
}
