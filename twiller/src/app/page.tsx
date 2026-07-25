import Landing from "@/components/Landing";
import Mainlayout from "@/components/layout/Mainlaout";
import { AuthProvider } from "@/context/AuthContext";
import Image from "next/image";

export default function Home() {
  return (
    <AuthProvider>
      <Mainlayout>
        <Landing />
      </Mainlayout>
    </AuthProvider>
  );
}
