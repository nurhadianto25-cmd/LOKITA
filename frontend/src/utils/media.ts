import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";

export type PickedAsset = { uri: string; mimeType?: string; fileName?: string };

export type PickResult = {
  ok: boolean;
  asset?: PickedAsset;
  canceled?: boolean;
  error?: string;
  blocked?: boolean; // permission permanently denied
};

/**
 * Pick any photo from the device gallery. Accepts every image type the gallery
 * holds (jpg/png/webp/gif/heic/live photos) — no format filtering — and returns
 * the asset's real mimeType/fileName so the upload keeps the correct format.
 */
export async function pickFromGallery(): Promise<PickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return { ok: false, blocked: !perm.canAskAgain, error: "Izin galeri diperlukan" };
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "livePhotos"],
    quality: 0.7,
    allowsMultipleSelection: false,
    exif: false,
  });
  if (res.canceled || !res.assets?.[0]) return { ok: false, canceled: true };
  const a = res.assets[0];
  return { ok: true, asset: { uri: a.uri, mimeType: a.mimeType || undefined, fileName: a.fileName || undefined } };
}

/** Capture a photo with the camera. Returns the asset with its real mimeType. */
export async function captureWithCamera(): Promise<PickResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    return { ok: false, blocked: !perm.canAskAgain, error: "Izin kamera diperlukan" };
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
  if (res.canceled || !res.assets?.[0]) return { ok: false, canceled: true };
  const a = res.assets[0];
  return { ok: true, asset: { uri: a.uri, mimeType: a.mimeType || undefined, fileName: a.fileName || undefined } };
}

export function openAppSettings() {
  Linking.openSettings();
}
