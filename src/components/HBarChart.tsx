import React from 'react';
import { formatPaise } from '@/lib/money';

export interface CategoryBarData {
  category: string;
  amountPaise: number;
  limitPaise?: number | null;
}

export interface HBarChartProps {
  data: CategoryBarData[];
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function HBarChart({ data }: HBarChartProps) {
  // Sort descending by amount
  const sorted = [...data].sort((a, b) => b.amountPaise - a.amountPaise);

  if (sorted.length === 0 || sorted.every((d) => d.amountPaise === 0)) {
    return (
      <div className="border border-rule p-4 text-xs text-ink-2">
        No category spend to display in chart.
      </div>
    );
  }

  // Find max value to calibrate horizontal scale (at least max amount or max limit)
  let maxVal = 1;
  for (const item of sorted) {
    if (item.amountPaise > maxVal) maxVal = item.amountPaise;
    if (item.limitPaise && item.limitPaise > maxVal) maxVal = item.limitPaise;
  }

  const chartHeight = sorted.length * 44;
  const barHeight = 16;
  const rowHeight = 44;
  const chartWidth = 500;
  const barAreaWidth = 320; // right 320px for bar, left 180px for text
  const labelWidth = 150;

  const topCategory = sorted[0];
  const ariaLabel = `Horizontal bar chart of spend by category. Largest category is ${capitalize(
    topCategory.category
  )} at ${formatPaise(topCategory.amountPaise)}.`;

  return (
    <div className="w-full">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto overflow-visible font-mono text-xs"
      >
        {sorted.map((item, index) => {
          const y = index * rowHeight;
          const isOverLimit = !!(item.limitPaise && item.amountPaise > item.limitPaise);
          const barWidth = Math.max(
            Math.round((item.amountPaise / maxVal) * barAreaWidth),
            item.amountPaise > 0 ? 2 : 0
          );
          const limitX = item.limitPaise
            ? labelWidth + Math.round((item.limitPaise / maxVal) * barAreaWidth)
            : null;

          return (
            <g key={item.category} transform={`translate(0, ${y})`}>
              {/* Category label and amount */}
              <text
                x={0}
                y={barHeight - 2}
                className="fill-ink text-xs font-sans capitalize"
              >
                {capitalize(item.category)}
              </text>
              <text
                x={labelWidth - 10}
                y={barHeight - 2}
                textAnchor="end"
                className="fill-ink-2 text-xs font-mono tabular-nums"
              >
                {formatPaise(item.amountPaise)}
              </text>

              {/* Background track */}
              <rect
                x={labelWidth}
                y={2}
                width={barAreaWidth}
                height={barHeight}
                className="fill-paper-2"
              />

              {/* Spend bar */}
              <rect
                x={labelWidth}
                y={2}
                width={barWidth}
                height={barHeight}
                className={isOverLimit ? 'fill-brick' : 'fill-ink'}
              />

              {/* Limit mark if present */}
              {limitX !== null && (
                <g>
                  <line
                    x1={limitX}
                    y1={0}
                    x2={limitX}
                    y2={barHeight + 4}
                    stroke="var(--color-brick)"
                    strokeWidth={2}
                  />
                  <title>
                    Limit: {formatPaise(item.limitPaise!)}
                  </title>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Visually hidden table for accessibility */}
      <table className="sr-only">
        <caption>Category spending data</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Spent</th>
            <th scope="col">Limit</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.category}>
              <td>{capitalize(item.category)}</td>
              <td>{formatPaise(item.amountPaise)}</td>
              <td>{item.limitPaise ? formatPaise(item.limitPaise) : 'None'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
