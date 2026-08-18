import Link from "next/link";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { localAccountUsernames, localLoginEnabled } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

export default async function LocalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; return_to?: string }>;
}) {
  const params = await searchParams;
  const returnTo = params.return_to && params.return_to.startsWith("/") ? params.return_to : "/dashboard";
  const enabled = localLoginEnabled();

  if (!enabled) {
    return (
      <main className="landing">
        <section className="hero" style={{ minHeight: "auto", padding: "120px 6vw" }}>
          <div className="heroCopy">
            <p className="eyebrow lightEyebrow">LOCAL SIGN-IN DISABLED</p>
            <h1>Local login is off.</h1>
            <p>
              Set <code>EVIDERGY_LOCAL_LOGIN=1</code> (and <code>EVIDERGY_LOCAL_LOGIN_SECRET</code>,{" "}
              <code>EVIDERGY_LOCAL_LOGIN_PASSWORD</code> for anything beyond a throwaway local demo) before
              starting the dev server to enable a local sign-in form. In production, identity is provided by the
              platform-owned Sign in with ChatGPT flow.
            </p>
            <div className="heroActions">
              <Link className="button buttonHero" href={chatGPTSignInPath(returnTo)}>
                Continue with Sign in with ChatGPT →
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const usernames = localAccountUsernames();
  const errored = params.error === "invalid_credentials";

  return (
    <main className="landing">
      <section className="hero" style={{ minHeight: "auto", padding: "120px 6vw" }}>
        <div className="heroCopy">
          <p className="eyebrow lightEyebrow">LOCAL DEMO SIGN-IN</p>
          <h1>
            Sign in to the
            <br />
            <em>local workspace.</em>
          </h1>
          <p>
            This is a local-only credential form for running and reviewing the product on a developer machine. It
            is separate from, and never used by, the platform-owned production sign-in.
          </p>
          {errored ? (
            <p style={{ color: "#ffb4b4", fontWeight: 700, fontSize: 12 }}>Incorrect username or password. Try again.</p>
          ) : null}
          <form
            method="post"
            action="/api/local-login"
            style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 360, marginTop: 24 }}
          >
            <input type="hidden" name="return_to" value={returnTo} />
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "#b8cbd9" }}>
              Username
              <input
                name="username"
                autoComplete="username"
                required
                defaultValue={usernames[0]}
                style={{ height: 42, borderRadius: 7, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.06)", color: "#fff", padding: "0 12px", fontSize: 13 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "#b8cbd9" }}>
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                style={{ height: 42, borderRadius: 7, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.06)", color: "#fff", padding: "0 12px", fontSize: 13 }}
              />
            </label>
            <button className="button buttonHero" type="submit" style={{ marginTop: 6 }}>
              Sign in →
            </button>
          </form>
          <div className="trustRow" style={{ marginTop: 28 }}>
            <span>
              <b>DEMO ACCOUNTS</b>
              {usernames.join(", ")}
            </span>
            <span>
              <b>PASSWORD</b>
              Set via EVIDERGY_LOCAL_LOGIN_PASSWORD (defaults to evidergy-demo)
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
