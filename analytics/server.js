import config from "config";
import express from "express";
import Debug from "debug";

import htlcsController from "./src/controllers/htlcs.js";
import metricsController from "./src/controllers/metrics.js";

const debug = Debug("server");
const app = express();
const port = config.get("port");
app.set("views", "./src/views");
app.set("view engine", "jade");
app.get("/htlcs", htlcsController());
app.get("/metrics", metricsController());

debug(`Starting HTTP server on port ${port}...`);
app.listen(port, () => {
  debug(`Started!`);
});
