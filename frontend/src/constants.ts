export type Tone = "brand" | "success" | "warning" | "error" | "info" | "neutral" | "accent";

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  MENUNGGU_KONFIRMASI: { label: "Menunggu Konfirmasi", tone: "warning" },
  DIKONFIRMASI: { label: "Dikonfirmasi", tone: "info" },
  SEDANG_DIPROSES: { label: "Sedang Diproses", tone: "info" },
  SIAP_DIANTAR: { label: "Siap Diantar", tone: "info" },
  SEDANG_DIANTAR: { label: "Sedang Diantar", tone: "accent" },
  DISERAHKAN: { label: "Diserahkan", tone: "brand" },
  DITITIPKAN: { label: "Dititipkan", tone: "brand" },
  MENUNGGU_PENYELESAIAN: { label: "Menunggu Penyelesaian", tone: "warning" },
  SELESAI: { label: "Selesai", tone: "success" },
  DIBATALKAN: { label: "Dibatalkan", tone: "error" },
  DITOLAK: { label: "Ditolak", tone: "error" },
};

// forward flow for the timeline progress rail
export const FLOW = [
  "MENUNGGU_KONFIRMASI",
  "DIKONFIRMASI",
  "SEDANG_DIPROSES",
  "SIAP_DIANTAR",
  "SEDANG_DIANTAR",
  "MENUNGGU_PENYELESAIAN",
  "SELESAI",
];

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  UNPAID: { label: "Belum Dibayar (COD)", tone: "warning" },
  PAID: { label: "Lunas (COD)", tone: "success" },
  MENUNGGU_PEMBAYARAN: { label: "Menunggu Pembayaran", tone: "warning" },
  SEDANG_DIVERIFIKASI: { label: "Sedang Diverifikasi", tone: "info" },
  BERHASIL: { label: "Pembayaran Berhasil", tone: "success" },
  GAGAL: { label: "Pembayaran Gagal", tone: "error" },
  EXPIRED: { label: "Pembayaran Kadaluarsa", tone: "error" },
};

export const PRODUCT_STATUS: Record<string, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Tersedia", tone: "success" },
  LIMITED_STOCK: { label: "Stok Terbatas", tone: "warning" },
  SOLD_OUT: { label: "Stok Habis", tone: "error" },
  INACTIVE: { label: "Nonaktif", tone: "neutral" },
};

export const CATEGORY_ICONS: Record<string, string> = {
  Semua: "grid-outline",
  Makanan: "fast-food-outline",
  Minuman: "cafe-outline",
  Sayur: "leaf-outline",
  Buah: "nutrition-outline",
  Umum: "pricetag-outline",
  Jasa: "construct-outline",
};

export function rupiah(n: number): string {
  return "Rp" + Math.round(n || 0).toLocaleString("id-ID");
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
