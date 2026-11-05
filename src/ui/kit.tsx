// The shared pieces every screen is built from, so a change of look is made in one place.
// Text follows the phone's own text size: nothing here turns font scaling off.

import { type ReactNode } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from "react-native";
import { radius, space, useTokens } from "./theme";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const t = useTokens();
  if (!scroll) return <View style={{ flex: 1, backgroundColor: t.canvas, padding: space.lg }}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.canvas }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl * 2, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  );
}

export function Loading() {
  const t = useTokens();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.canvas }}>
      <ActivityIndicator color={t.accentInk} accessibilityLabel="Loading" />
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTokens();
  return (
    <Text accessibilityRole="header" style={{ color: t.heading, fontSize: 26, fontWeight: "700" }}>
      {children}
    </Text>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const t = useTokens();
  return (
    <Text accessibilityRole="header" style={{ color: t.inkFaint, fontSize: 13, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" }}>
      {children}
    </Text>
  );
}

export function Body({ style, ...rest }: TextProps) {
  const t = useTokens();
  return <Text {...rest} style={[{ color: t.ink, fontSize: 16, lineHeight: 23 }, style]} />;
}

export function Muted({ style, ...rest }: TextProps) {
  const t = useTokens();
  return <Text {...rest} style={[{ color: t.inkMuted, fontSize: 14, lineHeight: 20 }, style]} />;
}

export function Strong({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTokens();
  return <Text style={[{ color: t.inkStrong, fontSize: 17, fontWeight: "600" }, style]}>{children}</Text>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  const t = useTokens();
  return (
    <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 15 }}>
      {children}
    </Text>
  );
}

export function Card({ children, onPress, style, accessibilityLabel, accessibilityHint }: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const t = useTokens();
  const base: ViewStyle = { backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: radius.card, padding: space.lg, gap: space.sm };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [base, pressed && { borderColor: t.lineStrong, opacity: 0.85 }, style]}
    >
      {children}
    </Pressable>
  );
}

type Variant = "primary" | "purple" | "quiet" | "text" | "danger";

export function Button({ label, onPress, variant = "primary", disabled, accessibilityHint, style }: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: PressableProps["style"];
}) {
  const t = useTokens();
  const look: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: t.blush, fg: t.onBlush, border: t.blush },
    purple: { bg: t.accent, fg: t.onAccent, border: t.accent },
    quiet: { bg: "transparent", fg: t.inkStrong, border: t.lineStrong },
    text: { bg: "transparent", fg: t.accentInk, border: "transparent" },
    danger: { bg: "transparent", fg: t.danger, border: t.danger },
  };
  const l = look[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={accessibilityHint}
      hitSlop={6}
      style={(state) => [
        {
          minHeight: 48,
          paddingHorizontal: variant === "text" ? space.sm : space.lg,
          borderRadius: radius.control,
          borderWidth: 1,
          borderColor: l.border,
          backgroundColor: l.bg,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.45 : state.pressed ? 0.8 : 1,
        },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <Text style={{ color: l.fg, fontSize: 16, fontWeight: "600", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, help, ...input }: TextInputProps & { label: string; help?: string }) {
  const t = useTokens();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: t.inkStrong, fontSize: 15, fontWeight: "600" }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={help}
        placeholderTextColor={t.inkFaint}
        {...input}
        style={[
          {
            backgroundColor: t.field,
            borderColor: t.lineStrong,
            borderWidth: 1,
            borderRadius: radius.control,
            color: t.ink,
            fontSize: 16,
            paddingHorizontal: space.md,
            paddingVertical: space.md,
            minHeight: input.multiline ? 110 : 48,
            textAlignVertical: input.multiline ? "top" : "center",
          },
          input.style,
        ]}
      />
      {help ? <Muted>{help}</Muted> : null}
    </View>
  );
}

/** A row of choices where one (or none) is picked, such as a spread or how sure the person felt. */
export function ChoiceRow<T extends string | number>({ label, options, value, onChange, allowNone }: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  allowNone?: boolean;
}) {
  const t = useTokens();
  return (
    <View style={{ gap: space.xs }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={{ color: t.inkStrong, fontSize: 15, fontWeight: "600" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(on && allowNone ? null : o.value)}
              style={{
                minHeight: 44,
                paddingHorizontal: space.md,
                justifyContent: "center",
                borderRadius: radius.control,
                borderWidth: 1,
                borderColor: on ? t.blush : t.lineStrong,
                backgroundColor: on ? t.blush : "transparent",
              }}
            >
              <Text style={{ color: on ? t.onBlush : t.ink, fontSize: 15 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({ label, help, value, onChange }: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTokens();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.inkStrong, fontSize: 16 }}>{label}</Text>
        {help ? <Muted>{help}</Muted> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        accessibilityHint={help}
        trackColor={{ true: t.accent, false: t.lineStrong }}
        thumbColor={value ? t.blush : t.inkFaint}
      />
    </View>
  );
}

export function Divider() {
  const t = useTokens();
  return <View style={{ height: 1, backgroundColor: t.line }} />;
}
