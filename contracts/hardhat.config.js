require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

// The deployer key lives only in contracts/.env (see .env.example). It is never committed.
const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // "paris" avoids newer opcodes, so the bytecode runs on any BOT Chain node version.
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    // The local node runs on 8546 (`npm run node`) so it can sit beside other projects' nodes.
    localhost: { url: "http://127.0.0.1:8546", chainId: 31337 },
    botchainTestnet: { url: "https://rpc.bohr.life", chainId: 968, accounts },
    botchain: { url: "https://rpc.botchain.ai", chainId: 677, accounts },
  },
  mocha: { timeout: 600000 },
};
