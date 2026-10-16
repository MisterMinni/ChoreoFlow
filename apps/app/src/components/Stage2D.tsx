import React, { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, View, Text } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";
import {
  evaluateScene,
  projectDuration,
  type Project,
  type Vec3,
} from "@choreoflow/core";
import { useTheme, Label } from "@choreoflow/ui";

type Props = {
  project: Project;
  time: number;
  selected: string[];
  onSelect: (id: string) => void;
  onMove?: (id: string, delta: Vec3) => void;
  showPaths?: boolean;
  compact?: boolean;
  snap?: boolean;
};
function Dancer({
  id,
  label,
  color,
  x,
  y,
  selected,
  angle,
  scale,
  onSelect,
  onMove,
  snap,
}: {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  selected: boolean;
  angle: number;
  scale: number;
  onSelect: () => void;
  onMove?: (id: string, delta: Vec3) => void;
  snap: boolean;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const latest = useRef({ onMove, onSelect, scale, snap });
  latest.current = { onMove, onSelect, scale, snap };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          !!latest.current.onMove && Math.hypot(g.dx, g.dy) > 4,
        onPanResponderGrant: () => latest.current.onSelect(),
        onPanResponderMove: (_, g) => setDrag({ x: g.dx, y: g.dy }),
        onPanResponderRelease: (_, g) => {
          const s = latest.current;
          const quantize = (n: number) => (s.snap ? Math.round(n * 4) / 4 : n);
          s.onMove?.(id, {
            x: quantize(g.dx / s.scale),
            y: quantize(-g.dy / s.scale),
            z: 0,
          });
          setDrag({ x: 0, y: 0 });
        },
        onPanResponderTerminate: () => setDrag({ x: 0, y: 0 }),
      }),
    [id],
  );
  return (
    <View
      {...responder.panHandlers}
      style={{
        position: "absolute",
        left: x - 22 + drag.x,
        top: y - 22 + drag.y,
        width: 44,
        height: 44,
        zIndex: selected ? 2 : 1,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Person ${label}`}
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={{
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: selected ? 37 : 31,
            height: selected ? 37 : 31,
            borderRadius: 22,
            backgroundColor: color,
            borderWidth: selected ? 3 : 2,
            borderColor: selected ? "#3769ed" : "#fff",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 6px #00000018",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>
            {label}
          </Text>
        </View>
        <View
          style={{
            position: "absolute",
            width: 42,
            height: 42,
            transform: [{ rotate: `${-angle}deg` }],
          }}
        >
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 17,
              width: 0,
              height: 0,
              borderLeftWidth: 4,
              borderRightWidth: 4,
              borderTopWidth: 5,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderTopColor: color,
            }}
          />
        </View>
      </Pressable>
    </View>
  );
}
export function Stage2D({
  project,
  time,
  selected,
  onSelect,
  onMove,
  showPaths = false,
  compact = false,
  snap = true,
}: Props) {
  const t = useTheme();
  const [width, setWidth] = useState(600);
  const height = compact ? 140 : Math.max(260, Math.min(510, width * 0.62));
  const padding = compact ? 15 : 34;
  const scale = Math.min(
    (width - padding * 2) / project.stage.width,
    (height - padding * 2) / project.stage.depth,
  );
  const w = project.stage.width * scale,
    h = project.stage.depth * scale,
    left = (width - w) / 2,
    top = (height - h) / 2;
  const scene = useMemo(() => evaluateScene(project, time), [project, time]);
  const trajectories = useMemo(() => {
    if (!showPaths) return [];
    const duration = projectDuration(project);
    const ids = selected.length ? selected : project.people.map((p) => p.id);
    return ids.map((id) => ({
      id,
      points: Array.from(
        { length: 49 },
        (_, i) =>
          evaluateScene(project, (duration * i) / 48).people.find(
            (p) => p.personId === id,
          )?.position,
      ).filter((p): p is Vec3 => !!p),
    }));
  }, [project, selected, showPaths]);
  const px = (p: Vec3) => width / 2 + p.x * scale;
  const py = (p: Vec3) => height / 2 - p.y * scale;
  return (
    <View
      testID={compact ? "stage-preview" : "stage-2d"}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        height,
        backgroundColor: t.stage,
        overflow: "hidden",
        borderRadius: 12,
      }}
    >
      <Svg width="100%" height={height} style={{ position: "absolute" }}>
        <Rect
          x={left}
          y={top}
          width={w}
          height={h}
          fill={t.surface}
          stroke={t.line}
          strokeWidth={1.5}
        />
        {Array.from(
          { length: Math.min(100, Math.floor(project.stage.width)) + 1 },
          (_, i) => (
            <Line
              key={`x${i}`}
              x1={left + i * scale}
              y1={top}
              x2={left + i * scale}
              y2={top + h}
              stroke={t.line}
              strokeWidth={0.65}
            />
          ),
        )}
        {Array.from(
          { length: Math.min(100, Math.floor(project.stage.depth)) + 1 },
          (_, i) => (
            <Line
              key={`y${i}`}
              x1={left}
              y1={top + i * scale}
              x2={left + w}
              y2={top + i * scale}
              stroke={t.line}
              strokeWidth={0.65}
            />
          ),
        )}
        <Line
          x1={width / 2}
          y1={top}
          x2={width / 2}
          y2={top + h}
          stroke={t.muted}
          strokeWidth={0.8}
          strokeDasharray="3,5"
        />
        <Line
          x1={left}
          y1={height / 2}
          x2={left + w}
          y2={height / 2}
          stroke={t.muted}
          strokeWidth={0.8}
          strokeDasharray="3,5"
        />
        {trajectories.map((path) => (
          <Path
            key={path.id}
            d={path.points
              .map((p, i) => `${i ? "L" : "M"}${px(p)},${py(p)}`)
              .join(" ")}
            fill="none"
            stroke={
              project.people.find((p) => p.id === path.id)?.color ?? t.accent
            }
            strokeWidth={1.5}
            strokeDasharray="5,4"
            opacity={0.6}
          />
        ))}
        <Line
          x1={left}
          y1={top + h}
          x2={left + w}
          y2={top + h}
          stroke={t.accent}
          strokeWidth={3}
        />
      </Svg>
      {scene.people.map((p) => {
        const person = project.people.find((v) => v.id === p.personId)!;
        return compact ? (
          <View
            key={p.personId}
            style={{
              position: "absolute",
              left: px(p.position) - 3,
              top: py(p.position) - 3,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: person.color,
            }}
          />
        ) : (
          <Dancer
            key={p.personId}
            id={p.personId}
            label={person.label}
            color={person.color}
            x={px(p.position)}
            y={py(p.position)}
            selected={selected.includes(p.personId)}
            angle={p.facingDeg}
            scale={scale}
            onSelect={() => onSelect(p.personId)}
            onMove={onMove}
            snap={snap}
          />
        );
      })}
      {!compact && (
        <View
          style={{
            position: "absolute",
            bottom: 4,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <Label muted size={10}>
            PUBLIKUM · VORDERKANTE
          </Label>
        </View>
      )}
    </View>
  );
}
