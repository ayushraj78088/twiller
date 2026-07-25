import Landing from "@/components/Landing";
import Mainlayout from "@/components/layout/Mainlaout";
import { AuthProvider } from "@/context/AuthContext";

export default function Home() {
  return (
    <AuthProvider>
      <Mainlayout>
        <Landing />
      </Mainlayout>
    </AuthProvider>
  );
}
