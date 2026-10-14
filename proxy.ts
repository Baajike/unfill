import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Every page except static assets, generated icons, the manifest and the API
    // (the API authenticates each request itself and returns JSON, not pages).
    "/((?!api/|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)",
  ],
};
