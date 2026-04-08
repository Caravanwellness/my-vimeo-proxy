import { NextResponse } from "next/server";

const VIMEO_TOKEN = process.env.VIMEO_TOKEN!;
const ALBUM_ID = process.env.VIMEO_ALBUM_ID;
const API_SECRET = process.env.API_SECRET;

function loadShowcaseTokens(): Record<string, string | undefined> {
  const tokenMap: Record<string, string | undefined> = {};

  if (API_SECRET) {
    tokenMap[API_SECRET] = ALBUM_ID;
  }

  Object.keys(process.env).forEach((key) => {
    const match = key.match(/^SHOWCASE_TOKEN_([A-Z0-9_]+)$/);
    if (match) {
      const identifier = match[1];
      const token = process.env[key];
      const albumId = process.env[`SHOWCASE_ALBUM_ID_${identifier}`];
      if (token && albumId) {
        tokenMap[token] = albumId;
      }
    }
  });

  return tokenMap;
}

const TOKEN_TO_ALBUM = loadShowcaseTokens();

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");

    const validTokens = Object.keys(TOKEN_TO_ALBUM).filter((t) => t !== "");
    if (!providedSecret || !validTokens.includes(providedSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!VIMEO_TOKEN) {
      return NextResponse.json({ error: "Missing VIMEO_TOKEN" }, { status: 500 });
    }

    const albumId = TOKEN_TO_ALBUM[providedSecret];
    if (!albumId) {
      return NextResponse.json(
        { error: "No showcase configured for this token" },
        { status: 500 }
      );
    }

    const videoId = params.id;

    // This endpoint returns the video only if it belongs to the album,
    // otherwise Vimeo returns 404 — so membership check is built in.
    const r = await fetch(
      `https://api.vimeo.com/albums/${albumId}/videos/${videoId}`,
      {
        headers: {
          Authorization: `Bearer ${VIMEO_TOKEN}`,
          Accept: "application/vnd.vimeo.*+json;version=3.4",
        },
        cache: "no-store",
      }
    );

    if (r.status === 404) {
      const response = NextResponse.json(
        { error: "Video not found in this showcase" },
        { status: 404 }
      );
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return response;
    }

    if (!r.ok) {
      const text = await r.text();
      const response = NextResponse.json({ error: "Vimeo error", detail: text }, { status: r.status });
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return response;
    }

    const data = await r.json();
    const response = NextResponse.json({ success: true, data });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return response;
  } catch (e: any) {
    const response = NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return response;
  }
}

export async function OPTIONS(req: Request) {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return response;
}
