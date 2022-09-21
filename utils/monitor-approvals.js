const { ethers } = require("hardhat");

const { TOKEN_ADDRESSES } = require("../addresses/tokens");

const DUSTSWEAPER_ADDRESS = "0x78106f7db3EbCEe3D2CFAC647f0E4c9b06683B39";

module.exports = async () => {
  let eventArray = [];

  //TODO: Loop over all acceptable addresses
  for (let index = 0; index < TOKEN_ADDRESSES.length; index++) {
    const _contract = await ethers.getContractAt(
      "IERC20",
      TOKEN_ADDRESSES[index]
    );

    const filter = _contract?.filters.Approval(null, DUSTSWEAPER_ADDRESS);
    const events = await _contract.queryFilter(filter, null, "latest");

    eventArray.push(events);
    // log(`Token ${TOKEN_ADDRESSES[index]}: events --> ${events}`);
  }
  const flatArray = eventArray.flat();

  const filterArray = flatArray.filter((el) => {
    return Number(el.args[2].toString()) > 0;
  });

  const sortArray = filterArray.sort((a, b) => {
    if (a.blockNumber === b.blockNumber) {
      return b.transactionIndex - a.transactionIndex;
    }
    return a.blockNumber < b.blockNumber ? 1 : -1;
  });

  return sortArray;
};
