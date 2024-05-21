const hre = require("hardhat");
const { createHash, randomBytes } = require("crypto");
const { expect } = require("chai");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { hexToUintArray } = require("../utils");

describe("Chargeable ETH HTLC", () => {
  it("should create contract and associated recipient and fee", async () => {
    const accounts = await ethers.getSigners();
    const reserveAddress = accounts[4].address;
    const archPoolSigner = ethers.Wallet.createRandom();

    const amount = ethers.parseEther("1.0")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ETH", [
      amount,
      "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
      lockTime,
      reserveAddress,
      accounts[5].address,
      archPoolSigner.address
    ], { value: amount })

    expect(await HTLCInstance.amount()).to.equal(amount)
    expect(await HTLCInstance.hash()).to.equal("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
    expect(await HTLCInstance.recipient()).to.equal(reserveAddress)
    expect(await HTLCInstance.status()).to.equal(0)
    expect(await HTLCInstance.lockTime()).to.equal(lockTime)
    expect(await HTLCInstance.poolSigner()).to.equal(archPoolSigner.address)

    await expect(await ethers.provider.getBalance(await HTLCInstance.getAddress()))
      .to.equal(amount)
  })

  it("should raise if the funds sending to the contract doesn't match the amount", async () => {
    const accounts = await ethers.getSigners()
    const reserveAddress = accounts[4].address
    const archPoolSigner = ethers.Wallet.createRandom();

    const amount = ethers.parseEther("1.0")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const contract = await ethers.getContractFactory("ChargeableHTLC_ETH")

    await expect(ethers.deployContract("ChargeableHTLC_ETH", [
      amount,
      "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
      lockTime,
      reserveAddress,
      accounts[5].address,
      archPoolSigner.address
    ], { value: ethers.parseEther("0.995") })
    )
      .to.be.revertedWithCustomError(contract, "ContractNotProvisioned")
  })

  it("withdraw should send tokens to the reserve address and the hash is signed by the Archethic pool", async () => {
    const accounts = await ethers.getSigners();
    const reserveAddress = accounts[4].address;
    const archPoolSigner = ethers.Wallet.createRandom();


    const poolCap = ethers.parseEther("0.95")

    const pool = await ethers.deployContract("ETHPool")
    await pool.initialize(
      accounts[4].address,
      archPoolSigner.address,
      poolCap,
      60,
      accounts[0]
    )
    const poolAddress = await pool.getAddress()

    const secret = randomBytes(32);
    const secretHash = createHash("sha256").update(secret).digest("hex");

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 60;

    const amount = ethers.parseEther("1.0")

    const HTLCInstance = await ethers.deployContract(
      "ChargeableHTLC_ETH",
      [
        amount,
        `0x${secretHash}`,
        lockTime,
        reserveAddress,
        poolAddress,
        archPoolSigner.address,
      ],
      { value: amount },
    );

    const signature = ethers.Signature.from(
      await archPoolSigner.signMessage(hexToUintArray(secretHash)),
    );

    await expect(
      HTLCInstance.connect(accounts[2]).withdraw(
        `0x${secret.toString("hex")}`,
        signature.r,
        signature.s,
        signature.v,
      ),
    ).to.changeEtherBalances(
      [
        reserveAddress,
        poolAddress,
        await HTLCInstance.getAddress()
      ],
      [
        amount - poolCap,
        poolCap,
        -amount
      ],
    );
  });

  it("withdraw should not be feasable after locktime", async () => {
    const accounts = await ethers.getSigners();
    const reserveAddress = accounts[4].address;
    const archPoolSigner = ethers.Wallet.createRandom();

    const amount = ethers.parseEther("1.0");

    const pool = await ethers.deployContract("ETHPool")
    await pool.initialize(
      accounts[4].address,
      archPoolSigner.address,
      amount,
      60,
      accounts[0]
    )
    const poolAddress = await pool.getAddress()

    const secret = randomBytes(32);
    const secretHash = createHash("sha256").update(secret).digest("hex");

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 60;

    const HTLCInstance = await ethers.deployContract(
      "ChargeableHTLC_ETH",
      [
        amount,
        `0x${secretHash}`,
        lockTime,
        reserveAddress,
        poolAddress,
        archPoolSigner.address
      ],
      { value: amount },
    );

    const signature = ethers.Signature.from(
      await archPoolSigner.signMessage(hexToUintArray(secretHash)),
    );

    await time.increaseTo(lockTime + 5);

    await expect(HTLCInstance.connect(accounts[2]).withdraw(
      `0x${secret.toString("hex")}`,
      signature.r,
      signature.s,
      signature.v,
    )).to.be.revertedWithCustomError(HTLCInstance, "TooLate")
  });

  it("refund should send back tokens to the owner", async () => {
    const accounts = await ethers.getSigners();
    const reserveAddress = accounts[4].address;
    const archPoolSigner = ethers.Wallet.createRandom();

    const secret = randomBytes(32);
    const secretHash = createHash("sha256").update(secret).digest("hex");

    const amount = ethers.parseEther("1.0");

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 1;

    const HTLCInstance = await ethers.deployContract(
      "ChargeableHTLC_ETH",
      [
        amount,
        `0x${secretHash}`,
        lockTime,
        reserveAddress,
        accounts[5].address,
        archPoolSigner.address,
      ],
      { value: amount },
    );

    await time.increaseTo(lockTime + 5);
    expect(await HTLCInstance.refund()).to.changeEtherBalance(
      accounts[0].address,
      amount,
    );
  });
});
