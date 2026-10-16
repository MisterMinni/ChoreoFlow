import React from "react";
import type { Project, Scene } from "@choreoflow/core";
export function SceneObjects({
  project,
  scene,
  selected,
  onSelect,
}: {
  project: Project;
  scene: Scene;
  selected: string[];
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <color attach="background" args={["#e7edf5"]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[8, 15, 8]} intensity={2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
        <planeGeometry args={[project.stage.width, project.stage.depth]} />
        <meshStandardMaterial color="#f9fbff" />
      </mesh>
      <gridHelper
        args={[
          Math.max(project.stage.width, project.stage.depth),
          12,
          "#a5b4ca",
          "#d9e1ec",
        ]}
      />
      {scene.people.map((p) => {
        const person = project.people.find((v) => v.id === p.personId)!;
        return (
          <group
            key={p.personId}
            position={[p.position.x, p.position.z, -p.position.y]}
            rotation={[0, (p.facingDeg * Math.PI) / 180, 0]}
            onClick={(e: { stopPropagation: () => void }) => {
              e.stopPropagation();
              onSelect(p.personId);
            }}
          >
            <mesh position={[0, 1.47, 0]}>
              <sphereGeometry args={[0.18, 12, 10]} />
              <meshStandardMaterial color="#e8c8b1" />
            </mesh>
            <mesh position={[0, 1.03, 0]}>
              <cylinderGeometry args={[0.21, 0.16, 0.56, 12]} />
              <meshStandardMaterial color={person.color} />
            </mesh>
            {[-1, 1].map((side) => (
              <group key={side}>
                <mesh position={[side * 0.1, 0.39, 0]}>
                  <cylinderGeometry args={[0.075, 0.065, 0.75, 8]} />
                  <meshStandardMaterial color="#34445c" />
                </mesh>
                <mesh
                  position={[side * 0.28, 1, 0]}
                  rotation={[0, 0, side * 0.18]}
                >
                  <cylinderGeometry args={[0.055, 0.045, 0.56, 8]} />
                  <meshStandardMaterial color={person.color} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, 0.025, 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.09, 3]} />
              <meshBasicMaterial color={person.color} />
            </mesh>
            {selected.includes(p.personId) && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[0.31, 0.36, 24]} />
                <meshBasicMaterial color="#3366ef" />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}
