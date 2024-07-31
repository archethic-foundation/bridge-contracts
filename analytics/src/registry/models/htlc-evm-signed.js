import { DataTypes } from "sequelize";

export default function (sequelize) {
  sequelize.define("htlcEVMSigned", {
    addressCreation: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    addressUser: DataTypes.STRING,
    addressPool: DataTypes.STRING,
    chainId: DataTypes.STRING,
    amount: DataTypes.STRING,
    status: DataTypes.STRING,
    secretHash: DataTypes.STRING,
    timeLockEnd: DataTypes.INTEGER,
  });
}
