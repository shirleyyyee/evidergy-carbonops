import { CarbonBars } from "@/components/charts";
import { Badge, KpiCard, MethodologyNote, PageHeader, Panel } from "@/components/ui";
import { carbonFactor, carbonMonths, scope2, sources } from "@/lib/reference-dataset";

export default function CarbonLedgerPage() {
  const totalPvMwh = carbonMonths.reduce((sum, m) => sum + m.pvMwh, 0);
  const totalAvoided = carbonMonths.reduce((sum, m) => sum + m.avoidedTco2e, 0);
  const pvSharePct = Math.round((totalPvMwh / (scope2.total_grid_import_mwh + totalPvMwh)) * 1000) / 10;
  const opsdSource = sources.find((s) => s.id === "opsd_household_data")!;
  const lastMonth = scope2.monthly.at(-1)!;
  return (
    <>
      <PageHeader eyebrow="Real factor, real energy, versioned" title="Carbon ledger" description="Trace purchased electricity to a named factor, calculation version and source-data snapshot — real monthly grid import, real published Scope 2 factor." action={<><button className="button buttonGhost">2016 (real backtest year)⌄</button><button className="button buttonPrimary">Export monthly report</button></>} />
      <div className="kpiGrid">
        <KpiCard label="Location-based Scope 2" value={scope2.total_emissions_tco2e.toFixed(2)} unit="tCO₂-e" trend={`${scope2.months_evaluated} months, 2016`} detail="Real monthly grid import × real NT factor" />
        <KpiCard label="Grid electricity" value={scope2.total_grid_import_mwh.toFixed(2)} unit="MWh" tone="cyan" trend={`${scope2.months_evaluated} months`} detail="Real net imported electricity (residential4)" />
        <KpiCard label="On-site PV" value={totalPvMwh.toFixed(2)} unit="MWh" tone="green" trend={`${pvSharePct}% share`} detail="Real physical generation contribution" />
        <KpiCard label="Indicative avoided" value={totalAvoided.toFixed(2)} unit="tCO₂-e" tone="amber" trend="Reference only" detail="Real PV × same location factor" />
      </div>
      <div className="dashboardGrid">
        <Panel title="Monthly electricity emissions" description="Dark bars: Scope 2 · green bars: indicative PV avoided — all real, 2016" className="span2"><CarbonBars months={carbonMonths} /><div className="chartLegend centered"><span className="legendEmissions">Scope 2 emissions</span><span className="legendAvoided">Indicative avoided</span></div></Panel>
        <Panel title="Active emission factor" description="Northern Territory · location based · real published value"><div className="factorCard"><span>NGA Factors 2025, Table 1</span><strong>{carbonFactor.value} <em>kg CO₂-e / kWh</em></strong><dl><div><dt>Region</dt><dd>{carbonFactor.region}</dd></div><div><dt>Effective year</dt><dd>{carbonFactor.effectiveYear}</dd></div><div><dt>Source</dt><dd>DCCEEW, direct download</dd></div><div><dt>Method</dt><dd>Grid import × factor</dd></div></dl><Badge tone="info">sha256 {carbonFactor.sha256.slice(0, 12)}…</Badge></div></Panel>
      </div>
      <Panel title="Audit-ready calculation chain" description="Real December 2016 entry — independently recomputable">
        <div className="ledgerChain"><div><span>1</span><strong>Metered import</strong><small>{lastMonth.grid_import_kwh.toLocaleString()} kWh · real, residential4</small></div><b>×</b><div><span>2</span><strong>Emission factor</strong><small>{carbonFactor.value} kg CO₂-e/kWh · NGA 2025</small></div><b>=</b><div><span>3</span><strong>Ledger entry</strong><small>{(lastMonth.emissions_kg_co2e / 1000).toFixed(2)} tCO₂-e · CARB-CALC-v1.1</small></div><b>→</b><div><span>4</span><strong>Monthly report</strong><small>Recompute consistency {scope2.recompute_consistency_pct}%</small></div></div>
        <p className="boundaryBanner"><strong>Reporting boundary:</strong> This ledger supports operational carbon accounting and evidence preparation. It does not replace NGER reporting, assurance, certification or legal advice.</p>
      </Panel>
      <MethodologyNote>Grid import from Open Power System Data household_data ({opsdSource.licence}, residential4, real 2016 meter readings), not the Alice Springs pilot. Factor is the real published NT (DKIS) value from DCCEEW.</MethodologyNote>
    </>
  );
}
