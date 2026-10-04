"use client";

import { useEffect } from "react";
import { trackCommercialEvent } from "@/lib/commercial/client";

export function PlanosAnalytics() {
  useEffect(() => {
    void trackCommercialEvent("pricing_viewed");
  }, []);
  return null;
}
