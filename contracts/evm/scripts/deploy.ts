import { ethers } from "hardhat";

async function main() {
  const Counter = await ethers.getContractFactory("Counter");
  const counter = await Counter.deploy();
  await counter.waitForDeployment();

  const address = await counter.getAddress();
  console.log(`Counter deployed to: ${address}`);

  // Verify it works
  const tx = await counter.setCounter(42);
  await tx.wait();
  const value = await counter.getCounter(await (await ethers.provider.getSigner()).getAddress());
  console.log(`Counter value after setCounter(42): ${value}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
