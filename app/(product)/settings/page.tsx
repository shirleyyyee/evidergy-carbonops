import { Badge, MethodologyNote, PageHeader, Panel } from "@/components/ui";
import { dataVersion, site, sources } from "@/lib/reference-dataset";

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Configuration & governance" title="Site settings" description="Review connection boundaries, sign conventions, thresholds, data licences and report defaults." action={<button className="button buttonPrimary">Save configuration</button>} />
      <div className="settingsGrid">
        <Panel title="Site profile" description="Operational metadata"><div className="formGrid"><label>Site name<input defaultValue={site.name} readOnly /></label><label>Timezone<select defaultValue={site.timezone}><option>{site.timezone}</option><option>Australia/Darwin</option><option>Australia/Sydney</option><option>Australia/Perth</option></select></label><label>Connection model<select defaultValue="single-pcc"><option value="single-pcc">Single PCC microgrid</option></select></label><label>Operating mode<input value="Read-only analytics" readOnly /></label></div></Panel>
        <Panel title="Physical conventions" description="Must be confirmed against raw exports"><div className="settingRows"><div><span>Grid power</span><strong>Positive = import</strong><Badge tone="good">Confirmed</Badge></div><div><span>BESS power</span><strong>Positive = discharge</strong><Badge tone="warn">Pilot assumption</Badge></div><div><span>Interval</span><strong>15 minutes (reference); 5 minutes (pilot target)</strong><Badge tone="good">Confirmed</Badge></div><div><span>Balance tolerance</span><strong>±3% of site load</strong><Badge tone="info">Calibrated</Badge></div></div></Panel>
        <Panel title="Data licence register" description="Commercial use and redistribution gate" className="span2">
          <div className="licenceTable tableLike">
            <div className="tableHead"><span>Source</span><span>Use</span><span>Commercial status</span><span>Redistribution</span><span>Action</span></div>
            {sources.map((s) => (
              <div className="tableRow" key={s.id}><strong>{s.name}</strong><span>Active — reference backtest</span><Badge tone="good">{s.licence}</Badge><span>Direct download, checksummed</span><a className="textButton" href={s.url} target="_blank" rel="noreferrer">Open source</a></div>
            ))}
            <div className="tableRow"><strong>DKP 2024–2025</strong><span>Energy / BESS / forecast (pilot target)</span><Badge tone="warn">Review required</Badge><span>Aggregates only</span><button className="textButton">Open terms</button></div>
            <div className="tableRow"><strong>DKASC 2018–2021</strong><span>PV baseline / event replay (pilot target)</span><Badge tone="warn">Threshold applies</Badge><span>≤5,000 units</span><button className="textButton">Open terms</button></div>
            <div className="tableRow"><strong>CQU DKA Fault Data</strong><span>Research benchmark (optional)</span><Badge tone="danger">Non-commercial</Badge><span>CC BY-NC-SA 4.0</span><button className="textButton">View licence</button></div>
          </div>
        </Panel>
      </div>
      <MethodologyNote>Currently active data version: <code>{dataVersion}</code>. The DKP/DKASC rows above are the Sprint 1 pilot-data target described in docs/CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md — not yet downloaded, pending written permission.</MethodologyNote>
    </>
  );
}
