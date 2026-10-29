// Usage: npm run create-admin -- <username> <password>
// or set ADMIN_USERNAME / ADMIN_PASSWORD in .env and run with no args.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectDB } = require("../db/connect");
const Admin = require("../models/Admin");

async function run() {
  const [, , argUsername, argPassword] = process.argv;
  const username = (argUsername || process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  const password = argPassword || process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error(
      "Usage: npm run create-admin -- <username> <password>\n" +
        "  (or set ADMIN_USERNAME / ADMIN_PASSWORD in backend-node/.env)"
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  await connectDB();

  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.updateOne({ username }, { $set: { passwordHash } }, { upsert: true });

  console.log(`Admin account ready: ${username}`);
  process.exit(0);
}

run().catch((err) => {
  console.error("create-admin failed:", err);
  process.exit(1);
});
