// Small, dependency-light charts drawn with Views and react-native-svg.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { formatCompactINR, formatINR } from '@/utils/format';
import { Text } from './ui';

// ------------------------------------------------------------ Bar chart

export interface BarDatum {
  key: string | number;
  label: string;
  value: number;
  /** Longer description shown when the bar is selected. */
  detail?: string;
  highlight?: boolean;
}

export function BarChart({
  data,
  height = 160,
  color: colorProp,
  labelEvery = 1,
  emptyLabel = 'No spending in this period',
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
  /** Render every nth x-axis label (dense series). */
  labelEvery?: number;
  emptyLabel?: string;
}) {
  const { colors } = useTheme();
  const color = colorProp ?? colors.brand;
  const styles = useStyles();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const average = data.length ? data.reduce((s, d) => s + d.value, 0) / data.length : 0;
  const active = selected !== null ? data[selected] : null;
  const gap = data.length > 20 ? 2 : data.length > 10 ? 4 : 8;

  return (
    <View>
      <View style={styles.chartCaption}>
        {active ? (
          <Text variant="labelStrong">
            {active.detail ?? active.label} · <Text variant="labelStrong" color={color}>{formatINR(active.value)}</Text>
          </Text>
        ) : (
          <Text variant="label" color={colors.textTertiary}>
            {max > 0 ? `Avg ${formatCompactINR(Math.round(average))} · tap a bar for details` : emptyLabel}
          </Text>
        )}
      </View>
      <View style={[styles.bars, { height, gap }]}>
        {max > 0 && average > 0 ? (
          <View pointerEvents="none" style={[styles.avgLine, { bottom: (average / max) * height }]} />
        ) : null}
        {data.map((d, i) => {
          const h = max > 0 ? Math.max(d.value > 0 ? 4 : 2, (d.value / max) * height) : 2;
          const isSelected = selected === i;
          const dim = selected !== null && !isSelected;
          return (
            <Pressable
              key={d.key}
              style={styles.barSlot}
              onPress={() => setSelected(isSelected ? null : i)}
              accessibilityLabel={`${d.detail ?? d.label}: ${formatINR(d.value)}`}
            >
              <View
                style={{
                  height: h,
                  borderRadius: data.length > 20 ? 2 : 6,
                  backgroundColor: d.value === 0 ? colors.surfaceMuted : d.highlight || isSelected ? color : `${color}99`,
                  opacity: dim ? 0.35 : 1,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.labels, { gap }]}>
        {data.map((d, i) => (
          <View key={d.key} style={[styles.barSlot, styles.labelSlot]}>
            {i % labelEvery === 0 ? (
              <Text variant="caption" align="center" numberOfLines={1} style={styles.axisLabel}>
                {d.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// ------------------------------------------------------------ Donut

export interface DonutSlice {
  key: string;
  value: number;
  color: string;
}

export function Donut({
  slices,
  size = 168,
  thickness = 22,
  children,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const gapLength = slices.length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceMuted} strokeWidth={thickness} fill="none" />
          {total > 0
            ? slices.map((s) => {
                const length = (s.value / total) * circumference;
                const visible = Math.max(0, length - gapLength);
                const el = (
                  <Circle
                    key={s.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={s.color}
                    strokeWidth={thickness}
                    fill="none"
                    strokeDasharray={`${visible} ${circumference - visible}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += length;
                return el;
              })
            : null}
        </G>
      </Svg>
      {children}
    </View>
  );
}

// ------------------------------------------------------------ Stacked bar

/** Single horizontal bar split by share — compact category overview. */
export function StackedBar({ slices, height = 10 }: { slices: DonutSlice[]; height?: number }) {
  const styles = useStyles();
  const total = slices.reduce((s, x) => s + x.value, 0);
  return (
    <View style={[styles.stacked, { height, borderRadius: height / 2 }]}>
      {total > 0
        ? slices.map((s) => <View key={s.key} style={{ flex: s.value / total, backgroundColor: s.color }} />)
        : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  chartCaption: {
    minHeight: 22,
    marginBottom: space.sm,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barSlot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    borderStyle: 'dashed',
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
  },
  labels: {
    flexDirection: 'row',
    marginTop: space.xs,
  },
  // Labels may be wider than a thin bar slot: give them a fixed width and
  // let them overflow the slot, centred under their bar.
  labelSlot: {
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 10,
    width: 40,
  },
  stacked: {
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
  },
}));
