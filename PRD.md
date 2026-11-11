# PRD — Dakon

**Congklak dua pemain yang setiap langkahnya diwasiti smart contract di BOT Chain.**
Versi 1.1 · 11 November 2026 · Project 2 dari 5 (BOT Chain Ecosystem Support Program)

**Status: M2 selesai — 55%.** Contract, mesin TypeScript, dan seluruh UI jadi; 71 test lulus termasuk uji banding 200 pertandingan acak; dua pertandingan Ringkas penuh sudah dimainkan antar-wallet di chain lokal lewat browser. Belum di-deploy ke testnet maupun mainnet. Rincian di [PROGRESS.md](PROGRESS.md).

---

## 1. Ringkasan

Dakon adalah congklak — permainan biji tradisional Nusantara — yang dimainkan antar-wallet. Satu pemain membuka meja, pemain lain duduk, lalu keduanya bergiliran mengambil biji dari satu lubang dan menebarkannya keliling papan. Setiap langkah adalah satu transaksi. Smart contract menjalankan seluruh aturan tebar, tembak, dan giliran, sehingga tidak ada langkah curang yang bisa lolos dan hasil akhirnya tercatat permanen.

Tidak ada taruhan dan tidak ada token. Yang dipertaruhkan hanya rekor menang-kalah di papan peringkat.

"Dakon" adalah nama Jawa untuk congklak.

| | |
|---|---|
| Kategori | GameFi |
| Jaringan | BOT Chain Mainnet (chain ID 677) |
| Bentuk | Satu smart contract + satu web app |
| Token | Tidak ada. Tidak ada biaya selain gas |
| Bahasa UI | Inggris; nama, istilah permainan, dan motif Indonesia |
| Folder | `D:\Project Web3\dakon` |

## 2. Latar belakang dan tujuan

### Masalah
Game di direktori BOT Chain didominasi catur (lima project), suit, dan tebak-tebakan bertaruh. Tidak ada satu pun permainan papan tradisional Asia Tenggara, dan sebagian besar game di sana memakai taruhan BOT sebagai daya tarik utama.

### Tujuan produk
1. Menghadirkan permainan yang aturannya sepenuhnya ditegakkan on-chain, bukan sekadar mencatat skor akhir.
2. Bisa dicoba dalam sepuluh detik tanpa wallet lewat mode latihan, lalu dilanjutkan ke pertandingan antar-wallet.
3. Menghasilkan rekam pertandingan yang bisa diputar ulang langkah demi langkah langsung dari data chain.
4. Memenuhi seluruh kriteria eligibility program lewat pemakaian wajar.

### Bukan tujuan (v1)
- Tidak ada taruhan, hadiah, token, atau NFT.
- Tidak ada congklak multi-babak dengan "lubang hangus".
- Tidak ada rating Elo, turnamen, atau matchmaking otomatis.
- Tidak ada chat antar-pemain.
- Tidak ada backend, database, atau indexer.

## 3. Pengguna sasaran

| Persona | Kebutuhan | Yang didapat |
|---|---|---|
| **Yang penasaran** | Ingin tahu cara mainnya dulu | Mode latihan lawan komputer, tanpa wallet dan tanpa gas |
| **Pembuka meja** | Ingin menantang teman | Membuka meja dalam satu transaksi dan mengirim tautan undangan |
| **Penantang** | Ingin cepat main | Daftar meja terbuka; duduk dan langsung jalan duluan |
| **Penonton** | Ingin menonton atau belajar | Pertandingan berjalan dan putar ulang pertandingan selesai, tanpa wallet |

## 4. Pemetaan ke kriteria program

