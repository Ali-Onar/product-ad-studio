import { updateSession } from "@/lib/supabase/proxy";
import { hasEnvVars } from "@/lib/utils";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Route prefixes that require an authenticated session.
 * Everything else is public: the landing page, marketing pages, the blog and
 * the auth pages. Add a prefix here when a new authenticated area is created.
 *
 * Note: this only guards navigations. Route handlers and server actions must
 * still check auth themselves — a matcher change can silently remove coverage.
 */
const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Auth pages a signed-in user has no reason to see.
 * Deliberately excludes /auth/update-password and /auth/confirm: the password
 * recovery flow authenticates the user before it reaches those routes.
 */
const SIGNED_OUT_ONLY_ROUTES = ["/auth/login", "/auth/sign-up"];

const SIGNED_IN_HOME = "/dashboard";
const LOGIN_ROUTE = "/auth/login";

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Redirects while carrying over the refreshed auth cookies, otherwise the
 * session is dropped and the browser goes out of sync with the server.
 */
function redirectWithSession(url: URL, sessionResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);

  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  // Without Supabase env vars there is no session to refresh or guard.
  // You can remove this once the project is set up.
  if (!hasEnvVars) {
    return NextResponse.next({ request });
  }

  const { pathname, search } = request.nextUrl;
  const { response, isAuthenticated } = await updateSession(request);

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_ROUTE;
    url.search = "";
    // Preserved so the login form can send the user back where they came from.
    url.searchParams.set("next", `${pathname}${search}`);

    return redirectWithSession(url, response);
  }

  if (isAuthenticated && SIGNED_OUT_ONLY_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = SIGNED_IN_HOME;
    url.search = "";

    return redirectWithSession(url, response);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
