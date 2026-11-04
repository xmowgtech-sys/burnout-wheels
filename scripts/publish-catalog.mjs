// One-command catalog publish for the free Vercel deployment.
// 1. Export ACTIVE products from data/burnout.db into src/lib/seed-catalog.ts
// 2. Copy their photos into public/uploads
// 3. Commit and push only those files => Vercel redeploys with the new catalog
import { execFileSync } from "node:child_process";

const root = process.cwd();

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

function capture(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: "utf8" });
}

try {
  console.log("\n→ Exporting active products from the local database...");
  run(process.execPath, ["scripts/export-seed.mjs"]);

  console.log("\n→ Staging catalog files...");
  run("git", ["add", "src/lib/seed-catalog.ts", "public/uploads"]);

  const staged = capture("git", ["diff", "--cached", "--name-only"])
    .split(/\r?\n/)
    .filter(Boolean);

  if (staged.length === 0) {
    console.log("\nNo catalog changes to publish. Vercel is already up to date.");
    process.exit(0);
  }

  const allowed = staged.every(
    (file) => file === "src/lib/seed-catalog.ts" || file.startsWith("public/uploads/")
  );

  if (!allowed) {
    console.error("\nOther files are already staged. Publishing stopped so they are not committed by accident.");
    console.error("Unstage them, then run `npm run catalog:publish` again:\n");
    for (const file of staged) console.error(`  ${file}`);
    process.exit(1);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  console.log("\n→ Committing catalog...");
  run("git", ["commit", "-m", `chore: publish catalog ${stamp}`]);

  console.log("\n→ Pushing to GitHub...");
  run("git", ["push"]);

  console.log("\nDone. Vercel will redeploy in about 1-2 minutes.");
  console.log("Live site: https://theburnoutwheels-vert.vercel.app/shop\n");
} catch (error) {
  console.error("\nCatalog publish failed.");
  if (error instanceof Error && "status" in error) {
    console.error(`Command exited with status ${error.status}.`);
  } else if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}
