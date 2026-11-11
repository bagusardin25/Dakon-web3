# Progres — Dakon

Catatan status project agar bisa dilanjutkan kapan saja tanpa membaca ulang percakapan.
Terakhir diperbarui: **11 November 2026**.

## Status sekarang

**Milestone M2 selesai — 55%.** Contract, mesin aturan TypeScript, dan seluruh UI jadi; dua pertandingan Ringkas penuh sudah dimainkan antar-wallet di chain lokal lewat browser. Belum ada yang di-deploy ke jaringan publik.

Pekerjaan dijeda di sini karena langkah berikutnya menunggu repo dan wallet deployer dari pemilik project.

| Tahap | Isi | Progres | Status |
|---|---|---|---|
| M0 | PRD | 5% | Selesai |
| M1 | Contract, mesin TypeScript, uji banding lulus | 30% | Selesai |
| M2 | UI/UX lengkap, pertandingan penuh di chain lokal | 55% | Selesai |
| M3 | Deploy testnet (968) + uji dua wallet sungguhan | 70% | **Berikutnya** |
| M4 | Deploy mainnet (677) + verifikasi source | 85% | Belum |
| M5 | Vercel produksi, pengumuman X, aktivitas on-chain, audit checklist | 100% | Belum |

## Yang sudah jadi

### Dokumen
- [PRD.md](PRD.md) versi 1.1 — status, angka gas terukur, dan keputusan terbuka yang sudah diambil.
- [README.md](README.md) — cara menjalankan, deploy, dan setting Vercel, plus 13 screenshot (desktop, 768 px, 375 px) di `docs/screenshots/`, diambil dari chain lokal dengan data contoh.

### Smart contract (`contracts/`)
- `contracts/Dakon.sol` — Solidity 0.8.24, target EVM `paris`, optimizer 200 runs, tanpa dependensi, tanpa fungsi payable, tanpa pemilik.
- `contracts/test/DakonHarness.sol` — **khusus test**, tidak pernah di-deploy: menaruh posisi apa pun di meja agar kasus langka (beranting terpanjang, batas tebar) bisa diukur lewat `play`.
- `test/Dakon.rules.test.js` — 63 test: setiap aturan bagian 5 (jalan lagi, beranting, tembak, mati, lumbung lawan dilewati, akhir permainan, seri), setiap penolakan, batas waktu tiga tempo, menyerah, batal, nickname, semua fungsi baca.
- `test/Dakon.differential.test.js` — **uji banding**: 200 pertandingan acak (120 Ringkas, 80 Klasik) dimainkan lewat contract dan mesin TypeScript; papan, giliran berikutnya, hasil langkah, dan jumlah biji harus identik setelah setiap langkah. Ditambah 1.500 posisi sembarang lewat `simulateMove`.
- `test/Dakon.gas.test.js` — biaya setiap aksi dan kasus terburuk.
- `scripts/deploy.js` — deploy ke jaringan mana pun, menulis alamat ke `deployments/<network>.json` dan `web/src/config/deployments.json`.
- `scripts/seed.js` — 10 meja contoh (selesai, berjalan, menunggu, dibatalkan, satu dikhususkan untuk dev wallet Tari); hanya mau jalan di chain lokal.
- `scripts/export-abi.js` — menulis ABI ke `web/src/config/abi.ts`.

Yang ditegakkan contract: penantang (Utara) jalan duluan; hanya pemain yang gilirannya boleh jalan; lubang harus milik sendiri dan berisi; seluruh tebar-beranting-tembak dihitung on-chain; permainan berakhir saat pemain yang harus jalan tidak punya biji; klaim waktu hanya setelah batas lewat; meja khusus hanya untuk alamat undangan; pembuka tidak bisa duduk di mejanya sendiri.

