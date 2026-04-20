"use server";

import { setSession, clearSession, pickAvatar } from "./session";
import { redirect } from "next/navigation";

export async function loginAction(_prevState: unknown, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();

  if (!name) return { error: "Please enter your name" };
  if (!email || !email.includes("@")) return { error: "Please enter a valid email" };

  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const avatar = pickAvatar(name);

  await setSession({ id, name, email, avatar });

  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
