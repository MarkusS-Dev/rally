// Generic vertical scroll wheel. The middle row is the selection, and the
// wheel always comes to rest exactly on a row.
//
// Built on a plain ScrollView (not FlatList) so it can sit inside a scrolling
// page without nesting virtualized lists. Only the rows near the selection
// are rendered, so long ranges (2,700 weights) stay cheap.

import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export const WHEEL_ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5; // odd, so one row sits in the middle
const PAD_ROWS = (VISIBLE_ROWS - 1) / 2;
const H = WHEEL_ITEM_HEIGHT;
const RENDER_RADIUS = 10; // rows drawn above and below the selection

export function Wheel({
  count,
  index,
  onChange,
  label,
  width = 96,
  accessibilityLabel,
}: {
  count: number;
  index: number;
  onChange: (index: number) => void;
  label: (index: number) => string;
  width?: number;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  // Where to start; later changes come from scrolling, not from props.
  const [initialIndex] = useState(() => clamp(index, count));
  const listRef = useRef<ScrollViewInstance>(null);
  const positioned = useRef(false);
  const momentum = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = clamp(index, count);

  function select(i: number) {
    const next = clamp(i, count);
    if (next === current) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onChange(next);
  }

  /** Scroll so the nearest row sits exactly in the middle. */
  function settle(offsetY: number) {
    const i = clamp(Math.round(offsetY / H), count);
    select(i);
    if (Math.abs(offsetY - i * H) > 0.5) {
      listRef.current?.scrollTo({ y: i * H, animated: true });
    }
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    select(Math.round(e.nativeEvent.contentOffset.y / H));
  }

  function onScrollEndDrag(e: NativeSyntheticEvent<NativeScrollEvent>) {
    // If a fling follows, momentum end settles it; otherwise settle here.
    const y = e.nativeEvent.contentOffset.y;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!momentum.current) settle(y);
    }, 120);
  }

  function onMomentumScrollBegin() {
    momentum.current = true;
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }

  function onMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    momentum.current = false;
    settle(e.nativeEvent.contentOffset.y);
  }

  // Screen-reader support: swipe up/down to step one row.
  function step(direction: 1 | -1) {
    const next = clamp(current + direction, count);
    listRef.current?.scrollTo({ y: next * H, animated: true });
    select(next);
  }

  return (
    <View
      style={[styles.container, { width }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: label(current) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
      <View
        pointerEvents="none"
        style={[
          styles.band,
          { top: PAD_ROWS * H, backgroundColor: theme.backgroundSelected, borderColor: theme.accent },
        ]}
      />
      <ScrollView
        ref={listRef}
        // Scroll offset i * H puts row i in the middle (rows start PAD_ROWS down).
        contentOffset={{ x: 0, y: initialIndex * H }}
        onLayout={() => {
          // contentOffset isn't honoured everywhere; make sure we start in place.
          if (positioned.current) return;
          positioned.current = true;
          listRef.current?.scrollTo({ y: initialIndex * H, animated: false });
        }}
        contentContainerStyle={{ height: (count - 1 + VISIBLE_ROWS) * H }}
        snapToInterval={H}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollBegin={onMomentumScrollBegin}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        nestedScrollEnabled>
        {rowsAround(current, count).map((i) => {
          const distance = Math.abs(i - current);
          return (
            <View key={i} style={[styles.item, { top: (PAD_ROWS + i) * H }]}>
              <Text
                style={[
                  styles.itemText,
                  {
                    color: distance === 0 ? theme.text : theme.textSecondary,
                    opacity: distance === 0 ? 1 : distance === 1 ? 0.7 : 0.35,
                    fontWeight: distance === 0 ? '700' : '500',
                  },
                ]}>
                {label(i)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function rowsAround(center: number, count: number): number[] {
  const from = Math.max(0, center - RENDER_RADIUS);
  const to = Math.min(count - 1, center + RENDER_RADIUS);
  return Array.from({ length: to - from + 1 }, (_, k) => from + k);
}

function clamp(i: number, count: number) {
  return Math.min(count - 1, Math.max(0, i));
}

const styles = StyleSheet.create({
  container: { height: H * VISIBLE_ROWS },
  band: { position: 'absolute', left: 0, right: 0, height: H, borderRadius: 10, borderWidth: 1.5 },
  item: { position: 'absolute', left: 0, right: 0, height: H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 20, fontVariant: ['tabular-nums'] },
});
