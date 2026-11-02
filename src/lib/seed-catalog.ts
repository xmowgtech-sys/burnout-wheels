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
    brand: "Hot Wheels",
    category: "Rare Drops",
    scale: "1:64",
    condition: "NEW",
    description: "Create the hottest and fastest Hot Wheels collection with a 1:64 scale Premium Formula 1 Oracle Red Bull Racing RB20 (#11) race car. Each vehicle features a Metal/Metal body and chassis and Real Riders tires with authentic details to replicate the actual, real-life race car. The display plinth and specialized packaging enhance collectability. Pick a favorite Formula 1 team or start collecting.",
    highlights: [
      "Metal/Metal body and chassis with Real Riders rubber tires",
      "Authentic race livery matching the 2024 championship car",
      "Official Formula 1 Oracle Red Bull Racing licensing",
      "Collector display plinth with branded protective sleeve"
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
  },
  {
    slug: "porsche-911-gt3-rs-weissach",
    name: "Porsche 911 GT3 RS Weissach Package",
    brand: "Hot Wheels Premium",
    category: "Supercars",
    scale: "1:64",
    condition: "NEW",
    description: "1:64 scale die-cast precision casting of the road-legal track weapon Porsche 911 GT3 RS fitted with the Weissach weight-reduction package. Complete with exposed carbon-weave bonnet styling, dual active aero rear wing, magnesium-look wheels, and full roll cage detailing inside.",
    highlights: [
      "Precision aero profile with active rear wing and louvred front fenders",
      "Detailed interior roll cage and ceramic brake rotor visible behind rims",
      "Factory authentic Ice Grey Metallic with Pyro Red wheels",
      "Real Riders high-grip rubber tyres on die-cast metal base"
    ],
    tags: "porsche,gt3rs,weissach,supercar,premium",
    images: [
      "/uploads/u-mvw91a4c-roz17.jpg",
      "/uploads/u-mvw91pc7-esyi8.jpg",
      "/uploads/u-mvw91x6e-gqsaj.jpg"
    ],
    priceSale: 249900,
    priceCost: 119900,
    feePercent: 2,
    stock: 50,
    lowStockThreshold: 3,
    status: "ACTIVE",
    featured: 0,
    dropAt: null
  },
  {
    slug: "nissan-skyline-gtr-r34-v-spec-ii",
    name: "Nissan Skyline GT-R R34 V-Spec II",
    brand: "Hot Wheels Premium",
    category: "JDM Legends",
    scale: "1:64",
    condition: "NEW",
    description: "The crown jewel of Japanese performance: the Nissan Skyline GT-R R34 V-Spec II in iconic Bayside Blue. Built on a weighted metal chassis with NACA duct bonnet casting, twin-turbo RB26DETT badge detailing, and classic 6-spoke NISMO-style bronze wheels with Real Riders tyres.",
    highlights: [
      "Iconic Bayside Blue pearl finish with V-Spec II carbon bonnet NACA duct",
      "Die-cast body and chassis with Real Riders rubber tyres",
      "Accurate quad round tail lights and rear wing stance",
      "Collector card packaging with authentic factory badges"
    ],
    tags: "skyline,r34,gtr,jdm,nismo,godzilla",
    images: [
      "/uploads/u-mvw91pc7-esyi8.jpg",
      "/uploads/u-mvw91x6e-gqsaj.jpg",
      "/uploads/u-mvw91a4c-roz17.jpg"
    ],
    priceSale: 219900,
    priceCost: 99900,
    feePercent: 2,
    stock: 45,
    lowStockThreshold: 4,
    status: "ACTIVE",
    featured: 0,
    dropAt: null
  },
  {
    slug: "ferrari-f40-competizione-rosso",
    name: "Ferrari F40 Competizione Rosso Corsa",
    brand: "Hot Wheels Elite",
    category: "Exotics",
    scale: "1:64",
    condition: "NEW",
    description: "The ultimate turbocharged analogue supercar: the Ferrari F40 Competizione in Rosso Corsa. Featuring an opening rear clamshell revealing the twin-turbocharged Tipo F120 V8 engine block, twin NACA intake side pods, and high-downforce racing wing.",
    highlights: [
      "Rosso Corsa race specification with Speedline racing rims",
      "Full engine bay casting with twin intercooler detailing",
      "Metal chassis and lightweight aerodynamic splitter",
      "Classic pop-up headlamp cutouts and lexan rear screen louvres"
    ],
    tags: "ferrari,f40,competizione,rosso,exotic,turbo",
    images: [
      "/uploads/u-mvw91x6e-gqsaj.jpg",
      "/uploads/u-mvw91a4c-roz17.jpg",
      "/uploads/u-mvw91pc7-esyi8.jpg"
    ],
    priceSale: 279900,
    priceCost: 139900,
    feePercent: 2,
    stock: 35,
    lowStockThreshold: 3,
    status: "ACTIVE",
    featured: 0,
    dropAt: null
  }
];
