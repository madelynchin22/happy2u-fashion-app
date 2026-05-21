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

  // Create all outlet locations
  const outletData = [
    { marking: "JN53-H2UWM",     name: "AEON Wangsa Maju KL",               country: "MY", isHQ: false },
    { marking: "JN55-H2UES",     name: "Eslite Spectrum The Starhill KL",    country: "MY", isHQ: false },
    { marking: "JN55-H2USA",     name: "AEON Shah Alam Selangor",            country: "MY", isHQ: false },
    { marking: "JN59-H2UMV",     name: "AEON Mid Valley KL",                 country: "MY", isHQ: false },
    { marking: "JN62-H2UPTJ",    name: "AEON IOI City Mall Putrajaya",       country: "MY", isHQ: false },
    { marking: "JN75-H2UABM",    name: "AEON Bandaraya Melaka Outlet",       country: "MY", isHQ: false },
    { marking: "JN75-H2UABMDEP", name: "AEON Bandaraya Melaka DEP",          country: "MY", isHQ: false },
    { marking: "JN75-H2UAK",     name: "AEON Ayer Keroh Melaka",             country: "MY", isHQ: false },
    { marking: "JN75-H2UHQ",     name: "Happy2U Cheng HQ",                   country: "MY", isHQ: true  },
    { marking: "JN81-H2UATC",    name: "AEON Tebrau City Johor Bharu",       country: "MY", isHQ: false },
    { marking: "JN81-H2UBI",     name: "AEON Bukit Indah Johor Bharu",       country: "MY", isHQ: false },
    { marking: "JN-H2UABT",      name: "AEON Bukit Tinggi",                  country: "MY", isHQ: false },
    { marking: "JN-H2UATM",      name: "AEON Taman Maluri KL",               country: "MY", isHQ: false },
  ];
  for (const o of outletData) {
    await prisma.outlet.upsert({
      where: { marking: o.marking },
      update: { name: o.name },
      create: { ...o, isActive: true },
    });
  }
  console.log("✅ Outlets seeded:", outletData.length);

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

  // Default competitors — MY + regional
  const competitors = [
    // Malaysia
    { name: "My Ballerine",    url: "https://www.myballerine.com",        country: "MY" },
    { name: "Charles & Keith", url: "https://www.charleskeith.com",       country: "MY" },
    { name: "Bata Malaysia",   url: "https://www.bata.com/my",            country: "MY" },
    { name: "Vincci",          url: "https://www.padini.com/vincci",       country: "MY" },
    { name: "Nose",            url: "https://www.nose.com.my",            country: "MY" },
    // Singapore
    { name: "Pedro",           url: "https://www.pedro.com.sg",           country: "SG" },
    { name: "Schu",            url: "https://www.schu.sg",                country: "SG" },
    { name: "Steve Madden SG", url: "https://www.stevemadden.com.sg",     country: "SG" },
    { name: "Bysi",            url: "https://www.bysi.com",               country: "SG" },
    { name: "Pomelo Fashion",  url: "https://www.pomelofashion.com",      country: "SG" },
    // Philippines
    { name: "Primadonna",      url: "https://www.primadonna.com.ph",      country: "PH" },
    { name: "Parisian",        url: "https://www.parisian.com.ph",        country: "PH" },
    { name: "Mendrez",         url: "https://www.mendrez.com.ph",         country: "PH" },
    { name: "So.Fab!",         url: "https://www.sofab.com.ph",           country: "PH" },
    { name: "Shoebox PH",      url: "https://www.theshoebox.ph",          country: "PH" },
    // Indonesia
    { name: "Yongki Komaladi", url: "https://www.yongkikomaladi.com",     country: "ID" },
    { name: "Buccheri",        url: "https://www.buccheri.com",           country: "ID" },
    { name: "Colorbox",        url: "https://www.colorboxindonesia.com",  country: "ID" },
    { name: "Carvil",          url: "https://www.carvil.co.id",           country: "ID" },
    { name: "Fladeo",          url: "https://www.fladeo.co.id",           country: "ID" },
    // Thailand
    { name: "Vinny",           url: "https://www.vinny.co.th",            country: "TH" },
    { name: "Monobo",          url: "https://www.monobo.co.th",           country: "TH" },
    { name: "Baoji",           url: "https://www.baoji.co.th",            country: "TH" },
    { name: "Keds Thailand",   url: "https://www.kedsthailand.com",       country: "TH" },
    { name: "Naturalizer TH",  url: "https://www.naturalizer.co.th",      country: "TH" },
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
