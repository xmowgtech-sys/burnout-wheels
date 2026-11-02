// Cold-start catalog seed — generated from the operator's real product catalog.
// Only active, authentic products are included. Demo/placeholder items removed.
export type SeedProduct = {
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  scale: string | null;
  condition: string;
  description: string;
  highlights: string[];
  tags: string;
  images: string[];
  priceSale: number;
  priceCost: number;
  feePercent: number;
  stock: number;
  lowStockThreshold: number;
  status: string;
  featured: number;
  dropAt: string | null;
};

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: "red-bull-racing-rb20-f1",
    name: "Red Bull Racing RB20 F1",
    brand: "Hot Wheel",
    category: "Rare Drops",
    scale: "1:64",
    condition: "NEW",
    description: "Create the hottest and fastest Hot Wheels collection with a 1:64 scale Premium Formula 1 Oracle Red Bull Racing RB20 (#11) race car. Each vehicle features a Metal/Metal body and chassis and Real Riders tires with authentic details to replicate the actual, real-life race car. The display plinth and specialized packaging enhance collectability. Pick a favorite Formula 1 team or start collecting. Each sold separately, subject to availability. Styles, colors and decorations may vary.",
    highlights: [
      "Additional Features: Metal/Metal body and chassis, Real Riders tires, intricate details matching real-life race car",
      "Operation Mode: Push",
      "Are Batteries Required: No",
      "Indoor Outdoor Usage: Indoor",
      "Is Assembly Required: No",
      "Number Of Players: 1"
    ],
    tags: "red bull,f1,hotwheel,rare",
    images: [
      "/uploads/u-mvxjll11-0wvz0.png",
      "/uploads/u-mvxjlna1-az4f1.png",
      "/uploads/u-mvxjlp8r-yci7z.png"
    ],
    priceSale: 199900,
    priceCost: 89900,
    feePercent: 2,
    stock: 100,
    lowStockThreshold: 5,
    status: "ACTIVE",
    featured: 1,
    dropAt: null
  }
];
