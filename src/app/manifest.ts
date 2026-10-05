import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sorria",
    short_name: "Sorria",
    description: "Gestão inteligente para consultórios",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F7F9FA",
    theme_color: "#246B73",
    lang: "pt-BR",
    categories: ["business", "medical", "productivity"],
    id: getAppUrl() + "/",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
