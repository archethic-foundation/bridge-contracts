import { Sequelize } from "sequelize";
import config from "config";

import HtlcAESigned from "./models/htlc-ae-signed.js";
import HtlcAEChargeable from "./models/htlc-ae-chargeable.js";
import HtlcEVMSigned from "./models/htlc-evm-signed.js";
import HtlcEVMChargeable from "./models/htlc-evm-chargeable.js";
import KeyValue from "./models/key-value.js";

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: config.get("dbFile"),
});

HtlcAESigned(sequelize);
HtlcAEChargeable(sequelize);
HtlcEVMSigned(sequelize);
HtlcEVMChargeable(sequelize);
KeyValue(sequelize);

await sequelize.sync({ alter: true });

export default sequelize;
