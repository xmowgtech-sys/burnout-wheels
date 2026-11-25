import type { Metadata } from "next";
import { SakugaGallery } from "@/components/store/sakuga-gallery";

export const metadata: Metadata = {
  title: "Sakuga FX Lab",
  description:
    "Interactive anime-inspired spring physics and hand-drawn canvas VFX controls powering Burnout Wheels.",
};

export default function VfxLabPage() {
  return <SakugaGallery />;
}
