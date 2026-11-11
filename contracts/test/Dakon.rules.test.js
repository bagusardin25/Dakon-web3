// Rules, tables, time limits and views. Every position below is checked twice: against the
// contract and against the TypeScript engine in web/src/engine/rules.ts, with the expected
// board worked out by hand from PRD section 5.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  SIZE,
  PACE,
  PACE_SECONDS,
  STATUS,
  SIDE,
  RESULT,
  REASON,
  OUTCOME,
  PREVIEW,
  loadEngine,
  deploy,
  withGame,
  withHarnessGame,
  board,
  toNumbers,
  moveEvent,
} = require("./helpers");

const ZERO = ethers.ZeroAddress;
const INITIAL_5 = board([5, 5, 5, 5, 5], 0, [5, 5, 5, 5, 5], 0);
const INITIAL_7 = board([7, 7, 7, 7, 7, 7, 7], 0, [7, 7, 7, 7, 7, 7, 7], 0);

async function boardOf(contract, id) {
  return toNumbers((await contract.getTable(id)).board);
}

/**
 * Places `start` on table 1 of the harness with `side` to move, plays `hole`, and checks the
 * contract and the engine both arrive at `expected`.
 */
async function checkPosition(ctx, { start, side, hole, expected, outcome, sown, next, ended = false }) {
  const E = await loadEngine();
  const engine = E.applyMove(start, SIZE.RINGKAS, side, hole);
  expect(engine.board, "engine board").to.deep.equal(expected);
  expect(engine.outcome, "engine outcome").to.equal(outcome);
  expect(engine.sown, "engine sown").to.equal(sown);
  expect(engine.next, "engine next").to.equal(next);
  expect(engine.ended, "engine ended").to.equal(ended);

  const { harness, sekar, bayu } = ctx;
  await harness.forceBoard(1, start, side);
  const mover = side === SIDE.SOUTH ? sekar : bayu;
  const receipt = await (await harness.connect(mover).play(1, hole)).wait();
  const event = moveEvent(harness, receipt);
  expect(Number(event.outcome), "contract outcome").to.equal(OUTCOME[outcome]);
  expect(Number(event.sown), "contract sown").to.equal(sown);

  const t = await harness.getTable(1);
  expect(toNumbers(t.board), "contract board").to.deep.equal(expected);
  expect(Number(t.turn), "contract next").to.equal(next);
  expect(Number(t.status), "contract status").to.equal(ended ? STATUS.FINISHED : STATUS.PLAYING);
  return t;
}

