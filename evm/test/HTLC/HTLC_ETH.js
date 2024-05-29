const hre = require("hardhat");

const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { createHash, randomBytes } = require("crypto");
const { expect } = require("chai");

describe("ETH HTLC", () => {
  it("should create contract", async () => {
    const accounts = await ethers.getSigners();
    const recipientEthereum = accounts[2].address;

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 60;

    const HTLCInstance = await ethers.deployContract(
      "HTLC_ETH",
      [
        recipientEthereum,
        ethers.parseEther("1.0"),
        "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
        lockTime,
        false,
      ],
      { value: ethers.parseEther("1.0") },
    );

    expect(await HTLCInstance.amount()).to.equal(ethers.parseEther("1.0"));
    expect(await HTLCInstance.hash()).to.equal(
      "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
    );
    expect(await HTLCInstance.recipient()).to.equal(recipientEthereum);
    expect(await HTLCInstance.status()).to.equal(0);
    expect(await HTLCInstance.lockTime()).to.equal(lockTime);

    expect(
      await ethers.provider.getBalance(await HTLCInstance.getAddress()),
    ).to.equal(ethers.parseEther("1.0"));
  });

  it("should refund the owner after the lock time", async () => {
    const accounts = await ethers.getSigners();
    const recipientEthereum = accounts[2];

    const amount = ethers.parseEther("1");
    const secret = randomBytes(32);
    const secretHash = createHash("sha256").update(secret).digest("hex");

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 1;

    const HTLCInstance = await ethers.deployContract(
      "HTLC_ETH",
      [recipientEthereum, amount, `0x${secretHash}`, lockTime, false],
      { value: amount },
    );

    expect(await HTLCInstance.canRefund(lockTime + 5)).to.be.true;

    time.increaseTo(lockTime + 5);
    const tx = HTLCInstance.refund();

    await expect(tx).to.changeEtherBalance(accounts[0], amount);
    await expect(tx).to.emit(HTLCInstance, "Refunded");

    expect(await HTLCInstance.status()).to.equal(2);
  });

  it("should return an error if the swap is already finished", async () => {
    const accounts = await ethers.getSigners();
    const recipientEthereum = accounts[2];

    const amount = ethers.parseEther("1");
    const secret = randomBytes(32);
    const secretHash = createHash("sha256").update(secret).digest("hex");

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 1;

    const HTLCInstance = await ethers.deployContract(
      "HTLC_ETH",
      [recipientEthereum, amount, `0x${secretHash}`, lockTime, false],
      { value: amount },
    );

    time.increaseTo(lockTime + 5);
    await HTLCInstance.refund();

    await expect(HTLCInstance.refund()).to.be.revertedWithCustomError(
      HTLCInstance,
      "AlreadyRefunded",
    );
  });

  it("should return an error if the lock time is not reached", async () => {
    const accounts = await ethers.getSigners();
    const recipientEthereum = accounts[2];

    const amount = ethers.parseEther("1");
    const secret = randomBytes(32);
    const secretHash = createHash("sha256").update(secret).digest("hex");

    const previousBlockTimestamp = await time.latest();

    const HTLCInstance = await ethers.deployContract(
      "HTLC_ETH",
      [
        recipientEthereum,
        amount,
        `0x${secretHash}`,
        previousBlockTimestamp + 10,
        false,
      ],
      { value: amount },
    );

    const now = new Date();
    const secondUNIX = Math.floor(now.getTime() / 1000);

    expect(await HTLCInstance.canRefund(secondUNIX)).to.be.false;

    await expect(HTLCInstance.refund()).to.be.revertedWithCustomError(
      HTLCInstance,
      "TooEarly",
    );
  });
});