| Kriteria | Cara dipenuhi |
|---|---|
| Akun X aktif, 5 post | Akun X khusus Dakon. Draft post disiapkan di tahap akhir. **Dikerjakan olehmu.** |
| Pengumuman mainnet | Post dengan kalimat wajib "Officially launched on BOT Chain Mainnet." |
| BOT Chain di website | Footer menampilkan nama BOT Chain dengan tautan ke `https://botchain.ai` dan `https://scan.botchain.ai` |
| Produk usable | Frontend lengkap, connect wallet, pertandingan bisa dimainkan sampai selesai |
| Independen dan orisinal | Tidak ada congklak/mancala di direktori; mesin tebar-beranting ditulis dari nol; desain dan copy berbeda dari Sambung |
| 3 wallet, 5 transaksi | Satu pertandingan sudah puluhan transaksi dari 2 wallet; wallet ketiga cukup membuka atau duduk di meja lain |
| Deployment + verification | Contract di-deploy ke mainnet dan source-nya diverifikasi di scan.botchain.ai |

## 5. Aturan permainan

Varian yang dipakai: **congklak satu babak**. Aturan ini dijalankan persis sama oleh contract dan oleh frontend.

### 5.1 Papan

| Ukuran | Lubang per sisi | Biji per lubang | Total biji |
|---|---|---|---|
| **Ringkas** | 5 | 5 | 50 |
| **Klasik** | 7 | 7 | 98 |

Setiap pemain memiliki satu baris lubang dan satu **lumbung**. Pembuka meja duduk di sisi Selatan, penantang di sisi Utara. **Penantang jalan duluan**, sebagai imbalan atas pembuka yang sudah memilih ukuran dan tempo.

### 5.2 Satu giliran
1. Pilih satu lubang milik sendiri yang berisi biji. Ambil semua bijinya.
2. Tebar satu per satu ke lubang berikutnya mengikuti arah putaran, termasuk ke lumbung sendiri. **Lumbung lawan dilewati.**
3. Yang terjadi selanjutnya ditentukan tempat biji terakhir jatuh:

| Biji terakhir jatuh di | Akibat |
|---|---|
| Lumbung sendiri | **Jalan lagi**: pilih lubang lain |
| Lubang berisi (sisi mana pun) | **Beranting**: ambil semua biji di lubang itu dan lanjut menebar |
| Lubang kosong di sisi sendiri | **Tembak**: biji itu beserta semua biji di lubang seberangnya masuk lumbung. Bila seberangnya kosong, biji tetap di tempat. Giliran selesai |
| Lubang kosong di sisi lawan | **Mati**: giliran selesai |

### 5.3 Akhir permainan
- Permainan selesai saat pemain yang harus jalan tidak punya biji di sisinya.
- Biji yang tersisa di sisi lawan masuk ke lumbung lawan.
- Pemenang adalah pemilik lumbung terbanyak. Jumlah sama berarti seri.

### 5.4 Tempo dan pertandingan yang ditinggal

Tempo dipilih saat membuka meja dan berlaku per langkah.

| Tempo | Batas per langkah |
|---|---|
| Kilat | 3 menit |
| Biasa | 1 jam |
| Santai | 24 jam |

- Bila pemain yang harus jalan melewati batas, lawannya boleh **mengklaim menang waktu**.
- Pemain boleh **menyerah** kapan saja.
- Meja yang belum ada penantangnya boleh **dibatalkan** pembukanya.

## 6. Lingkup fitur

### 6.1 Masuk v1

**F1 — Mode latihan.**
Main melawan komputer di browser, tanpa wallet dan tanpa transaksi. Komputer memilih langkah dengan menimbang hasil satu langkah ke depan. Diberi label jelas bahwa hasilnya tidak tercatat di chain.

**F2 — Membuka meja.**
Pilih ukuran papan dan tempo. Meja bisa terbuka untuk siapa saja atau dikhususkan untuk satu alamat wallet.

**F3 — Duduk di meja.**
Wallet lain duduk di meja terbuka; pertandingan langsung dimulai dan penantang jalan pertama.

**F4 — Bermain.**
Klik lubang, konfirmasi di wallet, lalu biji ditebar dengan animasi yang mengikuti jalur sebenarnya. Lubang yang boleh dipilih disorot; lubang yang tidak boleh dipilih tidak bisa diklik.

**F5 — Menyerah, klaim waktu, batal.**
Tiga jalan keluar agar tidak ada pertandingan yang menggantung.

