import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database…");

  // Create admin user
  const adminPw = await bcrypt.hash("Happy2U@2026", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@happy2u.my" },
    update: {},
    create: {
      email: "admin@happy2u.my",
      name:  "Admin",
      password: adminPw,
      role: "admin",
    },
  });
  console.log("✅ Admin user:", admin.email);

  // Create HQ outlet
  const hq = await prisma.outlet.upsert({
    where: { marking: "HQ-MELAKA" },
    update: {},
    create: {
      name: "Melaka HQ",
      marking: "HQ-MELAKA",
      country: "MY",
      isHQ: true,
      address: "Melaka, Malaysia",
    },
  });
  console.log("✅ Outlet:", hq.name);

  // Create manufacturers (sorted A-Z)
  const manufacturerNames = [
    "Anna", "AOPIYA", "Li De", "Ms Sweet", "Nancy",
    "Sophia", "Tina Bella", "Tina Real Shoes", "Yuki & Maggie",
  ];
  for (const name of manufacturerNames) {
    const existing = await prisma.manufacturer.findFirst({ where: { name } });
    if (!existing) await prisma.manufacturer.create({ data: { name, country: "CN" } });
  }
  console.log("✅ Manufacturers seeded:", manufacturerNames.join(", "));

  // Default competitors
  const competitors = [
    { name: "My Ballerine",    url: "https://www.myballerine.com",  country: "MY" },
    { name: "Charles & Keith", url: "https://www.charleskeith.com", country: "MY" },
    { name: "Bata Malaysia",   url: "https://www.bata.com/my",      country: "MY" },
    { name: "Vincci",          url: "https://www.padini.com/vincci", country: "MY" },
  ];
  for (const c of competitors) {
    const domain = c.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
    const existing = await prisma.competitor.findFirst({ where: { url: { contains: domain } } });
    if (!existing) {
      await prisma.competitor.create({ data: { name: c.name, url: c.url, country: c.country, platform: "custom" } });
      console.log("✅ Competitor added:", c.name);
    } else if (existing.url !== c.url) {
      await prisma.competitor.update({ where: { id: existing.id }, data: { name: c.name, url: c.url } });
      console.log("✅ Competitor fixed:", c.name, "→", c.url);
    } else {
      console.log("⏭  Competitor already exists:", c.name);
    }
  }

  // Default exchange rate
  await prisma.exchangeRate.create({
    data: { fromCcy: "RMB", toCcy: "RM", rate: 0.62, setBy: admin.id },
  }).catch(() => {});
  console.log("✅ Exchange rate: 1 RMB = 0.62 RM");

  console.log("\n✨ Seed complete!");
  console.log("📧 Login: admin@happy2u.my");
  console.log("🔑 Password: Happy2U@2026");
  console.log("⚠️  Change this password after first login!");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
