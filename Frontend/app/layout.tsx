import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../src/styles/index.css";
import { AuthProvider } from "../src/app/providers/AuthProvider";

export const metadata: Metadata = {
  title: "CareMosaic",
  description: "Patient data, medications, appointments, and health logs in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