describe("Dakon — rules", function () {
  describe("openTable", function () {
    it("opens a Ringkas table with five seeds in every hole and North to move", async function () {
      const { dakon, sekar } = await loadFixture(deploy);
      const now = (await time.latest()) + 1;
      await time.setNextBlockTimestamp(now);
      await expect(dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO))
        .to.emit(dakon, "TableOpened")
        .withArgs(1, sekar.address, SIZE.RINGKAS, PACE.KILAT, ZERO);

      const t = await dakon.getTable(1);
      expect(t.id).to.equal(1);
      expect(t.south).to.equal(sekar.address);
      expect(t.north).to.equal(ZERO);
      expect(t.invited).to.equal(ZERO);
      expect(t.size).to.equal(SIZE.RINGKAS);
      expect(t.pace).to.equal(PACE.KILAT);
      expect(t.status).to.equal(STATUS.WAITING);
      expect(t.turn).to.equal(SIDE.NORTH);
      expect(t.result).to.equal(RESULT.NONE);
      expect(t.createdAt).to.equal(now);
      expect(t.deadline).to.equal(0);
      expect(t.moveCount).to.equal(0);
      expect(toNumbers(t.board)).to.deep.equal(INITIAL_5);
      expect(await dakon.tableCount()).to.equal(1);
      expect(await dakon.tablesOf(sekar.address)).to.deep.equal([1n]);
    });

    it("opens a Klasik table with seven seeds in every hole", async function () {
      const { dakon, sekar } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.KLASIK, PACE.SANTAI, ZERO);
      expect(await boardOf(dakon, 1)).to.deep.equal(INITIAL_7);
    });

    it("can reserve the North seat for one wallet", async function () {
      const { dakon, sekar, bayu } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.BIASA, bayu.address);
      expect((await dakon.getTable(1)).invited).to.equal(bayu.address);
    });

    it("numbers tables from 1 upwards", async function () {
      const { dakon, sekar, bayu } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await dakon.connect(bayu).openTable(SIZE.KLASIK, PACE.KILAT, ZERO);
      expect((await dakon.getTable(2)).south).to.equal(bayu.address);
      expect(await dakon.tableCount()).to.equal(2);
    });

    it("rejects a board size other than 5 or 7", async function () {
      const { dakon, sekar } = await loadFixture(deploy);
      for (const size of [0, 4, 6, 8, 9, 255]) {
        await expect(dakon.connect(sekar).openTable(size, PACE.KILAT, ZERO)).to.be.revertedWithCustomError(
          dakon,
          "InvalidSize",
        );
      }
    });

    it("rejects a pace other than 0, 1 or 2", async function () {
      const { dakon, sekar } = await loadFixture(deploy);
      await expect(dakon.connect(sekar).openTable(SIZE.RINGKAS, 3, ZERO)).to.be.revertedWithCustomError(
        dakon,
        "InvalidPace",
      );
    });

    it("rejects inviting yourself", async function () {
      const { dakon, sekar } = await loadFixture(deploy);
      await expect(dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, sekar.address)).to.be.revertedWithCustomError(
        dakon,
        "CannotInviteYourself",
      );
    });
  });

  describe("cancelTable", function () {
    it("lets the opener cancel a table nobody has sat at", async function () {
      const { dakon, sekar } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await expect(dakon.connect(sekar).cancelTable(1)).to.emit(dakon, "TableCancelled").withArgs(1);
      const t = await dakon.getTable(1);
      expect(t.status).to.equal(STATUS.CANCELLED);
      expect(t.endedAt).to.be.greaterThan(0);
    });

    it("rejects anyone but the opener", async function () {
      const { dakon, sekar, bayu } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await expect(dakon.connect(bayu).cancelTable(1)).to.be.revertedWithCustomError(dakon, "NotTheOpener");
    });

    it("rejects cancelling once a challenger has sat, or twice", async function () {
      const { dakon, sekar, bayu } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await dakon.connect(bayu).sit(1);
      await expect(dakon.connect(sekar).cancelTable(1)).to.be.revertedWithCustomError(dakon, "TableNotWaiting");
      await dakon.connect(sekar).cancelTable(2);
      await expect(dakon.connect(sekar).cancelTable(2)).to.be.revertedWithCustomError(dakon, "TableNotWaiting");
    });

    it("rejects a table that does not exist", async function () {
      const { dakon, sekar } = await loadFixture(deploy);
      await expect(dakon.connect(sekar).cancelTable(1)).to.be.revertedWithCustomError(dakon, "TableNotFound");
    });
  });

  describe("sit", function () {
    it("seats the challenger at North and starts the game with North to move", async function () {
      const { dakon, sekar, bayu } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await expect(dakon.connect(bayu).sit(1)).to.emit(dakon, "PlayerSat").withArgs(1, bayu.address);
      const t = await dakon.getTable(1);
      expect(t.north).to.equal(bayu.address);
      expect(t.status).to.equal(STATUS.PLAYING);
      expect(t.turn).to.equal(SIDE.NORTH);
      expect(t.deadline).to.equal(t.lastMoveAt + 180n);
      expect(await dakon.tablesOf(bayu.address)).to.deep.equal([1n]);
      const s = await dakon.stats();
      expect(s.playing).to.equal(1);
    });

    it("rejects the opener sitting at their own table", async function () {
      const { dakon, sekar } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await expect(dakon.connect(sekar).sit(1)).to.be.revertedWithCustomError(dakon, "OpenerCannotSit");
    });

    it("keeps a reserved seat for the invited wallet only", async function () {
      const { dakon, sekar, bayu, laras } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, bayu.address);
      await expect(dakon.connect(laras).sit(1)).to.be.revertedWithCustomError(dakon, "NotInvited");
      await dakon.connect(bayu).sit(1);
      expect((await dakon.getTable(1)).north).to.equal(bayu.address);
    });

    it("rejects a seat that has just been taken", async function () {
      const { dakon, laras } = await loadFixture(withGame);
      await expect(dakon.connect(laras).sit(1)).to.be.revertedWithCustomError(dakon, "TableNotWaiting");
    });

    it("rejects a cancelled table", async function () {
      const { dakon, sekar, bayu } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await dakon.connect(sekar).cancelTable(1);
      await expect(dakon.connect(bayu).sit(1)).to.be.revertedWithCustomError(dakon, "TableNotWaiting");
    });

    it("rejects table 0 and tables past the last one", async function () {
      const { dakon, bayu } = await loadFixture(withGame);
      await expect(dakon.connect(bayu).sit(0)).to.be.revertedWithCustomError(dakon, "TableNotFound");
      await expect(dakon.connect(bayu).sit(2)).to.be.revertedWithCustomError(dakon, "TableNotFound");
    });
  });

  describe("play — who may move", function () {
    it("rejects South moving before North", async function () {
      const { dakon, sekar } = await loadFixture(withGame);
      await expect(dakon.connect(sekar).play(1, 0)).to.be.revertedWithCustomError(dakon, "NotYourTurn");
    });

    it("rejects a wallet that is not at the table", async function () {
      const { dakon, laras } = await loadFixture(withGame);
      await expect(dakon.connect(laras).play(1, 0)).to.be.revertedWithCustomError(dakon, "NotAPlayer");
    });

    it("rejects a hole off the player's own row, including the opponent's holes", async function () {
      const { dakon, sekar, bayu } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await dakon.connect(sekar).openTable(SIZE.KLASIK, PACE.KILAT, ZERO);
      await dakon.connect(bayu).sit(1);
      await dakon.connect(bayu).sit(2);
      // Holes are numbered within the mover's own row, so the opponent's row cannot be named:
      // 5..7 are past the end of a Ringkas row and 8..12 are where South's holes sit in storage.
      for (const hole of [5, 6, 7, 8, 12, 15, 255]) {
        await expect(dakon.connect(bayu).play(1, hole)).to.be.revertedWithCustomError(dakon, "InvalidHole");
      }
      await expect(dakon.connect(bayu).play(2, 7)).to.be.revertedWithCustomError(dakon, "InvalidHole");
    });

    it("rejects an empty hole", async function () {
      const { dakon, bayu } = await loadFixture(withGame);
      await dakon.connect(bayu).play(1, 0); // ends in North's store: North moves again, hole 0 now empty
      await expect(dakon.connect(bayu).play(1, 0)).to.be.revertedWithCustomError(dakon, "EmptyHole");
    });

    it("rejects moves at a table that is waiting, cancelled or missing", async function () {
      const { dakon, sekar, bayu } = await loadFixture(deploy);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await expect(dakon.connect(sekar).play(1, 0)).to.be.revertedWithCustomError(dakon, "GameNotInPlay");
      await dakon.connect(sekar).cancelTable(1);
      await expect(dakon.connect(bayu).play(1, 0)).to.be.revertedWithCustomError(dakon, "GameNotInPlay");
      await expect(dakon.connect(bayu).play(9, 0)).to.be.revertedWithCustomError(dakon, "TableNotFound");
    });
  });

  describe("play — sowing (PRD 5.2)", function () {
    it("ends in the mover's own store: move again", async function () {
      const { dakon, bayu } = await loadFixture(withGame);
      const E = await loadEngine();
      const expected = board([5, 5, 5, 5, 5], 0, [0, 6, 6, 6, 6], 1);
      expect(E.applyMove(INITIAL_5, 5, SIDE.NORTH, 0).board).to.deep.equal(expected);

      const receipt = await (await dakon.connect(bayu).play(1, 0)).wait();
      const event = moveEvent(dakon, receipt);
      expect(event.outcome).to.equal(OUTCOME.extra);
      expect(event.sown).to.equal(5);
      const t = await dakon.getTable(1);
      expect(toNumbers(t.board)).to.deep.equal(expected);
      expect(t.turn).to.equal(SIDE.NORTH);
    });

    it("relays from a full hole, skips the opponent's store and captures across", async function () {
      // North lifts 5 from hole 1 and the last lands on South's first hole (now 6): relay.
      // The 6 run past South's store without dropping in it and the last falls in North's
      // emptied hole 1: capture the 6 across plus that seed.
      const { dakon, bayu } = await loadFixture(withGame);
      const E = await loadEngine();
      const expected = board([0, 6, 6, 0, 6], 0, [6, 0, 6, 6, 6], 8);
      const r = E.applyMove(INITIAL_5, 5, SIDE.NORTH, 1);
      expect(r.board).to.deep.equal(expected);
      expect(r.relays).to.equal(1);

      const receipt = await (await dakon.connect(bayu).play(1, 1)).wait();
      const event = moveEvent(dakon, receipt);
      expect(event.outcome).to.equal(OUTCOME.capture);
      expect(event.sown).to.equal(11);
      const t = await dakon.getTable(1);
      expect(toNumbers(t.board)).to.deep.equal(expected);
      expect(t.turn).to.equal(SIDE.SOUTH);
    });

    it("captures the seeds across when the last seed falls in an empty own hole", async function () {
      const ctx = await loadFixture(withHarnessGame);
      await checkPosition(ctx, {
        start: board([1, 0, 0, 0, 3], 0, [2, 0, 0, 4, 0], 40),
        side: SIDE.SOUTH,
        hole: 0,
        expected: board([0, 0, 0, 0, 3], 5, [2, 0, 0, 0, 0], 40),
        outcome: "capture",
        sown: 1,
        next: SIDE.NORTH,
      });
    });

    it("leaves the seed where it fell when the hole across is empty", async function () {
      const ctx = await loadFixture(withHarnessGame);
      await checkPosition(ctx, {
        start: board([1, 0, 0, 0, 3], 0, [2, 0, 0, 0, 4], 40),
        side: SIDE.SOUTH,
        hole: 0,
        expected: board([0, 1, 0, 0, 3], 0, [2, 0, 0, 0, 4], 40),
        outcome: "rest",
        sown: 1,
        next: SIDE.NORTH,
      });
    });

    it("ends the turn when the last seed falls in an empty hole across the board", async function () {
      const ctx = await loadFixture(withHarnessGame);
      await checkPosition(ctx, {
        start: board([0, 0, 0, 0, 3], 0, [2, 0, 0, 0, 0], 45),
        side: SIDE.SOUTH,
        hole: 4,
        expected: board([0, 0, 0, 0, 0], 1, [3, 1, 0, 0, 0], 45),
        outcome: "dead",
        sown: 3,
        next: SIDE.NORTH,
      });
    });

    it("relays on either side of the board, as often as the seeds lead", async function () {
      // 1 seed lands on South's 2 (relay 3), whose last lands on North's 1 (relay 2),
      // whose last lands in an empty North hole: the turn ends.
      const ctx = await loadFixture(withHarnessGame);
      await checkPosition(ctx, {
        start: board([0, 0, 1, 2, 0], 0, [1, 0, 0, 0, 0], 46),
        side: SIDE.SOUTH,
        hole: 2,
        expected: board([0, 0, 0, 0, 1], 1, [0, 1, 1, 0, 0], 46),
        outcome: "dead",
        sown: 6,
        next: SIDE.NORTH,
      });
    });

    it("gives another move when a relay ends in the mover's store", async function () {
      // 12 seeds lap the whole ring (dropping into the hole they came from) and relay twice.
      const ctx = await loadFixture(withHarnessGame);
      await checkPosition(ctx, {
        start: board([12, 0, 0, 0, 0], 0, [0, 0, 0, 0, 0], 38),
        side: SIDE.SOUTH,
        hole: 0,
        expected: board([1, 0, 2, 0, 2], 2, [1, 1, 1, 1, 1], 38),
        outcome: "extra",
        sown: 16,
        next: SIDE.SOUTH,
      });
    });

    it("never drops a seed in the opponent's store — South", async function () {
      const ctx = await loadFixture(withHarnessGame);
      await checkPosition(ctx, {
        start: board([0, 0, 0, 0, 8], 0, [0, 0, 0, 0, 0], 42),
        side: SIDE.SOUTH,
        hole: 4,
        expected: board([1, 0, 0, 0, 0], 3, [1, 1, 1, 0, 1], 42),
        outcome: "capture",
        sown: 8,
        next: SIDE.NORTH,
      });
    });

    it("never drops a seed in the opponent's store — North", async function () {
      const ctx = await loadFixture(withHarnessGame);
      await checkPosition(ctx, {
        start: board([0, 0, 0, 0, 0], 42, [0, 0, 0, 0, 8], 0),
        side: SIDE.NORTH,
        hole: 4,
        expected: board([1, 1, 1, 0, 1], 42, [1, 0, 0, 0, 0], 3),
        outcome: "capture",
        sown: 8,
        next: SIDE.SOUTH,
      });
    });

    it("records every move in the log, with the side in bit 7", async function () {
      const { dakon, sekar, bayu } = await loadFixture(withGame);
      await dakon.connect(bayu).play(1, 0); // ends in North's store: North again
      await dakon.connect(bayu).play(1, 2);
      expect((await dakon.getTable(1)).turn).to.equal(SIDE.SOUTH);
      await dakon.connect(sekar).play(1, 4);
      expect(await dakon.getMoves(1)).to.equal("0x808204");
      expect((await dakon.getTable(1)).moveCount).to.equal(3);

      const E = await loadEngine();
      const { final } = E.replay(5, [0x80, 0x82, 0x04]);
      expect(final.board).to.deep.equal(await boardOf(dakon, 1));
    });
  });

  describe("play — end of the game (PRD 5.3)", function () {
    it("ends when the side to move has no seeds; the other side keeps what is left", async function () {
      const ctx = await loadFixture(withHarnessGame);
      const { harness, sekar, bayu } = ctx;
      await harness.forceBoard(1, board([0, 0, 0, 0, 0], 20, [1, 0, 0, 0, 3], 26), SIDE.NORTH);
      await expect(harness.connect(bayu).play(1, 0))
        .to.emit(harness, "GameEnded")
        .withArgs(1, RESULT.NORTH, REASON.BOARD, 20, 30);

      const E = await loadEngine();
      const r = E.applyMove(board([0, 0, 0, 0, 0], 20, [1, 0, 0, 0, 3], 26), 5, SIDE.NORTH, 0);
      expect(r.ended).to.equal(true);
      expect(r.board).to.deep.equal(board([0, 0, 0, 0, 0], 20, [0, 0, 0, 0, 0], 30));

      const t = await harness.getTable(1);
      expect(t.status).to.equal(STATUS.FINISHED);
      expect(t.result).to.equal(RESULT.NORTH);
      expect(t.reason).to.equal(REASON.BOARD);
      expect(t.deadline).to.equal(0);
      expect(toNumbers(t.board)).to.deep.equal(r.board);

      const north = await harness.playerOf(bayu.address);
      const south = await harness.playerOf(sekar.address);
      expect([north.wins, north.losses, north.draws, north.bestStore]).to.deep.equal([1n, 0n, 0n, 30n]);
      expect([south.wins, south.losses, south.draws, south.bestStore]).to.deep.equal([0n, 1n, 0n, 20n]);
      const s = await harness.stats();
      expect([s.playing, s.finished]).to.deep.equal([0n, 1n]);
    });

    it("ends when a capture empties the opponent's row", async function () {
      const ctx = await loadFixture(withHarnessGame);
      await checkPosition(ctx, {
        start: board([1, 0, 0, 0, 3], 10, [0, 0, 0, 4, 0], 32),
        side: SIDE.SOUTH,
        hole: 0,
        expected: board([0, 0, 0, 0, 0], 18, [0, 0, 0, 0, 0], 32),
        outcome: "capture",
        sown: 1,
        next: SIDE.NORTH,
        ended: true,
      });
      expect((await ctx.harness.getTable(1)).result).to.equal(RESULT.NORTH);
    });

    it("ends when a move earns another turn but the mover's row is empty", async function () {
      const ctx = await loadFixture(withHarnessGame);
      await checkPosition(ctx, {
        start: board([0, 0, 0, 0, 1], 10, [3, 4, 5, 0, 0], 27),
        side: SIDE.SOUTH,
        hole: 4,
        expected: board([0, 0, 0, 0, 0], 11, [0, 0, 0, 0, 0], 39),
        outcome: "extra",
        sown: 1,
        next: SIDE.SOUTH,
        ended: true,
      });
      expect((await ctx.harness.getTable(1)).result).to.equal(RESULT.NORTH);
    });

    it("gives the game to South when South's store holds more", async function () {
      const ctx = await loadFixture(withHarnessGame);
      await checkPosition(ctx, {
        start: board([0, 0, 0, 0, 1], 30, [0, 0, 0, 1, 0], 18),
        side: SIDE.SOUTH,
        hole: 4,
        expected: board([0, 0, 0, 0, 0], 31, [0, 0, 0, 0, 0], 19),
        outcome: "extra",
        sown: 1,
        next: SIDE.SOUTH,
        ended: true,
      });
      const t = await ctx.harness.getTable(1);
      expect(t.result).to.equal(RESULT.SOUTH);
      expect((await ctx.harness.playerOf(ctx.sekar.address)).wins).to.equal(1);
    });

    it("calls equal stores a draw", async function () {
      const ctx = await loadFixture(withHarnessGame);
      await checkPosition(ctx, {
        start: board([0, 0, 0, 0, 0], 25, [1, 0, 0, 0, 0], 24),
        side: SIDE.NORTH,
        hole: 0,
        expected: board([0, 0, 0, 0, 0], 25, [0, 0, 0, 0, 0], 25),
        outcome: "rest",
        sown: 1,
        next: SIDE.SOUTH,
        ended: true,
      });
      expect((await ctx.harness.getTable(1)).result).to.equal(RESULT.DRAW);
      expect((await ctx.harness.playerOf(ctx.sekar.address)).draws).to.equal(1);
      expect((await ctx.harness.playerOf(ctx.bayu.address)).draws).to.equal(1);
    });

    it("rejects moves after the game has ended", async function () {
      const ctx = await loadFixture(withHarnessGame);
      const { harness, sekar, bayu } = ctx;
      await harness.forceBoard(1, board([0, 0, 0, 0, 0], 25, [1, 0, 0, 0, 0], 24), SIDE.NORTH);
      await harness.connect(bayu).play(1, 0);
      await expect(harness.connect(sekar).play(1, 0)).to.be.revertedWithCustomError(harness, "GameNotInPlay");
      await expect(harness.connect(bayu).play(1, 0)).to.be.revertedWithCustomError(harness, "GameNotInPlay");
    });

    it("plays a whole Ringkas game between two wallets to a result", async function () {
      const { dakon, sekar, bayu } = await loadFixture(withGame);
      const E = await loadEngine();
      let game = E.newGame(5);
      while (!game.ended) {
        // The largest hole: a plain, deterministic strategy.
        const legal = E.legalHoles(game.board, 5, game.turn);
        const hole = legal.reduce((best, h) => (game.board[game.turn * 8 + h] > game.board[game.turn * 8 + best] ? h : best));
        await dakon.connect(game.turn === SIDE.SOUTH ? sekar : bayu).play(1, hole);
        game = E.playMove(game, hole).game;
      }
      const t = await dakon.getTable(1);
      expect(t.status).to.equal(STATUS.FINISHED);
      expect(toNumbers(t.board)).to.deep.equal(game.board);
      expect(Number(t.board[7]) + Number(t.board[15])).to.equal(50);
      expect(Number(t.result)).to.equal(E.winnerOf(game.board));
      expect(Number(t.moveCount)).to.equal(game.moves.length);
    });
  });

  describe("resign", function () {
    it("gives the game to the other player, whoever's turn it is", async function () {
      const { dakon, sekar, bayu } = await loadFixture(withGame);
      await expect(dakon.connect(sekar).resign(1))
        .to.emit(dakon, "GameEnded")
        .withArgs(1, RESULT.NORTH, REASON.RESIGN, 0, 0);
      const t = await dakon.getTable(1);
      expect(t.status).to.equal(STATUS.FINISHED);
      expect(t.reason).to.equal(REASON.RESIGN);
      expect((await dakon.playerOf(bayu.address)).wins).to.equal(1);
      expect((await dakon.playerOf(sekar.address)).losses).to.equal(1);
      // Best store only counts games played to the last seed.
      expect((await dakon.playerOf(bayu.address)).bestStore).to.equal(0);
    });

    it("lets North resign too", async function () {
      const { dakon, bayu } = await loadFixture(withGame);
      await dakon.connect(bayu).resign(1);
      expect((await dakon.getTable(1)).result).to.equal(RESULT.SOUTH);
    });

    it("rejects outsiders, waiting tables and finished games", async function () {
      const { dakon, sekar, bayu, laras } = await loadFixture(withGame);
      await expect(dakon.connect(laras).resign(1)).to.be.revertedWithCustomError(dakon, "NotAPlayer");
      await dakon.connect(laras).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await expect(dakon.connect(laras).resign(2)).to.be.revertedWithCustomError(dakon, "GameNotInPlay");
      await dakon.connect(sekar).resign(1);
      await expect(dakon.connect(bayu).resign(1)).to.be.revertedWithCustomError(dakon, "GameNotInPlay");
    });
  });

  describe("claimTimeout (PRD 5.4)", function () {
    it("rejects a claim before the mover's time is up, even at the last second", async function () {
      const { dakon, sekar } = await loadFixture(withGame);
      const { deadline } = await dakon.getTable(1);
      await expect(dakon.connect(sekar).claimTimeout(1))
        .to.be.revertedWithCustomError(dakon, "TimeNotUp")
        .withArgs(deadline);
      await time.setNextBlockTimestamp(deadline);
      await expect(dakon.connect(sekar).claimTimeout(1)).to.be.revertedWithCustomError(dakon, "TimeNotUp");
    });

    it("gives the game to the waiting player once the mover's time is up", async function () {
      const { dakon, sekar, bayu } = await loadFixture(withGame);
      const { deadline } = await dakon.getTable(1);
      await time.setNextBlockTimestamp(deadline + 1n);
      await expect(dakon.connect(sekar).claimTimeout(1))
        .to.emit(dakon, "GameEnded")
        .withArgs(1, RESULT.SOUTH, REASON.TIMEOUT, 0, 0);
      expect((await dakon.getTable(1)).reason).to.equal(REASON.TIMEOUT);
      expect((await dakon.playerOf(sekar.address)).wins).to.equal(1);
      expect((await dakon.playerOf(bayu.address)).losses).to.equal(1);
    });

    it("rejects a claim by the player whose move it is, and by outsiders", async function () {
      const { dakon, bayu, laras } = await loadFixture(withGame);
      await time.increase(3600);
      await expect(dakon.connect(bayu).claimTimeout(1)).to.be.revertedWithCustomError(dakon, "YourOwnMove");
      await expect(dakon.connect(laras).claimTimeout(1)).to.be.revertedWithCustomError(dakon, "NotAPlayer");
    });

    it("accepts a late move until someone claims, and the clock restarts", async function () {
      const { dakon, sekar, bayu } = await loadFixture(withGame);
      await time.increase(1000);
      await dakon.connect(bayu).play(1, 1); // late, but nobody claimed; South to move now
      const t = await dakon.getTable(1);
      expect(t.turn).to.equal(SIDE.SOUTH);
      expect(t.deadline).to.equal(t.lastMoveAt + 180n);
      await expect(dakon.connect(bayu).claimTimeout(1)).to.be.revertedWithCustomError(dakon, "TimeNotUp");
      await expect(dakon.connect(sekar).claimTimeout(1)).to.be.revertedWithCustomError(dakon, "YourOwnMove");
    });

    it("uses 3 minutes, 1 hour and 24 hours per move", async function () {
      const { dakon, sekar, bayu } = await loadFixture(deploy);
      for (const pace of [PACE.KILAT, PACE.BIASA, PACE.SANTAI]) {
        await dakon.connect(sekar).openTable(SIZE.RINGKAS, pace, ZERO);
        const id = await dakon.tableCount();
        await dakon.connect(bayu).sit(id);
        const t = await dakon.getTable(id);
        expect(t.deadline - t.lastMoveAt).to.equal(BigInt(PACE_SECONDS[pace]));
      }
    });

    it("rejects a claim at a table that is waiting or finished", async function () {
      const { dakon, sekar, bayu } = await loadFixture(withGame);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await expect(dakon.connect(sekar).claimTimeout(2)).to.be.revertedWithCustomError(dakon, "GameNotInPlay");
      await dakon.connect(bayu).resign(1);
      await time.increase(3600);
      await expect(dakon.connect(sekar).claimTimeout(1)).to.be.revertedWithCustomError(dakon, "GameNotInPlay");
    });
  });

  describe("setNickname", function () {
    it("stores a name of up to 20 bytes and lists the wallet as a player", async function () {
      const { dakon, laras } = await loadFixture(deploy);
      await expect(dakon.connect(laras).setNickname("Laras dari Solo"))
        .to.emit(dakon, "NicknameSet")
        .withArgs(laras.address, "Laras dari Solo");
      expect((await dakon.playerOf(laras.address)).nickname).to.equal("Laras dari Solo");
      expect((await dakon.stats()).players).to.equal(1);
      await dakon.connect(laras).setNickname("12345678901234567890");
      expect(await dakon.getNicknames([laras.address])).to.deep.equal(["12345678901234567890"]);
    });

    it("counts bytes, not characters", async function () {
      const { dakon, laras } = await loadFixture(deploy);
      await dakon.connect(laras).setNickname("é".repeat(10)); // 20 bytes
      await expect(dakon.connect(laras).setNickname("é".repeat(11))).to.be.revertedWithCustomError(
        dakon,
        "NicknameTooLong",
      );
      await expect(dakon.connect(laras).setNickname("123456789012345678901")).to.be.revertedWithCustomError(
        dakon,
        "NicknameTooLong",
      );
    });

    it("clears the name with an empty string and lists each wallet once", async function () {
      const { dakon, laras } = await loadFixture(deploy);
      await dakon.connect(laras).setNickname("Citra");
      await dakon.connect(laras).setNickname("");
      expect((await dakon.playerOf(laras.address)).nickname).to.equal("");
      expect((await dakon.stats()).players).to.equal(1);
    });
  });

  describe("views", function () {
    it("pages through tables newest first", async function () {
      const { dakon, sekar } = await loadFixture(deploy);
      for (let i = 0; i < 5; i++) await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      let [page, next] = await dakon.getTables(0, 2);
      expect(page.map((t) => t.id)).to.deep.equal([5n, 4n]);
      expect(next).to.equal(3);
      [page, next] = await dakon.getTables(next, 2);
      expect(page.map((t) => t.id)).to.deep.equal([3n, 2n]);
      [page, next] = await dakon.getTables(next, 2);
      expect(page.map((t) => t.id)).to.deep.equal([1n]);
      expect(next).to.equal(0);
    });

    it("returns at most 100 tables per page", async function () {
      const { dakon, sekar } = await loadFixture(deploy);
      for (let i = 0; i < 101; i++) await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      const [page, next] = await dakon.getTables(0, 500);
      expect(page.length).to.equal(100);
      expect(next).to.equal(1);
    });

    it("returns an empty page when there are no tables", async function () {
      const { dakon } = await loadFixture(deploy);
      const [page, next] = await dakon.getTables(0, 10);
      expect(page.length).to.equal(0);
      expect(next).to.equal(0);
    });

    it("looks up tables by id, with empty entries for ids that do not exist", async function () {
      const { dakon } = await loadFixture(withGame);
      const page = await dakon.getTablesByIds([1, 0, 99]);
      expect(page.map((t) => t.id)).to.deep.equal([1n, 0n, 0n]);
      expect(page[0].status).to.equal(STATUS.PLAYING);
    });

    it("reverts getTable and getMoves for a table that does not exist", async function () {
      const { dakon } = await loadFixture(withGame);
      await expect(dakon.getTable(2)).to.be.revertedWithCustomError(dakon, "TableNotFound");
      await expect(dakon.getMoves(0)).to.be.revertedWithCustomError(dakon, "TableNotFound");
    });

    it("previews a move exactly as play() will make it", async function () {
      const { dakon, bayu } = await loadFixture(withGame);
      const p = await dakon.previewMove(1, 1);
      expect(p.code).to.equal(PREVIEW.OK);
      expect(p.outcome).to.equal(OUTCOME.capture);
      expect(p.sown).to.equal(11);
      expect(p.next).to.equal(SIDE.SOUTH);
      await dakon.connect(bayu).play(1, 1);
      expect(toNumbers(p.board)).to.deep.equal(await boardOf(dakon, 1));
    });

    it("explains why a previewed move is not possible", async function () {
      const { dakon, sekar, bayu } = await loadFixture(withGame);
      expect((await dakon.previewMove(7, 0)).code).to.equal(PREVIEW.NOT_FOUND);
      expect((await dakon.previewMove(1, 5)).code).to.equal(PREVIEW.OFF_BOARD);
      await dakon.connect(bayu).play(1, 0); // extra turn, hole 0 empty
      const empty = await dakon.previewMove(1, 0);
      expect(empty.code).to.equal(PREVIEW.EMPTY);
      expect(toNumbers(empty.board)).to.deep.equal(await boardOf(dakon, 1));
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      expect((await dakon.previewMove(2, 0)).code).to.equal(PREVIEW.NOT_IN_PLAY);
    });

    it("simulates any board with the same rules, and checks its input", async function () {
      const { dakon } = await loadFixture(deploy);
      const r = await dakon.simulateMove(5, INITIAL_5, SIDE.NORTH, 1);
      expect(toNumbers(r.board)).to.deep.equal(board([0, 6, 6, 0, 6], 0, [6, 0, 6, 6, 6], 8));
      await expect(dakon.simulateMove(6, INITIAL_5, 0, 0)).to.be.revertedWithCustomError(dakon, "InvalidSize");
      await expect(dakon.simulateMove(5, INITIAL_5, 2, 0)).to.be.revertedWithCustomError(dakon, "NotAPlayer");
      await expect(dakon.simulateMove(5, INITIAL_5, 0, 5)).to.be.revertedWithCustomError(dakon, "InvalidHole");
      await expect(dakon.simulateMove(5, board([0], 0, [1], 0), 0, 0)).to.be.revertedWithCustomError(
        dakon,
        "EmptyHole",
      );
      await expect(dakon.simulateMove(5, board([200, 56], 0, [1], 0), 0, 0)).to.be.revertedWithCustomError(
        dakon,
        "InvalidBoard",
      );
    });

    it("lists each player once, in order of first appearance", async function () {
      const { dakon, sekar, bayu, laras } = await loadFixture(withGame);
      await dakon.connect(sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ZERO);
      await dakon.connect(laras).sit(2);
      let [page, next] = await dakon.getPlayers(0, 2);
      expect(page.map((p) => p.wallet)).to.deep.equal([sekar.address, bayu.address]);
      expect(page[0].tables).to.equal(2);
      expect(next).to.equal(2);
      [page, next] = await dakon.getPlayers(next, 2);
      expect(page.map((p) => p.wallet)).to.deep.equal([laras.address]);
      expect(next).to.equal(0);
      [page, next] = await dakon.getPlayers(9, 2);
      expect(page.length).to.equal(0);
      expect(next).to.equal(0);
    });

    it("counts tables, games in play, finished games, moves and players", async function () {
      const { dakon, sekar, bayu } = await loadFixture(withGame);
      await dakon.connect(bayu).play(1, 0);
      await dakon.connect(sekar).openTable(SIZE.KLASIK, PACE.KILAT, ZERO);
      let s = await dakon.stats();
      expect([s.tables, s.playing, s.finished, s.moves, s.players]).to.deep.equal([2n, 1n, 0n, 1n, 2n]);
      await dakon.connect(bayu).resign(1);
      s = await dakon.stats();
      expect([s.playing, s.finished]).to.deep.equal([0n, 1n]);
    });
  });

  describe("no money, no owner", function () {
    it("refuses BOT sent to it and has no payable function", async function () {
      const { dakon, sekar } = await loadFixture(deploy);
      await expect(sekar.sendTransaction({ to: await dakon.getAddress(), value: 1n })).to.be.reverted;
      const payable = dakon.interface.fragments.filter((f) => f.type === "function" && f.payable);
      expect(payable).to.have.lengthOf(0);
    });

    it("has no owner or admin function", async function () {
      const { dakon } = await loadFixture(deploy);
      const names = dakon.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
      for (const banned of ["owner", "transferOwnership", "pause", "setRules", "withdraw"]) {
        expect(names).to.not.include(banned);
      }
    });
  });
});
