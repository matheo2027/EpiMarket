import bcrypt from "bcryptjs";
import { prisma } from "../src/prisma.js";

async function main() {
  const passwordHash = await bcrypt.hash("admin1234", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@epitech.eu" },
    update: {},
    create: {
      email: "admin@epitech.eu",
      username: "admin",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Seeded admin user: ${admin.email} / admin1234`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
