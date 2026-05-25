import { Suspense } from "react";
import { AppointmentsScreen } from "../../../src/app/screens/main/AppointmentsScreen";

export default function AppointmentsPage() {
  return (
    <Suspense>
      <AppointmentsScreen />
    </Suspense>
  );
}
