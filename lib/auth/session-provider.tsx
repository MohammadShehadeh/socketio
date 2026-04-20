import type { User } from "@/lib/auth/types";
import { getSession } from "@/lib/auth/session";
import { AuthProvider } from "@/lib/auth/auth-context";

export async function SessionProvider({ children }: { children: React.ReactNode }) {
  const user: User | null = await getSession();

  return <AuthProvider initialUser={user}>{children}</AuthProvider>;
}
