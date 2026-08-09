import { createLocalSession, localLoginEnabled, verifyLocalCredentials } from "@/lib/local-auth";

function safeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function POST(request: Request) {
  if (!localLoginEnabled()) {
    return Response.json({ error: "local_login_disabled" }, { status: 404 });
  }
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const returnTo = safeReturnTo(form.get("return_to"));

  const account = verifyLocalCredentials(username, password);
  if (!account) {
    const url = new URL(`/login?error=invalid_credentials&return_to=${encodeURIComponent(returnTo)}`, request.url);
    return Response.redirect(url, 303);
  }

  await createLocalSession(account.username);
  return Response.redirect(new URL(returnTo, request.url), 303);
}
