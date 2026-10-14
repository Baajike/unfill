import { ImageResponse } from "next/og";

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
          background: "#5b8a6a",
        }}
      >
        <div
          style={{
            width: 79,
            height: 79,
            borderRadius: "50%",
            border: "13px solid #ffffff",
          }}
        />
      </div>
    ),
    size,
  );
}
