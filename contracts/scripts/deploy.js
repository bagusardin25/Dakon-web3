// Deploys Dakon and records the address where the web app reads it.
//
//   npx hardhat run scripts/deploy.js --network localhost
//   npx hardhat run scripts/deploy.js --network botchainTestnet
//   npx hardhat run scripts/deploy.js --network botchain
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

// hardhat network name -> key in web/src/config/deployments.json
const WEB_KEY = { localhost: "local", hardhat: "local", botchainTestnet: "testnet", botchain: "mainnet" };
const EXPLORER = { botchainTestnet: "https://scan.bohr.life", botchain: "https://scan.botchain.ai" };

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account. Copy .env.example to .env and set PRIVATE_KEY.");

  const { chainId } = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network   ${network.name} (chain ${chainId})`);
  console.log(`Deployer  ${deployer.address}`);
  console.log(`Balance   ${ethers.formatEther(balance)} BOT`);

  const dakon = await ethers.deployContract("Dakon");
  const receipt = await dakon.deploymentTransaction().wait();
  const address = await dakon.getAddress();

  console.log(`Dakon     ${address}`);
  console.log(`Tx        ${receipt.hash}`);
  console.log(`Gas used  ${receipt.gasUsed}`);
  if (EXPLORER[network.name]) console.log(`Explorer  ${EXPLORER[network.name]}/address/${address}`);

  const record = {
    network: network.name,
    chainId: Number(chainId),
    address,
    deployer: deployer.address,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
  };
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), JSON.stringify(record, null, 2) + "\n");

  const webKey = WEB_KEY[network.name];
  const webFile = path.join(__dirname, "..", "..", "web", "src", "config", "deployments.json");
  if (webKey && fs.existsSync(webFile)) {
    const deployments = JSON.parse(fs.readFileSync(webFile, "utf8"));
    deployments[webKey] = address;
    fs.writeFileSync(webFile, JSON.stringify(deployments, null, 2) + "\n");
    console.log(`Updated   web/src/config/deployments.json (${webKey})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
