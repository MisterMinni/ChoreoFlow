import React, { createContext, useContext } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  Platform,
  type ViewStyle,
  type StyleProp,
  type TextInputProps,
} from "react-native";
export const palettes = {
  light: {
    bg: "#f6f7fb",
    surface: "#ffffff",
    raised: "#f0f3f9",
    text: "#19253c",
    muted: "#758197",
    line: "#e3e8f1",
    accent: "#3366ef",
    tint: "#eaf0ff",
    danger: "#bc4646",
    stage: "#fbfcff",
  },
  dark: {
    bg: "#111722",
    surface: "#192231",
    raised: "#222f42",
    text: "#eaf0fa",
    muted: "#99a8c0",
    line: "#2d3b50",
    accent: "#83a7ff",
    tint: "#273a5e",
    danger: "#ff9b9b",
    stage: "#151e2c",
  },
};
export type Theme = typeof palettes.light;
export const ThemeContext = createContext<Theme>(palettes.light);
export const useTheme = () => useContext(ThemeContext);
export function Label({
  children,
  muted = false,
  size = 14,
  bold = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  size?: number;
  bold?: boolean;
  style?: StyleProp<import("react-native").TextStyle>;
}) {
  const t = useTheme();
  return (
    <Text
      style={[
        {
          color: muted ? t.muted : t.text,
          fontSize: size,
          fontWeight: bold ? "600" : "400",
          lineHeight: size * 1.45,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Button({
  children,
  onPress,
  primary = false,
  disabled = false,
  selected = false,
  accessibilityLabel,
  style,
  testID,
}: {
  children: React.ReactNode;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (typeof children === "string" ? children : undefined)
      }
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: primary ? t.accent : selected ? t.tint : t.surface,
          borderWidth: 1,
          borderColor: primary ? "transparent" : selected ? t.accent : t.line,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {React.Children.toArray(children).every(
        (child) => typeof child === "string" || typeof child === "number",
      ) ? (
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: primary ? "#fff" : selected ? t.accent : t.text,
          }}
        >
          {children}
        </Text>
      ) : (
        React.Children.map(children, (child) =>
          typeof child === "string" || typeof child === "number" ? (
            <Text style={{ color: t.text }}>{child}</Text>
          ) : (
            child
          ),
        )
      )}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Label muted size={12} bold>
        {label}
      </Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        {...props}
        onBlur={(event) => {
          // React Native Web emits text on blur but does not implement onEndEditing.
          if (Platform.OS === "web")
            props.onEndEditing?.(
              event as Parameters<NonNullable<TextInputProps["onEndEditing"]>>[0],
            );
          props.onBlur?.(event);
        }}
        style={[
          {
            minHeight: 46,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: t.line,
            padding: 12,
            color: t.text,
            backgroundColor: t.bg,
            fontSize: 15,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: 16,
          padding: 20,
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
