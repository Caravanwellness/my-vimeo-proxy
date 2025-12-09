import { NextResponse } from "next/server";

const VIMEO_TOKEN = process.env.VIMEO_TOKEN!;
const USER_ID = process.env.VIMEO_USER_ID;        // for Project/Folder
const PROJECT_ID = process.env.VIMEO_PROJECT_ID;  // for Project/Folder
const ALBUM_ID = process.env.VIMEO_ALBUM_ID;      // for Album/Showcase (default)
const API_SECRET = process.env.API_SECRET;
const SHOWCASE_TOKEN = process.env.SHOWCASE_TOKEN;
const SHOWCASE_ALBUM_ID = process.env.SHOWCASE_ALBUM_ID;
const PRUDENTIAL_SHOWCASE_TOKEN = process.env.PRUDENTIAL_SHOWCASE_TOKEN;
const PRUDENTIAL_SHOWCASE_ALBUM_ID = process.env.PRUDENTIAL_SHOWCASE_ALBUM_ID;

// Map tokens to their respective album IDs
const TOKEN_TO_ALBUM: Record<string, string | undefined> = {
  [API_SECRET || '']: ALBUM_ID,
  [SHOWCASE_TOKEN || '']: SHOWCASE_ALBUM_ID,
  [PRUDENTIAL_SHOWCASE_TOKEN || '']: PRUDENTIAL_SHOWCASE_ALBUM_ID,
};

// Return all fields from Vimeo API

function vimeoUrl(searchParams: URLSearchParams, albumId?: string) {
  const page = searchParams.get("page") ?? "1";
  const perPage = searchParams.get("per_page") ?? "20";
  const query = searchParams.get("query") ?? "";

  const base = albumId
    ? `https://api.vimeo.com/albums/${albumId}/videos`
    : `https://api.vimeo.com/users/${USER_ID}/projects/${PROJECT_ID}/videos`;

  const url = new URL(base);
  url.searchParams.set("page", page);
  url.searchParams.set("per_page", perPage);
  if (query) url.searchParams.set("query", query);
  return url.toString();
}

export async function GET(req: Request) {
  try {
    // Check API secret token or showcase token
    const authHeader = req.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');

    const validTokens = [API_SECRET, SHOWCASE_TOKEN, PRUDENTIAL_SHOWCASE_TOKEN].filter(Boolean);
    if (!providedSecret || !validTokens.some(token => token === providedSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!VIMEO_TOKEN) {
      return NextResponse.json({ error: "Missing VIMEO_TOKEN" }, { status: 500 });
    }

    // Get the album ID based on the provided token
    const albumIdForToken = TOKEN_TO_ALBUM[providedSecret];

    if (!albumIdForToken && !(USER_ID && PROJECT_ID)) {
      return NextResponse.json(
        { error: "No album configured for this token and no fallback project configured" },
        { status: 500 }
      );
    }

    const upstream = vimeoUrl(new URL(req.url).searchParams, albumIdForToken);
    const r = await fetch(upstream, {
      headers: {
        Authorization: `Bearer ${VIMEO_TOKEN}`,
        Accept: "application/vnd.vimeo.*+json;version=3.4",
      },
      cache: "no-store",
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json({ error: "Vimeo error", detail: text }, { status: r.status });
    }

    const data = await r.json();

    const response = NextResponse.json({
      success: true,
      data: data
    });

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    return response;
  } catch (e: any) {
    const response = NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });

    // Add CORS headers to error response too
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    return response;
  }
}

export async function OPTIONS(req: Request) {
  const response = new NextResponse(null, { status: 200 });

  // Add CORS headers for OPTIONS request
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  return response;
}
