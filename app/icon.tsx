import { ImageResponse } from "next/og";
import { Mark } from "@/components/Logo";

// Served at /icon/192 and /icon/512 (referenced by app/manifest.ts).
export function generateImageMetadata() {
  return [192, 512].map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType: "image/png",
  }));
}

// The Logo mark on a white disc over soft mint. Square and full-bleed: platforms apply
// their own masks, and the disc stays inside the maskable safe zone.
export default async function Icon({ id }: { id: Promise<string | number> }) {
  const px = Number(await id) === 512 ? 512 : 192;
  const disc = Math.round(px * 0.66);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#E8F5EE",
        }}
      >
        <div
          style={{
            width: disc,
            height: disc,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: "#ffffff",
            boxShadow: `0 ${Math.round(px * 0.03)}px ${Math.round(px * 0.08)}px rgba(63,107,80,.22)`,
          }}
        >
          <Mark size={disc} />
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
