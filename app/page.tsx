"use client";

import { AppProvider, useApp } from "@/components/AppProvider";
import { AuthScreen } from "@/components/AuthScreen";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { AppShell } from "@/components/app/AppShell";
import { BootSplash } from "@/components/BootSplash";

function Root() {
  const { screen } = useApp();
  switch (screen) {
    case "loading":
      return <BootSplash />;
    case "anon":
      return <AuthScreen />;
    case "onboarding":
      return <Onboarding />;
    case "app":
      return <AppShell />;
  }
}

export default function Page() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
