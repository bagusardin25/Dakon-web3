// Gas: what each action costs, and proof that the longest possible move fits in a block.
//
// Relay sowing can run long. No real game reached more than 365 seeds in one move over 40,000
// random games, and a hill-climbing search over all 98-seed Klasik positions found nothing
// past 856. The contract still stops any move at MAX_SOWN (1200) seeds, so the true worst case
// is a move that reaches that limit. Such a move needs more seeds than a real game holds, so it
// is placed on a table with the test-only harness and played through play() as usual.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { SIZE, PACE, SIDE, STATUS, OUTCOME, loadEngine, deploy, deployHarness, board, toNumbers, moveEvent } = require("./helpers");

const BOT_CHAIN_BLOCK_GAS_LIMIT = 35_000_000; // eth_getBlockByNumber on rpc.botchain.ai, 11 Nov 2026
const GWEI = 20n;
const bot = (gas) => (Number(BigInt(gas) * GWEI) / 1e9).toFixed(4);

// Longest relay found on a legal Klasik position (98 seeds): South hole 6 sows 856 seeds.
const LONGEST_KLASIK = { board: [6, 15, 6, 9, 2, 1, 2, 2, 9, 4, 5, 2, 5, 14, 14, 2], side: SIDE.SOUTH, hole: 6, sown: 856 };
// Positions that reach the sowing limit (more seeds than a real game, so only via the harness).
const LIMIT_KLASIK = { board: [15, 19, 19, 13, 16, 16, 17, 0, 15, 24, 19, 23, 21, 13, 25, 0], side: SIDE.SOUTH, hole: 4 };
const LIMIT_RINGKAS = { board: [13, 12, 16, 17, 22, 0, 0, 0, 16, 23, 14, 9, 8, 0, 0, 0], side: SIDE.SOUTH, hole: 1 };

const rows = [];

async function measure(size, position) {
  const ctx = await deployHarness();
  const { harness, sekar, bayu } = ctx;
  await harness.connect(sekar).openTable(size, PACE.SANTAI, ethers.ZeroAddress);
  await harness.connect(bayu).sit(1);
  await harness.forceBoard(1, position.board, position.side);
  const mover = position.side === SIDE.SOUTH ? sekar : bayu;
  const rc = await (await harness.connect(mover).play(1, position.hole)).wait();
  const event = moveEvent(harness, rc);
  const E = await loadEngine();
  const engine = E.applyMove(position.board, size, position.side, position.hole, false);
  expect(toNumbers((await harness.getTable(1)).board)).to.deep.equal(engine.board);
  return { gas: Number(rc.gasUsed), sown: Number(event.sown), outcome: Number(event.outcome), engine };
}

describe("Dakon — gas", function () {
  it("deploys", async function () {
    const factory = await ethers.getContractFactory("Dakon");
    const contract = await factory.deploy();
    const rc = await contract.deploymentTransaction().wait();
    rows.push(["Deploy", rc.gasUsed]);
    expect(Number(rc.gasUsed)).to.be.lessThan(5_000_000);
  });

  it("opens a table, sits, sets a nickname, resigns", async function () {
    const { dakon, sekar, bayu } = await loadFixture(deploy);
    const first = await (await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ethers.ZeroAddress)).wait();
    const again = await (await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ethers.ZeroAddress)).wait();
    const sitFirst = await (await dakon.connect(bayu).sit(1)).wait();
    const sitAgain = await (await dakon.connect(bayu).sit(2)).wait();
    const nick = await (await dakon.connect(sekar).setNickname("Sekar")).wait();
    const resign = await (await dakon.connect(sekar).resign(1)).wait();
    rows.push(["Open a table (wallet's first)", first.gasUsed]);
    rows.push(["Open a table (later)", again.gasUsed]);
    rows.push(["Sit (wallet's first)", sitFirst.gasUsed]);
    rows.push(["Sit (later)", sitAgain.gasUsed]);
    rows.push(["Set nickname", nick.gasUsed]);
    rows.push(["Resign", resign.gasUsed]);
  });

  it("plays an ordinary opening move", async function () {
    const { dakon, sekar, bayu } = await loadFixture(deploy);
    await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ethers.ZeroAddress);
    await dakon.connect(bayu).sit(1);
    const rc = await (await dakon.connect(bayu).play(1, 1)).wait(); // one relay and a capture
    rows.push(["Move: opening, one relay (11 seeds)", rc.gasUsed]);
  });

  it("plays the longest relay found on a real Klasik position (856 seeds)", async function () {
    const r = await measure(SIZE.KLASIK, LONGEST_KLASIK);
    expect(r.sown).to.equal(LONGEST_KLASIK.sown);
    rows.push([`Move: longest relay found (${r.sown} seeds)`, r.gas]);
    expect(r.gas).to.be.lessThan(1_000_000);
  });

  it("stops a move at the sowing limit and stays far below the block gas limit", async function () {
    for (const [size, position, name] of [
      [SIZE.KLASIK, LIMIT_KLASIK, "Klasik"],
      [SIZE.RINGKAS, LIMIT_RINGKAS, "Ringkas"],
    ]) {
      const r = await measure(size, position);
      expect(r.outcome).to.equal(OUTCOME.limit);
      expect(r.engine.outcome).to.equal("limit");
      expect(r.sown).to.be.at.least(1200);
      rows.push([`Move: sowing limit, ${name} (${r.sown} seeds)`, r.gas]);
      expect(r.gas).to.be.lessThan(1_000_000);
      expect(r.gas).to.be.lessThan(BOT_CHAIN_BLOCK_GAS_LIMIT / 30);
    }
  });

  it("plays a move that ends the game", async function () {
    const { harness, sekar, bayu } = await loadFixture(deployHarness);
    await harness.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ethers.ZeroAddress);
    await harness.connect(bayu).sit(1);
    await harness.forceBoard(1, board([0, 0, 0, 0, 0], 20, [1, 0, 0, 0, 3], 26), SIDE.NORTH);
    const rc = await (await harness.connect(bayu).play(1, 0)).wait();
    expect((await harness.getTable(1)).status).to.equal(STATUS.FINISHED);
    rows.push(["Move: last move of a game", rc.gasUsed]);
  });

  after(function () {
    console.log("\n      Action                                   Gas        BOT at 20 gwei");
    for (const [name, gas] of rows) {
      console.log(`      ${name.padEnd(40)} ${String(gas).padStart(9)}   ${bot(gas)}`);
    }
  });
});
