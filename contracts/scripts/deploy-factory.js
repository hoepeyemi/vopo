const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying vopo Factory with deployer:", deployer.address);

  const VopoFactory = await hre.ethers.getContractFactory("VopoFactory");
  const factory = await VopoFactory.deploy();
  await factory.waitForDeployment();

  const tx = await factory.deployProtocol();
  const receipt = await tx.wait();

  console.log("VopoFactory deployed at:", await factory.getAddress());
  console.log("=== vopo Protocol Deployed ===");
  console.log("Deployment tx:", receipt.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
