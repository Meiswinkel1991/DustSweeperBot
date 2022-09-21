require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const MAINNET_PRIVATE_KEY = process.env.PRIVATE_KEY;
const MAINNET_RPC_HTTP = process.env.MAINNET_RPC_HTTP;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  networks: {
    hardhat: {
      forking: {
        url: MAINNET_RPC_HTTP,
        allowUnlimitedContractSize: true,
      },
    },
    mainnet: {
      url: MAINNET_RPC_HTTP,
      accounts: [MAINNET_PRIVATE_KEY],
    },
  },
};