**F6 — Menonton dan putar ulang.**
Siapa pun bisa membuka pertandingan yang sedang berjalan. Pertandingan selesai bisa diputar ulang maju-mundur per langkah, direkonstruksi dari daftar langkah di chain.

**F7 — Papan peringkat.**
Menang, kalah, seri, dan skor lumbung tertinggi per wallet, dibaca dari contract.

**F8 — Meja saya.**
Pertandingan yang sedang menunggu giliranmu, yang menunggu lawan, dan riwayat. Termasuk nama panggilan (maksimal 20 byte).

**F9 — Halaman aturan.**
Penjelasan aturan dengan papan kecil yang bisa dicoba, karena tidak semua pengunjung mengenal congklak.

### 6.2 Tidak masuk v1 (kandidat v2)
- Congklak multi-babak dengan lubang hangus.
- Rating dan musim peringkat.
- Efek suara.
- Papan sembilan lubang.

## 7. Alur pengguna

### 7.1 Pertama kali datang
1. Buka situs. Papan di beranda langsung bisa dimainkan melawan komputer.
2. Setelah satu-dua langkah, muncul ajakan: buka meja atau duduk di meja yang menunggu.

### 7.2 Membuka meja
1. **Open a table** → hubungkan wallet bila perlu.
2. Pilih ukuran, tempo, dan (opsional) alamat lawan.
3. Konfirmasi → masuk ke halaman meja dalam keadaan menunggu, dengan tautan undangan untuk disalin.

### 7.3 Bertanding
1. Penantang membuka tautan atau memilih meja dari lobi → **Sit down** → konfirmasi.
2. Papan menampilkan giliran siapa dan sisa waktu.
3. Pemain yang jalan mengklik lubang → konfirmasi → animasi tebar → giliran berpindah atau jalan lagi.
4. Halaman lawan memperbarui diri otomatis dan memutar animasi langkah yang sama.
5. Saat selesai: spanduk hasil, skor kedua lumbung, tombol putar ulang dan tanding ulang.

### 7.4 Keadaan yang ditangani
Tanpa wallet · jaringan salah · bukan giliranmu · lubang kosong · meja khusus untuk alamat lain · meja sudah terisi orang lain saat kamu mengklik · transaksi ditolak · transaksi gagal · RPC gagal · waktu lawan habis · pertandingan tidak ditemukan · saldo BOT tidak cukup.

## 8. Halaman dan layar

| Rute | Isi |
|---|---|
| `#/` Lobi | Papan latihan sebagai pembuka, tombol buka meja, daftar meja menunggu, pertandingan berjalan, pertandingan terakhir selesai |
| `#/table/:id` Meja | Papan, dua pemain dan lumbungnya, penanda giliran, hitung mundur, daftar langkah, aksi menyerah/klaim/batal, tautan undangan; setelah selesai: hasil dan putar ulang |
| `#/practice` Latihan | Papan penuh lawan komputer, pilihan ukuran |
| `#/rules` Aturan | Aturan bergambar dengan papan contoh |
| `#/players` Peringkat | Tabel pemain |
| `#/me` Meja saya | Giliranmu, menunggu lawan, riwayat, nama panggilan |
| Footer (semua halaman) | "Built on BOT Chain" dengan tautan wajib, alamat contract, akun X |

## 9. Arah desain

Sengaja dibuat berlawanan dengan Sambung agar kedua project tidak terlihat satu cetakan.

| | Sambung | Dakon |
|---|---|---|
| Suasana | Kertas terang, tenang | Panggung gelap, taktil |
| Motif | Benang merah | Papan kayu berukir dan pola kawung |
| Tipografi | Serif buku | Grotesk berkarakter, angka tabular |
| Tata letak | Kolom baca | Papan di tengah sebagai pusat |
| Gerak | Halus, jarang | Biji melompat mengikuti jalur tebar |

