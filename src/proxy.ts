import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "inmovoz_session";

/**
 * Comprobación optimista: si no hay cookie de sesión, redirige al login sin renderizar.
 * La validación real de la sesión se hace en el servidor (getAuth) en cada página y acción.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
