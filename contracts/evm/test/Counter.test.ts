import { expect } from "chai";
import { ethers } from "hardhat";

describe("Counter", function () {
  async function deployCounterFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const Counter = await ethers.getContractFactory("Counter");
    const counter = await Counter.deploy();
    return { counter, owner, otherAccount };
  }

  it("Should start at zero", async function () {
    const { counter, owner } = await deployCounterFixture();
    expect(await counter.getCounter(owner.address)).to.equal(0);
  });

  it("Should set counter", async function () {
    const { counter, owner } = await deployCounterFixture();
    await counter.setCounter(42);
    expect(await counter.getCounter(owner.address)).to.equal(42);
  });

  it("Should increment counter", async function () {
    const { counter, owner } = await deployCounterFixture();
    await counter.setCounter(10);
    await counter.increment();
    expect(await counter.getCounter(owner.address)).to.equal(11);
  });

  it("Should track counters per account", async function () {
    const { counter, owner, otherAccount } = await deployCounterFixture();
    await counter.setCounter(100);
    await counter.connect(otherAccount).setCounter(200);
    expect(await counter.getCounter(owner.address)).to.equal(100);
    expect(await counter.getCounter(otherAccount.address)).to.equal(200);
  });
});