- **Tiga atribut:** taktil, hangat, fokus.
- **Motif:** papan kayu jati dengan lubang cekung; ornamen kawung (empat lonjong, yang kebetulan menyerupai lubang congklak) dipakai tipis sebagai latar.
- **Warna:** latar cokelat-arang gelap, kayu jati untuk papan, kuningan sebagai aksen tunggal, biji gading.
- **Papan:** digambar dengan SVG, bukan gambar bitmap, agar tajam di semua ukuran.
- **Mobile:** papan diputar vertikal agar lubang tetap cukup besar untuk disentuh (minimal 44 px).
- **Gerak:** animasi tebar bisa dipercepat atau dilewati; dimatikan bila pengguna memilih reduced motion, diganti sorotan jalur.
- **Yang dihindari:** tampilan kasino, neon, kilau koin — apa pun yang memberi kesan judi.

Kontras teks minimal WCAG AA. Seluruh permainan bisa dijalankan dengan keyboard: lubang adalah tombol.

## 10. Spesifikasi smart contract

**Contract:** `Dakon.sol` · Solidity 0.8.24 · EVM target `paris` · tanpa dependensi eksternal · tanpa fungsi payable.

### 10.1 Penyimpanan
- Papan disimpan sebagai 16 angka 8-bit dalam **satu slot** (7 lubang + lumbung per sisi), sehingga satu langkah hanya menulis ulang satu slot papan.
- Daftar langkah disimpan sebagai `bytes`, satu byte per langkah, untuk putar ulang.
- Proses tebar dihitung di memori. Ada batas langkah tebar per transaksi sebagai pengaman gas: **1.200 biji**. Bila batas tercapai saat biji terakhir jatuh di lubang berisi, giliran selesai di tempat (kedua mesin menjalankan aturan yang sama). Dalam 40.000 pertandingan acak tidak ada langkah yang lewat 365 biji, dan pencarian posisi Klasik tidak menemukan langkah lebih dari 856 biji.

### 10.2 Fungsi tulis

| Fungsi | Aturan |
|---|---|
| `openTable(size, pace, invited)` | `size` 5 atau 7; `pace` 0–2; `invited` alamat nol berarti terbuka |
| `cancelTable(id)` | Hanya pembuka, selama belum ada penantang |
| `sit(id)` | Bukan pembuka; cocok dengan `invited` bila diisi; memulai pertandingan |
| `play(id, hole)` | Harus gilirannya; lubang milik sendiri dan berisi; menjalankan seluruh aturan 5.2 dan 5.3 |
| `resign(id)` | Salah satu pemain, selama pertandingan berjalan |
| `claimTimeout(id)` | Pemain yang tidak sedang jalan, setelah batas waktu lawan lewat |
| `setNickname(name)` | 0–20 byte |

### 10.3 Fungsi baca

RPC mainnet mematikan `eth_getLogs`, jadi semua data dibaca lewat fungsi view.

`tableCount` · `getTable(id)` · `getTables(cursor, limit)` · `getTablesByIds(ids[])` · `tablesOf(wallet)` · `getMoves(id)` · `previewMove(id, hole)` · `playerOf(wallet)` · `getPlayers(cursor, limit)` · `getNicknames(wallets[])` · `stats()`

Tambahan saat implementasi: `simulateMove(size, board, side, hole)` (pure) — menjalankan aturan pada papan apa pun, agar siapa pun bisa memeriksa aturan contract; dipakai uji banding untuk posisi sembarang.

### 10.4 Event
`TableOpened` · `TableCancelled` · `PlayerSat` · `MovePlayed` · `GameEnded` · `NicknameSet` — untuk keterbacaan di explorer.

### 10.5 Keamanan dan keadilan
- Tidak ada dana yang disimpan, jadi tidak ada yang bisa dicuri.
- Congklak adalah permainan informasi sempurna tanpa unsur acak: tidak butuh randomness on-chain dan tidak ada yang bisa di-front-run.
- Tidak ada peran pemilik. Setelah di-deploy, tidak seorang pun bisa mengubah aturan atau hasil.
- Pertandingan yang ditinggal selalu bisa diakhiri lewat klaim waktu.

### 10.6 Biaya terukur (gas 20 gwei, BOT ≈ $12,6)

