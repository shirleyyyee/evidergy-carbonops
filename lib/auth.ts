import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { getLocalSessionUser, localLoginEnabled } from "@/lib/local-auth";

const demoUser: ChatGPTUser = {
  userId: "local-demo-user",
  displayName: "Maya Chen",
  email: "maya@evidergy.demo",
  fullName: "Maya Chen",
};

export type ProductUser = ChatGPTUser & { authSource: "chatgpt" | "local" | "dev-fallback" };

async function resolveProductUser(): Promise<ProductUser | null> {
  const platformUser = await getChatGPTUser();
  if (platformUser) return { ...platformUser, authSource: "chatgpt" };

  if (localLoginEnabled()) {
    const localUser = await getLocalSessionUser();
    if (localUser) return { ...localUser, authSource: "local" };
    return null;
  }

  if (process.env.NODE_ENV === "development") return { ...demoUser, authSource: "dev-fallback" };
  return null;
}

export async function getProductUser(): Promise<ProductUser | null> {
  return resolveProductUser();
}

export async function requireProductUser(returnTo = "/dashboard"): Promise<ProductUser> {
  const user = await resolveProductUser();
  if (user) return user;
  redirect(localLoginEnabled() ? `/login?return_to=${encodeURIComponent(returnTo)}` : chatGPTSignInPath(returnTo));
}

export async function requireApiUser(): Promise<ProductUser | null> {
  return resolveProductUser();
}
