// Differential test: the contract (the referee) against the TypeScript engine (animation,
// practice and replay). Both must agree on the board, the next player, the outcome and the
// seed count after every single move of hundreds of random games.
//
//   DAKON_GAMES=400 DAKON_SEED=7 npx hardhat test test/Dakon.differential.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { STATUS, loadEngine, toNumbers, moveEvent, rng } = require("./helpers");

const GAMES = Number(process.env.DAKON_GAMES || 200);
const SEED = Number(process.env.DAKON_SEED || 677);
const RANDOM_POSITIONS = Number(process.env.DAKON_POSITIONS || 1500);

describe("Dakon — differential test against web/src/engine/rules.ts", function () {
  let E;
  let dakon;
  let signers;
  const gas = { open: [], sit: [], move: [] };

  before(async function () {
    E = await loadEngine();
    signers = (await ethers.getSigners()).slice(1, 9);
    dakon = await ethers.deployContract("Dakon");
    await dakon.waitForDeployment();
  });

  it(`plays ${GAMES} random games with identical boards after every move`, async function () {
    const random = rng(SEED);
    const pick = (list) => list[Math.floor(random() * list.length)];
    let moves = 0;
    let longest = { sown: 0 };
    const outcomes = {};
    const results = { 1: 0, 2: 0, 3: 0 };

    for (let g = 0; g < GAMES; g++) {
      // Roughly three Ringkas games for every two Klasik ones.
      const size = g % 5 < 3 ? 5 : 7;
      const south = signers[g % signers.length];
      const north = signers[(g + 1 + Math.floor(random() * (signers.length - 1))) % signers.length];
      const pace = g % 3;

      const openRc = await (await dakon.connect(south).openTable(size, pace, ethers.ZeroAddress)).wait();
      const id = await dakon.tableCount();
      const sitRc = await (await dakon.connect(north).sit(id)).wait();
      gas.open.push(Number(openRc.gasUsed));
      gas.sit.push(Number(sitRc.gasUsed));

      let game = E.newGame(size);
      const context = () => `game ${g + 1} (table ${id}, size ${size}, seed ${SEED}), move ${game.moves.length + 1}`;

      while (!game.ended) {
        const legal = E.legalHoles(game.board, size, game.turn);
        const hole = pick(legal);
        const mover = game.turn === 0 ? south : north;

        const step = E.playMove(game, hole);
        const rc = await (await dakon.connect(mover).play(id, hole)).wait();
        const event = moveEvent(dakon, rc);
        const t = await dakon.getTable(id);

        expect(toNumbers(t.board), `board after ${context()}`).to.deep.equal(step.game.board);
        expect(Number(t.turn), `next player after ${context()}`).to.equal(step.game.turn);
        expect(Number(t.status), `status after ${context()}`).to.equal(
          step.game.ended ? STATUS.FINISHED : STATUS.PLAYING,
        );
        expect(Number(event.sown), `seeds sown in ${context()}`).to.equal(step.result.sown);
        expect(Number(event.outcome), `outcome of ${context()}`).to.equal(
          ["extra", "capture", "rest", "dead", "limit"].indexOf(step.result.outcome),
        );

        gas.move.push(Number(rc.gasUsed));
        outcomes[step.result.outcome] = (outcomes[step.result.outcome] || 0) + 1;
        if (step.result.sown > longest.sown) longest = { sown: step.result.sown, gas: Number(rc.gasUsed), size };
        game = step.game;
        moves += 1;
      }

      const t = await dakon.getTable(id);
      expect(Number(t.result), `result of game ${g + 1}`).to.equal(E.winnerOf(game.board));
      expect(Number(t.board[7]) + Number(t.board[15])).to.equal(2 * size * size);
      results[Number(t.result)] += 1;

      // The stored move log replays to the same final board.
      const log = Array.from(ethers.getBytes(await dakon.getMoves(id)));
      expect(log).to.deep.equal(game.moves);
      expect(E.replay(size, log).final.board).to.deep.equal(toNumbers(t.board));
    }

    const s = await dakon.stats();
    expect(Number(s.finished)).to.equal(GAMES);
    expect(Number(s.moves)).to.equal(moves);

    console.log(
      `      ${GAMES} games, ${moves} moves — outcomes ${JSON.stringify(outcomes)}; ` +
        `South won ${results[1]}, North won ${results[2]}, drawn ${results[3]}; ` +
        `longest move sowed ${longest.sown} seeds (${longest.gas} gas, size ${longest.size})`,
    );
  });

  it(`agrees on ${RANDOM_POSITIONS} arbitrary positions through simulateMove`, async function () {
    // Positions no real game may ever reach: uneven seeds, full stores, long laps.
    const random = rng(SEED + 1);
    let checked = 0;
    while (checked < RANDOM_POSITIONS) {
      const size = random() < 0.5 ? 5 : 7;
      const total = 10 + Math.floor(random() * (2 * size * size + 40));
      const cells = [];
      for (let i = 0; i < size; i++) cells.push(i, 8 + i);
      cells.push(7, 15);
      const board = new Array(16).fill(0);
      for (let s = 0; s < total; s++) board[cells[Math.floor(random() * cells.length)]] += 1;
      const side = random() < 0.5 ? 0 : 1;
      const legal = E.legalHoles(board, size, side);
      if (legal.length === 0) continue;
      const hole = legal[Math.floor(random() * legal.length)];

      const expected = E.applyMove(board, size, side, hole, false);
      const got = await dakon.simulateMove(size, board, side, hole);
      const where = `position ${JSON.stringify(board)} size ${size} side ${side} hole ${hole}`;
      expect(toNumbers(got.board), where).to.deep.equal(expected.board);
      expect(Number(got.next), where).to.equal(expected.next);
      expect(got.ended, where).to.equal(expected.ended);
      expect(Number(got.sown), where).to.equal(expected.sown);
      checked += 1;
    }
  });

  after(function () {
    const summary = (list) => {
      if (list.length === 0) return "n/a";
      const sorted = [...list].sort((a, b) => a - b);
      const mean = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
      return `mean ${mean}, median ${sorted[sorted.length >> 1]}, p95 ${sorted[Math.floor(sorted.length * 0.95)]}, max ${sorted[sorted.length - 1]}`;
    };
    console.log(`      gas — openTable: ${summary(gas.open)}`);
    console.log(`      gas — sit:       ${summary(gas.sit)}`);
    console.log(`      gas — play:      ${summary(gas.move)}`);
  });
});
