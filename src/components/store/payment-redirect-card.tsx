"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Copy, Check, ExternalLink, ShieldCheck, Clock, Truck, MessageSquare, QrCode } from "lucide-react";
import { CONTACT } from "@/lib/contact";
import { fmtUSD } from "@/lib/money";
import type { OrderWithRelations, OrderItem } from "@/lib/types";

interface Props {
  order: OrderWithRelations;
  initialChannel?: "discord" | "whatsapp";
}

export function PaymentRedirectCard({ order, initialChannel }: Props) {
  const [copied, setCopied] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);
  const [channel, setChannel] = useState<"discord" | "whatsapp">(
    initialChannel === "whatsapp" || order.paymentChannel === "WHATSAPP" ? "whatsapp" : "discord"
  );
  const [cachedItems, setCachedItems] = useState<OrderItem[]>(order.items ?? []);
  const [displayTotal, setDisplayTotal] = useState<number>(order.total);

  // If server order has 0 items (serverless fallback), recover full item details from client sessionStorage
  useEffect(() => {
    if (order.items && order.items.length > 0) return;
    try {
      const stored = window.sessionStorage.getItem("bw:lastOrder");
      if (stored) {
        const parsed = JSON.parse(stored) as {
          number?: string;
          total?: number;
          items?: { id?: number; productId?: number; name: string; slug?: string; price: number; qty: number; image?: string | null; condition?: string }[];
        };
        if (parsed.number?.toUpperCase() === order.number.toUpperCase()) {
          if (parsed.items && parsed.items.length > 0) {
            setCachedItems(
              parsed.items.map((it, idx) => ({
                id: it.id || idx + 1,
                orderId: order.id,
                productId: it.productId ?? null,
                name: it.name,
                slug: it.slug ?? null,
                condition: it.condition ?? "New / Boxed",
                scale: "1:64",
                image: it.image ?? null,
                price: it.price,
                cost: 0,
                qty: it.qty || 1,
              }))
            );
          }
          if (parsed.total) {
            setDisplayTotal(parsed.total);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, [order.number, order.items, order.id]);

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(order.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText("7889079186@naviaxis");
    setUpiCopied(true);
    setTimeout(() => setUpiCopied(false), 2500);
  };

  const totalInRupees = Math.round(displayTotal / 100);
  const whatsappMessage = encodeURIComponent(
    `Hi Burnout Wheels! I placed Order #${order.number} for ₹${totalInRupees.toLocaleString("en-IN")}. My name is ${order.name}. Please send me the payment QR code so I can complete payment.`
  );
  const whatsappUrl = `https://wa.me/917889079186?text=${whatsappMessage}`;
  const discordUrl = CONTACT.discord;

  // Auto-copy order number on mount for convenience
  useEffect(() => {
    try {
      navigator.clipboard.writeText(order.number);
    } catch {
      /* ignore */
    }
  }, [order.number]);

  const qrUrl = `/images/upi-qr.png`;

  return (
    <div className="mt-8 border border-line bg-panel p-6 md:p-8">
      {/* Order Number Header with Copy Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="u-label text-dim">Your Order Identifier</p>
          <p className="u-mono mt-1 text-2xl font-bold tracking-wider text-bone md:text-3xl">
            {order.number}
          </p>
          <p className="mt-1 text-xs text-mint">
            ✓ Copied to clipboard — ready to paste in #{channel === "discord" ? "billing" : "WhatsApp"}
          </p>
        </div>
        <button
          type="button"
          onClick={copyOrderNumber}
          className="u-btn u-btn-primary flex items-center gap-2 px-4! py-2.5! text-xs font-semibold"
        >
          {copied ? (
            <>
              <Check className="size-4 text-mint" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="size-4" />
              <span>Copy Order Number</span>
            </>
          )}
        </button>
      </div>

      {/* Ordered Items Summary (Hydrated from local cache or database) */}
      {cachedItems.length > 0 && (
        <div className="border-b border-line py-4">
          <p className="u-label text-dim mb-2">Reserved Items:</p>
          <div className="flex flex-wrap gap-3">
            {cachedItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded border border-line bg-surface/60 px-3 py-2 text-xs">
                {item.image && (
                  <div className="relative size-8 shrink-0 overflow-hidden rounded bg-ink">
                    <Image src={item.image} alt={item.name} fill sizes="32px" className="object-cover" />
                  </div>
                )}
                <div>
                  <span className="font-semibold text-bone">{item.name}</span>
                  <span className="ml-1 text-fog">×{item.qty} ({fmtUSD(item.price * item.qty)})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Channel Switcher */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="u-label">Where would you like to pay?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setChannel("discord")}
            className={`px-3.5 py-2 text-xs font-bold transition-all ${
              channel === "discord"
                ? "bg-red text-white shadow-sm ring-1 ring-red"
                : "border border-line bg-surface text-fog hover:text-white"
            }`}
          >
            Pay on Discord (Most popular)
          </button>
          <button
            type="button"
            onClick={() => setChannel("whatsapp")}
            className={`px-3.5 py-2 text-xs font-bold transition-all ${
              channel === "whatsapp"
                ? "bg-mint text-ink font-extrabold shadow-sm ring-1 ring-mint"
                : "border border-line bg-surface text-fog hover:text-white"
            }`}
          >
            Pay on WhatsApp
          </button>
        </div>
      </div>

      {/* DISCORD PAYMENT FLOW */}
      {channel === "discord" && (
        <div className="mt-6 border border-line bg-surface p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="u-badge bg-red text-white font-bold text-[10px]">MOST POPULAR</span>
              <span className="text-sm font-semibold text-bone">Discord Billing Channel Payment</span>
            </div>
            <span className="u-mono text-sm font-bold text-mint">{fmtUSD(displayTotal)}</span>
          </div>

          <div className="my-5 rounded-sm border border-red/30 bg-red/[0.06] p-4 text-[13px] leading-relaxed text-bone">
            <p className="font-bold text-red">Redirection Action:</p>
            <p className="mt-1">
              Click the big button below to enter our Discord server. Once inside, go to the <strong className="text-white">#billing</strong> channel, paste your order number <strong className="font-mono text-white">{order.number}</strong>, and complete payment.
            </p>
          </div>

          {/* Discord Direct CTA Button */}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="u-btn u-btn-primary flex items-center gap-2 px-6! py-4! text-sm font-bold tracking-wide shadow-lg shadow-red/20"
            >
              <span>Go Directly to Discord Server (#billing)</span>
              <ExternalLink className="size-4" />
            </a>
            <button
              type="button"
              onClick={copyOrderNumber}
              className="u-btn u-btn-ghost px-4! py-4! text-xs"
            >
              {copied ? "✓ Copied to clipboard" : "Copy Order Number Again"}
            </button>
          </div>

          {/* QR Code Section */}
          <div className="mt-6 border-t border-line/60 pt-6">
            <p className="u-label flex items-center gap-2 text-bone">
              <QrCode className="size-4 text-mint" /> Or Scan Official UPI QR Code Directly:
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-5">
              <div className="rounded border border-line bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="Navi UPI QR Code - Amanjot Singh" className="size-48 md:size-56 object-contain" />
              </div>
              <div className="flex flex-col gap-2 text-xs text-fog">
                <p>Payee: <strong className="text-white">AMANJOT SINGH</strong> (Navi Axis Bank)</p>
                <p>Scan with Google Pay, PhonePe, Paytm, or Navi.</p>
                <div className="flex items-center gap-2 rounded border border-line bg-ink px-3 py-2 font-mono text-white">
                  <span>7889079186@naviaxis</span>
                  <button type="button" onClick={copyUpiId} className="text-red hover:underline text-[11px] ml-1">
                    {upiCopied ? "Copied ✓" : "Copy UPI"}
                  </button>
                </div>
                <p className="text-[11px] text-dim">Include order number <strong className="text-bone">{order.number}</strong> in the payment note.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP PAYMENT FLOW */}
      {channel === "whatsapp" && (
        <div className="mt-6 border border-line bg-surface p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="u-badge border-mint text-mint text-[10px] font-bold">WHATSAPP DIRECT</span>
              <span className="text-sm font-semibold text-bone">WhatsApp QR Code &amp; Agent Payment</span>
            </div>
            <span className="u-mono text-sm font-bold text-mint">{fmtUSD(displayTotal)}</span>
          </div>

          <div className="my-5 rounded-sm border border-mint/30 bg-mint/[0.06] p-4 text-[13px] leading-relaxed text-bone">
            <p className="font-bold text-mint">WhatsApp Direct Chat:</p>
            <p className="mt-1">
              Click the button below to message our agent. The message is pre-filled with your order number <strong className="font-mono text-white">{order.number}</strong>. Our agent will send you the QR code for payment.
            </p>
          </div>

          {/* WhatsApp Direct CTA Button */}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="u-btn u-btn-primary bg-mint! text-ink! flex items-center gap-2 px-6! py-4! text-sm font-extrabold tracking-wide shadow-lg shadow-mint/20"
            >
              <MessageSquare className="size-4" />
              <span>Send Message on WhatsApp (+91 78890 79186)</span>
            </a>
            <button
              type="button"
              onClick={copyOrderNumber}
              className="u-btn u-btn-ghost px-4! py-4! text-xs"
            >
              {copied ? "✓ Copied" : "Copy Order Number"}
            </button>
          </div>

          {/* QR Code Section */}
          <div className="mt-6 border-t border-line/60 pt-6">
            <p className="u-label flex items-center gap-2 text-bone">
              <QrCode className="size-4 text-mint" /> Direct UPI QR Code:
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-5">
              <div className="rounded border border-line bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="Navi UPI QR Code - Amanjot Singh" className="size-48 md:size-56 object-contain" />
              </div>
              <div className="flex flex-col gap-2 text-xs text-fog">
                <p>Payee: <strong className="text-white">AMANJOT SINGH</strong> (Navi Axis Bank)</p>
                <p>Scan with any UPI app, pay <strong className="text-bone">₹{totalInRupees}</strong>, and send screenshot to WhatsApp.</p>
                <div className="flex items-center gap-2 rounded border border-line bg-ink px-3 py-2 font-mono text-white">
                  <span>7889079186@naviaxis</span>
                  <button type="button" onClick={copyUpiId} className="text-mint hover:underline text-[11px] ml-1">
                    {upiCopied ? "Copied ✓" : "Copy UPI"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assurance Bar */}
      <div className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-3 text-xs text-fog">
        <div className="flex items-center gap-2.5">
          <Clock className="size-4 text-yellow shrink-0" />
          <span>Real agent verification (up to 24 hrs)</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Truck className="size-4 text-mint shrink-0" />
          <span>Dispatched via Shiprocket PAN-India</span>
        </div>
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-4 text-sky shrink-0" />
          <span>Stock reserved immediately under your name</span>
        </div>
      </div>
    </div>
  );
}
