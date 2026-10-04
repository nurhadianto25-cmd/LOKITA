import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, Linking, Platform } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Button, Badge, Card, Input, Field } from "@/src/components/ui";
import { Countdown } from "@/src/components/Countdown";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/auth";
import { api, fileUrl, uploadImage } from "@/src/api/client";
import { ORDER_STATUS, PAYMENT_STATUS, rupiah } from "@/src/constants";

export default function OrderDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [titipOpen, setTitipOpen] = useState(false);
  const [proofs, setProofs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  const q = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.get(`/orders/${id}`),
    refetchInterval: (query: any) => {
      const s = query.state.data?.status;
      return s && !["SELESAI", "DIBATALKAN", "DITOLAK"].includes(s) ? 5000 : false;
    },
  });
  const ratingQ = useQuery({ queryKey: ["rating", id], queryFn: () => api.get(`/ratings/order/${id}`), enabled: q.data?.status === "SELESAI" });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["buyer-orders-active"] });
  }

  const run = useMutation({
    mutationFn: ({ path, body }: any) => api.post(path, body ?? {}),
    onSuccess: () => { Haptics.selectionAsync().catch(() => {}); invalidate(); },
    onError: (e: any) => toast(e.message, "error"),
  });
  const submitRating = useMutation({
    mutationFn: () => api.post("/ratings", { order_id: id, stars, comment }),
    onSuccess: () => { toast("Terima kasih atas penilaian Anda", "success"); qc.invalidateQueries({ queryKey: ["rating", id] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (q.isLoading || !q.data) return <View style={styles.root}><ScreenHeader title="Pesanan" /><Loading /></View>;
  const o = q.data;
  const st = ORDER_STATUS[o.status] || { label: o.status, tone: "neutral" as const };
  const pay = PAYMENT_STATUS[o.payment_status];
  const isBuyer = user?.id === o.buyer_id;
  const isSeller = user?.id === o.seller_id;
  const terminal = ["SELESAI", "DIBATALKAN", "DITOLAK"].includes(o.status);
  const delivered = ["DISERAHKAN", "DITITIPKAN", "MENUNGGU_PENYELESAIAN"].includes(o.status);

  async function pickProof(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        toast("Izin ditolak. Buka Pengaturan untuk mengaktifkan.", "error");
        Linking.openSettings();
      } else {
        toast("Izin kamera/galeri diperlukan untuk foto bukti", "error");
      }
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (res.canceled || !res.assets?.[0]) return;
    setUploading(true);
    try {
      const up = await uploadImage(res.assets[0].uri, "proof", o.id);
      setProofs((p) => [...p, up.id].slice(0, 2));
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
    }
  }

  function submitTitip() {
    if (proofs.length < 2) return toast("Wajib 2 foto bukti", "error");
    run.mutate({ path: `/orders/${id}/titip`, body: { proof_file_ids: proofs } }, {
      onSuccess: () => { setTitipOpen(false); setProofs([]); invalidate(); toast("Pesanan dititipkan", "success"); },
    });
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={`Pesanan #${o.order_no}`} subtitle={isBuyer ? o.store_name : o.buyer_name}
        right={<Pressable testID="open-chat-btn" onPress={() => router.push(`/chat/${o.id}`)} style={styles.chatBtn}><Icon name="chatbubble-ellipses" size={20} color={colors.brandPrimary} /></Pressable>} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
        {/* status + timer */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Badge label={st.label} tone={st.tone} testID="order-status-badge" />
            {o.status === "MENUNGGU_KONFIRMASI" && o.seconds_to_confirm > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="time-outline" size={16} color={colors.warning} />
                <Countdown seconds={o.seconds_to_confirm} style={styles.timer} onDone={invalidate} />
              </View>
            ) : null}
          </View>
          {o.cancel_reason ? <Text style={styles.note}>{o.cancel_reason}</Text> : null}
          {o.reject_reason ? <Text style={styles.note}>Alasan: {o.reject_reason}</Text> : null}
          {o.status === "MENUNGGU_KONFIRMASI" ? (
            <Text style={styles.note}>{isSeller ? "Konfirmasi dalam 5 menit atau pesanan batal otomatis." : "Penjual akan mengonfirmasi dalam 5 menit."}</Text>
          ) : null}
        </Card>

        {/* items */}
        <Card>
          <Text style={styles.cardTitle}>Rincian Pesanan</Text>
          {o.items.map((it: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>{it.qty}× {it.name}{it.variant ? ` (${it.variant})` : ""}</Text>
              <Text style={styles.itemPrice}>{rupiah(it.line_total)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.itemRow}>
            <Text style={styles.total}>Total</Text>
            <Text style={styles.total}>{rupiah(o.total)}</Text>
          </View>
          <View style={{ marginTop: 8 }}>
            {pay ? <Badge label={pay.label} tone={pay.tone} /> : null}
          </View>
        </Card>

        {/* delivery / titip info */}
        {(o.titip_allowed || o.delivery_note) ? (
          <Card>
            <Text style={styles.cardTitle}>Pengiriman</Text>
            {o.delivery_window ? <Info icon="calendar-outline" text={o.delivery_window} /> : null}
            {o.titip_allowed ? <Info icon="home-outline" text={`Boleh dititipkan di: ${o.titip_location || "-"}`} /> : null}
            {o.titip_notes ? <Info icon="document-text-outline" text={o.titip_notes} /> : null}
            {o.delivery_note ? <Info icon="chatbox-outline" text={o.delivery_note} /> : null}
          </Card>
        ) : null}

        {/* proof photos */}
        {o.proof_file_ids?.length ? (
          <Card>
            <Text style={styles.cardTitle}>Bukti Penitipan</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {o.proof_file_ids.map((fid: string) => (
                <Image key={fid} source={{ uri: fileUrl(fid) }} style={styles.proofImg} contentFit="cover" />
              ))}
            </View>
          </Card>
        ) : null}

        {/* QRIS payment (buyer) */}
        {isBuyer && o.payment_method === "QRIS" && !terminal ? (
          <Card>
            <Text style={styles.cardTitle}>Pembayaran QRIS</Text>
            {o.payment_status === "SEDANG_DIVERIFIKASI" ? (
              <Text style={styles.note}>Pembayaran Anda sedang diverifikasi penjual.</Text>
            ) : o.payment_status === "BERHASIL" ? (
              <Text style={[styles.note, { color: colors.success }]}>Pembayaran berhasil.</Text>
            ) : (
              <>
                {o.qris_file_id ? (
                  <Image source={{ uri: fileUrl(o.qris_file_id) }} style={styles.qris} contentFit="contain" />
                ) : (
                  <View style={styles.qrisPlaceholder}><Icon name="qr-code" size={48} color={colors.muted} /><Text style={styles.note}>Penjual belum mengunggah QRIS. Hubungi via chat.</Text></View>
                )}
                <Button testID="qris-paid-btn" title="Saya Sudah Bayar" small onPress={() => run.mutate({ path: `/orders/${id}/pay/qris-sent` })} />
                {o.supports_cod ? (
                  <View style={{ marginTop: 8 }}>
                    <Button testID="switch-cod-btn" title="Beralih ke COD" variant="outline" small onPress={() => run.mutate({ path: `/orders/${id}/pay/switch-cod` })} />
                  </View>
                ) : null}
              </>
            )}
          </Card>
        ) : null}

        {/* timeline */}
        <Card>
          <Text style={styles.cardTitle}>Riwayat Status</Text>
          {o.timeline.map((t: any, i: number) => {
            const tl = ORDER_STATUS[t.status];
            return (
              <View key={i} style={styles.tlRow}>
                <View style={styles.tlDotWrap}>
                  <View style={[styles.tlDot, { backgroundColor: colors.brandPrimary }]} />
                  {i < o.timeline.length - 1 ? <View style={styles.tlLine} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 14 }}>
                  <Text style={styles.tlLabel}>{tl?.label || t.status}</Text>
                  {t.note ? <Text style={styles.tlNote}>{t.note}</Text> : null}
                  <Text style={styles.tlTime}>{new Date(t.at).toLocaleString("id-ID")}</Text>
                </View>
              </View>
            );
          })}
        </Card>

        {/* rating */}
        {o.status === "SELESAI" ? (
          <Card>
            <Text style={styles.cardTitle}>Beri Penilaian</Text>
            {ratingQ.data?.mine ? (
              <View style={{ flexDirection: "row", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((s) => <Icon key={s} name={s <= ratingQ.data.mine.stars ? "star" : "star-outline"} size={22} color={colors.brandSecondary} />)}
                <Text style={[styles.note, { marginLeft: 8 }]}>Terima kasih!</Text>
              </View>
            ) : (
              <>
                <Text style={styles.note}>{isBuyer ? "Nilai penjual ini" : "Nilai pembeli ini"}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginVertical: 8 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Pressable key={s} testID={`star-${s}`} onPress={() => setStars(s)}>
                      <Icon name={s <= stars ? "star" : "star-outline"} size={30} color={colors.brandSecondary} />
                    </Pressable>
                  ))}
                </View>
                <Field><Input testID="rating-comment" value={comment} onChangeText={setComment} placeholder="Komentar (opsional)" /></Field>
                <View style={{ height: 10 }} />
                <Button testID="submit-rating-btn" title="Kirim Penilaian" small disabled={stars === 0} loading={submitRating.isPending} onPress={() => submitRating.mutate()} />
              </>
            )}
          </Card>
        ) : null}
      </ScrollView>

      {/* action bar */}
      {!terminal ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {isBuyer ? (
            <BuyerActions o={o} run={run} delivered={delivered} />
          ) : isSeller ? (
            <SellerActions o={o} run={run} onTitip={() => setTitipOpen(true)} />
          ) : null}
        </View>
      ) : null}

      {/* titip proof modal */}
      <Modal visible={titipOpen} animationType="slide" transparent onRequestClose={() => setTitipOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Titip di Rumah</Text>
              <Pressable testID="close-titip" onPress={() => setTitipOpen(false)}><Icon name="close" size={24} /></Pressable>
            </View>
            <Text style={styles.note}>Ambil 2 foto bukti: (1) paket + nomor rumah/patokan, (2) paket di lokasi penitipan.</Text>
            <View style={{ flexDirection: "row", gap: 12, marginVertical: 14 }}>
              {[0, 1].map((i) => (
                <View key={i} style={styles.slot}>
                  {proofs[i] ? <Image source={{ uri: fileUrl(proofs[i]) }} style={{ flex: 1, borderRadius: 12 }} contentFit="cover" /> :
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <Icon name="camera-outline" size={28} color={colors.muted} />
                      <Text style={styles.slotLabel}>Foto {i + 1}</Text>
                    </View>}
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Button testID="titip-camera" title="Kamera" variant="outline" small icon="camera" disabled={proofs.length >= 2 || uploading} onPress={() => pickProof(true)} /></View>
              <View style={{ flex: 1 }}><Button testID="titip-gallery" title="Galeri" variant="outline" small icon="images" disabled={proofs.length >= 2 || uploading} onPress={() => pickProof(false)} /></View>
            </View>
            {uploading ? <Text style={[styles.note, { textAlign: "center", marginTop: 8 }]}>Mengunggah...</Text> : null}
            <View style={{ height: 12 }} />
            <Button testID="submit-titip-btn" title="Selesaikan Penitipan" disabled={proofs.length < 2} loading={run.isPending} onPress={submitTitip} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function BuyerActions({ o, run, delivered }: any) {
  const { colors } = useTheme();
  if (o.status === "MENUNGGU_KONFIRMASI") {
    return o.buyer_can_cancel ? (
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
          <Icon name="information-circle-outline" size={14} color={colors.muted} />
          <Text style={{ fontSize: 12, color: colors.muted }}>Batal hanya tersedia </Text>
          <Countdown seconds={o.seconds_to_cancel_end} style={{ fontSize: 12, color: colors.muted, fontWeight: "700" }} />
        </View>
        <Button testID="cancel-order-btn" title="Batalkan Pesanan" variant="danger" onPress={() => run.mutate({ path: `/orders/${o.id}/cancel` })} />
      </View>
    ) : <Text style={{ textAlign: "center", color: colors.muted, fontSize: 13 }}>Pesanan tidak dapat dibatalkan lagi.</Text>;
  }
  if (delivered && !o.buyer_received) {
    return (
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button testID="away-btn" title="Masih di Luar" variant="outline" onPress={() => run.mutate({ path: `/orders/${o.id}/away` })} /></View>
        <View style={{ flex: 1 }}><Button testID="received-btn" title="Pesanan Diterima" onPress={() => run.mutate({ path: `/orders/${o.id}/received` })} /></View>
      </View>
    );
  }
  if (o.buyer_received) return <Text style={{ textAlign: "center", color: colors.muted, fontSize: 13 }}>Menunggu konfirmasi pembayaran dari penjual.</Text>;
  return <Text style={{ textAlign: "center", color: colors.muted, fontSize: 13 }}>Pesanan sedang diproses penjual.</Text>;
}

function SellerActions({ o, run, onTitip }: any) {
  const s = o.status;
  const p = (path: string) => run.mutate({ path: `/orders/${o.id}/${path}` });
  if (s === "MENUNGGU_KONFIRMASI") {
    return (
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button testID="reject-btn" title="Produk Habis" variant="outline" onPress={() => p("reject")} /></View>
        <View style={{ flex: 2 }}><Button testID="confirm-btn" title="Konfirmasi Pesanan" onPress={() => p("confirm")} /></View>
      </View>
    );
  }
  if (s === "DIKONFIRMASI") return <Button testID="advance-btn" title="Proses Pesanan" icon="restaurant-outline" onPress={() => p("advance")} />;
  if (s === "SEDANG_DIPROSES") return <Button testID="advance-btn" title="Siap Diantar" icon="cube-outline" onPress={() => p("advance")} />;
  if (s === "SIAP_DIANTAR") return <Button testID="advance-btn" title="Antar Sekarang" icon="bicycle-outline" onPress={() => p("advance")} />;
  if (s === "SEDANG_DIANTAR") {
    return (
      <View style={{ gap: 10 }}>
        <Button testID="handover-btn" title="Serahkan Langsung ke Pembeli" onPress={() => p("handover")} />
        {o.titip_allowed ? <Button testID="titip-btn" title="Titipkan (2 Foto Bukti)" variant="outline" icon="home-outline" onPress={onTitip} /> : null}
      </View>
    );
  }
  if (s === "MENUNGGU_PENYELESAIAN") {
    const label = o.payment_method === "QRIS"
      ? (o.payment_status === "SEDANG_DIVERIFIKASI" ? "Verifikasi Pembayaran QRIS" : "Menunggu Pembayaran Pembeli")
      : "Tandai Lunas (COD Diterima)";
    const disabled = o.payment_method === "QRIS" && o.payment_status !== "SEDANG_DIVERIFIKASI";
    return <Button testID="verify-payment-btn" title={label} disabled={disabled} onPress={() => p("payment/verify")} />;
  }
  return null;
}

function Info({ icon, text }: { icon: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 }}>
      <Icon name={icon} size={16} color={colors.muted} />
      <Text style={{ fontSize: 13, color: colors.onSurfaceSecondary, flex: 1 }}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  chatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: c.onSurface, marginBottom: 8 },
  timer: { fontSize: 16, fontWeight: "700", color: c.warning },
  note: { fontSize: 13, color: c.muted, marginTop: 6, lineHeight: 18 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, gap: 10 },
  itemName: { fontSize: 14, color: c.onSurfaceSecondary, flex: 1 },
  itemPrice: { fontSize: 14, color: c.onSurface },
  divider: { height: 1, backgroundColor: c.divider, marginVertical: 8 },
  total: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  proofImg: { width: 120, height: 120, borderRadius: 12, backgroundColor: c.surfaceTertiary },
  qris: { width: "100%", height: 220, marginBottom: 12, backgroundColor: c.surfaceTertiary, borderRadius: 12 },
  qrisPlaceholder: { height: 160, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.surfaceSecondary, borderRadius: 12, marginBottom: 12, padding: 16 },
  tlRow: { flexDirection: "row", gap: 12 },
  tlDotWrap: { alignItems: "center", width: 16 },
  tlDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  tlLine: { flex: 1, width: 2, backgroundColor: c.border, marginTop: 2 },
  tlLabel: { fontSize: 14, fontWeight: "600", color: c.onSurface },
  tlNote: { fontSize: 13, color: c.onSurfaceSecondary, marginTop: 1 },
  tlTime: { fontSize: 11, color: c.muted, marginTop: 2 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: c.onSurface },
  slot: { flex: 1, aspectRatio: 1, borderRadius: 12, borderWidth: 1.5, borderColor: c.border, borderStyle: "dashed", backgroundColor: c.surfaceSecondary, overflow: "hidden" },
  slotLabel: { fontSize: 12, color: c.muted, marginTop: 4 },
}));
