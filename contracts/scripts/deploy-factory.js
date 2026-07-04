const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying vasmo Factory with deployer:", deployer.address);

  const VasmoFactory = await hre.ethers.getContractFactory("VasmoFactory");
  const factory = await VasmoFactory.deploy();
  await factory.waitForDeployment();

  const tx = await factory.deployProtocol();
  const receipt = await tx.wait();

  console.log("VasmoFactory deployed at:", await factory.getAddress());
  console.log("=== vasmo Protocol Deployed ===");
  console.log("Deployment tx:", receipt.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
