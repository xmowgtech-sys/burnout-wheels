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

export const SEED_PRODUCTS: SeedProduct[] = [];