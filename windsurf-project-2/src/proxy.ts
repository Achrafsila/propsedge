import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = new Set([
  "/welcome",
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/callback",
]);

// API routes never return HTML — redirecting one to /login on an auth
// failure breaks every fetch()-based JSON consumer (the browser follows
// the 307, lands on the login page's HTML, and res.json() throws, which
// callers then silently treat as "provider unavailable"). This route
// carries no user-specific data (it's market regime/phase/price/news
// data, not account data) and its actual API keys never leave the route
// handler, so it's safe to exempt from the session redirect rather than
// forcing it to 307 like a page route.
// Edge Pulse carries the same category of data as market-intelligence
// (market structure/liquidity/levels/catalyst — no user-specific/account
// data, and its API keys never leave the route handler either), so it's
// exempt for the same reason.
const PUBLIC_API_ROUTES = new Set(["/api/market-intelligence", "/api/edge-pulse"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.has(pathname) || pathname === "/" || PUBLIC_API_ROUTES.has(pathname);

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authenticated = !!session;

    if (authenticated && (pathname === "/login" || pathname === "/signup")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!authenticated && !isPublic) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } catch {
    if (!isPublic) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.(?:ico|svg)|fonts/|logo-|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)",
  ],
};
