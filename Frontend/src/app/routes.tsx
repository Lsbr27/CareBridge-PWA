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
import { ProfileScreen } from "./screens/main/ProfileScreen";

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
    path: "/",
    Component: OnboardingPuzzleClean,
    errorElement: <ErrorBoundary />,
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
  // Redirect old onboarding routes to home
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
  {
    path: "/app",
    Component: MainLayout,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, Component: HomeScreen },
      { path: "add", Component: AddDataScreen },
      { path: "insights", Component: InsightsScreen },
      { path: "profile", Component: ProfileScreen },
    ],
  },
  // Catch-all 404 redirect
  {
    path: "*",
    Component: RedirectToHome,
  },
]);