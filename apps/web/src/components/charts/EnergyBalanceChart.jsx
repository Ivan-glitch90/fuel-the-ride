import { useState } from 'react';
import { max, scaleBand, scaleLinear, timeFormat } from 'd3';
import {
  CHART_HEIGHT,
  ChartTable,
  columnPath,
  Legend,
  MARGIN,
  Tooltip,
  UNIT_LABEL_Y,
  useElementWidth,
  YGrid,
} from './chartKit.jsx';

const fmtTick = timeFormat('%b %-d');
const fmtLong = timeFormat('%a, %b %-d');
const kcal = (n) => Math.round(n).toLocaleString('en-US');

/**
 * Calories burned vs eaten, one pair of columns per ride with logged intake.
 * Columns ≤ 24 px, 4 px rounded tops, 2 px gap; each ride is a focusable hit target with a tooltip.
 */
export function EnergyBalanceChart({ rides }) {
  const [containerRef, width] = useElementWidth();
  const [active, setActive] = useState(null);

  const data = rides.map((r) => ({ ...r, date: new Date(r.date) }));
  const x = scaleBand()
    .domain(data.map((d) => d.rideId))
    .range([MARGIN.left + 4, width - MARGIN.right])
    .paddingInner(0.35)
    .paddingOuter(0.2);
  const barWidth = Math.max(2, Math.min(24, (x.bandwidth() - 2) / 2));
  const groupOffset = (x.bandwidth() - (barWidth * 2 + 2)) / 2;
  const y = scaleLinear()
    .domain([0, max(data, (d) => Math.max(d.kcalBurned, d.kcalEaten)) || 500])
    .nice()
    .range([CHART_HEIGHT - MARGIN.bottom, MARGIN.top]);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(width / 72))));

  const a = active === null ? null : data[active];
  const covered = (d) => (d.kcalBurned > 0 ? Math.round((d.kcalEaten / d.kcalBurned) * 100) : 0);

  return (
    <div className="chart" ref={containerRef}>
      <Legend
        items={[
          { label: 'Burned', shape: 'square', color: 'var(--series-1)' },
          { label: 'Eaten', shape: 'square', color: 'var(--series-2)' },
        ]}
      />
      <div className="chart__plot">
        <svg width={width} height={CHART_HEIGHT} role="group" aria-label="Calories burned and eaten per ride">
          <YGrid scale={y} width={width} format={kcal} />
          <g className="chart-axis" aria-hidden="true">
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(0)} y2={y(0)} />
            {data.map((d, i) =>
              i % labelEvery === 0 ? (
                <text key={d.rideId} x={x(d.rideId) + x.bandwidth() / 2} y={CHART_HEIGHT - 8} textAnchor="middle">
                  {fmtTick(d.date)}
                </text>
              ) : null,
            )}
          </g>
          <text className="chart-unit" x={MARGIN.left - 6} y={UNIT_LABEL_Y} textAnchor="end" aria-hidden="true">
            kcal
          </text>

          {data.map((d, i) => {
            const left = x(d.rideId) + groupOffset;
            const label = `${d.name ?? 'Ride'}, ${fmtLong(d.date)}: burned ${kcal(d.kcalBurned)} kcal, ate ${kcal(d.kcalEaten)} kcal`;
            return (
              <g
                key={d.rideId}
                className={`chart-group ${active === i ? 'chart-group--active' : ''}`}
                tabIndex={0}
                role="img"
                aria-label={label}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                {/* Hit target: the whole slot, bigger than the marks */}
                <rect className="chart-hit" x={x(d.rideId)} y={MARGIN.top} width={x.bandwidth()} height={y(0) - MARGIN.top} />
                {active === i && (
                  <rect
                    className="chart-focus-ring"
                    x={x(d.rideId) - 2}
                    y={MARGIN.top - 2}
                    width={x.bandwidth() + 4}
                    height={y(0) - MARGIN.top + 4}
                    rx={6}
                  />
                )}
                <path d={columnPath(left, y(d.kcalBurned), barWidth, y(0) - y(d.kcalBurned))} style={{ fill: 'var(--series-1)' }} />
                <path
                  d={columnPath(left + barWidth + 2, y(d.kcalEaten), barWidth, y(0) - y(d.kcalEaten))}
                  style={{ fill: 'var(--series-2)' }}
                />
              </g>
            );
          })}
        </svg>
        {a && (
          <Tooltip
            x={x(a.rideId) + x.bandwidth() / 2}
            containerWidth={width}
            title={`${a.name ?? 'Ride'} · ${fmtLong(a.date)}`}
            rows={[
              { label: 'burned', value: `${kcal(a.kcalBurned)} kcal`, color: 'var(--series-1)' },
              { label: 'eaten', value: `${kcal(a.kcalEaten)} kcal`, color: 'var(--series-2)' },
              { label: 'of burned', value: `${covered(a)}%` },
            ]}
          />
        )}
      </div>
      <ChartTable
        caption="Calories burned and eaten per ride"
        columns={['Ride', 'Date', 'Burned', 'Eaten', 'Eaten vs burned']}
        rows={data.map((d) => ({
          key: d.rideId,
          cells: [d.name ?? 'Ride', fmtLong(d.date), `${kcal(d.kcalBurned)} kcal`, `${kcal(d.kcalEaten)} kcal`, `${covered(d)}%`],
        }))}
      />
    </div>
  );
}
