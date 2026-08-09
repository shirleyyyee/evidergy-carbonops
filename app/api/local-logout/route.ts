import { clearLocalSession } from "@/lib/local-auth";

export async function POST(request: Request) {
  await clearLocalSession();
  return Response.redirect(new URL("/", request.url), 303);
}
