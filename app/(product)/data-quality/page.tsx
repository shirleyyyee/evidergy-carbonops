import { Badge, KpiCard, MethodologyNote, PageHeader, Panel, Progress } from "@/components/ui";
import { channelCoverage, dataQuality, energyBalance, qualityChecks } from "@/lib/reference-dataset";

export default function DataQualityPage() {
  const overallHealth = Math.round(qualityChecks.reduce((sum, c) => sum + c.score, 0) / qualityChecks.length);
  const reviewCount = qualityChecks.filter((c) => c.status !== "pass").length;
  return (
    <>
      <PageHeader eyebrow="Trust before diagnosis — real gaps, not injected" title="Data quality" description="Every model output starts with a traceable verdict on timestamps, units, sign conventions and physical consistency, measured on real public telemetry with real coverage gaps." action={<button className="button buttonPrimary">Download quality report</button>} />
      <div className="kpiGrid">
        <KpiCard label="Overall health" value={overallHealth.toString()} unit="/ 100" tone="green" trend="Real, 2016" detail={`Across ${qualityChecks.length} monitored checks`} />
        <KpiCard label="Balance identity" value={energyBalance.identity_check.pass_pct.toFixed(1)} unit="%" trend="residential4, real" detail="Sign-convention / unit-conversion code path" />
        <KpiCard label="Metering completeness" value={energyBalance.metering_completeness_pct.toFixed(1)} unit="%" tone="cyan" trend="Real submetering gap" detail="6 appliance circuits vs. whole-building load" />
        <KpiCard label="Real missing intervals" value={dataQuality.missing_pct.toFixed(1)} unit="%" tone="amber" trend="industrial2 storage, 2016" detail="Genuine source gap, not injected" />
      </div>
      <Panel title="Quality gate" description="Checks run before forecasting or asset-health inference — real results" action={<Badge tone={reviewCount ? "warn" : "good"}>{reviewCount} checks need review</Badge>}>
        <div className="qualityTable tableLike">
          <div className="tableHead"><span>Check</span><span>Score</span><span>Affected data</span><span>Evidence</span><span>Status</span></div>
          {qualityChecks.map((check) => <div className="tableRow" key={check.name}><strong>{check.name}</strong><div><Progress value={check.score} tone={check.status === "warn" ? "amber" : "green"} label={`${check.score}%`} /></div><span>{check.affected}</span><span>{check.evidence}</span><Badge tone={check.status === "pass" ? "good" : "warn"}>{check.status === "pass" ? "Passed" : "Review"}</Badge></div>)}
        </div>
      </Panel>
      <div className="dashboardGrid">
        <Panel title="Channel coverage" description="Expected vs. observed 15-minute intervals, whole year 2016, real" className="span2"><div className="channelGrid">{channelCoverage.map((channel) => <div key={channel.name}><span><i className={channel.coveragePct < 99 ? "warnCell" : "goodCell"} />{channel.name}</span><strong>{channel.coveragePct}%</strong></div>)}</div></Panel>
        <Panel title="Diagnostic order" description="Why a flag became an alert"><ol className="evidenceSteps"><li className="complete"><span>1</span><div><strong>Data integrity</strong><small>Timestamp, range, duplicate and freeze checks</small></div></li><li className="complete"><span>2</span><div><strong>Physical balance</strong><small>PCC residual within calibrated tolerance</small></div></li><li className="active"><span>3</span><div><strong>Probability interval</strong><small>Deviation persists outside expected range</small></div></li><li><span>4</span><div><strong>Human confirmation</strong><small>OEM alarm or work-order evidence required</small></div></li></ol></Panel>
      </div>
      <MethodologyNote>Channel coverage and quality-gate results are computed on real Open Power System Data household_data (2016), including genuine ~14-32% gaps in the battery-storage telemetry — nothing here is injected to look clean.</MethodologyNote>
    </>
  );
}
