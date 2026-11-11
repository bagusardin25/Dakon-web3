// Puts sample tables on a LOCAL chain so the lobby, replays and the leaderboard have
// something to show. Refuses to run anywhere else: sample games do not belong on a public
// network.
//
//   npx hardhat run scripts/seed.js --network localhost
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const hre = require("hardhat");

const SIZE = { RINGKAS: 5, KLASIK: 7 };
const PACE = { KILAT: 0, BIASA: 1, SANTAI: 2 };

async function main() {
  const { ethers, network } = hre;
  if (network.name !== "localhost" && network.name !== "hardhat") {
    throw new Error(`seed.js only runs on a local chain, not "${network.name}".`);
  }
  const file = path.join(__dirname, "..", "deployments", "localhost.json");
  if (!fs.existsSync(file)) throw new Error("Deploy first: npm run deploy:local");
  const { address } = JSON.parse(fs.readFileSync(file, "utf8"));

  const enginePath = path.join(__dirname, "..", "..", "web", "src", "engine", "rules.ts");
  const E = await import(pathToFileURL(enginePath).href);

  // Accounts 0, 7, 8 and 9 are the browser's dev wallets. The seed leaves them alone,
  // apart from one table reserved for account 7 so an invitation can be tried.
  const signers = await ethers.getSigners();
  const [, sekar, bayu, laras, wulan, nyoman, mega] = signers;
  const invitee = signers[7];
  const dakon = await ethers.getContractAt("Dakon", address);
  const as = (signer) => dakon.connect(signer);
  const send = async (tx) => (await tx).wait();
  const ZERO = ethers.ZeroAddress;

  const names = [
    [sekar, "Sekar"],
    [bayu, "Bayu Aji"],
    [laras, "laras.dakon"],
    [wulan, "Wulan"],
    [nyoman, "Bli Nyoman"],
  ];
  for (const [signer, name] of names) await send(as(signer).setNickname(name));

  /** Plays `count` moves, or to the end, choosing the hole that adds most to the mover's store. */
  async function playOut(id, south, north, size, count = Infinity) {
    let game = E.newGame(size);
    let n = 0;
    while (!game.ended && n < count) {
      const legal = E.legalHoles(game.board, size, game.turn);
      const store = E.storeOf(game.turn);
      let best = legal[0];
      let bestGain = -Infinity;
      for (const hole of legal) {
        const r = E.applyMove(game.board, size, game.turn, hole, false);
        const variety = ((hole * 7 + n) % 3) * 0.1;
        const gain = r.board[store] - game.board[store] + (r.outcome === "extra" ? 2 : 0) + variety;
        if (gain > bestGain) {
          bestGain = gain;
          best = hole;
        }
      }
      await send(as(game.turn === 0 ? south : north).play(id, best));
      game = E.playMove(game, best).game;
      n += 1;
    }
    return game;
  }

  async function open(opener, size, pace, invited = ZERO) {
    await send(as(opener).openTable(size, pace, invited));
    return Number(await dakon.tableCount());
  }

  // 1: finished, Ringkas
  let id = await open(sekar, SIZE.RINGKAS, PACE.BIASA);
  await send(as(bayu).sit(id));
  await playOut(id, sekar, bayu, SIZE.RINGKAS);

  // 2: finished, Klasik
  id = await open(laras, SIZE.KLASIK, PACE.SANTAI);
  await send(as(wulan).sit(id));
  await playOut(id, laras, wulan, SIZE.KLASIK);

  // 3: finished by resignation
  id = await open(mega, SIZE.RINGKAS, PACE.KILAT);
  await send(as(nyoman).sit(id));
  await playOut(id, mega, nyoman, SIZE.RINGKAS, 5);
  await send(as(mega).resign(id));

  // 4: finished, Ringkas, a return match reserved for the previous opponent
  id = await open(bayu, SIZE.RINGKAS, PACE.BIASA, sekar.address);
  await send(as(sekar).sit(id));
  await playOut(id, bayu, sekar, SIZE.RINGKAS);

  // 5: in play, Ringkas, a few moves in
  id = await open(bayu, SIZE.RINGKAS, PACE.SANTAI);
  await send(as(laras).sit(id));
  await playOut(id, bayu, laras, SIZE.RINGKAS, 6);

  // 6: in play, Klasik
  id = await open(nyoman, SIZE.KLASIK, PACE.SANTAI);
  await send(as(sekar).sit(id));
  await playOut(id, nyoman, sekar, SIZE.KLASIK, 9);

  // 7: cancelled
  id = await open(bayu, SIZE.KLASIK, PACE.KILAT);
  await send(as(bayu).cancelTable(id));

  // 8, 9: waiting for anyone
  await open(wulan, SIZE.RINGKAS, PACE.BIASA);
  await open(mega, SIZE.KLASIK, PACE.SANTAI);

  // 10: waiting for dev wallet account 7 only
  await open(sekar, SIZE.RINGKAS, PACE.SANTAI, invitee.address);

  const s = await dakon.stats();
  console.log(
    `Seeded ${s.tables} tables: ${s.playing} in play, ${s.finished} finished, ${s.moves} moves, ${s.players} players.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
