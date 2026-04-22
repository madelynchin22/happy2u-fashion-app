import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url).searchParams.get("url") ?? "https://www.myballerine.com/products.json?limit=5";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json, */*",
      },
      cache: "no-store",
      redirect: "follow",
    });

    const text = await res.text();
    return NextResponse.json({
      status: res.status,
      contentType: res.headers.get("content-type"),
      finalUrl: res.url,
      bodyStart: text.slice(0, 300),
      isJson: text.trim().startsWith("{") || text.trim().startsWith("["),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
