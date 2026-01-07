import { NextResponse, type NextRequest } from "next/server";

function isBasicAuthDisabled() {
  return !process.env.DEMO_BASIC_USER || !process.env.DEMO_BASIC_PASS;
}

function isExcludedPath(pathname: string) {
  return (
    pathname.startsWith("/api/line/webhook") ||
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml")
  );
}

function isAuthorized(authHeader: string | null) {
  if (!authHeader) return false;
  const [scheme, encoded] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "basic" || !encoded) return false;

  try {
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) return false;
    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    return (
      username === process.env.DEMO_BASIC_USER &&
      password === process.env.DEMO_BASIC_PASS
    );
  } catch (err) {
    console.error("Failed to decode basic auth header", err);
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isBasicAuthDisabled() || isExcludedPath(pathname)) {
    return NextResponse.next();
  }

  if (isAuthorized(req.headers.get("authorization"))) {
    return NextResponse.next();
  }

  const res = new NextResponse("Authentication required", { status: 401 });
  res.headers.set(
    "WWW-Authenticate",
    'Basic realm="Restricted", charset="UTF-8"',
  );
  return res;
}

export const config = {
  matcher: [
    "/((?!api/line/webhook|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
