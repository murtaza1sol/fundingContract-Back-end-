const { assert, expect } = require("chai");
const {
  network,
  deployments,
  ethers,
  getChainId,
  getNamedAccounts,
} = require("hardhat");

const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("FundMe", function () {
      let fundMe, mockV3Aggregator, deployer;
      const sendValue = ethers.utils.parseEther("1");

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        fundMe = await ethers.getContract("FundMe", deployer);
        mockV3Aggregator = await ethers.getContract(
          "MockV3Aggregator",
          deployer
        );
      });
      describe("Constructor", function () {
        it("should set the aggregator address correctly", async () => {
          const response = await fundMe.getPriceFeed();
          assert.equal(response, mockV3Aggregator.address);
        });
      });
      describe("fund", () => {
        it("should fail if you don't send enough ETH", async () => {
          await expect(fundMe.fund()).to.be.revertedWith(
            "You need to spend more ETH!"
          );
        });
        it("Updates the amount funded data structure", async () => {
          await fundMe.fund({ value: sendValue });
          const fundedAmount = await fundMe.getAddressToAmountFunded(deployer);
          assert.equal(sendValue.toString(), fundedAmount.toString());
        });
        it("Adds funder to array of funders", async () => {
          await fundMe.fund({ value: sendValue });
          assert.equal(await fundMe.getFunder(0), deployer);
        });
      });
      describe("withdraw", () => {
        beforeEach(async () => {
          await fundMe.fund({ value: sendValue });
        });
        it("withdraws ETH from a single funder", async () => {
          const startingFundMeBal = await fundMe.provider.getBalance(
            fundMe.address
          );
          const startingDeployerBal = await ethers.provider.getBalance(
            deployer
          );

          const transactionReceipt = await (await fundMe.withdraw()).wait();
          const { gasUsed, effectiveGasPrice } = transactionReceipt;
          const gasCost = gasUsed.mul(effectiveGasPrice);

          const endingFundMeBal = await fundMe.provider.getBalance(
            fundMe.address
          );
          const endingDeployerBal = await ethers.provider.getBalance(deployer);

          assert.equal(endingFundMeBal, 0);
          assert.equal(
            startingDeployerBal.add(startingFundMeBal).toString(),
            endingDeployerBal.add(gasCost).toString()
          );
        });
        it("allows us to withdraw with multiple funders", async () => {
          const accounts = await ethers.getSigners();
          for (var i = 1; i <= 5; i++) {
            const connectedAcc = await fundMe.connect(accounts[i]);
            await connectedAcc.fund({ value: sendValue });
          }

          const startingFundMeBal = await fundMe.provider.getBalance(
            fundMe.address
          );
          const startingDeployerBal = await ethers.provider.getBalance(
            deployer
          );

          const transactionReceipt = await (await fundMe.withdraw()).wait();
          const { gasUsed, effectiveGasPrice } = transactionReceipt;
          const gasCost = gasUsed.mul(effectiveGasPrice);

          console.log(`Gas Cost: ${gasCost}`);
          console.log(`Gas Used: ${gasUsed}`);
          console.log(`Gas Price: ${effectiveGasPrice}`);

          const endingDeployerBal = await ethers.provider.getBalance(deployer);

          assert.equal(
            startingDeployerBal.add(startingFundMeBal).toString(),
            endingDeployerBal.add(gasCost).toString()
          );
          await expect(fundMe.getFunder(0)).to.be.reverted;

          for (i = 1; i <= 5; i++) {
            assert.equal(
              await fundMe.getAddressToAmountFunded(accounts[i].address),
              0
            );
          }
        });

        it("Only allows onwer to withdraw", async () => {
        
            const account = await ethers.getSigners();
            const connect = fundMe.connect(account[1]);

            await expect(connect.withdraw()).to.be.revertedWithCustomError(fundMe,"FundMe__NotOwner");

        });
      });
    });
