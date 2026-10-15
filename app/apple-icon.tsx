import { ImageResponse } from "next/og";
import { Mark } from "@/components/Logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same mark as app/icon.tsx. iOS rounds the corners itself, so keep it square.
export default function AppleIcon() {
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
            width: 124,
            height: 124,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: "#ffffff",
            boxShadow: "0 5px 14px rgba(63,107,80,.22)",
          }}
        >
          <Mark size={124} />
        </div>
      </div>
    ),
    size,
  );
}
