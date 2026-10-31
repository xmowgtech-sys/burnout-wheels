import { StoreProviders } from "@/components/store/providers";
import { Header } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { SmoothScroll } from "@/components/store/smooth-scroll";
import { RaceLoader } from "@/components/store/loader";
import { AnnounceBanner } from "@/components/store/announce-banner";
import { VisitsBeacon } from "@/components/store/visits-beacon";
import { SiteMonitor } from "@/components/store/site-monitor";
import { ConsentBanner } from "@/components/store/consent-banner";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProviders>
      <VisitsBeacon />
      <SiteMonitor />
      <ConsentBanner />
      <SmoothScroll />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-red focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <div className="fixed inset-x-0 top-0 z-[60]">
        <AnnounceBanner />
        <Header />
      </div>
      <main id="main" className="min-h-dvh">{children}</main>
      <Footer />
    </StoreProviders>
  );
}