Diukur oleh `contracts/test/Dakon.gas.test.js` dan uji banding (5.300 langkah) pada 11 November 2026.

| Aksi | Gas | BOT | Perkiraan awal |
|---|---|---|---|
| Deploy contract | 2.527.155 | 0,051 | 0,04–0,07 |
| Membuka meja (wallet pertama kali / berikutnya) | 226.524 / 127.895 | 0,0045 / 0,0026 | ± 0,003 |
| Duduk (wallet pertama kali / berikutnya) | 135.177 / 70.748 | 0,0027 / 0,0014 | ± 0,002 |
| Satu langkah (median / rata-rata / p95) | 56.050 / 59.254 / 76.589 | 0,0011 / 0,0012 / 0,0015 | ± 0,0012 |
| Langkah terpanjang di posisi nyata (856 biji) | 361.609 | 0,0072 | sampai ± 0,006 |
| Langkah yang berhenti di batas tebar (kasus terburuk) | 469.994 | 0,0094 | — |
| Langkah terakhir pertandingan | 91.459 | 0,0018 | — |
| Nickname / menyerah | 49.051 / 53.999 | 0,0010 / 0,0011 | — |

Batas gas blok BOT Chain 35.000.000 (dibaca dari `rpc.botchain.ai`); langkah terburuk memakai 1,3%.

Panjang pertandingan (40.000 pertandingan acak di mesin TypeScript): Ringkas median 20 langkah (5–95%: 13–28); Klasik median 36 langkah (25–48).

## 11. Arsitektur teknis

```
dakon/
├── PRD.md
├── README.md
├── PROGRESS.md
├── contracts/            Hardhat 2 + ethers + chai (JavaScript)
│   ├── contracts/Dakon.sol
│   ├── test/             aturan, akhir permainan, waktu, dan uji banding mesin
│   ├── scripts/          deploy, seed, export-abi
│   └── .env.example      (PRIVATE_KEY diisi olehmu, tidak pernah di-commit)
└── web/                  Vite + React + TypeScript + viem
    └── src/
        ├── engine/       aturan congklak dalam TypeScript + lawan komputer
        ├── config/       chain, alamat contract, ABI
        ├── lib/          wallet, client baca, format
        ├── components/   papan SVG, lumbung, daftar meja
        ├── pages/
        └── styles/
```

- **Dua mesin, satu aturan.** Aturan ditulis dua kali: Solidity sebagai wasit, TypeScript untuk animasi, mode latihan, dan putar ulang. **Uji banding** memainkan ratusan pertandingan acak di keduanya dan menuntut papan identik setelah setiap langkah.
- **Pembaruan langsung:** halaman meja memeriksa chain tiap beberapa detik selama pertandingan berjalan; blok BOT Chain 0,75 detik membuat giliran terasa cepat.
- **Wallet:** EIP-6963 dengan cadangan `window.ethereum`; lapisan koneksinya memakai pola yang sudah teruji di Sambung, tampilannya dibuat baru.
- **Routing:** hash router. **Hosting:** Vercel, root directory `web`.
- **Wallet dev:** hanya di mode development pada chain lokal; tidak ikut build produksi.

## 12. Kebutuhan non-fungsional

| Aspek | Target |
|---|---|
| Ketepatan aturan | Mesin TypeScript dan contract identik di seluruh uji banding |
| Batas gas | Langkah terpanjang yang mungkin tetap di bawah batas blok, dibuktikan dengan test |
| Responsif | Papan bisa dimainkan di 375 px tanpa scroll horizontal |
| Aksesibilitas | Lubang sebagai tombol berlabel ("Hole 3, 7 seeds"), fokus terlihat, giliran diumumkan ke pembaca layar |
| Ketahanan | Kegagalan RPC menampilkan pesan dan tombol coba lagi; papan terakhir tetap tampil |

## 13. Tahapan dan progres

