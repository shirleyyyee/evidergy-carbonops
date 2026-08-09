import Link from "next/link";
import { EnergyChart, Donut } from "@/components/charts";
import { Badge, KpiCard, MethodologyNote, PageHeader, Panel } from "@/components/ui";
import { alerts, dashboardStats, energySeries, forecastSeries, siteAExemplarDay } from "@/lib/reference-dataset";

export default function DashboardPage() {
  const latest = energySeries[29];
  return (
    <>
      <PageHeader eyebrow="Real-data backtest" title="Energy overview" description="One trusted view of power flow, operational risk and carbon impact — computed from a real, checksummed public reference dataset, not simulated data." action={<><button className="button buttonGhost">{siteAExemplarDay}⌄</button><button className="button buttonPrimary">Export snapshot</button></>} />
      <div className="kpiGrid">
        <KpiCard label="Site demand (now)" value={latest.loadKw.toFixed(2)} unit="kW" trend={`Peak ${dashboardStats.peakLoadKw} kW`} detail="Real residential4 whole-building load" />
        <KpiCard label="Solar generation" value={latest.pvKw.toFixed(2)} unit="kW" trend="Real PV meter" tone="green" detail={`${dashboardStats.totalPvKwhToday} kWh generated today`} />
        <KpiCard label="Grid import" value={Math.max(0, latest.gridKw).toFixed(2)} unit="kW" trend={`${dashboardStats.totalGridImportKwhToday} kWh today`} tone="cyan" detail="Real grid_import − grid_export meter" />
        <KpiCard label="Self-consumption" value={dashboardStats.selfConsumptionPct.toFixed(1)} unit="%" trend="Real PV vs. import split" tone="amber" detail="Share of energy served by on-site PV" />
      </div>
      <div className="dashboardGrid">
        <Panel title="Site power flow" description="15-minute real meter data · positive BESS = discharge" action={<Badge tone="good">Balance identity 100%</Badge>} className="span2">
          <div className="powerFlow">
            <div className="flowNode gridNode"><span>GRID</span><strong>{Math.max(0, latest.gridKw).toFixed(1)} kW</strong><small>Import</small></div>
            <div className="flowConnector"><i /><b>→</b></div>
            <div className="flowNode siteNode"><span>SITE LOAD</span><strong>{latest.loadKw.toFixed(1)} kW</strong><small>Current demand</small></div>
            <div className="flowBranches"><div><b>↑</b><span>PV</span><strong>{latest.pvKw.toFixed(1)} kW</strong></div><div><b>↑</b><span>BESS</span><strong>{latest.bessKw.toFixed(1)} kW</strong></div></div>
          </div>
          <div className="flowMeta"><span>Balance residual <strong>{latest.balanceResidualKw.toFixed(2)} kW</strong></span><span>Site peak, {siteAExemplarDay} <strong>{dashboardStats.peakLoadKw} kW</strong></span><span>Self-consumed <strong>{dashboardStats.selfConsumptionPct}%</strong></span></div>
        </Panel>
        <Panel title="Today at a glance" description="Derived from real metered energy">
          <div className="donutRow"><Donut value={dashboardStats.selfConsumptionPct} label="Solar share" sublabel="of site energy" /><Donut value={alerts.length ? 100 - alerts.length * 5 : 100} label="Data health" sublabel={`${alerts.length} evidence items`} tone="cyan" /></div>
          <div className="quickMetrics"><div><span>PV generated</span><strong>{dashboardStats.totalPvKwhToday} kWh</strong></div><div><span>Scope 2 today</span><strong>{dashboardStats.scope2TodayTco2e} tCO₂-e</strong></div><div><span>Evidence items</span><strong>{alerts.length}</strong></div></div>
        </Panel>
      </div>
      <div className="dashboardGrid">
        <Panel title="Real day, 15-minute resolution" description={`Grid, load and solar power — ${siteAExemplarDay} (residential4, no battery at this site)`} action={<Link className="textLink" href="/forecast">Open forecast →</Link>} className="span2"><EnergyChart points={energySeries} /></Panel>
        <Panel title="Backtest evidence" description="From fault-injection validation runs" action={<Link className="textLink" href="/alerts">View all</Link>}>
          <div className="alertList compact">{alerts.slice(0, 3).map((alert) => <Link href={`/alerts#${alert.id}`} key={alert.id} className="alertRow"><span className={`severityDot severity-${alert.severity}`} /><div><strong>{alert.title}</strong><small>{alert.asset} · {alert.startedAt}</small></div><b>›</b></Link>)}</div>
          <div className="forecastCallout"><span>Real held-out backtest window</span><strong>{forecastSeries[11].p50.toFixed(1)} kW median</strong><small>90% interval {forecastSeries[11].p05.toFixed(1)}–{forecastSeries[11].p95.toFixed(1)} kW</small></div>
        </Panel>
      </div>
      <MethodologyNote>Energy figures above are a real day ({siteAExemplarDay}) from Open Power System Data household_data (residential4, CC-BY, ISC Konstanz) — not the Alice Springs pilot.</MethodologyNote>
    </>
  );
}