### Mesin aturan (`web/src/engine/`)
- `rules.ts` — kembaran TypeScript dari contract, tanpa dependensi; menghasilkan urutan kejadian (angkat, jatuhkan, tembak, sapu) untuk animasi.
- `ai.ts` — lawan latihan: mencoba semua lubang, memilih yang paling memperlebar selisih lumbung (satu langkah ke depan).
- `narrate.ts` — satu kalimat per langkah untuk daftar langkah dan pembaca layar.

### Frontend (`web/`)
Vite + React + TypeScript + viem. Enam halaman dan dua dialog:

| Rute | Halaman | File |
|---|---|---|
| `#/` | Lobi: papan latihan sebagai pembuka, meja menunggu, berjalan, selesai | `src/pages/Lobby.tsx` |
| `#/table/:id` | Meja: papan live, giliran, hitung mundur, daftar langkah, menyerah/klaim/batal, undangan, hasil, putar ulang, tanding ulang | `src/pages/TablePage.tsx` |
| `#/practice` | Latihan lawan komputer, pilihan ukuran | `src/pages/Practice.tsx` |
| `#/rules` | Aturan dengan enam papan kecil yang bisa dicoba | `src/pages/Rules.tsx` |
| `#/players` | Papan peringkat | `src/pages/Players.tsx` |
| `#/me` | Giliranmu, undangan, menunggu lawan, riwayat, nickname | `src/pages/MyGames.tsx` |
| — | Dialog wallet, dialog buka meja | `src/components/WalletDialog.tsx`, `OpenTableDialog.tsx` |

- Papan digambar SVG (`src/components/board/`): kayu jati, lubang cekung, biji gading, ornamen kawung. Lubang adalah `<button>` sungguhan di atas gambar, berlabel "Your hole 3, 7 seeds".
- Animasi tebar: biji melompat lubang demi lubang, "tangan" kuningan menunjukkan sisa biji; bisa Calm/Quick atau Skip; dengan reduced motion diganti sorotan jalur.
- Di layar sempit (< 600 px) papan berdiri tegak; di 375×812 papan, kedua kursi, dan lubang 61 px muat dalam satu layar.
- Footer: "Built on BOT Chain" dengan tautan `https://botchain.ai` dan `https://scan.botchain.ai`, plus alamat contract.
- Hitung mundur memakai jam chain (selisih dari blok terbaru), bukan hanya jam komputer.

## Yang sudah diverifikasi

Semua dijalankan pada 11 November 2026.

| Pemeriksaan | Hasil |
|---|---|
| `npm test` di `contracts/` | 71 lulus (63 aturan, 2 uji banding, 6 gas) |
| Uji banding 200 pertandingan acak | 5.300 langkah, papan identik di setiap langkah; 1.500 posisi sembarang identik |
| `npm run typecheck` dan `npm run build` di `web/` | Lulus |
| Kode wallet dev di bundle produksi | Tidak ada (modul dan teks dialognya terbuang) |
| Build produksi tanpa alamat mainnet | Banner "not on BOT Chain yet", latihan tetap jalan, tanpa error console |
| Pertandingan Ringkas penuh di browser, dua dev wallet di dua tab | Meja #11: 18 langkah, seri 25–25. Meja #12 (lewat "Offer a return game"): 25 langkah, Utara menang 34–16. Papan replay = papan chain |
| Tab lawan memperbarui diri dan memutar animasi langkah yang sama | Berhasil |
| Meja khusus satu alamat, duduk dari lobi, batal meja, menyerah dengan konfirmasi | Berhasil |
| Klaim menang waktu (meja Kilat, jam chain dimajukan 200 detik) | Tombol muncul, klaim berhasil, kedua sisi melihat hasilnya |
| Mode latihan sampai selesai, di 375 px | Berhasil ("The computer won, 31 to 19") |
| Putar ulang: mainkan otomatis, maju/mundur per langkah, lompat ke awal/akhir | Berhasil |
| Keyboard: Tab ke lubang yang menyala, Enter menebar | Berhasil di halaman aturan |
| Nickname: validasi 20 byte, simpan on-chain, tampil di header | Berhasil |
| Viewport 375 px, 768 px, 1440 px | Tanpa scroll horizontal; papan tegak di 375 px |
| Screenshot README (13 gambar) | Diambil dengan Chromium headless dari chain lokal, setiap gambar dibuka dan diperiksa, semua tautan gambar di README mengarah ke file yang ada |
| Kontras warna | 19 pasangan lulus WCAG AA |

