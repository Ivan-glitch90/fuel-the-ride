import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/index.js';

// Shared pieces for the D3 charts: D3 does the maths (scales, shapes, ticks), React draws the SVG.

// top leaves a row for the unit label ("g/hr", "kcal") above the highest tick
export const MARGIN = { top: 30, right: 16, bottom: 28, left: 40 };
export const CHART_HEIGHT = 234;
export const UNIT_LABEL_Y = 12;

/** Width of a container, following resizes (falls back to 320 where ResizeObserver doesn't exist, e.g. tests). */
export function useElementWidth(fallback = 320) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Column with a 4px rounded data end and a square baseline. */
export function columnPath(x, y, width, height, radius = 4) {
  if (height <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  const bottom = y + height;
  return `M${x},${bottom}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${bottom}Z`;
}

/** Legend: mirrors the marks (line key for lines, dot for dots, square for columns). Text stays in text colours. */
export function Legend({ items }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span className={`chart-legend__key chart-legend__key--${item.shape}`} style={{ '--key-color': item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Horizontal gridlines + y tick labels (hairline, recessive). */
export function YGrid({ scale, width, ticks = 4, format = String }) {
  return (
    <g className="chart-grid" aria-hidden="true">
      {scale.ticks(ticks).map((t) => (
        <g key={t} transform={`translate(0,${scale(t)})`}>
          <line x1={MARGIN.left} x2={width - MARGIN.right} />
          <text x={MARGIN.left - 6} dy="0.32em" textAnchor="end">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

const TOOLTIP_WIDTH = 210;
const TOOLTIP_GAP = 14;

/**
 * Tooltip box: value first (strong), label after (muted); line keys for series.
 * Sits beside the crosshair (right of it on the left half, left of it on the right half)
 * so it never covers the point being read.
 */
export function Tooltip({ x, containerWidth, title, rows }) {
  const preferred = x < containerWidth / 2 ? x + TOOLTIP_GAP : x - TOOLTIP_GAP - TOOLTIP_WIDTH;
  const left = Math.min(Math.max(preferred, 0), Math.max(0, containerWidth - TOOLTIP_WIDTH));
  return (
    <div className="chart-tooltip" style={{ left, width: TOOLTIP_WIDTH }} role="status">
      <p className="chart-tooltip__title">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="chart-tooltip__row">
          {row.color && <span className="chart-tooltip__key" style={{ '--key-color': row.color }} aria-hidden="true" />}
          <strong>{row.value}</strong> <span className="muted">{row.label}</span>
        </p>
      ))}
    </div>
  );
}

/** "Show as table" toggle + the table itself: every value reachable without hovering or colour. */
export function ChartTable({ caption, columns, rows }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="chart-table">
      <button type="button" className="btn btn--ghost" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? t('Hide table') : t('Show as table')}
      </button>
      {open && (
        <div className="chart-table__scroll">
          <table>
            <caption className="visually-hidden">{caption}</caption>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, i) => (
                    <td key={columns[i]}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
