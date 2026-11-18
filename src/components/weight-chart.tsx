// Line chart of weigh-ins over time, with an optional dashed goal line.
// Plain react-native-svg: no chart library needed for one line.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import type { WeighIn } from '@/lib/api/types';
import { dayNumber, linearTrend } from '@/lib/stats';

const HEIGHT = 200;
const PAD = { top: 16, right: 12, bottom: 24, left: 40 };

function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}`;
}

/** `points` must be oldest first. With `showWeighIns` off only the trendline is drawn. */
export function WeightChart({
  points,
  goalKg,
  showWeighIns = true,
}: {
  points: WeighIn[];
  goalKg?: number | null;
  showWeighIns?: boolean;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  if (points.length === 0) return null;

  const weights = points.map((p) => p.weightKg);
  if (goalKg != null) weights.push(goalKg);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (max - min < 2) {
    // Keep a sensible scale when the weight barely moves.
    const mid = (max + min) / 2;
    min = mid - 1;
    max = mid + 1;
  }
  const yPad = (max - min) * 0.1;
  min -= yPad;
  max += yPad;

  const first = dayNumber(points[0].measuredOn);
  const last = dayNumber(points[points.length - 1].measuredOn);
  const span = Math.max(1, last - first);
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const x = (date: string) =>
    points.length === 1 ? PAD.left + plotW / 2 : PAD.left + ((dayNumber(date) - first) / span) * plotW;
  const y = (kg: number) => PAD.top + ((max - kg) / (max - min)) * plotH;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.measuredOn).toFixed(1)},${y(p.weightKg).toFixed(1)}`)
    .join(' ');

  const gridValues = [max - yPad, (max + min) / 2, min + yPad];
  const trend = linearTrend(points.map((p) => ({ x: dayNumber(p.measuredOn), y: p.weightKg })));
  const trendY = (date: string) => (trend ? trend.slope * dayNumber(date) + trend.intercept : 0);

  return (
    <View
      style={styles.container}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={`Weight chart, ${points.length} weigh-ins from ${points[0].measuredOn} to ${points[points.length - 1].measuredOn}`}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {gridValues.map((v) => (
            <Line
              key={v}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke={theme.border}
              strokeWidth={1}
            />
          ))}
          {gridValues.map((v) => (
            <SvgText key={`l${v}`} x={PAD.left - 6} y={y(v) + 4} fontSize={11} fill={theme.textSecondary} textAnchor="end">
              {v.toFixed(1)}
            </SvgText>
          ))}

          {goalKg != null && (
            <>
              <Line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(goalKg)}
                y2={y(goalKg)}
                stroke={theme.success}
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
              <SvgText x={width - PAD.right} y={y(goalKg) - 6} fontSize={11} fill={theme.success} textAnchor="end">
                Goal
              </SvgText>
            </>
          )}

          {showWeighIns && (
            <Path d={path} stroke={theme.accent} strokeWidth={2} strokeOpacity={0.55} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {trend && points.length > 1 && (
            <Line
              x1={x(points[0].measuredOn)}
              y1={y(trendY(points[0].measuredOn))}
              x2={x(points[points.length - 1].measuredOn)}
              y2={y(trendY(points[points.length - 1].measuredOn))}
              stroke={theme.accent}
              strokeWidth={2.5}
              strokeDasharray="7 4"
            />
          )}
          {showWeighIns &&
            points.length <= 60 &&
            points.map((p) => (
              <Circle key={p.id} cx={x(p.measuredOn)} cy={y(p.weightKg)} r={3} fill={theme.accent} />
            ))}

          <SvgText x={PAD.left} y={HEIGHT - 6} fontSize={11} fill={theme.textSecondary}>
            {shortDate(points[0].measuredOn)}
          </SvgText>
          {points.length > 1 && (
            <SvgText x={width - PAD.right} y={HEIGHT - 6} fontSize={11} fill={theme.textSecondary} textAnchor="end">
              {shortDate(points[points.length - 1].measuredOn)}
            </SvgText>
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: HEIGHT, width: '100%' },
});
