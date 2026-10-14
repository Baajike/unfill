import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types";

const PUBLIC_PATHS = new Set(["/login"]);

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.local");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are low risk and React/Next emit some of them.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self' blob:",
    `connect-src 'self' https://${supabase.host} wss://${supabase.host}${isDev ? " ws:" : ""}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Runs in proxy.ts on every page request: sets a per-request CSP nonce,
 * refreshes the Supabase session cookie, and redirects signed-out users.
 * Pages and the API still verify the user themselves; this is only the first gate.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };

  let response = next();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = next();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(cacheHeaders ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // getClaims() validates the JWT signature (and refreshes it when needed).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!signedIn && !PUBLIC_PATHS.has(path)) {
    return redirectKeepingCookies(request, response, "/login");
  }
  if (signedIn && path === "/login") {
    return redirectKeepingCookies(request, response, "/");
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function redirectKeepingCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
