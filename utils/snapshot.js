const { ethers } = require("hardhat");
const fs = require("fs");
const { storeFile } = require("../helper-hardhat-config");

const takeSnapshot = (blockNumber, makers, tokens) => {
  const currentSnapshot = JSON.parse(fs.readFileSync(storeFile, "utf-8"));

  console.log(currentSnapshot);

  //TODO: Safe the actual data and dont look to events before this block
};

module.exports = { takeSnapshot };
