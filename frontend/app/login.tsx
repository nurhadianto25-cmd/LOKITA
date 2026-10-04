import React, { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { makeStyles } from "@/src/theme";
import { Button, Input, Field, Icon } from "@/src/components/ui";
import { LogoStacked } from "@/src/components/Logo";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/auth";
import { api } from "@/src/api/client";

type Step = "phone" | "otp" | "setpin" | "loginpin";

export default function Login() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { signIn } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [challenge, setChallenge] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const device = Platform.OS === "web" ? "web" : Platform.OS;

  async function requestOtp() {
    if (phone.trim().length < 8) return toast("Masukkan nomor telepon yang valid", "error");
    setLoading(true);
    try {
      const r = await api.post("/auth/otp/request", { phone });
      setChallenge(r.challenge_id);
      if (r.is_existing) {
        setStep("loginpin");
      } else {
        if (r.dev_otp) setOtp(r.dev_otp);
        setStep("otp");
        toast("Kode OTP dikirim (mode demo otomatis terisi)", "info");
      }
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) return toast("Kode OTP harus 6 digit", "error");
    setLoading(true);
    try {
      const r = await api.post("/auth/otp/verify", { phone, otp });
      setChallenge(r.challenge_id);
      setStep("setpin");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function setupPin() {
    if (pin.length !== 6) return toast("PIN harus 6 digit", "error");
    if (!name.trim()) return toast("Masukkan nama Anda", "error");
    setLoading(true);
    try {
      const r = await api.post("/auth/pin/set", { challenge_id: challenge, pin, name, device_name: device });
      await signIn(r.access_token, r.user);
      router.replace("/community/select");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function loginPin() {
    if (pin.length !== 6) return toast("PIN harus 6 digit", "error");
    setLoading(true);
    try {
      const r = await api.post("/auth/login", { phone, pin, device_name: device });
      await signIn(r.access_token, r.user);
      router.replace("/");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40, gap: 28 }}
      >
        <LogoStacked />

        {step !== "phone" ? (
          <Pressable testID="back-btn" onPress={() => { setStep("phone"); setPin(""); setOtp(""); }} style={styles.back}>
            <Icon name="arrow-back" size={20} />
            <Text style={styles.backText}>Ubah nomor</Text>
          </Pressable>
        ) : null}

        <View style={{ gap: 18 }}>
          {step === "phone" && (
            <>
              <Text style={styles.title}>Masuk atau Daftar</Text>
              <Text style={styles.sub}>Gunakan nomor telepon Anda untuk mulai berbelanja di komunitas.</Text>
              <Field label="Nomor Telepon">
                <Input
                  testID="phone-input"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="08xxxxxxxxxx"
                  keyboardType="phone-pad"
                  autoFocus
                />
              </Field>
              <Button testID="request-otp-btn" title="Lanjut" onPress={requestOtp} loading={loading} icon="arrow-forward" />
            </>
          )}

          {step === "otp" && (
            <>
              <Text style={styles.title}>Verifikasi OTP</Text>
              <Text style={styles.sub}>Masukkan 6 digit kode yang dikirim ke {phone}.</Text>
              <Field label="Kode OTP">
                <Input testID="otp-input" value={otp} onChangeText={setOtp} placeholder="______"
                  keyboardType="number-pad" maxLength={6} style={{ letterSpacing: 8, fontSize: 20 }} />
              </Field>
              <Button testID="verify-otp-btn" title="Verifikasi" onPress={verifyOtp} loading={loading} />
            </>
          )}

          {step === "setpin" && (
            <>
              <Text style={styles.title}>Buat Akun</Text>
              <Text style={styles.sub}>Lengkapi profil dan buat PIN 6 digit untuk keamanan.</Text>
              <Field label="Nama">
                <Input testID="name-input" value={name} onChangeText={setName} placeholder="Nama Anda" />
              </Field>
              <Field label="Buat PIN (6 digit)">
                <Input testID="setpin-input" value={pin} onChangeText={setPin} placeholder="______"
                  keyboardType="number-pad" maxLength={6} secureTextEntry style={{ letterSpacing: 8, fontSize: 20 }} />
              </Field>
              <Button testID="create-account-btn" title="Buat Akun" onPress={setupPin} loading={loading} />
            </>
          )}

          {step === "loginpin" && (
            <>
              <Text style={styles.title}>Selamat Datang Kembali</Text>
              <Text style={styles.sub}>Masukkan PIN untuk {phone}.</Text>
              <Field label="PIN">
                <Input testID="loginpin-input" value={pin} onChangeText={setPin} placeholder="______"
                  keyboardType="number-pad" maxLength={6} secureTextEntry autoFocus style={{ letterSpacing: 8, fontSize: 20 }} />
              </Field>
              <Button testID="login-btn" title="Masuk" onPress={loginPin} loading={loading} />
            </>
          )}
        </View>

        <Text style={styles.terms}>
          Dengan melanjutkan, Anda menyetujui Syarat & Ketentuan dan Kebijakan Privasi LOKITA.
        </Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  title: { fontSize: 24, fontWeight: "700", color: c.onSurface },
  sub: { fontSize: 14, color: c.muted, lineHeight: 20 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  backText: { color: c.onSurfaceSecondary, fontSize: 14 },
  terms: { fontSize: 12, color: c.muted, textAlign: "center", lineHeight: 18 },
}));
