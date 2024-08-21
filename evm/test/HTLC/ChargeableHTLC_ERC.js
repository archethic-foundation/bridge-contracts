const hre = require("hardhat");
const { createHash, randomBytes } = require("crypto");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { hexToUintArray } = require("../utils");

describe("Chargeable ERC HTLC", () => {
  async function deployToken() {
    return doDeployToken("DummyToken")
  }

  async function deployTokenMintable() {
    return doDeployToken("DummyTokenMintable")
  }

  async function doDeployToken(implementation) {
    const contract = await ethers.deployContract(implementation, [
      ethers.parseEther("1000"),
    ]);
    return { instance: contract, address: await contract.getAddress() };
  }

  it("should create contract", async () => {
    const { address: tokenAddress } = await loadFixture(deployToken);

    const accounts = await ethers.getSigners();
    const recipientAddress = accounts[4].address;
    const archPoolSigner = ethers.Wallet.createRandom();

    const amount = ethers.parseEther("0.995")

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 60;

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ERC", [
      tokenAddress,
      false,
      amount,
      "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
      lockTime,
      recipientAddress,
      archPoolSigner.address
    ])

    expect(await HTLCInstance.amount()).to.equal(amount)
    expect(await HTLCInstance.hash()).to.equal("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
    expect(await HTLCInstance.token()).to.equal(await tokenAddress)
    expect(await HTLCInstance.recipient()).to.equal(recipientAddress)
    expect(await HTLCInstance.status()).to.equal(0)
    expect(await HTLCInstance.lockTime()).to.equal(lockTime)
    expect(await HTLCInstance.poolSigner()).to.equal(archPoolSigner.address)
  })

  it("withdraw should send tokens to the recipient address upon signature verification with non mintable token", async () => {
    const { instance: tokenInstance, address: tokenAddress } = await loadFixture(deployToken);
    const accounts = await ethers.getSigners()

    const archPoolSigner = ethers.Wallet.createRandom()

    const recipientAddress = accounts[4].address

    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const amount = ethers.parseEther("1.0")

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 60;

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ERC", [
      tokenAddress,
      false,
      amount,
      `0x${secretHash}`,
      lockTime,
      recipientAddress,
      archPoolSigner.address
    ])

    await tokenInstance.transfer(
      HTLCInstance.getAddress(),
      amount,
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
    ).to.changeTokenBalances(
      tokenInstance,
      [
        recipientAddress,
        await HTLCInstance.getAddress(),
      ],
      [amount, -amount]
    );
  });

  it("withdraw should not be feasable after locktime", async () => {
    const { address: tokenAddress } = await loadFixture(deployToken);
    const accounts = await ethers.getSigners();
    const recipientAddress = accounts[4].address;
    const archPoolSigner = ethers.Wallet.createRandom();

    const secret = randomBytes(32);
    const secretHash = createHash("sha256").update(secret).digest("hex");

    const amount = ethers.parseEther("0.995");

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 60;

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ERC", [
      tokenAddress,
      false,
      amount,
      `0x${secretHash}`,
      lockTime,
      recipientAddress,
      archPoolSigner.address
    ])

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

  it("refund should send back tokens to the owner with non mintable token", async () => {
    const { instance: tokenInstance, address: tokenAddress } =
      await loadFixture(deployToken);
    const accounts = await ethers.getSigners();

    const recipientAddress = accounts[4].address;
    const archPoolSigner = ethers.Wallet.createRandom();

    const secret = randomBytes(32);
    const secretHash = createHash("sha256").update(secret).digest("hex");

    const amount = ethers.parseEther("1.0");

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 1;

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ERC", [
      tokenAddress,
      false,
      amount,
      `0x${secretHash}`,
      lockTime,
      recipientAddress,
      archPoolSigner.address
    ])

    await tokenInstance.transfer(
      HTLCInstance.getAddress(),
      amount,
    );
    await time.increaseTo(lockTime + 5);

    expect(await HTLCInstance.refund()).to.changeTokenBalance(
      tokenInstance,
      accounts[0].address,
      amount,
    );
  });

  it("withdraw should burn the tokens upon signature verification with mintable token", async () => {
    const { instance: tokenInstance, address: tokenAddress } = await loadFixture(deployTokenMintable);
    const accounts = await ethers.getSigners()

    const archPoolSigner = ethers.Wallet.createRandom()

    const recipientAddress = accounts[4].address

    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const amount = ethers.parseEther("1.0")

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 60;

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ERC", [
      tokenAddress,
      true,
      amount,
      `0x${secretHash}`,
      lockTime,
      recipientAddress,
      archPoolSigner.address
    ])

    await tokenInstance.transfer(
      HTLCInstance.getAddress(),
      amount,
    );

    const signature = ethers.Signature.from(
      await archPoolSigner.signMessage(hexToUintArray(secretHash)),
    );

    const tx = HTLCInstance.connect(accounts[2]).withdraw(
      `0x${secret.toString("hex")}`,
      signature.r,
      signature.s,
      signature.v,
    )

    const HTLCAddress = await HTLCInstance.getAddress()

    await expect(tx).to.changeTokenBalances(tokenInstance, [recipientAddress, await HTLCAddress], [0, -amount]);
    await expect(tx).to.emit(tokenInstance, "Transfer").withArgs(HTLCAddress, ethers.ZeroAddress, amount)
  });

  it("refund should send back tokens to the owner with mintable token", async () => {
    const { instance: tokenInstance, address: tokenAddress } =
      await loadFixture(deployTokenMintable);
    const accounts = await ethers.getSigners();

    const recipientAddress = accounts[4].address;
    const archPoolSigner = ethers.Wallet.createRandom();

    const secret = randomBytes(32);
    const secretHash = createHash("sha256").update(secret).digest("hex");

    const amount = ethers.parseEther("1.0");

    const blockTimestamp = await time.latest();
    const lockTime = blockTimestamp + 1;

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ERC", [
      tokenAddress,
      true,
      amount,
      `0x${secretHash}`,
      lockTime,
      recipientAddress,
      archPoolSigner.address
    ])

    await tokenInstance.transfer(
      HTLCInstance.getAddress(),
      amount,
    );
    await time.increaseTo(lockTime + 5);

    expect(await HTLCInstance.refund()).to.changeTokenBalance(
      tokenInstance,
      accounts[0].address,
      amount,
    );
  });
});
