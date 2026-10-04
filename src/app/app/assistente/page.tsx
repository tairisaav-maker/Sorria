import type { Metadata } from "next";
import { AssistantClient } from "@/components/assistant/assistant-client";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Secretária Virtual",
};

export default async function AssistentePage() {
  await requirePermission("assistant.use");
  return <AssistantClient />;
}
