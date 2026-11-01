"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Official Shop Pay express-checkout button — Shopify's shop-js web component
 * (the same thing @shopify/hydrogen-react's <ShopPayButton /> renders, used
 * directly so no Hydrogen provider tree is required).
 *
 * Eligibility is decided server-side: the button only mounts when the Shopify
 * store is connected AND the intent maps to real Shopify variants. If Shopify
 * isn't configured, nothing renders — never a broken button.
 */

/* Custom element isn't in React-DOM's element map; typed loosely on purpose. */
const ShopPayElement = "shop-pay-button" as unknown as React.FC<{
  "store-url": string;
  "variant-ids": string;
  class?: string;
}>;

interface Props {
  storeDomain: string;
  variantIds: number[];
  /** Small print rendered under the button. */
  note?: string;
}

export function ShopPayButton({ storeDomain, variantIds, note }: Props) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!storeDomain || variantIds.length === 0) return;
    const script = document.createElement("script");
    script.src = "https://cdn.shopify.com/shopifycloud/shop-js/v1.0/client.js";
    script.async = true;
    script.onerror = () => setFailed(true);
    ref.current?.appendChild(script);
    return () => {
      script.remove();
    };
  }, [storeDomain, variantIds]);

  if (failed) return null;

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <ShopPayElement
        store-url={`https://${storeDomain}`}
        variant-ids={JSON.stringify(variantIds)}
        class="w-full"
      />
      {note && <p className="u-label-txt text-[12px]! normal-case!">{note}</p>}
      <noscript>
        <p className="u-label-txt">Shop Pay needs JavaScript enabled.</p>
      </noscript>
    </div>
  );
}
