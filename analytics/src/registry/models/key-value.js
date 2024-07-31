import { DataTypes } from "sequelize";

export default function (sequelize) {
  sequelize.define("kv", {
    key: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    value: DataTypes.STRING,
  });
}
