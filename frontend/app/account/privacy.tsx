import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";

const SECTIONS: [string, string][] = [
  ["Identitas Pengembang", "LOKITA dioperasikan oleh tim LOKITA. Pertanyaan privasi: privasi@lokita.app"],
  ["Data yang Kami Kumpulkan", "Nomor telepon, nama, alamat pengiriman, lokasi perkiraan untuk bukti pengiriman, foto produk & bukti penitipan, data pesanan & pembayaran (COD/QRIS), pesan chat, serta informasi perangkat/sesi."],
  ["Tujuan Penggunaan", "Autentikasi akun, menghubungkan pembeli dengan penjual dalam komunitas, memproses pesanan & pembayaran, mengantarkan pesanan, menyediakan bukti pengiriman, serta menjaga keamanan dan moderasi."],
  ["Pembagian Data", "Data pesanan dibagikan antara pembeli dan penjual yang terkait pada pesanan tersebut. Kami tidak menjual data pribadi Anda. Foto bukti penitipan bersifat privat dan hanya dapat diakses pihak yang berwenang atas pesanan."],
  ["Penyedia Pihak Ketiga", "Penyimpanan objek untuk foto (terenkripsi saat transit). Tidak ada SDK iklan yang digunakan pada tahap ini."],
  ["Keamanan", "PIN disimpan dalam bentuk hash (bcrypt), komunikasi dienkripsi melalui HTTPS, dan akses data dibatasi berdasarkan peran (RBAC)."],
  ["Penyimpanan & Penghapusan", "Data pribadi disimpan selama akun aktif. Anda dapat menghapus akun kapan saja melalui menu Akun → Hapus Akun. Catatan transaksi tertentu dapat disimpan untuk kewajiban hukum/keamanan dengan identitas dianonimkan."],
  ["Hak Anda", "Anda berhak mengakses, memperbarui, dan menghapus data Anda, serta mengatur preferensi notifikasi di dalam aplikasi."],
  ["Penghapusan Akun Eksternal", "Permintaan penghapusan akun juga dapat diajukan melalui halaman web publik: https://lokita.app/hapus-akun"],
];

export default function Privacy() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScreenHeader title="Kebijakan Privasi" />
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
