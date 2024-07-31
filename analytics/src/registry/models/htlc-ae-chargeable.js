import { DataTypes } from "sequelize";

export default function (sequelize) {
  sequelize.define("htlcAEChargeable", {
    addressCreation: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    addressPool: DataTypes.STRING,
    addressUser: DataTypes.STRING,

    evmContract: DataTypes.STRING,
    evmChainId: DataTypes.INTEGER,

    amount: DataTypes.BIGINT,
    amountUser: DataTypes.BIGINT,
    amountRefund: DataTypes.BIGINT,
    amountFee: DataTypes.BIGINT,

    status: DataTypes.STRING,
    timeCreation: DataTypes.INTEGER,
    timeLockEnd: DataTypes.INTEGER,
  });
}
