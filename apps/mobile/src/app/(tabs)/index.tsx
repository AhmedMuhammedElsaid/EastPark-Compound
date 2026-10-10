import * as React from "react";

import { ResidentHome } from "@/components/home/resident-home";
import { GuestLanding } from "@/components/teaser/guest-landing";
import { useAppSelector } from "@/store";

/**
 * Home tab. Signed out it is the public landing page (mirrors the web `/`); signed in it is the
 * resident home with every feature open.
 */
export default function HomeScreen() {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  return isAuthenticated ? <ResidentHome /> : <GuestLanding />;
}