### Biaya gas terukur (20 gwei)

| Aksi | Gas | BOT |
|---|---|---|
| Deploy | 2.527.155 | 0,051 |
| Buka meja (pertama kali / berikutnya) | 226.524 / 127.895 | 0,0045 / 0,0026 |
| Duduk (pertama kali / berikutnya) | 135.177 / 70.748 | 0,0027 / 0,0014 |
| Satu langkah (median 5.300 langkah) | 56.050 | 0,0011 |
| Satu langkah (rata-rata / p95) | 59.254 / 76.589 | 0,0012 / 0,0015 |
| Langkah terpanjang di posisi nyata (856 biji) | 361.609 | 0,0072 |
| Langkah yang berhenti di batas tebar (kasus terburuk) | 469.994 | 0,0094 |
| Nickname / menyerah | 49.051 / 53.999 | 0,0010 / 0,0011 |

Batas gas blok BOT Chain 35.000.000 (dibaca dari RPC mainnet); langkah terburuk memakai 1,3%.

## Yang belum dikerjakan

### M3 — Testnet
- [ ] **Kamu:** setup repo git dari folder `dakon/` dan hubungkan ke Vercel (Root Directory `web`).
- [ ] **Kamu:** siapkan wallet deployer, ambil BOT testnet di `https://faucet.botchain.ai/basic`.
- [ ] **Kamu:** salin `contracts/.env.example` menjadi `.env`, isi `PRIVATE_KEY`.
- [ ] **Kamu:** jalankan `npm run deploy:testnet` di `contracts/`.
- [ ] **Saya:** uji dengan MetaMask atau BO Wallet sungguhan di testnet (`VITE_CHAIN=testnet`), termasuk dua wallet di dua perangkat.
- [ ] **Saya:** siapkan verifikasi source di explorer BOT Chain (`hardhat-verify` atau unggah manual).

### M4 — Mainnet
- [ ] **Kamu:** buat group project. **Wajib sebelum deploy mainnet.**
- [ ] **Kamu:** isi BOT mainnet (± 0,06 BOT cukup untuk deploy) lewat B DEX atau bridge.
- [ ] **Kamu:** jalankan `npm run deploy:mainnet`, lalu commit `deployments/botchain.json` dan `web/src/config/deployments.json`.
- [ ] **Saya:** verifikasi source contract di `scan.botchain.ai`.

### M5 — Peluncuran
- [ ] **Kamu:** buat akun X Dakon; isi URL-nya di `web/src/config/site.ts` (`xUrl`).
- [ ] **Saya:** draft minimal 5 post, termasuk pengumuman dengan kalimat "Officially launched on BOT Chain Mainnet."
- [ ] **Kamu:** publikasikan post.
- [ ] **Kamu:** ajak 2–3 lawan dengan wallet sendiri untuk menyelesaikan satu pertandingan Ringkas (memenuhi 3 wallet dan 5 transaksi).
- [ ] **Saya:** gambar Open Graph untuk pratinjau tautan.
- [ ] **Saya:** audit akhir terhadap checklist eligibility di dokumen program.

## Hal yang diketahui dan belum ditangani

