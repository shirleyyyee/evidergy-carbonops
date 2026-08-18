import Image from "next/image";
import Link from "next/link";
import { chatGPTSignInPath } from "./chatgpt-auth";
import { getProductUser } from "@/lib/auth";
import { loadForecastByHorizon, pvEvidence } from "@/lib/reference-dataset";

const p90CoveragePct = Math.round(loadForecastByHorizon[0].p90_coverage * 1000) / 10;

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getProductUser();
  const launchHref = user ? "/dashboard" : chatGPTSignInPath("/dashboard");
  return (
    <main className="landing">
      <nav className="landingNav">
        <Link href="/" className="brand brandDark"><span className="brandMark"><i /><i /><i /></span><span><strong>EVIDERGY</strong><small>CARBONOPS</small></span></Link>
        <div><a href="#platform">Platform</a><a href="#hardware">Hardware</a><a href="#evidence">Evidence model</a><a href="#scope">Scope</a><Link className="button buttonLight" href={launchHref}>{user ? "Open workspace" : "Sign in"}</Link></div>
      </nav>
      <section className="hero">
        <div className="heroGlow" />
        <div className="heroCopy">
          <p className="eyebrow lightEyebrow">READ-ONLY MICROGRID INTELLIGENCE</p>
          <h1>See energy risk<br />before it becomes<br /><em>operational loss.</em></h1>
          <p>Evidergy connects trusted energy data, probabilistic forecasts, asset evidence and versioned Scope 2 accounting in one operator workspace.</p>
          <div className="heroActions"><Link className="button buttonHero" href={launchHref}>{user ? "Enter workspace" : "Sign in to workspace"} <span>→</span></Link><a className="textLink lightLink" href="#platform">Explore the platform ↓</a></div>
          <div className="trustRow"><span><b>READ-ONLY</b>No control commands</span><span><b>EVIDENCE-FIRST</b>Human confirmation retained</span><span><b>AUSTRALIA-READY</b>NT / NEM / WEM rule packs</span></div>
        </div>
        <div className="heroVisual">
          <div className="heroProductCard"><div className="heroCardTop"><span>PUBLIC REFERENCE DATASET</span><b>● BACKTESTED</b></div><Image src="/evidergy-product.png" width={900} height={650} alt="Evidergy platform showing a commercial microgrid and six analytics modules" priority /><div className="heroMetrics"><div><span>FORECAST P90 COVERAGE</span><strong>{p90CoveragePct}%</strong></div><div><span>PV EVENT RECALL</span><strong>{pvEvidence.known_event_recall_pct}%</strong></div><div><span>SCOPE 2 RECOMPUTE</span><strong>100%</strong></div></div></div>
          <div className="floatingProof"><span>REAL PUBLIC DATA, NOT A MOCKUP</span><strong>OPSD + Open-Meteo + NGA 2025</strong><small>Checksummed, reproducible backtest — see /methodology</small></div>
        </div>
      </section>
      <section className="landingStats"><div><strong>6</strong><span>connected operator views</span></div><div><strong>1–24h</strong><span>probabilistic horizons</span></div><div><strong>100%</strong><span>reproducible carbon entries</span></div><div><strong>0</strong><span>automated control commands</span></div></section>
      <section className="platformSection" id="platform">
        <div className="sectionIntro"><p className="eyebrow">ONE OPERATIONAL EVIDENCE LAYER</p><h2>From raw meter data to<br />a decision someone can defend.</h2><p>The platform is organised around the questions real energy, asset and sustainability teams ask every day.</p></div>
        <div className="moduleGrid">
          {[["01","Energy overview","Reconcile Grid, Load, PV and BESS at the point of connection."],["02","Data quality","Find missing, frozen, duplicate or physically inconsistent measurements first."],["03","PV health","Compare weather-adjusted output with calibrated baselines and peer arrays."],["04","BESS health","Track SOC–power consistency, throughput, efficiency and peak shaving."],["05","Probability forecast","Show median, 90% intervals and threshold-exceedance probability."],["06","Carbon ledger","Recompute every Scope 2 entry from metered import and a locked factor version."]].map(([number,title,detail]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{detail}</p><b>View in workspace →</b></article>)}
        </div>
      </section>
      <section className="tierSection" id="hardware">
        <div className="sectionIntro"><p className="eyebrow">FIELD HARDWARE, ONE BOARD FAMILY</p><h2>Start with one circuit.<br />Scale to the whole panel.</h2><p>The same gateway design, offered in three fixed configurations — pick the one that matches how much of the site you want visible on day one.</p></div>
        <div className="tierGrid">
          <div className="tierCard">
            <span>FASTEST TO DEPLOY</span>
            <h3>Lite</h3>
            <p>One current-sensing channel on a single circuit or machine, Wi-Fi only, basic on/off detection. Built to get real telemetry into the workspace inside a day.</p>
            <ul><li>1 current-sensing channel</li><li>Wi-Fi only, no wired network</li><li>Basic on/off detection</li></ul>
            <small>Uses the same threshold logic as the public edge-collector prototype.</small>
          </div>
          <div className="tierCard tierFeatured">
            <span>MOST DEPLOYED</span>
            <h3>Standard</h3>
            <p>Four channels cover a full distribution panel or several machines at once, with a clock that keeps real timestamps through a network outage.</p>
            <ul><li>4 current-sensing channels</li><li>Wi-Fi + onboard real-time clock</li><li>Adaptive run / idle / off recognition with a confidence score</li></ul>
            <small>The configuration validated end-to-end in our reference testing.</small>
          </div>
          <div className="tierCard">
            <span>INDUSTRIAL SITES</span>
            <h3>Pro</h3>
            <p>Everything in Standard, plus wired Ethernet for RF-noisy sites and a wider current range for larger machinery.</p>
            <ul><li>4 current-sensing channels, extended range option</li><li>Wired Ethernet + Wi-Fi</li><li>Same adaptive recognition as Standard</li></ul>
            <small>Confirmed compatible at the component level; not yet bench-tested as a complete unit.</small>
          </div>
        </div>
        <p className="boundaryNote">All three share one board and firmware family — only the current-sensing channels and connectivity are populated per site. Standard is the only configuration fully validated so far; Lite and Pro use the same analog design with components added or omitted, pending their own validation pass.</p>
      </section>
      <section className="evidenceSection" id="evidence"><div><p className="eyebrow lightEyebrow">EVIDENCE BEFORE AUTOMATION</p><h2>An anomaly score is not a diagnosis.</h2><p>Evidergy checks data integrity, physical balance and calibrated probability before presenting a ranked evidence pack for human confirmation.</p><ol><li><span>1</span><div><strong>Trust the data</strong><small>Timestamp, unit, sign and sensor checks</small></div></li><li><span>2</span><div><strong>Respect the physics</strong><small>PCC balance and asset operating envelopes</small></div></li><li><span>3</span><div><strong>Quantify uncertainty</strong><small>Expected interval, persistence and confidence</small></div></li><li><span>4</span><div><strong>Confirm the action</strong><small>Operator response and work-order evidence</small></div></li></ol></div><div className="evidenceExample"><span>ALT-2418 · PV ARRAY 04</span><h3>Weather-adjusted underperformance</h3><p>Output below the P05 baseline across 9 consecutive intervals.</p><div><b>91%</b><small>confidence</small></div><div><b>84.6 kWh</b><small>estimated loss</small></div><ul><li>✓ Irradiance stable</li><li>✓ Peer arrays normal</li><li>✓ Data quality passed</li></ul><small>Candidate underperformance — not a deterministic component root cause.</small></div></section>
      <section className="scopeSection" id="scope"><div><p className="eyebrow">BUILT WITH A CLEAR BOUNDARY</p><h2>Useful on day one.<br />Honest about what comes next.</h2></div><div className="scopeColumns"><article><span>IN THE MVP</span><ul><li>Read-only data ingestion</li><li>Site energy balance</li><li>Probabilistic load forecasting</li><li>PV and BESS evidence</li><li>Location-based Scope 2 ledger</li><li>Human-confirmed alert workflow</li></ul></article><article><span>NOT CLAIMED</span><ul><li>Automatic dispatch or control</li><li>Cell-level BESS safety diagnosis</li><li>Deterministic component root cause</li><li>Revenue-grade settlement</li><li>NGER filing or assurance</li><li>Net-zero certification</li></ul></article></div></section>
      <section className="landingCta"><div><span className="brandMark"><i /><i /><i /></span><h2>Bring the whole energy story<br />into focus.</h2><p>Explore the operator workspace with a realistic Australian commercial microgrid dataset.</p><Link className="button buttonHero" href={launchHref}>{user ? "Open workspace" : "Sign in to workspace"} →</Link></div></section>
      <footer className="landingFooter"><span>© 2026 Evidergy CarbonOps</span><span>Operational analytics · Evidence-first · Read-only by design</span></footer>
    </main>
  );
}
