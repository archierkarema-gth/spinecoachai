import type { SchrothExercise } from "@/lib/schroth-schemas";

/**
 * Six-move Schroth-inspired corrective breathing routine. Static reference
 * content (like exercise-seed.ts) — not stored in IndexedDB, only the daily
 * completion checklist (schrothLogs) is. See schroth-schemas.ts for the
 * guardrail note on why every cue here is generic, not curve-targeted.
 */
export const SCHROTH_SEED: SchrothExercise[] = [
  {
    id: "schroth-elongasi-aktif",
    name: "Elongasi Aktif",
    durationSeconds: 90,
    breaths: 6,
    position: "Duduk tegak di kursi, kaki rata di lantai, tangan di paha.",
    purpose: "Membangun kesadaran postur memanjang sebelum latihan napas lain.",
    description:
      "Fondasi Schroth: memanjangkan tulang belakang secara aktif (bukan menarik bahu ke atas) sambil menjaga napas tetap tenang.",
    cues: [
      "Bayangkan ubun-ubun ditarik lembut ke langit-langit",
      "Bahu tetap turun & rileks, jangan ikut naik",
      "Napas biasa lewat hidung, jangan ditahan",
    ],
    contraindications: ["Pusing saat duduk tegak lama"],
  },
  {
    id: "schroth-rab",
    name: "Napas Rotasi Angular (RAB)",
    durationSeconds: 180,
    breaths: 10,
    position: "Duduk atau berdiri tegak, satu tangan di masing-masing sisi rusuk.",
    purpose: "Melatih ekspansi rusuk yang lebih merata kiri-kanan lewat napas terarah.",
    description:
      "Teknik napas Schroth klasik: arahkan napas ke sisi rusuk yang terasa lebih rata/tertekan di bawah tanganmu sendiri, bukan instruksi baku dari aplikasi — sesuaikan dengan arahan fisioterapismu.",
    cues: [
      "Tarik napas lambat, rasakan rusuk mengembang di bawah telapak tangan",
      "Buang napas panjang lewat mulut sambil rileks",
      "Fokus pada sisi yang terasa kurang bergerak saat napas masuk",
    ],
    contraindications: ["Pusing berat saat napas dalam", "Sesak napas"],
  },
  {
    id: "schroth-muscle-cylinder",
    name: "Aktivasi Muscle Cylinder",
    durationSeconds: 120,
    breaths: 8,
    position: "Berdiri, kaki selebar pinggul, lutut sedikit ditekuk.",
    purpose: "Mengaktifkan otot batang tubuh secara simetris sebagai satu \"silinder\".",
    description:
      "Kontraksi ringan otot perut, punggung, dan panggul bersamaan — menstabilkan batang tubuh tanpa membungkuk atau melengkung berlebih.",
    cues: [
      "Kencangkan perut ringan seperti memakai korset otot",
      "Panggul netral, jangan dimajukan/dimundurkan",
      "Napas tetap jalan, jangan tahan napas saat mengencangkan",
    ],
    contraindications: ["Nyeri pinggang tajam saat mengencangkan otot"],
  },
  {
    id: "schroth-koreksi-panggul",
    name: "Napas Koreksi Panggul",
    durationSeconds: 90,
    breaths: 6,
    position: "Berdiri di depan cermin (opsional), kaki selebar pinggul.",
    purpose: "Kesadaran level panggul kiri-kanan, dikombinasikan dengan napas tenang.",
    description:
      "Cek posisi panggul secara visual/perasaan sendiri, coba ratakan dengan gerak kecil dan halus, lalu tahan sambil bernapas normal.",
    cues: [
      "Rasakan berat badan merata di kedua kaki",
      "Gerakan koreksi kecil saja, jangan dipaksa",
      "Napas 3 hitungan tarik, 4 hitungan buang",
    ],
    contraindications: ["Vertigo", "Riwayat jatuh tanpa pegangan"],
  },
  {
    id: "schroth-postur-dinding",
    name: "Postur Dinding Simetris",
    durationSeconds: 90,
    breaths: 6,
    position: "Berdiri membelakangi dinding, tumit-panggul-punggung-kepala menyentuh dinding.",
    purpose: "Umpan balik eksternal (dinding) untuk kesadaran postur simetris.",
    description:
      "Gunakan dinding sebagai referensi netral tubuh, lalu napas dalam sambil menjaga kontak dengan dinding tanpa menekan berlebihan.",
    cues: [
      "Jangan paksa punggung bawah menempel penuh — cukup nyaman",
      "Bahu kiri-kanan setinggi mungkin, rileks",
      "Napas ke rusuk, bukan hanya ke dada atas",
    ],
    contraindications: ["Nyeri saat berdiri lama menempel dinding"],
  },
  {
    id: "schroth-napas-pemulihan",
    name: "Napas Pemulihan",
    durationSeconds: 120,
    breaths: 8,
    position: "Berbaring telentang, lutut ditekuk, telapak kaki di lantai.",
    purpose: "Menutup sesi dengan napas diafragma penuh, menurunkan tegangan otot.",
    description:
      "Napas dalam dan lambat untuk relaksasi, menutup sesi Schroth hari ini.",
    cues: [
      "Satu tangan di dada, satu di perut — rasakan tangan di perut lebih banyak bergerak",
      "Buang napas 2x lebih panjang dari tarikan napas",
      "Rileks seluruh tubuh setiap buang napas",
    ],
    contraindications: ["Sesak saat berbaring telentang"],
  },
];
