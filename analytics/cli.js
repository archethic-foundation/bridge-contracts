import { resetPagingAddress } from "./src/registry/archethic-htlcs.js";
import config from "config";
import { Level } from "level";

if (
  process.argv.length == 3 &&
  process.argv[2].toLowerCase() == "resetpagingaddress"
) {
  const dbFolder = config.get("dbFolder");
  console.log(`Opening database: ${dbFolder}...`);
  const db = new Level(dbFolder, { valueEncoding: "json" });
  await db.open();
  console.log(`Opened!`);

  await resetPagingAddress(db);
  console.log("Done");
}
