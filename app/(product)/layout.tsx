import type { ReactNode } from "react";
import { ProductShell } from "@/components/product-shell";
import { requireProductUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProductLayout({ children }: { children: ReactNode }) {
  const user = await requireProductUser("/dashboard");
  return <ProductShell user={user}>{children}</ProductShell>;
}
