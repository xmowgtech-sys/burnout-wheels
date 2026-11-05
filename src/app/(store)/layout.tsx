import { StoreProviders } from "@/components/store/providers";
import { Header } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { SmoothScroll } from "@/components/store/smooth-scroll";
import { RaceLoader } from "@/components/store/loader";
import { VisitsBeacon } from "@/components/store/visits-beacon";
import { SiteMonitor } from "@/components/store/site-monitor";
import { ConsentBanner } from "@/components/store/consent-banner";
import { ensureCatalogHydrated } from "@/lib/catalog-store";

// The storefront renders live server data on every page (catalog, settings,
// sessions, orders). Never prerender these pages at build time — the deployment
// host has no database while it compiles, and static attempts crash the build.
export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Load the live catalog from Blob on a cold start. The call is deduped and
  // cached for a minute, so it is cheap on warm instances.
  await ensureCatalogHydrated();
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
        <Header />
      </div>
      <main id="main" className="min-h-dvh">{children}</main>
      <Footer />
    </StoreProviders>
  );
}