| Tahap | Isi | Progres |
|---|---|---|
| M0 | PRD | 5% — selesai |
| M1 | Contract, mesin TypeScript, uji banding lulus | 30% — selesai |
| M2 | **UI/UX lengkap: lobi, meja, latihan, aturan, peringkat; pertandingan penuh berjalan di chain lokal** | **55% — selesai** |
| M3 | Deploy testnet (968) + uji dengan dua wallet sungguhan | 70% — berikutnya |
| M4 | Deploy mainnet (677) + verifikasi source | 85% |
| M5 | Vercel produksi, pengumuman X, aktivitas on-chain, audit checklist | 100% |

**Titik lapor:** di akhir M2 saya berhenti dan memberi tahu kamu, supaya kamu bisa menyiapkan repo dan menghubungkannya.

## 14. Pembagian kerja

| Saya | Kamu |
|---|---|
| PRD, contract, mesin, test, frontend, script deploy | Membuat group project **sebelum** deploy mainnet |
| Uji lokal dan panduan uji testnet | Setup repo dan menghubungkan ke Vercel |
| Draft post X dan teks pengumuman | Membuat akun X dan mempublikasikan post |
| Panduan verifikasi contract | Menjalankan deploy dengan private key-mu sendiri |
| Audit checklist eligibility | Mengisi BOT untuk gas; mengajak lawan tanding sungguhan |

## 15. Risiko

| Risiko | Mitigasi |
|---|---|
| Beranting panjang memakan gas besar | Papan dihitung di memori dan ditulis sekali; batas langkah tebar; test khusus untuk kasus terburuk |
| Animasi tidak cocok dengan hasil contract | Uji banding dua mesin; setelah transaksi, papan selalu disamakan dengan data chain |
| Pertandingan ditinggal lawan | Batas waktu per langkah dan klaim menang waktu |
| Pengunjung tidak kenal congklak | Mode latihan di beranda dan halaman aturan interaktif |
| Dinilai mirip game catur atau dropfour yang sudah ada | Permainan berbeda, mesin tebar-beranting orisinal, mode latihan, putar ulang, identitas budaya |
| Dianggap judi | Tanpa taruhan sama sekali; desain menghindari estetika kasino |
| Banyak transaksi per pertandingan terasa merepotkan | Ukuran Ringkas sebagai default; gas per langkah kecil; animasi bisa dilewati |
| Perbedaan varian aturan antar-daerah | Varian ditetapkan tertulis di bagian 5 dan di halaman aturan |

## 16. Kriteria terima

1. Dua wallet bisa memainkan satu pertandingan Ringkas dari buka meja sampai ada pemenang.
2. Contract menolak: jalan di luar giliran, memilih lubang lawan, memilih lubang kosong, duduk di meja yang dikhususkan untuk orang lain, klaim waktu sebelum batas lewat.
3. Jalan lagi, beranting, tembak, dan mati berperilaku sesuai bagian 5 di contract maupun di animasi.
4. Uji banding mesin TypeScript terhadap contract lulus untuk minimal 200 pertandingan acak.
5. Pertandingan selesai bisa diputar ulang dari awal sampai akhir.
6. Mode latihan bisa dimainkan sampai selesai tanpa wallet.
7. Papan bisa dimainkan di 375 px dan dengan keyboard saja.
8. Footer memuat nama BOT Chain dan kedua tautan wajib.
9. Contract terverifikasi di scan.botchain.ai dan alamatnya tampil di situs.

## 17. Hal yang masih terbuka

- Apakah nilai tempo (3 menit, 1 jam, 24 jam) sudah pas.
- Nama akun X dan domain.
- Kriteria ketujuh program, yang belum tercantum di materi.

Sudah diputuskan di M2:
- Arah tebar yang ditampilkan: **searah jarum jam**, lumbung di kiri pemain, baris sendiri selalu di dekat penonton (penonton melihat Selatan di bawah).
- Ukuran default: **Ringkas**.
- Lubang asal ikut diisi bila tebar memutar penuh (tidak dilewati).
- Langkah yang terlambat tetap sah selama lawan belum mengklaim menang waktu.
- Skor lumbung terbaik di papan peringkat hanya dari pertandingan yang selesai di papan, bukan karena menyerah atau habis waktu.
