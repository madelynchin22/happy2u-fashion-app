// Next.js instrumentation hook — runs once on server startup
// Schedules the daily competitor crawl at 2:00 AM Malaysia time (UTC+8 = 18:00 UTC)

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron");

    // Daily at 18:00 UTC = 02:00 AM MYT
    cron.schedule("0 18 * * *", async () => {
      const baseUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
      const secret  = process.env.CRON_SECRET;
      if (!secret) {
        console.warn("[cron] CRON_SECRET not set — skipping daily crawl");
        return;
      }
      console.log("[cron] Starting daily competitor crawl…");
      try {
        const res = await fetch(`${baseUrl}/api/cron/crawl-all`, {
          method: "POST",
          headers: { "x-cron-secret": secret },
        });
        const data = await res.json().catch(() => ({}));
        console.log("[cron] Daily crawl complete:", JSON.stringify(data));
      } catch (err: any) {
        console.error("[cron] Daily crawl error:", err.message);
      }
    });

    console.log("[cron] Daily competitor crawl scheduled at 02:00 MYT");
  }
}
