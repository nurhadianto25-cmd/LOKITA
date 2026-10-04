import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth/auth";
import { Loading } from "@/src/components/ui";

export default function Index() {
  const { ready, user } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (!user.active_community_id) return <Redirect href="/community/select" />;
  return <Redirect href="/(tabs)" />;
}
