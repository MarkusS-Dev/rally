// Vertical scroll wheel for picking a weight in 0.1 kg steps.
// Scroll up for lower, down for higher; the middle row is the selection.

import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5; // odd, so one row sits in the middle
const PAD_ROWS = (VISIBLE_ROWS - 1) / 2;

const toTenths = (kg: number) => Math.round(kg * 10);

export function WeightWheel({
  value,
  onChange,
  min = 30,
  max = 300,
}: {
  value: number;
  onChange: (kg: number) => void;
  min?: number;
  max?: number;
}) {
  const theme = useTheme();
  const count = toTenths(max) - toTenths(min) + 1;
  const valueAt = (index: number) => (toTenths(min) + index) / 10;
  const indexOf = (kg: number) => Math.min(count - 1, Math.max(0, toTenths(kg) - toTenths(min)));

  // Where to start; later changes come from scrolling, not from props.
  const [initialIndex] = useState(() => indexOf(value));
  const [items] = useState(() => Array.from({ length: count }, (_, i) => i));
  const listRef = useRef<FlatList<number>>(null);
  const current = indexOf(value);

  function select(index: number) {
    const clamped = Math.min(count - 1, Math.max(0, index));
    if (clamped === current) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onChange(valueAt(clamped));
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    select(Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT));
  }

  // Screen-reader support: swipe up/down to change by 0.1 kg.
  function step(direction: 1 | -1) {
    const next = Math.min(count - 1, Math.max(0, current + direction));
    listRef.current?.scrollToOffset({ offset: next * ITEM_HEIGHT, animated: true });
    select(next);
  }

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Weight"
      accessibilityValue={{ text: `${valueAt(current).toFixed(1)} kilograms` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
      {/* Selection band behind the middle row */}
      <View
        pointerEvents="none"
        style={[
          styles.band,
          { top: PAD_ROWS * ITEM_HEIGHT, backgroundColor: theme.backgroundSelected, borderColor: theme.accent },
        ]}
      />
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(i) => String(i)}
        // Offsets ignore the top padding on purpose: scrolling to i * ITEM_HEIGHT
        // puts row i in the middle.
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: index * ITEM_HEIGHT, index })}
        initialScrollIndex={initialIndex}
        contentContainerStyle={{ paddingVertical: PAD_ROWS * ITEM_HEIGHT }}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled
        initialNumToRender={VISIBLE_ROWS + 4}
        windowSize={5}
        renderItem={({ item }) => {
          const distance = Math.abs(item - current);
          return (
            <View style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  {
                    color: distance === 0 ? theme.text : theme.textSecondary,
                    opacity: distance === 0 ? 1 : distance === 1 ? 0.7 : 0.35,
                    fontWeight: distance === 0 ? '700' : '500',
                  },
                ]}>
                {valueAt(item).toFixed(1)}
              </Text>
            </View>
          );
        }}
        extraData={current}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: ITEM_HEIGHT * VISIBLE_ROWS, width: 112 },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 20, fontVariant: ['tabular-nums'] },
});
