import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { EpiMarket } from "../typechain-types";

const Outcome = { NONE: 0, YES: 1, NO: 2 } as const;

const SEED_LIQUIDITY = 50n * 100n;

async function deployFixture() {
  const [owner, alice, bob, carol] = await ethers.getSigners();
  const EpiMarketFactory = await ethers.getContractFactory("EpiMarket");
  const epiMarket = (await EpiMarketFactory.deploy()) as unknown as EpiMarket;
  return { epiMarket, owner, alice, bob, carol };
}

async function deployWithMarketFixture() {
  const base = await deployFixture();
  await base.epiMarket.createMarket("market-1");
  return base;
}

describe("EpiMarket", () => {
  describe("deployment", () => {
    it("sets the deployer as owner and starts with no supply", async () => {
      const { epiMarket, owner } = await loadFixture(deployFixture);
      expect(await epiMarket.owner()).to.equal(owner.address);
      expect(await epiMarket.totalSupply()).to.equal(0n);
      expect(await epiMarket.name()).to.equal("EpiMarket Token");
      expect(await epiMarket.symbol()).to.equal("EPIM");
      expect(await epiMarket.decimals()).to.equal(2);
    });
  });

  describe("mint", () => {
    it("credits the recipient and increases totalSupply", async () => {
      const { epiMarket, alice } = await loadFixture(deployFixture);
      await expect(epiMarket.mint(alice.address, 1000n))
        .to.emit(epiMarket, "Transfer")
        .withArgs(ethers.ZeroAddress, alice.address, 1000n);
      expect(await epiMarket.balanceOf(alice.address)).to.equal(1000n);
      expect(await epiMarket.totalSupply()).to.equal(1000n);
    });

    it("rejects mint from a non-owner", async () => {
      const { epiMarket, alice } = await loadFixture(deployFixture);
      await expect(epiMarket.connect(alice).mint(alice.address, 1000n)).to.be.revertedWith("Not the owner");
    });
  });

  describe("ERC-20 transfer/approve", () => {
    it("transfers between users", async () => {
      const { epiMarket, alice, bob } = await loadFixture(deployFixture);
      await epiMarket.mint(alice.address, 500n);
      await epiMarket.connect(alice).transfer(bob.address, 200n);
      expect(await epiMarket.balanceOf(alice.address)).to.equal(300n);
      expect(await epiMarket.balanceOf(bob.address)).to.equal(200n);
    });

    it("rejects a transfer exceeding the balance", async () => {
      const { epiMarket, alice, bob } = await loadFixture(deployFixture);
      await epiMarket.mint(alice.address, 100n);
      await expect(epiMarket.connect(alice).transfer(bob.address, 101n)).to.be.revertedWith("Insufficient balance");
    });

    it("supports approve + transferFrom", async () => {
      const { epiMarket, alice, bob, carol } = await loadFixture(deployFixture);
      await epiMarket.mint(alice.address, 500n);
      await epiMarket.connect(alice).approve(bob.address, 300n);
      await epiMarket.connect(bob).transferFrom(alice.address, carol.address, 300n);
      expect(await epiMarket.balanceOf(carol.address)).to.equal(300n);
      expect(await epiMarket.allowance(alice.address, bob.address)).to.equal(0n);
    });

    it("rejects transferFrom beyond the allowance", async () => {
      const { epiMarket, alice, bob, carol } = await loadFixture(deployFixture);
      await epiMarket.mint(alice.address, 500n);
      await epiMarket.connect(alice).approve(bob.address, 100n);
      await expect(epiMarket.connect(bob).transferFrom(alice.address, carol.address, 101n)).to.be.revertedWith(
        "Allowance exceeded",
      );
    });
  });

  describe("createMarket", () => {
    it("seeds yes/no pools with virtual liquidity", async () => {
      const { epiMarket } = await loadFixture(deployFixture);
      await epiMarket.createMarket("market-1");
      const market = await epiMarket.markets("market-1");
      expect(market.yesPool).to.equal(SEED_LIQUIDITY);
      expect(market.noPool).to.equal(SEED_LIQUIDITY);
      expect(market.totalVolume).to.equal(0n);
      expect(market.resolved).to.equal(false);
      expect(market.exists).to.equal(true);
    });

    it("rejects a non-owner", async () => {
      const { epiMarket, alice } = await loadFixture(deployFixture);
      await expect(epiMarket.connect(alice).createMarket("market-1")).to.be.revertedWith("Not the owner");
    });

    it("rejects creating the same market twice", async () => {
      const { epiMarket } = await loadFixture(deployWithMarketFixture);
      await expect(epiMarket.createMarket("market-1")).to.be.revertedWith("Market already exists");
    });
  });

  describe("placeBet", () => {
    it("escrows the stake into the contract and updates the pools", async () => {
      const { epiMarket, alice } = await loadFixture(deployWithMarketFixture);
      await epiMarket.mint(alice.address, 1000n);

      await expect(epiMarket.connect(alice).placeBet("market-1", Outcome.YES, 300n))
        .to.emit(epiMarket, "BetPlaced")
        .withArgs("market-1", alice.address, Outcome.YES, 300n);

      expect(await epiMarket.balanceOf(alice.address)).to.equal(700n);
      expect(await epiMarket.balanceOf(await epiMarket.getAddress())).to.equal(300n);

      const market = await epiMarket.markets("market-1");
      expect(market.yesPool).to.equal(SEED_LIQUIDITY + 300n);
      expect(market.noPool).to.equal(SEED_LIQUIDITY);
      expect(market.totalVolume).to.equal(300n);
    });

    it("rejects a bet with insufficient balance", async () => {
      const { epiMarket, alice } = await loadFixture(deployWithMarketFixture);
      await epiMarket.mint(alice.address, 100n);
      await expect(epiMarket.connect(alice).placeBet("market-1", Outcome.YES, 101n)).to.be.revertedWith(
        "Insufficient balance",
      );
    });

    it("rejects a zero-amount bet", async () => {
      const { epiMarket, alice } = await loadFixture(deployWithMarketFixture);
      await epiMarket.mint(alice.address, 100n);
      await expect(epiMarket.connect(alice).placeBet("market-1", Outcome.YES, 0n)).to.be.revertedWith(
        "amount must be positive",
      );
    });

    it("rejects a bet on an unknown market", async () => {
      const { epiMarket, alice } = await loadFixture(deployFixture);
      await epiMarket.mint(alice.address, 100n);
      await expect(epiMarket.connect(alice).placeBet("no-such-market", Outcome.YES, 50n)).to.be.revertedWith(
        "Market not found",
      );
    });

    it("rejects a bet on a resolved market", async () => {
      const { epiMarket, alice } = await loadFixture(deployWithMarketFixture);
      await epiMarket.mint(alice.address, 100n);
      await epiMarket.resolveMarket("market-1", Outcome.YES);
      await expect(epiMarket.connect(alice).placeBet("market-1", Outcome.YES, 50n)).to.be.revertedWith(
        "Market is not open for betting",
      );
    });
  });

  describe("resolveMarket", () => {
    it("rejects a non-owner", async () => {
      const { epiMarket, alice } = await loadFixture(deployWithMarketFixture);
      await expect(epiMarket.connect(alice).resolveMarket("market-1", Outcome.YES)).to.be.revertedWith(
        "Not the owner",
      );
    });

    it("rejects resolving an unknown market", async () => {
      const { epiMarket } = await loadFixture(deployFixture);
      await expect(epiMarket.resolveMarket("no-such-market", Outcome.YES)).to.be.revertedWith("Market not found");
    });

    it("rejects resolving twice", async () => {
      const { epiMarket } = await loadFixture(deployWithMarketFixture);
      await epiMarket.resolveMarket("market-1", Outcome.YES);
      await expect(epiMarket.resolveMarket("market-1", Outcome.YES)).to.be.revertedWith("Market is already resolved");
    });

    it("splits the pool proportionally among winners with no remainder", async () => {
      const { epiMarket, alice, bob, carol } = await loadFixture(deployWithMarketFixture);
      await epiMarket.mint(alice.address, 1000n);
      await epiMarket.mint(bob.address, 1000n);
      await epiMarket.mint(carol.address, 1000n);

      await epiMarket.connect(alice).placeBet("market-1", Outcome.YES, 100n);
      await epiMarket.connect(bob).placeBet("market-1", Outcome.YES, 300n);
      await epiMarket.connect(carol).placeBet("market-1", Outcome.NO, 200n);

      await expect(epiMarket.resolveMarket("market-1", Outcome.YES))
        .to.emit(epiMarket, "MarketResolved")
        .withArgs("market-1", Outcome.YES, 600n);

      expect(await epiMarket.balanceOf(alice.address)).to.equal(900n + 150n);
      expect(await epiMarket.balanceOf(bob.address)).to.equal(700n + 450n);
      expect(await epiMarket.balanceOf(carol.address)).to.equal(800n);
      expect(await epiMarket.balanceOf(await epiMarket.getAddress())).to.equal(0n);

      const market = await epiMarket.markets("market-1");
      expect(market.resolved).to.equal(true);
      expect(market.outcome).to.equal(Outcome.YES);

      const [, , , alicePayout] = await epiMarket.getBet("market-1", 0);
      const [, , , bobPayout] = await epiMarket.getBet("market-1", 1);
      const [, , , carolPayout] = await epiMarket.getBet("market-1", 2);
      expect(alicePayout).to.equal(150n);
      expect(bobPayout).to.equal(450n);
      expect(carolPayout).to.equal(0n);
    });

    it("gives the rounding remainder to the last winner", async () => {
      const { epiMarket, alice, bob, carol } = await loadFixture(deployWithMarketFixture);
      await epiMarket.mint(alice.address, 1000n);
      await epiMarket.mint(bob.address, 1000n);
      await epiMarket.mint(carol.address, 1000n);

      await epiMarket.connect(alice).placeBet("market-1", Outcome.YES, 1n);
      await epiMarket.connect(bob).placeBet("market-1", Outcome.YES, 1n);
      await epiMarket.connect(carol).placeBet("market-1", Outcome.NO, 1n);

      await epiMarket.resolveMarket("market-1", Outcome.YES);

      expect(await epiMarket.balanceOf(alice.address)).to.equal(999n + 1n);
      expect(await epiMarket.balanceOf(bob.address)).to.equal(999n + 1n + 1n);
      expect(await epiMarket.balanceOf(await epiMarket.getAddress())).to.equal(0n);

      const [, , , alicePayout] = await epiMarket.getBet("market-1", 0);
      const [, , , bobPayout] = await epiMarket.getBet("market-1", 1);
      expect(alicePayout).to.equal(1n);
      expect(bobPayout).to.equal(2n);
    });

    it("refunds everyone when nobody backed the winning side", async () => {
      const { epiMarket, alice, bob } = await loadFixture(deployWithMarketFixture);
      await epiMarket.mint(alice.address, 1000n);
      await epiMarket.mint(bob.address, 1000n);

      await epiMarket.connect(alice).placeBet("market-1", Outcome.NO, 100n);
      await epiMarket.connect(bob).placeBet("market-1", Outcome.NO, 200n);

      await epiMarket.resolveMarket("market-1", Outcome.YES);

      expect(await epiMarket.balanceOf(alice.address)).to.equal(1000n);
      expect(await epiMarket.balanceOf(bob.address)).to.equal(1000n);
      expect(await epiMarket.balanceOf(await epiMarket.getAddress())).to.equal(0n);
    });
  });

  describe("bet history views", () => {
    it("exposes bet count and bet details", async () => {
      const { epiMarket, alice, bob } = await loadFixture(deployWithMarketFixture);
      await epiMarket.mint(alice.address, 1000n);
      await epiMarket.mint(bob.address, 1000n);

      await epiMarket.connect(alice).placeBet("market-1", Outcome.YES, 100n);
      await epiMarket.connect(bob).placeBet("market-1", Outcome.NO, 50n);

      expect(await epiMarket.getBetCount("market-1")).to.equal(2n);

      const [bettor0, side0, amount0, payout0] = await epiMarket.getBet("market-1", 0);
      expect(bettor0).to.equal(alice.address);
      expect(side0).to.equal(Outcome.YES);
      expect(amount0).to.equal(100n);
      expect(payout0).to.equal(0n);

      const [bettor1, side1, amount1] = await epiMarket.getBet("market-1", 1);
      expect(bettor1).to.equal(bob.address);
      expect(side1).to.equal(Outcome.NO);
      expect(amount1).to.equal(50n);
    });
  });

  describe("createMultiMarket", () => {
    it("seeds every option pool with virtual liquidity", async () => {
      const { epiMarket } = await loadFixture(deployFixture);
      await epiMarket.createMultiMarket("multi-1", 4);
      const [pools, totalVolume, resolved, , exists] = await epiMarket.getMultiMarket("multi-1");
      expect(pools).to.deep.equal([SEED_LIQUIDITY, SEED_LIQUIDITY, SEED_LIQUIDITY, SEED_LIQUIDITY]);
      expect(totalVolume).to.equal(0n);
      expect(resolved).to.equal(false);
      expect(exists).to.equal(true);
    });

    it("rejects a non-owner", async () => {
      const { epiMarket, alice } = await loadFixture(deployFixture);
      await expect(epiMarket.connect(alice).createMultiMarket("multi-1", 4)).to.be.revertedWith("Not the owner");
    });

    it("rejects an option count outside the allowed range", async () => {
      const { epiMarket } = await loadFixture(deployFixture);
      await expect(epiMarket.createMultiMarket("multi-1", 2)).to.be.revertedWith("optionCount out of range");
      await expect(epiMarket.createMultiMarket("multi-2", 7)).to.be.revertedWith("optionCount out of range");
    });

    it("rejects creating the same market twice", async () => {
      const { epiMarket } = await loadFixture(deployFixture);
      await epiMarket.createMultiMarket("multi-1", 4);
      await expect(epiMarket.createMultiMarket("multi-1", 4)).to.be.revertedWith("Market already exists");
    });
  });

  describe("placeMultiBet", () => {
    async function deployWithMultiMarketFixture() {
      const base = await deployFixture();
      await base.epiMarket.createMultiMarket("multi-1", 4);
      return base;
    }

    it("escrows the stake and updates the chosen option pool", async () => {
      const { epiMarket, alice } = await loadFixture(deployWithMultiMarketFixture);
      await epiMarket.mint(alice.address, 1000n);

      await expect(epiMarket.connect(alice).placeMultiBet("multi-1", 2, 300n))
        .to.emit(epiMarket, "MultiBetPlaced")
        .withArgs("multi-1", alice.address, 2, 300n);

      expect(await epiMarket.balanceOf(alice.address)).to.equal(700n);

      const [pools, totalVolume] = await epiMarket.getMultiMarket("multi-1");
      expect(pools[2]).to.equal(SEED_LIQUIDITY + 300n);
      expect(pools[0]).to.equal(SEED_LIQUIDITY);
      expect(totalVolume).to.equal(300n);
    });

    it("rejects an out-of-range option index", async () => {
      const { epiMarket, alice } = await loadFixture(deployWithMultiMarketFixture);
      await epiMarket.mint(alice.address, 100n);
      await expect(epiMarket.connect(alice).placeMultiBet("multi-1", 4, 50n)).to.be.revertedWith(
        "Invalid option index",
      );
    });

    it("rejects a bet on an unknown market", async () => {
      const { epiMarket, alice } = await loadFixture(deployFixture);
      await epiMarket.mint(alice.address, 100n);
      await expect(epiMarket.connect(alice).placeMultiBet("no-such-market", 0, 50n)).to.be.revertedWith(
        "Market not found",
      );
    });
  });

  describe("resolveMultiMarket", () => {
    async function deployWithMultiMarketFixture() {
      const base = await deployFixture();
      await base.epiMarket.createMultiMarket("multi-1", 4);
      return base;
    }

    it("splits the pool proportionally among winners of the chosen option", async () => {
      const { epiMarket, alice, bob, carol } = await loadFixture(deployWithMultiMarketFixture);
      await epiMarket.mint(alice.address, 1000n);
      await epiMarket.mint(bob.address, 1000n);
      await epiMarket.mint(carol.address, 1000n);

      await epiMarket.connect(alice).placeMultiBet("multi-1", 1, 100n);
      await epiMarket.connect(bob).placeMultiBet("multi-1", 1, 300n);
      await epiMarket.connect(carol).placeMultiBet("multi-1", 2, 200n);

      await expect(epiMarket.resolveMultiMarket("multi-1", 1))
        .to.emit(epiMarket, "MultiMarketResolved")
        .withArgs("multi-1", 1, 600n);

      expect(await epiMarket.balanceOf(alice.address)).to.equal(900n + 150n);
      expect(await epiMarket.balanceOf(bob.address)).to.equal(700n + 450n);
      expect(await epiMarket.balanceOf(carol.address)).to.equal(800n);
      expect(await epiMarket.balanceOf(await epiMarket.getAddress())).to.equal(0n);

      const [, , resolved, winningOption] = await epiMarket.getMultiMarket("multi-1");
      expect(resolved).to.equal(true);
      expect(winningOption).to.equal(1);
    });

    it("refunds everyone when nobody backed the winning option", async () => {
      const { epiMarket, alice, bob } = await loadFixture(deployWithMultiMarketFixture);
      await epiMarket.mint(alice.address, 1000n);
      await epiMarket.mint(bob.address, 1000n);

      await epiMarket.connect(alice).placeMultiBet("multi-1", 0, 100n);
      await epiMarket.connect(bob).placeMultiBet("multi-1", 0, 200n);

      await epiMarket.resolveMultiMarket("multi-1", 3);

      expect(await epiMarket.balanceOf(alice.address)).to.equal(1000n);
      expect(await epiMarket.balanceOf(bob.address)).to.equal(1000n);
      expect(await epiMarket.balanceOf(await epiMarket.getAddress())).to.equal(0n);
    });

    it("rejects a non-owner", async () => {
      const { epiMarket, alice } = await loadFixture(deployWithMultiMarketFixture);
      await expect(epiMarket.connect(alice).resolveMultiMarket("multi-1", 0)).to.be.revertedWith("Not the owner");
    });

    it("rejects resolving twice", async () => {
      const { epiMarket } = await loadFixture(deployWithMultiMarketFixture);
      await epiMarket.resolveMultiMarket("multi-1", 0);
      await expect(epiMarket.resolveMultiMarket("multi-1", 0)).to.be.revertedWith("Market is already resolved");
    });
  });

  describe("multi-outcome bet history views", () => {
    it("exposes bet count and bet details", async () => {
      const { epiMarket, alice, bob } = await loadFixture(deployFixture);
      await epiMarket.createMultiMarket("multi-1", 4);
      await epiMarket.mint(alice.address, 1000n);
      await epiMarket.mint(bob.address, 1000n);

      await epiMarket.connect(alice).placeMultiBet("multi-1", 1, 100n);
      await epiMarket.connect(bob).placeMultiBet("multi-1", 3, 50n);

      expect(await epiMarket.getMultiBetCount("multi-1")).to.equal(2n);

      const [bettor0, optionIndex0, amount0, payout0] = await epiMarket.getMultiBet("multi-1", 0);
      expect(bettor0).to.equal(alice.address);
      expect(optionIndex0).to.equal(1);
      expect(amount0).to.equal(100n);
      expect(payout0).to.equal(0n);

      const [bettor1, optionIndex1, amount1] = await epiMarket.getMultiBet("multi-1", 1);
      expect(bettor1).to.equal(bob.address);
      expect(optionIndex1).to.equal(3);
      expect(amount1).to.equal(50n);
    });
  });
});
