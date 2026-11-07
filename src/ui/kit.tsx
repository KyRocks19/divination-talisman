// The shared pieces every screen is built from, so a change of look is made in one place.
// Text follows the phone's own text size: nothing here turns font scaling off.

import { useState, type ReactNode } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from "react-native";
import { useGap, useType } from "./comfort";
import { TabSwipe } from "./TabSwipe";
import { radius, space, useTokens } from "./theme";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const t = useTokens();
  const gap = useGap();
  if (!scroll)
    return (
      <TabSwipe>
        <View style={{ flex: 1, backgroundColor: t.canvas, padding: space.lg }}>{children}</View>
      </TabSwipe>
    );
  return (
    <TabSwipe>
      <ScrollView
        style={{ flex: 1, backgroundColor: t.canvas }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl * 2, gap: gap(space.lg) }}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        {children}
      </ScrollView>
    </TabSwipe>
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
  const type = useType();
  return (
    <Text accessibilityRole="header" style={{ color: t.heading, ...type({ fontSize: 26, bold: true }) }}>
      {children}
    </Text>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const t = useTokens();
  const type = useType();
  return (
    <Text
      accessibilityRole="header"
      style={{ color: t.inkFaint, ...type({ fontSize: 13, bold: true, letterSpacing: 0.8 }), textTransform: "uppercase" }}
    >
      {children}
    </Text>
  );
}

export function Body({ style, ...rest }: TextProps) {
  const t = useTokens();
  const type = useType();
  return <Text {...rest} style={[{ color: t.ink, ...type({ fontSize: 16, lineHeight: 23 }) }, style]} />;
}

export function Muted({ style, ...rest }: TextProps) {
  const t = useTokens();
  const type = useType();
  return <Text {...rest} style={[{ color: t.inkMuted, ...type({ fontSize: 14, lineHeight: 20 }) }, style]} />;
}

export function Strong({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTokens();
  const type = useType();
  return <Text style={[{ color: t.inkStrong, ...type({ fontSize: 17, bold: "semi" }) }, style]}>{children}</Text>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  const t = useTokens();
  const type = useType();
  return (
    <Text accessibilityRole="alert" style={{ color: t.danger, ...type({ fontSize: 15 }) }}>
      {children}
    </Text>
  );
}

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const t = useTokens();
  const gap = useGap();
  const base: ViewStyle = {
    backgroundColor: t.surface,
    borderColor: t.line,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    gap: gap(space.sm),
  };
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

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: PressableProps["style"];
}) {
  const t = useTokens();
  const type = useType();
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
      <Text style={{ color: l.fg, ...type({ fontSize: 16, bold: "semi" }), textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, help, ...input }: TextInputProps & { label: string; help?: string }) {
  const t = useTokens();
  const type = useType();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: t.inkStrong, ...type({ fontSize: 15, bold: "semi" }) }}>{label}</Text>
      {/* The field keeps its own touches, so dragging to select words never swipes to another tab (src/ui/TabSwipe.tsx). */}
      <View onStartShouldSetResponder={() => true} onResponderTerminationRequest={() => false}>
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
              ...type({ fontSize: 16 }),
              paddingHorizontal: space.md,
              paddingVertical: space.md,
              minHeight: input.multiline ? 110 : 48,
              textAlignVertical: input.multiline ? "top" : "center",
            },
            input.style,
          ]}
        />
      </View>
      {help ? <Muted>{help}</Muted> : null}
    </View>
  );
}

/** A row of choices where one (or none) is picked, such as a spread or how sure the person felt. */
export function ChoiceRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  allowNone,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  allowNone?: boolean;
}) {
  const t = useTokens();
  const type = useType();
  return (
    <View style={{ gap: space.xs }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={{ color: t.inkStrong, ...type({ fontSize: 15, bold: "semi" }) }}>{label}</Text>
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
              <Text style={{ color: on ? t.onBlush : t.ink, ...type({ fontSize: 15 }) }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A list of choices, one under the other, where one is picked: for choices that need a sentence each, such as a font. */
export function RadioList<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; note?: string; labelStyle?: StyleProp<TextStyle>; before?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTokens();
  const type = useType();
  return (
    <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={{ color: t.inkStrong, ...type({ fontSize: 15, bold: "semi" }) }}>{label}</Text>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.note ? `${o.label}. ${o.note}` : o.label}
            onPress={() => onChange(o.value)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              minHeight: 48,
              padding: space.md,
              borderRadius: radius.control,
              borderWidth: on ? 2 : 1,
              borderColor: on ? t.accentInk : t.lineStrong,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: on ? t.accentInk : t.inkFaint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accentInk }} />}
            </View>
            {o.before}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[{ color: t.inkStrong, ...type({ fontSize: 16 }) }, o.labelStyle]}>{o.label}</Text>
              {o.note ? <Muted>{o.note}</Muted> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ label, help, value, onChange }: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTokens();
  const type = useType();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.inkStrong, ...type({ fontSize: 16 }) }}>{label}</Text>
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

/** A closed box that shows the current choice; tapping it opens the full list underneath, and picking one closes it. */
export function Dropdown<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTokens();
  const type = useType();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: t.inkStrong, ...type({ fontSize: 15, bold: "semi" }) }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? ""}`}
        accessibilityHint={open ? "Closes the list" : "Opens the list of choices"}
        accessibilityState={{ expanded: open }}
/**
 * A part of a page that opens and closes, so a long page of settings can be read at a glance. The heading and one
 * plain line about what is inside are always shown; the rest only when the person opens it.
 */
export function Section({
  title,
  about,
  open,
  onToggle,
  children,
}: {
  title: string;
  about?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const t = useTokens();
  const type = useType();
  const gap = useGap();
  return (
    <View style={{ gap: gap(space.md) }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={about ? `${title}. ${about}` : title}
        accessibilityHint={open ? "Closes this part" : "Opens this part"}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          minHeight: 48,
          paddingHorizontal: space.md,
          borderRadius: radius.control,
          borderWidth: 1,
          borderColor: open ? t.accentInk : t.lineStrong,
          backgroundColor: t.field,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ flex: 1, color: t.ink, ...type({ fontSize: 16 }) }}>{current?.label}</Text>
        <Text style={{ color: t.inkMuted, ...type({ fontSize: 14 }) }} importantForAccessibility="no" accessibilityElementsHidden>
          {open ? "▲" : "▼"}
        </Text>
      </Pressable>
      {open && (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          style={{ borderRadius: radius.control, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, overflow: "hidden" }}
        >
          {options.map((o, i) => {
            const on = o.value === value;
            return (
              <Pressable
                key={String(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  minHeight: 48,
                  paddingHorizontal: space.md,
                  justifyContent: "center",
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.line,
                  backgroundColor: on ? t.blush : "transparent",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: on ? t.onBlush : t.ink, ...type({ fontSize: 16, bold: on ? "semi" : undefined }) }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
          minHeight: 56,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: open ? t.lineStrong : t.line,
          backgroundColor: t.surface,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.inkStrong, ...type({ fontSize: 17, bold: "semi" }) }}>{title}</Text>
          {about ? <Muted>{about}</Muted> : null}
        </View>
        <Text accessible={false} style={{ color: t.accentInk, ...type({ fontSize: 18, bold: true }) }}>
          {open ? "−" : "+"}
        </Text>
      </Pressable>
      {open && <View style={{ gap: gap(space.md) }}>{children}</View>}
    </View>
  );
}
