// Shared fixtures and helpers for the Dakon tests.
const path = require("path");
const { pathToFileURL } = require("url");
const { ethers } = require("hardhat");

const SIZE = { RINGKAS: 5, KLASIK: 7 };
const PACE = { KILAT: 0, BIASA: 1, SANTAI: 2 };
const PACE_SECONDS = [180, 3600, 86400];
const STATUS = { WAITING: 0, PLAYING: 1, FINISHED: 2, CANCELLED: 3 };
const SIDE = { SOUTH: 0, NORTH: 1 };
const RESULT = { NONE: 0, SOUTH: 1, NORTH: 2, DRAW: 3 };
const REASON = { NONE: 0, BOARD: 1, RESIGN: 2, TIMEOUT: 3 };
const OUTCOME = { extra: 0, capture: 1, rest: 2, dead: 3, limit: 4 };
const PREVIEW = { OK: 0, NOT_FOUND: 1, NOT_IN_PLAY: 2, OFF_BOARD: 3, EMPTY: 4 };

/** The TypeScript rules engine the web app uses, loaded straight from web/src (Node strips the types). */
let enginePromise;
function loadEngine() {
  if (!enginePromise) {
    const file = path.join(__dirname, "..", "..", "web", "src", "engine", "rules.ts");
    enginePromise = import(pathToFileURL(file).href);
  }
  return enginePromise;
}

async function deploy() {
  const signers = await ethers.getSigners();
  const [deployer, sekar, bayu, laras, wulan] = signers;
  const dakon = await ethers.deployContract("Dakon");
  await dakon.waitForDeployment();
  return { dakon, deployer, sekar, bayu, laras, wulan, signers };
}

async function deployHarness() {
  const ctx = await deploy();
  const harness = await ethers.deployContract("DakonHarness");
  await harness.waitForDeployment();
  return { ...ctx, harness };
}

/** Sekar opens table 1 (Ringkas, Kilat) and Bayu sits: North (Bayu) to move. */
async function withGame() {
  const ctx = await deploy();
  await ctx.dakon.connect(ctx.sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ethers.ZeroAddress);
  await ctx.dakon.connect(ctx.bayu).sit(1);
  return ctx;
}

/** The same on the harness, so a test can set up any position. */
async function withHarnessGame() {
  const ctx = await deployHarness();
  await ctx.harness.connect(ctx.sekar).openTable(SIZE.RINGKAS, PACE.KILAT, ethers.ZeroAddress);
  await ctx.harness.connect(ctx.bayu).sit(1);
  return ctx;
}

/** Board in the 16-cell layout: [south holes ×7, south store, north holes ×7, north store]. */
function board(southHoles, southStore, northHoles, northStore) {
  const pad = (holes) => [...holes, ...Array(7 - holes.length).fill(0)];
  return [...pad(southHoles), southStore, ...pad(northHoles), northStore];
}

const toNumbers = (arr) => Array.from(arr, Number);

/** Parses MovePlayed from a receipt. */
function moveEvent(contract, receipt) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "MovePlayed") return parsed.args;
    } catch {
      // not ours
    }
  }
  return undefined;
}

/** Small deterministic PRNG (mulberry32), so a failing random game can be replayed. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = {
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
  deployHarness,
  withGame,
  withHarnessGame,
  board,
  toNumbers,
  moveEvent,
  rng,
};
