import { NextResponse } from "next/server";

const VIMEO_TOKEN = process.env.VIMEO_TOKEN!;
const USER_ID = process.env.VIMEO_USER_ID;        // for Project/Folder
const PROJECT_ID = process.env.VIMEO_PROJECT_ID;  // for Project/Folder
const ALBUM_ID = process.env.VIMEO_ALBUM_ID;      // for Album/Showcase

// keep payload small/safe (no file download links etc.)
const VIMEO_FIELDS =
  "uri,name,description,duration,created_time,modified_time,link,pictures.sizes.link,embed.html,privacy.view";

function vimeoUrl(searchParams: URLSearchParams) {
  const page = searchParams.get("page") ?? "1";
  const perPage = searchParams.get("per_page") ?? "20";
  const query = searchParams.get("query") ?? "";

  const base = ALBUM_ID
    ? `https://api.vimeo.com/albums/${ALBUM_ID}/videos`
    : `https://api.vimeo.com/users/${USER_ID}/projects/${PROJECT_ID}/videos`;

  const url = new URL(base);
  url.searchParams.set("page", page);
  url.searchParams.set("per_page", perPage);
  if (query) url.searchParams.set("query", query);
  url.searchParams.set("fields", VIMEO_FIELDS);
  return url.toString();
}

export async function GET(req: Request) {
  try {
    if (!VIMEO_TOKEN) {
      return NextResponse.json({ error: "Missing VIMEO_TOKEN" }, { status: 500 });
    }
    if (!ALBUM_ID && !(USER_ID && PROJECT_ID)) {
      return NextResponse.json(
        { error: "Set either VIMEO_ALBUM_ID or both VIMEO_USER_ID and VIMEO_PROJECT_ID" },
        { status: 500 }
      );
    }

    const upstream = vimeoUrl(new URL(req.url).searchParams);
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
    const videos = (data?.data ?? []).map((v: any) => ({
      id: v.uri?.split("/").pop(),
      title: v.name,
      description: v.description,
      duration: v.duration,
      urls: {
        watch: v.link,
        embed: v.embed?.html
      },
      thumbnail: v.pictures?.sizes?.[2]?.link ?? v.pictures?.sizes?.[0]?.link,
      timestamps: {
        created: v.created_time,
        modified: v.modified_time
      },
      privacy: v.privacy?.view,
    }));

    return NextResponse.json({
      success: true,
      data: {
        videos,
        pagination: {
          page: data.page,
          perPage: data.per_page,
          total: data.total,
          hasNext: !!data.paging?.next,
          hasPrevious: !!data.paging?.previous
        }
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
