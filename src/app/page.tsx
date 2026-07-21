import Landing from "@/components/Landing";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Image from "next/image";

export default function Home() {
  const { user } = useAuth();

  return (
    <AuthProvider>
      <Landing />
    </AuthProvider>
  );
}
