// Cold-start catalog seed — generated from the operator's real product catalog.
// Only active, authentic products are included. Demo/placeholder items removed.
// Regenerate with: npm run seed:export
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
  imageFit: string;
  imagePosition: string;
};

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    "slug": "red-bull-racing-rb20-f1",
    "name": "Red Bull Racing RB20 F1",
    "brand": "Hot Wheel",
    "category": "Rare Drops",
    "scale": "1:64",
    "condition": "GRADED",
    "description": "Create the hottest and fastest Hot Wheels collection with a 1:64 scale Premium Formula 1 Oracle Red Bull Racing RB20 (#11) race car. Each vehicle features a Metal/Metal body and chassis and Real Riders tires with authentic details to replicate the actual, real-life race car. The display plinth and specialized packaging enhance collectability. Pick a favorite Formula 1 team or start collecting. Each sold separately, subject to availability. Styles, colors and decorations may vary.",
    "highlights": [
      "Additional Features\tMetal/Metal body and chassis, Real Riders tires, intricate details matching real-life race car",
      "Operation Mode\tPush",
      "Are Batteries Required\tNo",
      "Indoor Outdoor Usage\tIndoor",
      "Is Assembly Required\tNo",
      "Number Of Players\t1"
    ],
    "tags": "red bull,f1,hotwheel,rare",
    "images": [
      "/uploads/u-mw0b4lv9-dkxb4.jpg",
      "/uploads/u-mw0b4pyt-x01jg.jpg",
      "/uploads/u-mw0b4s4o-ea53o.jpg",
      "/uploads/u-mw0b4tzd-h2u8b.jpg",
      "/uploads/u-mw0b4vsz-xl86z.jpg"
    ],
    "priceSale": 49900,
    "priceCost": 18000,
    "feePercent": 2,
    "stock": 3,
    "lowStockThreshold": 1,
    "status": "ACTIVE",
    "featured": 1,
    "dropAt": null,
    "imageFit": "contain",
    "imagePosition": "center"
  },
  {
    "slug": "mattel-hot-wheels-ferrari-sf90-stradale-red",
    "name": "Mattel Hot Wheels Ferrari SF90 Stradale [Red]",
    "brand": "Mattel Hot Wheels",
    "category": "Ferrari",
    "scale": "1:64",
    "condition": "NEW",
    "description": "Factory Fresh 5/5, Limited Edition 191/250, 1:64 Scale Diecast Vehicle. Mattel Hot Wheels Ferrari SF90 Stradale in Rosso Corsa Red. Premium collector piece with authentic details.",
    "highlights": [
      "Factory Fresh 5/5 Condition",
      "Limited Edition 191/250",
      "1:64 Scale Diecast",
      "Rosso Corsa Red Finish",
      "Authentic Ferrari Licensing",
      "Premium Collector Packaging"
    ],
    "tags": "ferrari,sf90,stradale,hotwheels,mattel,limited-edition,1:64,collector",
    "images": [
      "/uploads/u-mw0bz8z3-ak9ru.png"
    ],
    "priceSale": 39900,
    "priceCost": 18000,
    "feePercent": 2,
    "stock": 1,
    "lowStockThreshold": 1,
    "status": "ACTIVE",
    "featured": 0,
    "dropAt": null,
    "imageFit": "contain",
    "imagePosition": "center"
  },
  {
    "slug": "ferrari-12cilindri-red",
    "name": "Ferrari 12Cilindri [Red]",
    "brand": "Ferrari",
    "category": "Ferrari",
    "scale": "1:64",
    "condition": "NEW",
    "description": "Ferrari 12Cilindri in Rosso Corsa Red. The ultimate V12 berlinetta with 830 cv, 0-100 km/h in 2.9s. Factory fresh, premium collector piece.",
    "highlights": [
      "Naturally Aspirated V12 6.5L",
      "830 cv / 678 Nm",
      "0-100 km/h 2.9s",
      "Rosso Corsa Red",
      "Limited Production",
      "Factory Fresh"
    ],
    "tags": "ferrari,12cilindri,v12,ferrari-red,collector,limited-edition,1:64",
    "images": [
      "/uploads/u-mw0bzsc7-ma9i6.png",
      "/uploads/u-mw0bzu2x-seexg.png",
      "/uploads/u-mw0bzwhd-cs3kk.png",
      "/uploads/u-mw0bzyld-6lvzg.png",
      "/uploads/u-mw0c00ab-75eid.png"
    ],
    "priceSale": 39900,
    "priceCost": 20000,
    "feePercent": 2,
    "stock": 1,
    "lowStockThreshold": 1,
    "status": "ACTIVE",
    "featured": 0,
    "dropAt": null,
    "imageFit": "contain",
    "imagePosition": "center"
  },
  {
    "slug": "ferrari-365-gtb4-competizione-red",
    "name": "Ferrari 365 GTB4 Competizione [Red]",
    "brand": "Ferrari",
    "category": "Ferrari",
    "scale": "1:64",
    "condition": "NEW",
    "description": "Ferrari 365 GTB4 \"Daytona\" Competizione in Red. The legendary endurance racer with V12 power. Historic competition spec, factory fresh.",
    "highlights": [
      "V12 4.4L Competition Engine",
      "365 GTB4 \"Daytona\"",
      "Le Mans Heritage",
      "Rosso Corsa Red",
      "Competition Specification",
      "Collector Grade"
    ],
    "tags": "ferrari,365-gtb4,daytona,competizione,ferrari-red,vintage,collector,1:64",
    "images": [
      "/uploads/u-mw0c0jcx-yobbh.png"
    ],
    "priceSale": 39900,
    "priceCost": 18000,
    "feePercent": 2,
    "stock": 1,
    "lowStockThreshold": 1,
    "status": "ACTIVE",
    "featured": 0,
    "dropAt": null,
    "imageFit": "contain",
    "imagePosition": "center"
  },
  {
    "slug": "ferrari-f50-red",
    "name": "Ferrari F50 [Red]",
    "brand": "Ferrari",
    "category": "Ferrari",
    "scale": "1:64",
    "condition": "NEW",
    "description": "Ferrari F50 in Rosso Corsa Red. The F1-derived V12 supercar, 1995-1997. 520 units produced. Formula 1 technology for the road.",
    "highlights": [
      "F1-Derived V12 4.7L",
      "520 cv / 470 Nm",
      "0-100 km/h 3.8s",
      "Only 520 Produced",
      "Rosso Corsa Red",
      "F1 Technology"
    ],
    "tags": "ferrari,f50,ferrari-red,v12,supercar,limited-edition,collector,1:64",
    "images": [
      "/uploads/u-mw0c22mm-0mcp7.png"
    ],
    "priceSale": 34900,
    "priceCost": 20000,
    "feePercent": 2,
    "stock": 1,
    "lowStockThreshold": 1,
    "status": "ACTIVE",
    "featured": 0,
    "dropAt": null,
    "imageFit": "contain",
    "imagePosition": "center"
  },
  {
    "slug": "mercedes-amg-petronas-f1-team-black",
    "name": "Mercedes-AMG Petronas Formula One Team [Black]",
    "brand": "Mercedes-AMG",
    "category": "Formula 1",
    "scale": "1:64",
    "condition": "NEW",
    "description": "Mercedes-AMG Petronas F1 Team car in Black. Championship-winning livery, 8x Constructors Champions. Lewis Hamilton & George Russell spec.",
    "highlights": [
      "8x Constructors Champions",
      "Black Championship Livery",
      "Lewis Hamilton Spec",
      "Petronas Green Accents",
      "1:64 Scale Diecast",
      "Official Team Merchandise"
    ],
    "tags": "mercedes,amg,petronas,f1,black,hamilton,russell,champion,1:64",
    "images": [
      "/uploads/u-mw0c3xrq-y5upq.jpg"
    ],
    "priceSale": 49900,
    "priceCost": 16000,
    "feePercent": 2,
    "stock": 2,
    "lowStockThreshold": 1,
    "status": "ACTIVE",
    "featured": 0,
    "dropAt": null,
    "imageFit": "contain",
    "imagePosition": "center"
  },
  {
    "slug": "moneygram-haas-f1-team-black",
    "name": "MoneyGram Haas F1 Team [Black]",
    "brand": "Haas F1 Team",
    "category": "Formula 1",
    "scale": "1:64",
    "condition": "NEW",
    "description": "MoneyGram Haas F1 Team car in Black. VF-24 spec with MoneyGram livery. Kevin Magnussen & Nico Hulkenberg. American team pride.",
    "highlights": [
      "VF-24 Chassis",
      "MoneyGram Title Sponsor",
      "Black & Red Livery",
      "Kevin Magnussen Spec",
      "1:64 Scale Diecast",
      "American F1 Team"
    ],
    "tags": "haas,f1,moneygram,black,magnussen,hulkenberg,american-team,1:64",
    "images": [
      "/uploads/u-mw0c5rv6-jkw2v.jpg",
      "/uploads/u-mw0c5toq-bma5n.jpg",
      "/uploads/u-mw0c5vh1-cqicw.jpg",
      "/uploads/u-mw0c5xar-oc557.jpg",
      "/uploads/u-mw0c643w-5gxih.jpg",
      "/uploads/u-mw0c663g-oa2lc.jpg"
    ],
    "priceSale": 39900,
    "priceCost": 15000,
    "feePercent": 2,
    "stock": 2,
    "lowStockThreshold": 1,
    "status": "ACTIVE",
    "featured": 0,
    "dropAt": null,
    "imageFit": "contain",
    "imagePosition": "center"
  },
  {
    "slug": "williams-racing-blue",
    "name": "Williams Racing [Blue]",
    "brand": "Williams Racing",
    "category": "Formula 1",
    "scale": "1:64",
    "condition": "NEW",
    "description": "Williams Racing FW46 in Gulf Blue. Historic British team, 9x Constructors Champions. Albon & Sargeant spec. Iconic Martini/Gulf heritage.",
    "highlights": [
      "9x Constructors Champions",
      "Gulf Blue Livery",
      "FW46 Chassis",
      "Alex Albon Spec",
      "British Heritage",
      "Official Team Merchandise"
    ],
    "tags": "williams,racing,f1,blue,gulf,albon,british,heritage,1:64",
    "images": [
      "/uploads/u-mw0c7cef-1tr17.webp"
    ],
    "priceSale": 39900,
    "priceCost": 15000,
    "feePercent": 2,
    "stock": 2,
    "lowStockThreshold": 1,
    "status": "ACTIVE",
    "featured": 0,
    "dropAt": null,
    "imageFit": "contain",
    "imagePosition": "center"
  }
];
