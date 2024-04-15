import { getSignedHTLCs } from "../registry/archethic-htlcs.js";

export default function (db) {
  return async (req, res) => {
    const htlcs = await getSignedHTLCs(db);
    res.render("signed", { htlcs });
  };
}
