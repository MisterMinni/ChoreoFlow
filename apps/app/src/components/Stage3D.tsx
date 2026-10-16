import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber/native";
import { evaluateScene, type Project } from "@choreoflow/core";
import { SceneObjects } from "./SceneObjects";
export default function Stage3D({
  project,
  time,
  selected,
  onSelect,
  camera = "angle",
}: {
  project: Project;
  time: number;
  selected: string[];
  onSelect: (id: string) => void;
  camera?: string;
}) {
  const scene = useMemo(() => evaluateScene(project, time), [project, time]);
  const position: [number, number, number] =
    camera === "top"
      ? [0, 22, 0.1]
      : camera === "front"
        ? [0, 6, 18]
        : [12, 14, 16];
  return (
    <Canvas
      key={camera}
      camera={{ position, fov: 42 }}
      onCreated={({ camera: c }) => c.lookAt(0, 0, 0)}
      style={{ height: 360 }}
    >
      <SceneObjects
        project={project}
        scene={scene}
        selected={selected}
        onSelect={onSelect}
      />
    </Canvas>
  );
}
