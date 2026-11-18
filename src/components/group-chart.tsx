// Every group member's weight (or % change) as a coloured line, each with a
// dashed least-squares trendline in the same colour.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RankingMetric } from '@/lib/api/types';
import { dayNumber, linearTrend } from '@/lib/stats';

export type ChartSeries = {
  userId: string;
  name: string;
  color: string;
  isMe: boolean;
  points: { measuredOn: string; weightKg: number }[]; // oldest first
};

const HEIGHT = 240;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };

function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}`;
}

export function GroupChart({
  series,
  metric,
  showWeighIns = true,
}: {
  series: ChartSeries[];
  metric: RankingMetric;
  /** Off: only the trendlines. */
  showWeighIns?: boolean;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  // In % mode each line shows change from that person's first point in range.
  const lines = series
    .filter((s) => s.points.length > 0)
    .map((s) => {
      const base = s.points[0].weightKg;
      const pts = s.points.map((p) => ({
        x: dayNumber(p.measuredOn),
        y: metric === 'kg' ? p.weightKg : ((p.weightKg - base) / base) * 100,
      }));
      return { ...s, pts, trend: linearTrend(pts) };
    });

  if (lines.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        No weigh-ins in this period yet.
      </ThemedText>
    );
  }

  const allX = lines.flatMap((l) => l.pts.map((p) => p.x));
  const allY = lines.flatMap((l) => l.pts.map((p) => p.y));
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  let minY = Math.min(...allY);
  let maxY = Math.max(...allY);
  const minSpan = metric === 'kg' ? 2 : 1;
  if (maxY - minY < minSpan) {
    const mid = (maxY + minY) / 2;
    minY = mid - minSpan / 2;
    maxY = mid + minSpan / 2;
  }
  const pad = (maxY - minY) * 0.08;
  minY -= pad;
  maxY += pad;

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (v: number) => PAD.left + (maxX === minX ? plotW / 2 : ((v - minX) / (maxX - minX)) * plotW);
  const y = (v: number) => PAD.top + ((maxY - v) / (maxY - minY)) * plotH;
  const label = (v: number) => (metric === 'kg' ? v.toFixed(0) : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);

  const grid = [maxY - pad, (maxY + minY) / 2, minY + pad];
  const firstDate = new Date(minX * 86_400_000).toISOString().slice(0, 10);
  const lastDate = new Date(maxX * 86_400_000).toISOString().slice(0, 10);

  // Draw "me" last so my line is on top.
  const ordered = [...lines].sort((a, b) => Number(a.isMe) - Number(b.isMe));

  return (
    <View style={styles.wrap}>
      <View
        style={styles.chart}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityLabel={`Group chart of ${metric === 'kg' ? 'weight' : 'percent change'} for ${lines.map((l) => l.name).join(', ')}`}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {grid.map((v) => (
              <Line key={v} x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={theme.border} strokeWidth={1} />
            ))}
            {grid.map((v) => (
              <SvgText key={`l${v}`} x={PAD.left - 6} y={y(v) + 4} fontSize={11} fill={theme.textSecondary} textAnchor="end">
                {label(v)}
              </SvgText>
            ))}
            {metric === 'pct' && minY < 0 && maxY > 0 && (
              <Line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke={theme.textSecondary} strokeWidth={1} />
            )}

            {showWeighIns &&
              ordered.map((l) => (
                <Path
                  key={l.userId}
                  d={l.pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')}
                  stroke={l.color}
                  strokeWidth={l.isMe ? 2.5 : 1.5}
                  strokeOpacity={0.55}
                  fill="none"
                  strokeLinejoin="round"
                />
              ))}
            {ordered.map((l) => {
              if (!l.trend) return null;
              const x1 = l.pts[0].x;
              const x2 = l.pts[l.pts.length - 1].x;
              return (
                <Line
                  key={`t${l.userId}`}
                  x1={x(x1)}
                  y1={y(l.trend.slope * x1 + l.trend.intercept)}
                  x2={x(x2)}
                  y2={y(l.trend.slope * x2 + l.trend.intercept)}
                  stroke={l.color}
                  strokeWidth={2.5}
                  strokeDasharray="7 4"
                />
              );
            })}

            <SvgText x={PAD.left} y={HEIGHT - 6} fontSize={11} fill={theme.textSecondary}>
              {shortDate(firstDate)}
            </SvgText>
            <SvgText x={width - PAD.right} y={HEIGHT - 6} fontSize={11} fill={theme.textSecondary} textAnchor="end">
              {shortDate(lastDate)}
            </SvgText>
          </Svg>
        )}
      </View>

      <View style={styles.legend}>
        {lines.map((l) => (
          <View key={l.userId} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: l.color }]} />
            <ThemedText type="small">
              {l.name}
              {l.isMe ? ' (you)' : ''}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  chart: { height: HEIGHT, width: '100%' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 12, height: 12, borderRadius: 6 },
});
