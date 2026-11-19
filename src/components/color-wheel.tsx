// A colour wheel (hue around, saturation outwards) with a brightness slider,
// and a popup that wraps them. Drawn with react-native-svg; no extra library.

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Button, Field, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from '@/lib/color';

const SEGMENTS = 72; // 5° wedges: smooth enough, cheap to draw

function point(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Use the same responder for start and move so dragging feels continuous. */
function useDrag(onPoint: (x: number, y: number) => void) {
  const handle = (e: GestureResponderEvent) => onPoint(e.nativeEvent.locationX, e.nativeEvent.locationY);
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: handle,
    onPanResponderMove: handle,
  });
}

export function ColorWheel({ value, onChange, size = 240 }: { value: Hsv; onChange: (hsv: Hsv) => void; size?: number }) {
  const r = size / 2;
  const responder = useDrag((x, y) => {
    const dx = x - r;
    const dy = y - r;
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const s = Math.min(1, Math.hypot(dx, dy) / r);
    onChange({ ...value, h, s });
  });
  const thumb = point(r, r, value.s * r, value.h);
  const step = 360 / SEGMENTS;

  return (
    <View
      style={{ width: size, height: size }}
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Colour wheel"
      accessibilityValue={{ text: hsvToHex(value) }}>
      <Svg width={size} height={size} pointerEvents="none">
        <Defs>
          <RadialGradient id="saturation" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          // Overlap wedges by half a degree so no hairline gaps show.
          const a = point(r, r, r, i * step - 0.5);
          const b = point(r, r, r, (i + 1) * step + 0.5);
          return (
            <Path
              key={i}
              d={`M${r},${r} L${a.x},${a.y} A${r},${r} 0 0,1 ${b.x},${b.y} Z`}
              fill={hsvToHex({ h: i * step + step / 2, s: 1, v: 1 })}
            />
          );
        })}
        <Circle cx={r} cy={r} r={r} fill="url(#saturation)" />
        <Circle cx={r} cy={r} r={r} fill="#000000" fillOpacity={1 - value.v} />
        <Circle cx={thumb.x} cy={thumb.y} r={13} fill={hsvToHex(value)} stroke="#FFFFFF" strokeWidth={3} />
        <Circle cx={thumb.x} cy={thumb.y} r={15} fill="none" stroke="#000000" strokeOpacity={0.35} strokeWidth={1} />
      </Svg>
    </View>
  );
}

function BrightnessSlider({ value, onChange }: { value: Hsv; onChange: (hsv: Hsv) => void }) {
  const [width, setWidth] = useState(0);
  const height = 28;
  const responder = useDrag((x) => {
    if (width > 0) onChange({ ...value, v: Math.min(1, Math.max(0, x / width)) });
  });
  const x = value.v * width;

  return (
    <View
      style={{ height, width: '100%' }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Brightness"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value.v * 100) }}>
      {width > 0 && (
        <Svg width={width} height={height} pointerEvents="none">
          <Defs>
            <LinearGradient id="brightness" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#000000" />
              <Stop offset="1" stopColor={hsvToHex({ ...value, v: 1 })} />
            </LinearGradient>
          </Defs>
          <Path
            d={`M${height / 2},4 H${width - height / 2} A${height / 2 - 4},${height / 2 - 4} 0 0,1 ${width - height / 2},${height - 4} H${height / 2} A${height / 2 - 4},${height / 2 - 4} 0 0,1 ${height / 2},4 Z`}
            fill="url(#brightness)"
          />
          <Circle
            cx={Math.min(width - height / 2, Math.max(height / 2, x))}
            cy={height / 2}
            r={height / 2 - 1}
            fill={hsvToHex(value)}
            stroke="#FFFFFF"
            strokeWidth={3}
          />
        </Svg>
      )}
    </View>
  );
}

/** Popup for picking one colour. Changes only apply on Done. */
export function ColorPickerModal({
  visible,
  title,
  value,
  onDone,
  onClose,
}: {
  visible: boolean;
  title: string;
  value: string;
  onDone: (hex: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Re-mount on open so it starts from the current colour. */}
      {visible && <PickerSheet title={title} initial={value} onDone={onDone} onClose={onClose} />}
    </Modal>
  );
}

function PickerSheet({
  title,
  initial,
  onDone,
  onClose,
}: {
  title: string;
  initial: string;
  onDone: (hex: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Kept as HSV so the hue isn't lost when dragging to white or black.
  const [hsv, setHsv] = useState(() => hexToHsv(initial));
  const [hexText, setHexText] = useState(initial);
  const hex = hsvToHex(hsv);

  function update(next: Hsv) {
    setHsv(next);
    setHexText(hsvToHex(next));
  }

  function typeHex(text: string) {
    setHexText(text);
    const n = normalizeHex(text);
    if (n) setHsv(hexToHsv(n));
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four }]}>
        <Row style={styles.header}>
          <ThemedText type="smallBold" style={styles.title}>
            {title}
          </ThemedText>
          <View style={[styles.preview, { backgroundColor: hex, borderColor: theme.border }]} />
        </Row>
        <View style={styles.center}>
          <ColorWheel value={hsv} onChange={update} />
        </View>
        <BrightnessSlider value={hsv} onChange={update} />
        <Field label="Hex" value={hexText} onChangeText={typeHex} autoCapitalize="characters" autoCorrect={false} />
        <Row style={styles.buttons}>
          <View style={styles.flex}>
            <Button title="Cancel" variant="secondary" onPress={onClose} />
          </View>
          <View style={styles.flex}>
            <Button title="Done" onPress={() => onDone(hex)} />
          </View>
        </Row>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  title: { fontSize: 18 },
  preview: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
  center: { alignItems: 'center' },
  buttons: { flexWrap: 'nowrap' },
  flex: { flex: 1 },
});
