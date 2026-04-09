import { createBrowserRouter, Navigate } from "react-router";
import { OnboardingPuzzleClean } from "./screens/onboarding/OnboardingPuzzleClean";
import { OnboardingPuzzleSwipe } from "./screens/onboarding/OnboardingPuzzleSwipe";
import { OnboardingPuzzleInteractive } from "./screens/onboarding/OnboardingPuzzleInteractive";
import { OnboardingPuzzlePremium } from "./screens/onboarding/OnboardingPuzzlePremium";
import { OnboardingCTA } from "./screens/onboarding/OnboardingCTA";
import { MainLayout } from "./layouts/MainLayout";
import { HomeScreen } from "./screens/main/HomeScreen";
import { AddDataScreen } from "./screens/main/AddDataScreen";
import { InsightsScreen } from "./screens/main/InsightsScreen";
import { MedicationReminderScreen } from "./screens/main/MedicationReminderScreen";
import { ProfileScreen } from "./screens/main/ProfileScreen";
import { AuthGuard, PublicOnlyRoute } from "./components/AuthGuard";
import { ProfileCompletionGuard } from "./components/ProfileCompletionGuard";
import { ProfileSetupScreen } from "./screens/main/ProfileSetupScreen";

// Redirect component
function RedirectToHome() {
  return <Navigate to="/" replace />;
}

// Error boundary component
function ErrorBoundary() {
  return <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  {
    Component: PublicOnlyRoute,
    children: [
      {
        path: "/",
        Component: OnboardingPuzzleClean,
        errorElement: <ErrorBoundary />,
      },
      {
        path: "/auth",
        Component: OnboardingCTA,
      },
      {
        path: "/onboarding/puzzle-swipe",
        Component: OnboardingPuzzleSwipe,
      },
      {
        path: "/onboarding/puzzle-interactive",
        Component: OnboardingPuzzleInteractive,
      },
      {
        path: "/onboarding/puzzle-premium",
        Component: OnboardingPuzzlePremium,
      },
      {
        path: "/onboarding/cta",
        Component: OnboardingCTA,
      },
      {
        path: "/onboarding/clarity",
        Component: RedirectToHome,
      },
      {
        path: "/onboarding/connection",
        Component: RedirectToHome,
      },
      {
        path: "/onboarding/fragmentation",
        Component: RedirectToHome,
      },
    ],
  },
  {
    Component: AuthGuard,
    children: [
      {
        Component: ProfileCompletionGuard,
        children: [
          {
            path: "/app",
            Component: MainLayout,
            errorElement: <ErrorBoundary />,
            children: [
              { index: true, Component: HomeScreen },
              { path: "medications", Component: MedicationReminderScreen },
              { path: "add", Component: AddDataScreen },
              { path: "insights", Component: InsightsScreen },
              { path: "profile", Component: ProfileScreen },
              { path: "profile/setup", Component: ProfileSetupScreen },
            ],
          },
        ],
      },
    ],
  },
  // Catch-all 404 redirect
  {
    path: "*",
    Component: RedirectToHome,
  },
]);
