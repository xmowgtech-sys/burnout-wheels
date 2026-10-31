import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Burnout Wheels — die-cast pit lane";

export default function opengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0c",
          padding: 72,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 16, height: 74, background: "#e10600" }} />
          <div
            style={{
              color: "#f4f4f2",
              fontSize: 92,
              fontWeight: 900,
              letterSpacing: -2,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            Burnout Wheels
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: "#ffe600", fontSize: 30, letterSpacing: 8, textTransform: "uppercase", display: "flex" }}>
            Die-Cast Pit Lane
          </div>
          <div style={{ color: "#a5a5ad", fontSize: 26, display: "flex" }}>
            Authentic F1 die-cast — catalogued like telemetry, shipped like a race weekend.
          </div>
        </div>
        <div style={{ display: "flex", height: 12, background: "linear-gradient(90deg, #e10600, #0a0a0c)" }} />
      </div>
    ),
    { ...size }
  );
}
