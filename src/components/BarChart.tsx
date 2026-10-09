import React from 'react';
import { formatPaise } from '@/lib/money';

export interface DailyBarData {
  date: string; // YYYY-MM-DD
  amountPaise: number;
}

export interface BarChartProps {
  data: DailyBarData[];
  plannedDailyAveragePaise?: number | null;
}

function formatDateShort(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      return `${day} ${months[monthIdx] || ''}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function BarChart({ data, plannedDailyAveragePaise }: BarChartProps) {
  if (data.length === 0 || data.every((d) => d.amountPaise === 0)) {
    return (
      <div className="border border-rule p-4 text-xs text-ink-2">
        No daily spend to display in chart.
      </div>
    );
  }

  // Find max value to calibrate vertical scale
  let maxVal = plannedDailyAveragePaise || 1;
  for (const item of data) {
    if (item.amountPaise > maxVal) {
      maxVal = item.amountPaise;
    }
  }

  const chartWidth = Math.max(500, data.length * 48);
  const chartHeight = 180;
  const bottomAxisY = 150;
  const topPadding = 24;
  const plotHeight = bottomAxisY - topPadding;

  const barSlotWidth = chartWidth / data.length;
  const barWidth = Math.max(12, Math.min(32, barSlotWidth - 12));

  const averageLineY =
    plannedDailyAveragePaise && plannedDailyAveragePaise > 0
      ? bottomAxisY - Math.round((plannedDailyAveragePaise / maxVal) * plotHeight)
      : null;

  const totalSpent = data.reduce((sum, d) => sum + d.amountPaise, 0);
  const ariaLabel = `Vertical bar chart of spend per day across ${data.length} recorded dates. Total spend is ${formatPaise(totalSpent)}.`;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{ minWidth: `${Math.min(chartWidth, 500)}px` }}
        className="w-full h-auto overflow-visible font-mono text-xs"
      >
        {/* Baseline axis */}
        <line
          x1={0}
          y1={bottomAxisY}
          x2={chartWidth}
          y2={bottomAxisY}
          stroke="var(--color-rule)"
          strokeWidth={1}
        />

        {/* Planned daily average line */}
        {averageLineY !== null && (
          <g>
            <line
              x1={0}
              y1={averageLineY}
              x2={chartWidth}
              y2={averageLineY}
              stroke="var(--color-ink-2)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={chartWidth - 6}
              y={averageLineY - 4}
              textAnchor="end"
              className="fill-ink-2 text-[10px] font-sans"
            >
              Planned avg {formatPaise(plannedDailyAveragePaise!)}
            </text>
          </g>
        )}

        {/* Vertical bars */}
        {data.map((item, index) => {
          const x = index * barSlotWidth + (barSlotWidth - barWidth) / 2;
          const barHeight = Math.max(
            Math.round((item.amountPaise / maxVal) * plotHeight),
            item.amountPaise > 0 ? 2 : 0
          );
          const y = bottomAxisY - barHeight;

          return (
            <g key={item.date}>
              {/* Amount text above bar */}
              {item.amountPaise > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-ink-2 text-[10px] tabular-nums"
                >
                  {formatPaise(item.amountPaise)}
                </text>
              )}

              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                className="fill-ink"
              />

              {/* Date label under bar */}
              <text
                x={x + barWidth / 2}
                y={bottomAxisY + 16}
                textAnchor="middle"
                className="fill-ink-2 text-[11px] font-sans"
              >
                {formatDateShort(item.date)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Visually hidden table for accessibility */}
      <table className="sr-only">
        <caption>Daily spending data</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Spent</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.date}>
              <td>{item.date}</td>
              <td>{formatPaise(item.amountPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
