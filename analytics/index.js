import cron from "node-cron";
import config from "config";
import Archethic from "@archethicjs/sdk";
import { Level } from "level";
import express from "express";
import Debug from "debug";

import { tick as tickArchethic } from "./src/archethic.js";
import { tick as tickEVM } from "./src/evm.js";
import htlcsController from "./src/controllers/htlcs.js";

const debug = Debug("server");
const ENDPOINT = config.get("archethic.endpoint");
let METRICS_ARCHETHIC = [];
let METRICS_EVM = [];
let LAST_TICK;
let RUNNING = false;

debug(`Connecting to endpoint ${ENDPOINT}...`);
const archethic = new Archethic(ENDPOINT);
await archethic.connect();
debug(`Connected!`);

const dbFolder = config.get("dbFolder");
debug(`Opening database: ${dbFolder}...`);
const db = new Level(dbFolder, { valueEncoding: "json" });
await db.open();
debug(`Opened!`);

const app = express();
const port = config.get("port");
app.set("views", "./src/views");
app.set("view engine", "jade");

app.get("/htlcs", htlcsController(db));

app.get("/metrics", (req, res) => {
  let text = "";
  let prevMetricsBaseName = "";

  const metadata = [
    {
      name: "tick",
      value: LAST_TICK,
    },
  ];

  // metrics with the same name but different labels must appear grouped
  const sortedMetrics = [
    ...METRICS_ARCHETHIC,
    ...METRICS_EVM,
    ...metadata,
  ].sort((a, b) => {
    if (a.name > b.name) return 1;
    return -1;
  });

  for (const metric of sortedMetrics) {
    const metricBaseName = metric.name.split("{")[0];

    // the type must not be set on each metrics
    if (metricBaseName != prevMetricsBaseName) {
      text += `# TYPE ${metricBaseName} gauge\n`;
    }

    text += `${metric.name} ${metric.value}\n`;
    prevMetricsBaseName = metricBaseName;
  }

  if (req.get("accept").includes("html")) {
    res.send(`<html><body><pre>${text}</pre></body></html>`);
  } else {
    res.send(text);
  }
});

debug(`Starting HTTP server on port ${port}...`);
app.listen(port, () => {
  debug(`Started!`);

  const tick = async function () {
    RUNNING = true;
    return Promise.all([
      tickArchethic(archethic, db).then((metricsArchethic) => {
        METRICS_ARCHETHIC = metricsArchethic;
      }),
      tickEVM(db).then((metricsEVM) => {
        METRICS_EVM = metricsEVM;
      }),
    ]).then(() => {
      LAST_TICK = Date.now();
      RUNNING = false;
    });
  };

  //tick();

  const cronInterval = config.get("cron");
  debug(`Scheduler set to: ${cronInterval}`);
  cron.schedule(cronInterval, async () => {
    if (RUNNING) return;

    debug("tick start");
    await tick();
    debug("tick end");
  });
});
