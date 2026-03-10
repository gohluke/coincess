import type { MetadataRoute } from "next";
import { BRAND_CONFIG } from "@/lib/brand.config";

const B = BRAND_CONFIG;

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: B.name,
    short_name: B.name,
    description: B.description,
    start_url: B.pwa.startUrl,
    display: "standalone",
    background_color: B.pwa.backgroundColor,
    theme_color: B.pwa.themeColor,
    orientation: "portrait-primary",
    icons: [
      {
        src: B.assets.icon,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: B.assets.logo,
        sizes: "512x512",
        type: "image/png",
      },
    ],
    categories: ["finance", "business"],
    prefer_related_applications: false,
  };
}
