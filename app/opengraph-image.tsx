import { ImageResponse } from "next/og";
import { Mark } from "@/components/Logo";

export const alt = "Unfill — say what you mean. Skip the um.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const glow = (color: string) => `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0) 70%)`;

// White card with soft pastel glows, the Logo mark, the name and the headline.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#ffffff",
          color: "#15201A",
        }}
      >
        <div style={{ position: "absolute", top: -260, left: -220, width: 720, height: 720, display: "flex", background: glow("rgba(178,226,199,.6)") }} />
        <div style={{ position: "absolute", top: -240, right: -260, width: 680, height: 680, display: "flex", background: glow("rgba(255,207,173,.55)") }} />
        <div style={{ position: "absolute", bottom: -320, right: 80, width: 720, height: 720, display: "flex", background: glow("rgba(196,186,247,.55)") }} />

        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 128,
              height: 128,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background: "#ffffff",
              boxShadow: "0 2px 4px rgba(21,32,26,.06), 0 14px 36px rgba(63,107,80,.24)",
            }}
          >
            <Mark size={128} />
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, letterSpacing: -1.5 }}>Unfill</div>
        </div>
        <div style={{ display: "flex", marginTop: 48, fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5, maxWidth: 960 }}>
          Say what you mean. Skip the um.
        </div>
      </div>
    ),
    size,
  );
}
