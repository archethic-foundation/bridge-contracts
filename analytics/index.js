import cron from "node-cron";
import config from "config";
import Archethic from "@archethicjs/sdk";
import { Level } from "level";
import express from "express";

import { tick as tickArchethic } from "./src/archethic.js";
import { tick as tickEVM } from "./src/evm.js";

const METRIC_ROOT = config.get("metricRoot");
const ENDPOINT = config.get("archethic.endpoint");
let METRICS_ARCHETHIC = [];
let METRICS_EVM = [];

console.log(`Connecting to endpoint ${ENDPOINT}...`);
const archethic = new Archethic(ENDPOINT);
await archethic.connect();
console.log(`Connected!`);

const dbFolder = config.get("dbFolder");
console.log(`Opening database: ${dbFolder}...`);
const db = new Level(dbFolder, { valueEncoding: "json" });
await db.open();
console.log(`Opened!`);

const app = express();
const port = config.get("port");

app.get("/metrics", (req, res) => {
  let text = "";
  for (const metric of [...METRICS_ARCHETHIC, ...METRICS_EVM]) {
    text += `# HELP ${METRIC_ROOT}${metric.name}\n# TYPE ${METRIC_ROOT}${metric.name} gauge\n${METRIC_ROOT}${metric.name} ${metric.value}\n`;
  }

  if (req.get("accept").includes("html")) {
    res.send(`<html><body><pre>${text}</pre></body></html>`);
  } else {
    res.send(text);
  }
});

console.log(`Starting HTTP server on port ${port}...`);
app.listen(port, () => {
  console.log(`Started!`);

  const cronInterval = config.get("cron");
  console.log(`Scheduler set to: ${cronInterval}`);
  cron.schedule(cronInterval, async () => {
    console.log("[tick] start");

    Promise.all([tickArchethic(archethic, db), tickEVM()]).then(
      ([metricsArchethic, metricsEVM]) => {
        METRICS_ARCHETHIC = metricsArchethic;
        METRICS_EVM = metricsEVM;

        METRICS_ARCHETHIC.push({
          name: "tick",
          value: Date.now(),
        });
      },
    );

    console.log("[tick] end");
  });
});
