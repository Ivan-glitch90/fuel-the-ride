import { useRef, useState } from 'react';
import { curveStepAfter, line, max, scaleLinear, scaleTime, timeFormat } from 'd3';
import { CHART_HEIGHT, ChartTable, Legend, MARGIN, Tooltip, UNIT_LABEL_Y, useElementWidth, YGrid } from './chartKit.jsx';

const DAY_MS = 24 * 60 * 60 * 1000;
const fmtTick = timeFormat('%b %-d');
const fmtLong = timeFormat('%a, %b %-d');
const END_LABEL_ROOM = 56;

/**
 * Gut training over time.
 *  - Trained rate: a step line (it changes when the rider accepts a suggestion), extended to today
 *  - Ate: one dot per checked-in ride (actual g/hr)
 * Crosshair + tooltip on hover/tap, arrow keys when focused, and a table view.
 */
export function CarbRateChart({ points, currentGph, today = new Date() }) {
  const [containerRef, width] = useElementWidth();
  const svgRef = useRef(null);
  const [active, setActive] = useState(null);

  const data = points.map((p) => ({ ...p, date: new Date(p.date) }));
  const last = data[data.length - 1].date;
  const end = today > last ? today : last;
  const start = end - data[0].date < DAY_MS ? new Date(end - 7 * DAY_MS) : data[0].date;
  const trained = [...data.map((p) => ({ date: p.date, value: p.trainedGph })), { date: end, value: currentGph }];
  const ate = data.filter((p) => p.actualGph !== null);

  const x = scaleTime()
    .domain([start, end])
    .range([MARGIN.left + 8, width - MARGIN.right - END_LABEL_ROOM]);
  const yTop = max([...trained.map((t) => t.value), ...ate.map((a) => a.actualGph), 30]);
  const y = scaleLinear()
    .domain([0, yTop * 1.15])
    .nice()
    .range([CHART_HEIGHT - MARGIN.bottom, MARGIN.top]);
  const trainedPath = line()
    .x((d) => x(d.date))
    .y((d) => y(d.value))
    .curve(curveStepAfter)(trained);

  function nearestIndex(px) {
    let best = 0;
    data.forEach((d, i) => {
      if (Math.abs(x(d.date) - px) < Math.abs(x(data[best].date) - px)) best = i;
    });
    return best;
  }
  const onPointerMove = (e) => {
    const box = svgRef.current.getBoundingClientRect();
    setActive(nearestIndex(e.clientX - box.left));
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') setActive((i) => Math.min(data.length - 1, (i ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setActive((i) => Math.max(0, (i ?? data.length) - 1));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const a = active === null ? null : data[active];
  const first = data[0].trainedGph;
  const summary = `Trained carb rate: ${first} g/hr at the first check-in, ${currentGph} g/hr now, over ${data.length} check-ins.`;

  return (
    <div className="chart" ref={containerRef}>
      <Legend
        items={[
          { label: 'Trained rate', shape: 'line', color: 'var(--series-1)' },
          { label: 'Ate (per ride)', shape: 'dot', color: 'var(--series-2)' },
        ]}
      />
      <div className="chart__plot">
        <svg
          ref={svgRef}
          width={width}
          height={CHART_HEIGHT}
          role="img"
          aria-label={`${summary} Use the left and right arrow keys to read each check-in.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((i) => i ?? data.length - 1)}
          onBlur={() => setActive(null)}
        >
          <YGrid scale={y} width={width} format={(t) => `${t}`} />
          <g className="chart-axis" aria-hidden="true">
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(0)} y2={y(0)} />
            {x.ticks(Math.max(2, Math.floor(width / 110))).map((t) => (
              <text key={+t} x={x(t)} y={CHART_HEIGHT - 8} textAnchor="middle">
                {fmtTick(t)}
              </text>
            ))}
          </g>
          <text className="chart-unit" x={MARGIN.left - 6} y={UNIT_LABEL_Y} textAnchor="end" aria-hidden="true">
            g/hr
          </text>

          {a && <line className="chart-crosshair" x1={x(a.date)} x2={x(a.date)} y1={MARGIN.top} y2={y(0)} />}

          <path d={trainedPath} className="chart-line" style={{ stroke: 'var(--series-1)' }} />
          {ate.map((d) => (
            <circle
              key={d.rideId}
              className="chart-dot"
              cx={x(d.date)}
              cy={y(d.actualGph)}
              r={a && a.rideId === d.rideId ? 6 : 4.5}
              style={{ fill: 'var(--series-2)' }}
            />
          ))}
          <circle className="chart-dot" cx={x(end)} cy={y(currentGph)} r={4.5} style={{ fill: 'var(--series-1)' }} />
          <text className="chart-end-label" x={x(end) + 8} y={y(currentGph)} dy="0.32em">
            {currentGph} g/hr
          </text>

          <rect
            className="chart-hit"
            x={MARGIN.left}
            y={MARGIN.top}
            width={Math.max(0, width - MARGIN.left - MARGIN.right)}
            height={y(0) - MARGIN.top}
            onPointerMove={onPointerMove}
            onPointerDown={onPointerMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        {a && (
          <Tooltip
            x={x(a.date)}
            containerWidth={width}
            title={fmtLong(a.date)}
            rows={[
              { label: 'trained rate', value: `${a.trainedGph} g/hr`, color: 'var(--series-1)' },
              {
                label: 'ate',
                value: a.actualGph === null ? 'not logged' : `${a.actualGph} g/hr`,
                color: 'var(--series-2)',
              },
              ...(a.targetGph !== null ? [{ label: 'plan', value: `${a.targetGph} g/hr` }] : []),
              { label: 'stomach', value: `${a.giScore}/5` },
            ]}
          />
        )}
      </div>
      <ChartTable
        caption="Trained carb rate and carbs eaten per checked-in ride"
        columns={['Date', 'Trained rate', 'Ate', 'Plan', 'Stomach']}
        rows={data.map((d) => ({
          key: d.rideId,
          cells: [
            fmtLong(d.date),
            `${d.trainedGph} g/hr`,
            d.actualGph === null ? '—' : `${d.actualGph} g/hr`,
            d.targetGph === null ? '—' : `${d.targetGph} g/hr`,
            `${d.giScore}/5`,
          ],
        }))}
      />
    </div>
  );
}
