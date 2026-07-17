import { artifacts, ethers, network } from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUTPUT_PATH = path.join(__dirname, "../../api/src/blockchain/deployment.json");

async function main() {
  const [deployer] = await ethers.getSigners();

  const EpiMarketFactory = await ethers.getContractFactory("EpiMarket");
  const epiMarket = await EpiMarketFactory.deploy();
  await epiMarket.waitForDeployment();

  const address = await epiMarket.getAddress();
  const artifact = await artifacts.readArtifact("EpiMarket");

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        address,
        abi: artifact.abi,
        network: network.name,
        chainId: network.config.chainId ?? null,
        owner: deployer.address,
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`EpiMarket deployed to ${address} (network: ${network.name}, owner: ${deployer.address})`);
  console.log(`Deployment info written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
