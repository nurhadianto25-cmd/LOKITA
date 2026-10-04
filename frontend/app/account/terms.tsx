import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";

const SECTIONS: [string, string][] = [
  ["Akun Pengguna", "Satu pengguna memiliki satu akun yang dapat berfungsi sebagai pembeli, penjual, atau keduanya. Anda bertanggung jawab menjaga kerahasiaan PIN Anda."],
  ["Komunitas", "LOKITA bersifat berbasis komunitas. Anda hanya dapat mengakses data komunitas tempat Anda menjadi anggota."],
  ["Penjual & Pembeli", "Penjual wajib menyediakan informasi produk yang akurat dan memenuhi pesanan. Pembeli wajib memberikan informasi pengiriman yang benar."],
  ["Transaksi & Pembayaran", "Pembayaran mendukung Tunai/COD dan QRIS. LOKITA menghubungkan pembeli dan penjual; penyelesaian pembayaran dilakukan antar pihak sesuai metode yang dipilih."],
  ["Pengiriman", "Pengiriman dikelola penjual. Fitur 'Titip di Rumah' membutuhkan izin pembeli dan dua foto bukti."],
  ["Perilaku yang Dilarang", "Penipuan, konten melanggar hukum, pelecehan, dan penyalahgunaan platform dilarang dan dapat berakibat pembatasan atau pemblokiran akun."],
  ["Sengketa & Moderasi", "Laporan ditinjau melalui alur moderasi. Bukti meliputi ID pesanan, chat, foto bukti, dan status. Tersedia mekanisme banding."],
  ["Penghentian Akun", "Anda dapat menghapus akun kapan saja. LOKITA dapat membatasi akun yang melanggar ketentuan."],
  ["Batasan Tanggung Jawab", "LOKITA menyediakan platform penghubung dan tidak bertanggung jawab atas kualitas barang di luar ketentuan yang berlaku."],
  ["Kontak", "Dukungan: dukungan@lokita.app"],
];

export default function Terms() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScreenHeader title="Syarat & Ketentuan" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 18 }}>
        <Text style={styles.updated}>Berlaku efektif Juni 2026</Text>
        {SECTIONS.map(([t, b]) => (
          <View key={t} style={{ gap: 4 }}>
            <Text style={styles.h}>{t}</Text>
            <Text style={styles.p}>{b}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  updated: { fontSize: 12, color: c.muted },
  h: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  p: { fontSize: 14, color: c.onSurfaceSecondary, lineHeight: 21 },
}));
