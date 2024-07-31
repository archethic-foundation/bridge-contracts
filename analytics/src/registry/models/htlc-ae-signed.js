import { DataTypes } from "sequelize";

export default function (sequelize) {
  sequelize.define("htlcAESigned", {
    addressCreation: { type: DataTypes.STRING, primaryKey: true },
    addressGenesis: DataTypes.STRING,
    addressPool: DataTypes.STRING,
    addressUser: DataTypes.STRING,

    evmContract: DataTypes.STRING,
    evmChainId: DataTypes.INTEGER,

    amount: DataTypes.STRING,

    status: DataTypes.STRING,
    secretHash: DataTypes.STRING,
    timeCreation: DataTypes.INTEGER,
    timeLockEnd: DataTypes.INTEGER,
  });
}
