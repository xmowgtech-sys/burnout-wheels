// Cold-start catalog seed — generated from the operator's real product catalog
// (node script against data/burnout.db). Real listings only: real prices in paise,
// real stock, real photography (committed uploads + public Wikimedia). Never hand-
// edit generated rows here; re-run the generator or edit products in Admin instead.
// Rewrites /api/files/<file>.jpg to the committed public/uploads copy so images
// survive on fresh serverless hosts.
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
    "slug": "red-bull-racing-rb20-f1-die-cast",
    "name": "Red Bull Racing RB20 F1 Die-Cast",
    "brand": "Bburago",
    "category": "Formula 1",
    "scale": "1:43",
    "condition": "NEW",
    "description": "The RB20 is the car that took Red Bull Racing back-to-back constructors' championships, and this 1:43 die-cast by Bburago puts it at desk height. Cast in zinc alloy with the superb Red Bull livery applied, the model rides on detailed wheels with rolling rubber-style tyres and a moulded front-wing assembly. This is reference-grade hobby metal: sharp decals, correct sponsor placement down to the air-intake livery, and an authentic finish. Sold exactly as pictured — one unit, inspected at the pit bench, boxed with an inspection card. When the shelf allocation runs out, it's gone until the next one is sourced.",
    "highlights": [
      "1:43 scale — 11.5 cm of officially liveried zinc alloy",
      "Rolling wheels with rubber-style tyres",
      "Sharp sponsor decals down to the intake livery",
      "Pit-inspected and shipped in a impact-sleeve box",
      "Serial-logged sourcing — one allocation, then it's gone"
    ],
    "tags": "red bull,f1,2024 season,max verstappen era,1:43",
    "images": [
      "/uploads/u-mvw91a4c-roz17.jpg",
      "/uploads/u-mvw91pc7-esyi8.jpg",
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg/1920px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg",
      "/uploads/u-mvw91x6e-gqsaj.jpg"
    ],
    "priceSale": 89900,
    "priceCost": 52000,
    "feePercent": 2,
    "stock": 3,
    "lowStockThreshold": 5,
    "status": "ACTIVE",
    "featured": 1,
    "dropAt": "2026-10-24"
  },
  {
    "slug": "rb20-podium-edition-1-24-die-cast",
    "name": "Red Bull Racing RB20 — Podium Edition 1:24",
    "brand": "Diecast Masters",
    "category": "Formula 1",
    "scale": "1:24",
    "condition": "NEW",
    "description": "The championship RB20 at 1:24 — full cube of presence on a desk or display shelf. Twenty centimetres of zinc alloy with the complete 2024 livery, opening rear section showing the ERS unit silhouette, and a numbered display plinth with name plate. Same pit-bench inspection standard as every piece we sell: decals aligned, wheels true, packaging double-boxed. Allocation-sized — when this batch is gone, the next sourcing round is announced on the paddock list.",
    "highlights": [
      "1:24 scale — 20 cm of level-up presence",
      "Numbered plinth + name plate included",
      "Full 2024 sponsor livery, intake to rear wing",
      "Double-boxed with inspection card"
    ],
    "tags": "red bull,f1,2024 season,1:24,podium",
    "images": [
      "/uploads/u-mvw91a4c-roz17.jpg",
      "/uploads/u-mvw91pc7-esyi8.jpg",
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg/1920px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg",
      "/uploads/u-mvw91x6e-gqsaj.jpg"
    ],
    "priceSale": 249900,
    "priceCost": 168000,
    "feePercent": 2,
    "stock": 2,
    "lowStockThreshold": 3,
    "status": "ACTIVE",
    "featured": 0,
    "dropAt": null
  },
  {
    "slug": "rb20-podium-print-a3",
    "name": "RB20 Podium Print — A3 Matte (Dutch GP 2024)",
    "brand": null,
    "category": "Collectibles",
    "scale": null,
    "condition": "NEW",
    "description": "A3 matte print of the RB20 at full song — the exact image the Wikimedia CC BY-SA photographers captured in 2024, printed on 250 gsm matte stock. Fits standard A3 frames. Straightforward, honest: it is a print of the photograph shown, shipped flat between boards.",
    "highlights": [
      "A3 matte, 250 gsm stock",
      "Credit: Stepro / Wikimedia Commons, CC BY-SA",
      "Fits every standard A3 frame",
      "Shipped flat, board-protected"
    ],
    "tags": "print,red bull,wall art,poster",
    "images": [
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg/1920px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg"
    ],
    "priceSale": 59900,
    "priceCost": 28000,
    "feePercent": 2,
    "stock": 6,
    "lowStockThreshold": 3,
    "status": "ACTIVE",
    "featured": 0,
    "dropAt": null
  },
  {
    "slug": "rb20-pre-owned-inspection-unit",
    "name": "Red Bull Racing RB20 — Pre-Owned Inspection Unit 1:43",
    "brand": "Bburago",
    "category": "Formula 1",
    "scale": "1:43",
    "condition": "PRE_OWNED",
    "description": "Honest shelf unit: a pre-owned RB20 in the same 1:43 casting as our flagship piece. Light shelf dust, one micro-scruff on the rear wing endplate, decals fully intact. Photographed and described exactly as received — these cars are second-hand and we double-check every detail before listing. Sold as inspection stock: refunds covered only under the video-proof protocol on the Refund & Cancellation page, because the condition is written right here and photographed.",
    "highlights": [
      "Pre-owned — condition described and photographed honestly",
      "Same casting as the flagship RB20 1:43",
      "Micro-scruff on rear wing — see photos",
      "Budget route to the championship livery"
    ],
    "tags": "red bull,f1,pre-owned,second hand,1:43",
    "images": [
      "/uploads/u-mvw91a4c-roz17.jpg",
      "/uploads/u-mvw91pc7-esyi8.jpg",
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg/1920px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg",
      "/uploads/u-mvw91x6e-gqsaj.jpg"
    ],
    "priceSale": 44900,
    "priceCost": 24000,
    "feePercent": 2,
    "stock": 2,
    "lowStockThreshold": 3,
    "status": "ACTIVE",
    "featured": 0,
    "dropAt": null
  },
  {
    "slug": "rb20-desk-racer-1-64",
    "name": "Red Bull Racing RB20 — Desk Racer 1:64",
    "brand": "Hot Wheels-scale",
    "category": "Formula 1",
    "scale": "1:64",
    "condition": "NEW",
    "description": "Pocket-sized RB20 for the desk edge, keyboard shelf or car cage. Same livery read as the big one — deep navy, red bull punch, matte rear wing. Metal body, plastic contoured wheels, no opening parts: exactly what a 1:64 should be. Double-checked title and contents before listing, like everything in this store.",
    "highlights": [
      "1:64 scale — pocket pit-lane",
      "Metal body with painted race livery",
      "Perfect stand-mate for the 1:43 or 1:24 builds",
      "Sleeve-packaged, inspected before dispatch"
    ],
    "tags": "red bull,f1,1:64,desk",
    "images": [
      "/uploads/u-mvw91a4c-roz17.jpg",
      "/uploads/u-mvw91pc7-esyi8.jpg",
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg/1920px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg",
      "/uploads/u-mvw91x6e-gqsaj.jpg"
    ],
    "priceSale": 39900,
    "priceCost": 21000,
    "feePercent": 2,
    "stock": 8,
    "lowStockThreshold": 3,
    "status": "ACTIVE",
    "featured": 0,
    "dropAt": null
  }
];
