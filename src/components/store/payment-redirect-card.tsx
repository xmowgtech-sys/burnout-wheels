"use client";

import { useState, useEffect } from "react";
import { Copy, Check, ExternalLink, ShieldCheck, Clock, Truck, MessageSquare, ArrowRight } from "lucide-react";
import { CONTACT } from "@/lib/contact";
import { fmtUSD } from "@/lib/money";
import type { OrderWithRelations } from "@/lib/types";

interface Props {
  order: OrderWithRelations;
  initialChannel?: "discord" | "whatsapp";
}

export function PaymentRedirectCard({ order, initialChannel }: Props) {
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState<"discord" | "whatsapp">(
    initialChannel === "whatsapp" || order.paymentChannel === "WHATSAPP" ? "whatsapp" : "discord"
  );
  const [autoOpened, setAutoOpened] = useState(false);

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(order.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const whatsappMessage = encodeURIComponent(
    `Hi Burnout Wheels! I have placed Order #${order.number} for ${fmtUSD(order.total)}. Please send me the QR code for payment so you can verify and accept my order.`
  );
  const whatsappUrl = `https://wa.me/917889079186?text=${whatsappMessage}`;
  const discordUrl = CONTACT.discord;

  // Auto-redirect prompt to Discord or WhatsApp when landing from checkout
  useEffect(() => {
    if (autoOpened) return;
    const timer = setTimeout(() => {
      setAutoOpened(true);
      if (channel === "discord") {
        window.open(discordUrl, "_blank", "noopener,noreferrer");
      }
    }, 2200);
    return () => clearTimeout(timer);
  }, [channel, autoOpened, discordUrl]);

  return (
    <div className="mt-8 border border-line bg-panel p-6 md:p-8">
      {/* Order Number Header with Copy Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="u-label text-dim">Your Order Identifier</p>
          <p className="u-mono mt-1 text-2xl font-bold tracking-wider text-bone md:text-3xl">
            {order.number}
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
              <span>Copied to clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="size-4" />
              <span>Copy order number</span>
            </>
          )}
        </button>
      </div>

      {/* Channel Switcher */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="u-label">Payment route selected:</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setChannel("discord")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              channel === "discord"
                ? "bg-red text-white"
                : "border border-line bg-surface text-fog hover:text-white"
            }`}
          >
            Discord (Most popular)
          </button>
          <button
            type="button"
            onClick={() => setChannel("whatsapp")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              channel === "whatsapp"
                ? "bg-red text-white"
                : "border border-line bg-surface text-fog hover:text-white"
            }`}
          >
            WhatsApp
          </button>
        </div>
      </div>

      {/* DISCORD PAYMENT FLOW */}
      {channel === "discord" && (
        <div className="mt-6 border border-line bg-surface p-5 md:p-6">
          <div className="flex items-center gap-2">
            <span className="u-badge bg-red text-white font-bold text-[10px]">MOST POPULAR</span>
            <span className="text-sm font-semibold text-bone">Discord Billing Channel Payment</span>
          </div>

          <p className="mt-3 text-[13.5px] leading-relaxed text-fog">
            Follow these exact steps to complete payment and get your order dispatched:
          </p>

          <ol className="mt-4 flex flex-col gap-3 text-[13px] text-bone">
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red/15 text-xs font-bold text-red">
                1
              </span>
              <span>
                Copy your order number: <strong className="font-mono text-white">{order.number}</strong>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red/15 text-xs font-bold text-red">
                2
              </span>
              <span>
                Join our Discord server using the button below and navigate to the{" "}
                <strong className="text-white">#billing</strong> channel.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red/15 text-xs font-bold text-red">
                3
              </span>
              <span>
                Drop your order number <strong className="font-mono text-white">{order.number}</strong> inside the{" "}
                <strong className="text-white">#billing</strong> channel and scan the official QR code posted there to complete payment.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red/15 text-xs font-bold text-red">
                4
              </span>
              <span>
                A real human agent will verify your payment and accept your order (may take up to 24 hours).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red/15 text-xs font-bold text-red">
                5
              </span>
              <span>
                Once accepted inside our pit wall panel, we dispatch your product via{" "}
                <strong className="text-mint">Shiprocket</strong> directly to your delivery address!
              </span>
            </li>
          </ol>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="u-btn u-btn-primary flex items-center gap-2 px-6! py-3.5! text-sm font-bold tracking-wide"
            >
              <span>Join Discord Server &amp; Go to #billing</span>
              <ExternalLink className="size-4" />
            </a>
            <button
              type="button"
              onClick={copyOrderNumber}
              className="u-btn u-btn-ghost px-4! py-3.5! text-xs"
            >
              {copied ? "Order number copied" : "Copy order number again"}
            </button>
          </div>
        </div>
      )}

      {/* WHATSAPP PAYMENT FLOW */}
      {channel === "whatsapp" && (
        <div className="mt-6 border border-line bg-surface p-5 md:p-6">
          <div className="flex items-center gap-2">
            <span className="u-badge border-mint text-mint text-[10px] font-bold">WHATSAPP DIRECT</span>
            <span className="text-sm font-semibold text-bone">WhatsApp QR Code Payment</span>
          </div>

          <p className="mt-3 text-[13.5px] leading-relaxed text-fog">
            Follow these steps to receive your QR code and get your order accepted:
          </p>

          <ol className="mt-4 flex flex-col gap-3 text-[13px] text-bone">
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mint/15 text-xs font-bold text-mint">
                1
              </span>
              <span>
                Click the button below to message our agent on WhatsApp with your pre-filled order number{" "}
                <strong className="font-mono text-white">{order.number}</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mint/15 text-xs font-bold text-mint">
                2
              </span>
              <span>
                Our agent will send you the official UPI QR code directly in the WhatsApp chat.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mint/15 text-xs font-bold text-mint">
                3
              </span>
              <span>
                Scan the QR code, complete payment for <strong className="text-bone">{fmtUSD(order.total)}</strong>, and send the payment screenshot.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mint/15 text-xs font-bold text-mint">
                4
              </span>
              <span>
                A real human agent will verify your payment and accept your order in our panel (may take up to 24 hours).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mint/15 text-xs font-bold text-mint">
                5
              </span>
              <span>
                We pack and ship your parcel through <strong className="text-mint">Shiprocket</strong> with tracking sent to your WhatsApp and email!
              </span>
            </li>
          </ol>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="u-btn u-btn-primary bg-mint! text-ink! flex items-center gap-2 px-6! py-3.5! text-sm font-bold tracking-wide"
            >
              <MessageSquare className="size-4" />
              <span>Send Order Number on WhatsApp for QR</span>
            </a>
            <button
              type="button"
              onClick={copyOrderNumber}
              className="u-btn u-btn-ghost px-4! py-3.5! text-xs"
            >
              {copied ? "Order number copied" : "Copy order number"}
            </button>
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