- **Wallet sungguhan belum diuji.** Semua langkah diuji lewat akun node Hardhat, bukan ekstensi wallet.
- **Reduced motion belum dicek di browser.** Jalurnya ada (papan langsung ke hasil, jalur tebar disorot), tetapi preferensi itu tidak bisa diemulasikan di panel uji.
- **Kegagalan RPC belum dicoba langsung.** Pesan "Could not reach the chain" dengan tombol coba lagi dan papan terakhir tetap tampil sudah ada di kode, tetapi node lokal tidak dimatikan saat uji agar data uji tidak hilang.
- **Animasi melambat bila tab tersembunyi** (browser menahan timer). Papan tetap benar karena selalu disamakan dengan chain.
- **Linter menyisakan 3 peringatan**, tanpa error (`set-state-in-effect` dua kali, `only-export-components` sekali; pola yang sama dengan Sambung).
- **Bundle JS 623 kB (188 kB gzip)**, sebagian besar dari viem. Belum dipecah.
- **Lobi memuat maksimal 200 meja terbaru.** Undangan untukmu dicari di 200 meja terbaru itu.
- **Hitungan langkah di halaman meja dibaca ulang tiap 2,5 detik** selama permainan berjalan; di mainnet ini dua panggilan `eth_call` per tab yang terbuka.
- **Kriteria ketujuh program** belum tercantum di materi.

## Keputusan yang sudah diambil

| Keputusan | Alasan |
|---|---|
| Tebar searah jarum jam; lumbung di kiri pemain; baris sendiri selalu di dekat penonton | Mengikuti kebiasaan congklak/congkak; hanya tampilan, aturan tidak berubah |
| Ukuran default Ringkas | Pertandingan ± 20 langkah, cocok untuk percobaan pertama |
| Batas tebar 1.200 biji per langkah, lalu giliran selesai di tempat | Tidak ada langkah yang bisa kehabisan gas. 40.000 pertandingan acak tidak pernah lewat 365 biji; pencarian posisi tidak menemukan putaran tanpa akhir |
| Lubang asal tidak dilewati saat tebar memutar | Aturan PRD tidak menyebutnya; ditulis jelas di halaman aturan |
| Langkah terlambat tetap sah selama lawan belum mengklaim | Pertandingan tidak pernah macet; klaim adalah hak lawan |
| Skor lumbung terbaik hanya dari permainan yang selesai di papan | Menyerah atau habis waktu tidak mencerminkan skor |
| Log langkah 1 byte: bit 7 = Utara, sisanya nomor lubang | Daftar langkah bisa dibaca tanpa memutar ulang |
| Tambahan fungsi baca `simulateMove` (pure) | Siapa pun bisa memeriksa aturan contract; dipakai uji banding untuk posisi sembarang |
| Mesin TypeScript dimuat langsung oleh test Hardhat | Node 22.18 membuang tipe secara bawaan; satu sumber aturan untuk web dan test |
| Lubang = `<button>` HTML di atas SVG | Keyboard, fokus, dan label pembaca layar alami |
| Hitung mundur pakai jam chain | Jam komputer pemain bisa melenceng |
| Port lokal 8546 (node) dan 5174 (Vite) | Berdampingan dengan project lain |
| Hash routing, tanpa WalletConnect, font di-host sendiri, UI Inggris, EVM `paris`, deploy oleh pemilik | Sama dengan Sambung (pola infrastruktur) |

## Cara melanjutkan

Chain lokal tidak menyimpan data: setiap kali node dihentikan, deploy dan seed harus diulang.

```bash
cd contracts
npm run node
```

```bash
cd contracts
npm run deploy:local
npm run seed:local
```

```bash
cd web
npm run dev
```

Buka `http://localhost:5174`, klik **Connect wallet**, pilih salah satu "Dev wallet". Untuk bermain dua sisi, buka tab kedua dan pilih dev wallet lain (lewat **Disconnect** dulu, karena tab berbagi pilihan wallet terakhir).

Kalau contract diubah: ubah juga `web/src/engine/rules.ts`, jalankan `npm test` (uji banding akan menangkap perbedaan), lalu `npm run export-abi`.

## Informasi jaringan

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 677 | 968 |
| RPC | `https://rpc.botchain.ai` | `https://rpc.bohr.life` |
| Explorer | `https://scan.botchain.ai` | `https://scan.bohr.life` |

Alamat contract: belum ada di testnet maupun mainnet.
