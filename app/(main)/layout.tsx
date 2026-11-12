// Every page in the (main) folder requires a signed-in user (or the demo).
// "(main)" is a route group: it groups files without adding to the URL.
import { AppShell } from "@/components/AppShell";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
