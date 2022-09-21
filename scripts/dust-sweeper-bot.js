// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const { ethers } = require("hardhat");

const axios = require("axios").default;
const priceApiUrl = "https://api.paymagic.xyz/v1/utils/fetchTrustedPrices";
var colors = require("colors");

const monitorApprovals = require("../utils/monitor-approvals");

const DUSTSWEAPER_ADDRESS = "0x78106f7db3ebcee3d2cfac647f0e4c9b06683b39";

const ETH_WHALE = "0xF443864BA5d5361bBc54298551067194F980a635";

async function main() {
  let eventArray = [];

  // const signer = await ethers.getSigner();
  const signer = await ethers.getSigner();
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(ethers.utils.formatEther(balance));
  const dustSweeperContract = await ethers.getContractAt(
    "DustSweeper",
    DUSTSWEAPER_ADDRESS,
    signer
  );

  log("Starting the bot", "green");
  log("--------------------", "green");

  log("searching for approvals..", "blue");
  eventArray = await monitorApprovals();
  const { tokenAddresses, makers } = readDataFromEvents(eventArray);

  // const makers = ["0x8530a6fbbd68877bfd72038dc157f41ded574dd2"];
  // const tokenAddresses = ["0x1982b2f5814301d4e9a8b0201555376e62f82428"];

  const { prices, packet } = await fetchData(tokenAddresses);

  log(
    `A total of ${makers.length} maker(s) and ${tokenAddresses.length} Token(s) were found...`,
    "blue"
  );

  //calculate send ETH amount
  let totalEthSend = ethers.BigNumber.from("0");
  let totalEthGet = ethers.BigNumber.from("0");
  let acceptedMakers = [];
  let acceptedTokens = [];

  const protocolPercent = await dustSweeperContract.protocolFee();
  const powPercent = ethers.BigNumber.from("10").pow(4);

  log("Calculating the ETHER Amount to send and will recieved...", "blue");
  for (let x = 0; x < makers.length; x++) {
    const tokenContract = await ethers.getContractAt(
      "IERC20",
      tokenAddresses[x]
    );
    const decimals = await tokenContract.decimals();
    const allowance = await tokenContract.allowance(
      makers[x],
      dustSweeperContract.address
    );
    const balance = await tokenContract.balanceOf(makers[x]);
    const amount = balance < allowance ? balance : allowance;

    const powDecimales = ethers.BigNumber.from("10").pow(decimals);

    const quotePrice = ethers.BigNumber.from(
      prices.pricesWei[prices.tokenArray.indexOf(tokenAddresses[x])]
    );

    //calculate the total price of the approved tokens
    const totalPrice = quotePrice
      .mul(ethers.BigNumber.from(amount))
      .div(powDecimales);

    if (!totalPrice.eq(ethers.BigNumber.from("0"))) {
      log(
        `Token: ${tokenAddresses[x]} --> Price: ${ethers.utils.formatEther(
          totalPrice
        )} [Maker No.${makers.length - x}]`
      );

      const takerDiscountTier =
        await dustSweeperContract.getTokenTakerDiscountTier(tokenAddresses[x]);
      const takerPercent = await dustSweeperContract.takerDiscountTiers(
        takerDiscountTier
      );
      const discountPrice = totalPrice
        .mul(powPercent.sub(takerPercent))
        .div(powPercent);

      const protocolTotal = totalPrice.mul(protocolPercent).div(powPercent);

      acceptedMakers.push(makers[x]);
      acceptedTokens.push(tokenAddresses[x]);
      totalEthSend = totalEthSend.add(discountPrice).add(protocolTotal);
      totalEthGet = totalEthGet.add(totalPrice);
    }
  }

  log(
    `Accepted ${acceptedMakers.length} Maker(s) and ${acceptedTokens.length} Token(s)`,
    "green"
  );
  if (acceptedMakers.length) {
    log(`Total ETH to send ${ethers.utils.formatEther(totalEthSend)}`, "red");
    log(`Total ETH to get ${ethers.utils.formatEther(totalEthGet)}`, "red");

    const gasPrice = await ethers.provider.getGasPrice();

    const functionGasFees = await dustSweeperContract.estimateGas.sweepDust(
      acceptedMakers,
      acceptedTokens,
      packet,
      {
        value: totalEthSend,
      }
    );
    const finalGasPrice = gasPrice * functionGasFees;

    const profit = calculateProfit(finalGasPrice, totalEthSend, totalEthGet);

    if (profit.gt(ethers.BigNumber.from("0"))) {
      log(
        `This is a profitable trade. Profit: ${ethers.utils.formatEther(
          profit
        )}`,
        "green"
      );
    } else {
      log(
        `This is not a profitable trade. Profit: ${ethers.utils.formatEther(
          profit
        )}`,
        "red"
      );
    }
  }
  // log(`Total costs of gas: ${finalGasPrice}`, "red");
  // const { packet: packetNew } = await fetchData(acceptedTokens);
  // console.log(packetNew);
  // const sweepTx = await dustSweeperContract.sweepDust(
  //   acceptedMakers,
  //   acceptedTokens,
  //   packet,
  //   {
  //     value: totalEthSend.add(ethers.utils.parseEther("0.5")),
  //   }
  // );
  // const sweepReceipt = await sweepTx.wait();
  // console.log(sweepReceipt);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function log(message, color) {
  const _color = color ? color : "blue";
  console.log(
    colors[_color](`[${new Date().toLocaleTimeString()}] ${message}`)
  );
}

const readDataFromEvents = (events) => {
  let tokenAddresses = [];
  let makers = [];
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    tokenAddresses.push(event.address);

    makers.push(event.args.owner);
  }

  return { tokenAddresses, makers };
};

const fetchData = async (tokenAddresses) => {
  let apiResponse;
  try {
    apiResponse = await axios.post(priceApiUrl, {
      tokenAddresses: [...new Set(tokenAddresses)],
    });
  } catch (e) {
    log(`error: ${e}`, "red");
  }
  const prices = apiResponse.data.data;
  const packet = apiResponse.data.packet;

  return { prices, packet };
};

const calculateProfit = (finalGasPrice, sendEth, getEth) => {
  const _profit = getEth.sub(finalGasPrice).sub(sendEth);

  return _profit;
};
