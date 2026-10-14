import { ImageResponse } from "next/og";

// Served at /icon/192 and /icon/512 (referenced by app/manifest.ts).
export function generateImageMetadata() {
  return [192, 512].map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType: "image/png",
  }));
}

// An unfilled ring on the accent green. Square and full-bleed: platforms apply their own masks.
export default async function Icon({ id }: { id: Promise<string | number> }) {
  const px = Number(await id) === 512 ? 512 : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#5b8a6a",
        }}
      >
        <div
          style={{
            width: Math.round(px * 0.44),
            height: Math.round(px * 0.44),
            borderRadius: "50%",
            border: `${Math.round(px * 0.07)}px solid #ffffff`,
          }}
        />
      </div>
    ),
    { width: px, height: px },
  );
}
