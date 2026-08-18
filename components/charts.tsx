import type { CarbonMonth, EnergyPoint, ForecastPoint } from "@/lib/types";

const dimensions = { width: 800, height: 260, padX: 20, padY: 20 };

function linePath(values: number[], max: number, min = 0) {
  const { width, height, padX, padY } = dimensions;
  const span = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = padX + (index / Math.max(values.length - 1, 1)) * (width - padX * 2);
    const y = height - padY - ((value - min) / span) * (height - padY * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function EnergyChart({ points }: { points: EnergyPoint[] }) {
  // Headroom above the real peak, not a fixed floor -- this reference dataset is a
  // real household/small-commercial site (single-digit kW), not a precinct-scale
  // system, so a hardcoded floor (previously 320) swamped the real range and
  // rendered every line as a flat sliver against the axis.
  const realMax = Math.max(...points.flatMap((point) => [point.loadKw, point.pvKw, point.gridKw, point.bessKw]), 0);
  const max = realMax * 1.15 || 1;
  const labels = [0, 12, 24, 36, 47];
  return (
    <div className="chartWrap">
      <div className="chartLegend"><span className="legendLoad">Site load</span><span className="legendPv">Solar PV</span><span className="legendGrid">Grid</span><span className="legendBess">BESS</span></div>
      <svg className="lineChart" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} role="img" aria-label="24 hour site load, solar PV, grid and battery power chart">
        {[0.25, 0.5, 0.75].map((fraction) => <line key={fraction} x1="20" x2="780" y1={260 - fraction * 220} y2={260 - fraction * 220} className="gridLine" />)}
        <path d={linePath(points.map((p) => p.loadKw), max)} className="chartLine loadLine" />
        <path d={linePath(points.map((p) => p.pvKw), max)} className="chartLine pvLine" />
        <path d={linePath(points.map((p) => p.gridKw), max)} className="chartLine gridPowerLine" />
        <path d={linePath(points.map((p) => Math.max(0, p.bessKw)), max)} className="chartLine bessLine" />
      </svg>
      <div className="axisLabels">{labels.map((index) => <span key={index}>{points[index].label}</span>)}</div>
    </div>
  );
}

export function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const realMax = Math.max(...points.map((point) => point.p95), 0);
  const max = realMax * 1.15 || 1;
  const upper = points.map((point) => point.p95);
  const lower = points.map((point) => point.p05);
  const upperPath = linePath(upper, max);
  const reversedLower = linePath([...lower].reverse(), max).replace(/^M/, "L");
  return (
    <div className="chartWrap">
      <div className="chartLegend"><span className="legendForecast">P50 forecast</span><span className="legendBand">90% interval</span><span className="legendActual">Actual</span></div>
      <svg className="lineChart" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} role="img" aria-label="24 hour probabilistic load forecast with 90 percent interval">
        {[0.25, 0.5, 0.75].map((fraction) => <line key={fraction} x1="20" x2="780" y1={260 - fraction * 220} y2={260 - fraction * 220} className="gridLine" />)}
        <path d={`${upperPath} ${reversedLower} Z`} className="forecastBand" />
        <path d={linePath(points.map((p) => p.p50), max)} className="chartLine forecastLine" />
        <path d={linePath(points.map((p) => p.actual ?? p.p50), max)} className="chartLine actualLine" />
      </svg>
      <div className="axisLabels"><span>{points[0].label}</span><span>{points[6].label}</span><span>{points[12].label}</span><span>{points[18].label}</span><span>{points.at(-1)?.label}</span></div>
    </div>
  );
}

export function CarbonBars({ months }: { months: CarbonMonth[] }) {
  const realMax = Math.max(...months.map((month) => Math.max(month.emissionsTco2e, month.avoidedTco2e)), 0);
  const max = realMax * 1.15 || 1;
  return (
    <div className="barChart" role="img" aria-label="Monthly Scope 2 emissions and avoided emissions">
      {months.map((month) => (
        <div className="barGroup" key={month.month}>
          <div className="bars">
            <span className="barEmissions" style={{ height: `${(month.emissionsTco2e / max) * 100}%` }} title={`${month.emissionsTco2e} tCO2-e`} />
            <span className="barAvoided" style={{ height: `${(month.avoidedTco2e / max) * 100}%` }} title={`${month.avoidedTco2e} tCO2-e avoided`} />
          </div>
          <small>{month.month}</small>
        </div>
      ))}
    </div>
  );
}

export function Donut({ value, label, sublabel, tone = "green" }: { value: number; label: string; sublabel: string; tone?: "green" | "cyan" | "amber" }) {
  return (
    <div className={`donut donut-${tone}`} style={{ background: `conic-gradient(var(--donut-color) ${value * 3.6}deg, var(--line) 0deg)` }} role="img" aria-label={`${label} ${value}%`}>
      <div><strong>{value}%</strong><span>{label}</span><small>{sublabel}</small></div>
    </div>
  );
}
