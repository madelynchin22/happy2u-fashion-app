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
