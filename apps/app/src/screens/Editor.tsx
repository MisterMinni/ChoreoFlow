import React, {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Slider from "@react-native-community/slider";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  Plus,
  Move,
  Route,
  X,
  Download,
  Grid3X3,
  Layers,
} from "lucide-react-native";
import { Button, Card, Field, Label, useTheme } from "@choreoflow/ui";
import {
  commitProject,
  commitFormationEdit,
  undo,
  redo,
  createId,
  generateTemplate,
  formationStartTime,
  evaluateScene,
  formatCounts,
  groupPosition,
  centroid,
  type Project,
  type Vec3,
  type GroupMotion,
  type TemplateType,
  type ProjectHistory,
  type FormationEditPlan,
} from "@choreoflow/core";
import { useApp } from "../state";
import { Stage2D } from "../components/Stage2D";
import { templateLabels } from "./Library";
import ConflictPanel from "../components/ConflictPanel";
import { CloudPanel } from "../components/CloudPanel";
import { FormationsPanel } from "../components/FormationsPanel";
import { usePlayback, MusicPanel } from "../audio";
import { saveProjectFile, exportPng } from "../transfer";
const Stage3D = lazy(() => import("../components/Stage3D"));
class RenderBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <Card>
        <Label>
          Die 3D-Ansicht konnte auf diesem Gerät nicht gestartet werden. Die
          2D-Ansicht bleibt verfügbar.
        </Label>
      </Card>
    ) : (
      this.props.children
    );
  }
}
const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
export default function Editor() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    app = useApp(),
    t = useTheme(),
    wide = useWindowDimensions().width > 1000;
  const history = app.histories.find((h) => h.present.id === id),
    project = history?.present;
  const [formationId, setFormationId] = useState<string | null>(null),
    [saving, setSaving] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [mode, setMode] = useState<"2d" | "3d">("2d"),
    [camera, setCamera] = useState("angle"),
    [panel, setPanel] = useState(""),
    [multiple, setMultiple] = useState(false),
    [paths, setPaths] = useState(false),
    [snap, setSnap] = useState(true),
    [note, setNote] = useState(""),
    [message, setMessage] = useState(""),
    [rename, setRename] = useState("");
  const savingRef = useRef(false);
  const pendingFocus = useRef<{
    projectId: string;
    revision: number;
    formationId: string;
  } | null>(null);
  const selectionByCommand = useRef(
    new Map<string, { before: string; after: string }>(),
  );
  const {
    time,
    setTime,
    playing,
    setPlaying,
    speed,
    setSpeed,
    duration,
    error: audioError,
  } = usePlayback(project);
  const scene = useMemo(
    () => (project ? evaluateScene(project, time) : null),
    [project, time],
  );
  // Playback must see the new duration before seeking to a newly added/moved formation.
  useEffect(() => {
    if (!project) return;
    const focus = pendingFocus.current;
    if (
      focus &&
      focus.projectId === project.id &&
      project.revision >= focus.revision
    ) {
      pendingFocus.current = null;
      const target =
        project.formations.find((f) => f.id === focus.formationId) ??
        project.formations[0];
      setFormationId(target.id);
      setPlaying(false);
      setTime(formationStartTime(project, target.id));
    } else if (!project.formations.some((f) => f.id === formationId)) {
      setFormationId(project.formations[0].id);
      setPlaying(false);
      setTime(0);
    }
  }, [project, formationId, setPlaying, setTime]);
  if (!project || !history || !scene)
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: t.bg, padding: 30, gap: 20 }}
      >
        <Button onPress={() => router.replace("/")}>Zurück zu Projekten</Button>
        <Label>
          {app.ready
            ? "Projekt wurde nicht gefunden."
            : "Projekt wird geladen …"}
        </Label>
      </SafeAreaView>
    );
  const formation =
      project.formations.find((f) => f.id === formationId) ??
      project.formations[0],
    transition = project.transitions.find(
      (v) => v.fromFormationId === formation.id,
    );
  const formationIndex = project.formations.findIndex(
    (f) => f.id === formation.id,
  );
  const currentPerson = project.people.find((p) => p.id === selected[0]);
  const individualLocked =
    transition?.motions.some(
      (m) => m.type === "group" && m.personIds.includes(selected[0]),
    ) ?? false;
  const isAtFormation =
    !scene.transitionId && scene.formationId === formation.id;
  const act = async (action: () => Promise<unknown> | unknown) => {
    try {
      await action();
    } catch (e) {
      app.setError(e instanceof Error ? e.message : String(e));
    }
  };
  const saveHistory = async (next: ProjectHistory, focusId?: string) => {
    if (savingRef.current)
      throw new Error(
        "Bitte warte, bis die aktuelle Änderung gespeichert ist.",
      );
    if (next === history) return;
    savingRef.current = true;
    setSaving(true);
    if (focusId) {
      setPlaying(false);
      pendingFocus.current = {
        projectId: next.present.id,
        revision: next.present.revision,
        formationId: focusId,
      };
    }
    try {
      await app.save(next);
    } catch (error) {
      pendingFocus.current = null;
      throw error;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const rememberSelection = (next: ProjectHistory, after: string) => {
    const command = next.undoStack.at(-1);
    if (command)
      selectionByCommand.current.set(command.id, {
        before: formation.id,
        after,
      });
    if (selectionByCommand.current.size > 100) {
      const oldest = selectionByCommand.current.keys().next().value;
      if (oldest) selectionByCommand.current.delete(oldest);
    }
  };
  const restoreHistory = (direction: "undo" | "redo") => {
    if (savingRef.current) return;
    void act(async () => {
      const command = (
        direction === "undo" ? history.undoStack : history.redoStack
      ).at(-1);
      const selection = command
        ? selectionByCommand.current.get(command.id)
        : undefined;
      const next = direction === "undo" ? undo(history) : redo(history);
      const requestedId =
        selection?.[direction === "undo" ? "before" : "after"] ?? formation.id;
      const target =
        next.present.formations.find((f) => f.id === requestedId) ??
        next.present.formations[
          Math.min(formationIndex, next.present.formations.length - 1)
        ];
      if (direction === "redo" && selection && next.undoStack.at(-1)) {
        selectionByCommand.current.set(next.undoStack.at(-1)!.id, selection);
      }
      await saveHistory(next, target.id);
    });
  };
  const edit = (fn: (draft: Project) => void) => {
    if (savingRef.current) {
      setMessage("Bitte warte, bis die aktuelle Änderung gespeichert ist.");
      return;
    }
    void act(async () => {
      const draft = structuredClone(project);
      fn(draft);
      await saveHistory(commitProject(history, draft));
    });
  };
  const chooseFormation = (nextId: string) => {
    setPlaying(false);
    setFormationId(nextId);
    setTime(formationStartTime(project, nextId));
  };
  const select = (personId: string) =>
    setSelected((previous) =>
      multiple
        ? previous.includes(personId)
          ? previous.filter((v) => v !== personId)
          : [...previous, personId]
        : [personId],
    );
  const move = (personId: string, delta: Vec3) => {
    if (!isAtFormation) {
      setMessage(
        "Zum Verschieben zuerst eine Formation in der Zeitleiste auswählen. Bewegungen im Übergang bearbeitest du unter „Weg“.",
      );
      return;
    }
    const ids = selected.includes(personId) ? selected : [personId];
    edit((draft) => {
      const f = draft.formations.find((item) => item.id === formation.id)!;
      for (const target of ids) {
        const p = f.positions[target];
        f.positions[target] = { x: p.x + delta.x, y: p.y + delta.y, z: p.z };
      }
    });
  };
  const addFormation = () => {
    if (savingRef.current || project.formations.length >= 200) return;
    const clone = structuredClone(formation),
      newId = createId("formation");
    clone.id = newId;
    clone.name = `Formation ${project.formations.length + 1}`;
    void act(async () => {
      const draft = structuredClone(project);
      const previous = draft.formations.at(-1)!;
      draft.formations.push(clone);
      draft.transitions.push({
        id: createId("transition"),
        fromFormationId: previous.id,
        toFormationId: newId,
        durationSeconds: 4,
        motions: [],
      });
      const next = commitProject(history, draft);
      rememberSelection(next, newId);
      await saveHistory(next, newId);
    });
  };
  const applyFormationEdit = (plan: FormationEditPlan) =>
    act(async () => {
      if (savingRef.current) return;
      const next = commitFormationEdit(history, plan, { acceptImpact: true });
      const target = plan.focusFormationId ?? next.present.formations[0].id;
      rememberSelection(next, target);
      await saveHistory(next, target);
    });
  const applyTemplate = (kind: TemplateType) => {
    edit((draft) => {
      const f = draft.formations.find((item) => item.id === formation.id)!;
      const ids = selected.length ? selected : project.people.map((p) => p.id);
      Object.assign(
        f.positions,
        generateTemplate(kind, ids, {
          width: project.stage.width * 0.72,
          depth: project.stage.depth * 0.5,
        }),
      );
    });
    setTime(formationStartTime(project, formation.id));
    setPlaying(false);
  };
  const applyRotation = (degrees: number) => {
    if (!transition) {
      setMessage(
        "Füge zuerst eine weitere Formation hinzu. Eine Gruppenbewegung verbindet zwei Formationen.",
      );
      return;
    }
    edit((draft) => {
      const tr = draft.transitions.find((v) => v.id === transition.id)!;
      const ids = selected.length ? selected : project.people.map((p) => p.id),
        pivot = centroid(ids.map((id) => formation.positions[id]));
      const motion: GroupMotion = {
        id: createId("motion"),
        type: "group",
        personIds: ids,
        pivot,
        angleDegrees: degrees,
        translation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1 },
        delaySeconds: 0,
        durationSeconds: tr.durationSeconds,
        easing: "linear",
        rotateFacing: true,
      };
      if (
        tr.motions.some(
          (m) =>
            m.type === "group" &&
            m.personIds.some((id) => ids.includes(id)) &&
            !m.personIds.every((id) => ids.includes(id)),
        )
      )
        throw new Error(
          "Bitte zuerst die gesamte bestehende Gruppe auswählen oder ihre Gruppenbewegung bewusst entfernen.",
        );
      tr.motions = tr.motions.filter((m) =>
        m.type === "individual"
          ? !ids.includes(m.personId)
          : !m.personIds.some((id) => ids.includes(id)),
      );
      tr.motions.push(motion);
      const target = draft.formations.find((f) => f.id === tr.toFormationId)!;
      ids.forEach((id) => {
        target.positions[id] = groupPosition(
          motion,
          formation.positions[id],
          id,
          1,
        );
        target.facing[id] = formation.facing[id] + degrees;
      });
    });
    setMessage(
      `Gruppenbewegung mit ${degrees}° angelegt. Über „Abspielen“ prüfen.`,
    );
  };
  const numeric = (
    label: string,
    value: number,
    onValue: (n: number) => void,
    min = -100,
    max = 100,
  ) => (
    <Field
      key={label + formation.id + selected.join() + value}
      label={label}
      editable={
        !saving &&
        (!/^(Position|Blickrichtung|Haltedauer)/.test(label) || isAtFormation)
      }
      defaultValue={String(value)}
      keyboardType="decimal-pad"
      onEndEditing={(e) => {
        const n = Number(e.nativeEvent.text.replace(",", "."));
        if (Number.isFinite(n) && n >= min && n <= max) onValue(n);
        else
          setMessage(`Bitte einen Wert zwischen ${min} und ${max} eingeben.`);
      }}
    />
  );
  const panelContent = (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Label size={20} bold>
          {panel || "Formation"}
        </Label>
        {!!panel && (
          <Button
            onPress={() => setPanel("")}
            accessibilityLabel="Panel schließen"
          >
            <X size={17} color={t.text} />
          </Button>
        )}
      </View>
      {!panel && (
        <>
          <Label muted size={12}>
            AKTUELLE AUSWAHL
          </Label>
          <Label size={18} bold>
            {selected.length > 1
              ? `${selected.length} Personen`
              : (currentPerson?.name ?? formation.name)}
          </Label>
          <Label size={13} muted>
            {selected.length
              ? "Personen auf der Bühne ziehen oder Positionen genau eingeben."
              : "Wähle eine Person auf der Bühne oder gestalte die gesamte Formation."}
          </Label>
          {currentPerson && selected.length === 1 ? (
            <>
              {numeric(
                "Position X (m)",
                formation.positions[currentPerson.id].x,
                (n) =>
                  edit((d) => {
                    d.formations.find((f) => f.id === formation.id)!.positions[
                      currentPerson.id
                    ].x = n;
                  }),
              )}
              {numeric(
                "Position Y (m)",
                formation.positions[currentPerson.id].y,
                (n) =>
                  edit((d) => {
                    d.formations.find((f) => f.id === formation.id)!.positions[
                      currentPerson.id
                    ].y = n;
                  }),
              )}
              {numeric(
                "Blickrichtung (°)",
                formation.facing[currentPerson.id],
                (n) =>
                  edit((d) => {
                    d.formations.find((f) => f.id === formation.id)!.facing[
                      currentPerson.id
                    ] = n;
                  }),
                -720,
                720,
              )}
            </>
          ) : (
            <>
              {numeric(
                "Haltedauer (Sekunden)",
                formation.holdSeconds,
                (n) =>
                  edit((d) => {
                    d.formations.find(
                      (f) => f.id === formation.id,
                    )!.holdSeconds = n;
                  }),
                0.01,
                600,
              )}
              <Button onPress={() => setPanel("Anordnen")}>
                Formation anordnen
              </Button>
            </>
          )}
          <Button selected={multiple} onPress={() => setMultiple(!multiple)}>
            Mehrfachauswahl {multiple ? "an" : "aus"}
          </Button>
          <Button
            onPress={() =>
              setSelected(
                selected.length === project.people.length
                  ? []
                  : project.people.map((p) => p.id),
              )
            }
          >
            {selected.length === project.people.length
              ? "Auswahl aufheben"
              : "Alle auswählen"}
          </Button>
          <View style={{ height: 1, backgroundColor: t.line }} />
          <Label size={12} muted bold>
            BESETZUNG · {project.people.length}
          </Label>
          {project.people.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => select(p.id)}
              accessibilityRole="button"
              accessibilityLabel={`${p.name} auswählen`}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: selected.includes(p.id)
                  ? t.tint
                  : "transparent",
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: p.color,
                }}
              />
              <Label style={{ flex: 1 }}>{p.name}</Label>
              <Label muted size={12}>
                {p.label}
              </Label>
            </Pressable>
          ))}
        </>
      )}
      {panel === "Projektmenü" && (
        <>
          {[
            "Formationen",
            "Bühne",
            "Besetzung",
            "Musik",
            "Notizen",
            "Prüfen",
            "Freigaben",
            "Export",
            "Projekteinstellungen",
          ].map((title) => (
            <Button
              key={title}
              onPress={() => {
                setRename(project.name);
                setPanel(title);
              }}
            >
              {title}
            </Button>
          ))}
        </>
      )}
      {panel === "Formationen" && (
        <FormationsPanel
          key={`${project.id}:${project.revision}:${formation.id}`}
          project={project}
          formationId={formation.id}
          busy={saving}
          onPreview={() => setPlaying(false)}
          onApply={applyFormationEdit}
        />
      )}
      {panel === "Anordnen" && (
        <>
          <Label muted>
            Wendet eine Form auf{" "}
            {selected.length ? `${selected.length} ausgewählte` : "alle"}{" "}
            Personen an. Identitäten bleiben erhalten.
          </Label>
          {templateLabels.map(([kind, title]) => (
            <Button key={kind} onPress={() => applyTemplate(kind)}>
              {title}
            </Button>
          ))}
        </>
      )}
      {panel === "Bühne" && (
        <>
          <Label muted>
            Maße in Metern. Bestehende Positionen bleiben beim Ändern erhalten.
          </Label>
          {numeric(
            "Breite (m)",
            project.stage.width,
            (n) =>
              edit((d) => {
                d.stage.width = n;
              }),
            2,
            100,
          )}
          {numeric(
            "Tiefe (m)",
            project.stage.depth,
            (n) =>
              edit((d) => {
                d.stage.depth = n;
              }),
            2,
            100,
          )}
          <Button selected={snap} onPress={() => setSnap(!snap)}>
            Einrasten auf 0,25 m: {snap ? "an" : "aus"}
          </Button>
        </>
      )}
      {panel === "Besetzung" && (
        <>
          <Label muted>
            Änderungen gelten für dieses Projekt. Gespeicherte Besetzungen
            bleiben unverändert.
          </Label>
          {project.people.map((p) => (
            <View
              key={p.id}
              style={{
                gap: 8,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderColor: t.line,
              }}
            >
              <Field
                label={`Name ${p.label}`}
                defaultValue={p.name}
                onEndEditing={(e) => {
                  const text = e.nativeEvent.text.trim();
                  if (text)
                    edit((d) => {
                      d.people.find((x) => x.id === p.id)!.name = text;
                    });
                }}
              />
              <Field
                label={`Kürzel ${p.label}`}
                defaultValue={p.label}
                maxLength={6}
                onEndEditing={(e) => {
                  const text = e.nativeEvent.text.trim();
                  if (text)
                    edit((d) => {
                      d.people.find((x) => x.id === p.id)!.label = text;
                    });
                }}
              />
            </View>
          ))}
          <Button
            onPress={() =>
              void act(async () => {
                await app.saveCast({
                  id: createId("cast"),
                  name: project.name,
                  revision: 1,
                  people: structuredClone(project.people),
                  groups: structuredClone(project.groups),
                });
                setMessage(
                  "Besetzung gespeichert. Du findest sie unter „Besetzungen“.",
                );
              })
            }
          >
            Als Besetzung speichern
          </Button>
        </>
      )}
      {panel === "Weg" && (
        <>
          {!transition ? (
            <Label muted>
              Füge eine zweite Formation hinzu, um einen Übergang zu gestalten.
            </Label>
          ) : (
            <>
              {numeric(
                "Übergang (Sekunden)",
                transition.durationSeconds,
                (n) =>
                  edit((d) => {
                    const tr = d.transitions.find(
                      (x) => x.id === transition.id,
                    )!;
                    const factor = n / tr.durationSeconds;
                    tr.durationSeconds = n;
                    for (const m of tr.motions) {
                      m.delaySeconds *= factor;
                      m.durationSeconds *= factor;
                      if (m.type === "group" && m.staggerSeconds) {
                        for (const id of Object.keys(m.staggerSeconds))
                          m.staggerSeconds[id] *= factor;
                      }
                    }
                  }),
                0.01,
                600,
              )}
              <Label bold>Individueller Weg</Label>
              {individualLocked && (
                <Label muted>
                  Diese Person gehört zu einer Gruppenbewegung. Entferne diese
                  zuerst bewusst, bevor du Einzelwege bearbeitest.
                </Label>
              )}
              <Label size={12} muted>
                Wähle eine Person. Ein Bogen verbindet ihre Position mit der
                nächsten Formation.
              </Label>
              <Button
                disabled={selected.length !== 1 || individualLocked}
                onPress={() =>
                  edit((d) => {
                    const tr = d.transitions.find(
                        (x) => x.id === transition.id,
                      )!,
                      pid = selected[0],
                      start = formation.positions[pid],
                      end = d.formations.find((f) => f.id === tr.toFormationId)!
                        .positions[pid];
                    tr.motions = tr.motions.filter((m) =>
                      m.type === "individual"
                        ? m.personId !== pid
                        : !m.personIds.includes(pid),
                    );
                    tr.motions.push({
                      id: createId("motion"),
                      type: "individual",
                      personId: pid,
                      path: {
                        type: "arc",
                        control: {
                          x: (start.x + end.x) / 2 + 2,
                          y: (start.y + end.y) / 2 + 2,
                          z: 0,
                        },
                      },
                      delaySeconds: 0,
                      durationSeconds: tr.durationSeconds,
                      easing: "linear",
                      facing: { type: "along-path" },
                    });
                  })
                }
              >
                Bogenweg anlegen
              </Button>
              <Button
                disabled={selected.length !== 1 || individualLocked}
                onPress={() =>
                  edit((d) => {
                    const tr = d.transitions.find(
                      (x) => x.id === transition.id,
                    )!;
                    tr.motions = tr.motions.filter((m) =>
                      m.type === "individual"
                        ? m.personId !== selected[0]
                        : !m.personIds.includes(selected[0]),
                    );
                  })
                }
              >
                Gerader Weg
              </Button>
              <Label bold>Starre Gruppenbewegung</Label>
              <Button
                onPress={() =>
                  edit((d) => {
                    d.transitions.find((x) => x.id === transition.id)!.motions =
                      d.transitions
                        .find((x) => x.id === transition.id)!
                        .motions.filter((m) => m.type !== "group");
                  })
                }
              >
                Gruppenbewegungen dieses Übergangs entfernen
              </Button>
              <Label size={12} muted>
                Dreht die Auswahl um ihre Mitte. Die Zielpositionen der nächsten
                Formation werden entsprechend gesetzt.
              </Label>
              {[90, 180, 360, -360, 720].map((degrees) => (
                <Button
                  key={degrees}
                  onPress={() => applyRotation(degrees)}
                >{`${degrees}° drehen`}</Button>
              ))}
            </>
          )}
        </>
      )}
      {panel === "Prüfen" && (
        <ConflictPanel
          project={project}
          onSeek={(seconds) => {
            setTime(seconds);
            setPlaying(false);
          }}
        />
      )}
      {panel === "Notizen" && (
        <>
          <Field
            label="Neue Probennotiz"
            multiline
            value={note}
            onChangeText={setNote}
          />
          <Button
            disabled={!note.trim()}
            onPress={() => {
              edit((d) => {
                d.notes.push({
                  id: createId("note"),
                  text: note.trim(),
                  timeSeconds: time,
                });
              });
              setNote("");
            }}
          >
            Notiz hinzufügen
          </Button>
          {project.notes.map((n) => (
            <Card key={n.id}>
              <Label size={11} muted>
                {timeLabel(n.timeSeconds ?? 0)}
              </Label>
              <Label>{n.text}</Label>
              <Button
                onPress={() => {
                  setTime(n.timeSeconds ?? 0);
                  setPlaying(false);
                }}
              >
                Zur Stelle
              </Button>
            </Card>
          ))}
        </>
      )}
      {panel === "Musik" && (
        <>
          <Label bold>Tempo und Counts</Label>
          {numeric(
            "Tempo (BPM)",
            project.tempo.marks[0].bpm,
            (n) =>
              edit((d) => {
                d.tempo.marks[0].bpm = n;
              }),
            20,
            300,
          )}
          {numeric(
            "Count-Offset (Sekunden)",
            project.tempo.countOffsetSeconds,
            (n) =>
              edit((d) => {
                d.tempo.countOffsetSeconds = n;
              }),
            -600,
            600,
          )}
          <MusicPanel
            project={project}
            onChange={(next) => saveHistory(commitProject(history, next))}
          />
        </>
      )}
      {panel === "Freigaben" && (
        <CloudPanel project={project} onMessage={setMessage} />
      )}
      {panel === "Export" && (
        <>
          <Label muted>
            Eine Projektdatei erhält Personen, Formationen, Bewegungen, Timing
            und Notizen.
          </Label>
          <Button onPress={() => void act(() => saveProjectFile(project))}>
            <Download size={17} color={t.text} />
            <Label>Projektdatei exportieren</Label>
          </Button>
          <Button onPress={() => void act(() => exportPng(project, time))}>
            Formation als PNG
          </Button>
          <Button
            onPress={() =>
              void act(async () => {
                const exporter = await import("../export");
                await exporter.exportPdf(project);
              })
            }
          >
            Formationsübersicht als PDF
          </Button>
          <Label size={12} muted>
            Video- und native Bildausgaben sind noch in Arbeit. PDF-Übersichten
            werden lokal als echte Datei erzeugt.
          </Label>
        </>
      )}
      {panel === "Projekteinstellungen" && (
        <>
          <Field label="Projektname" value={rename} onChangeText={setRename} />
          <Button
            disabled={!rename.trim()}
            onPress={() => {
              edit((d) => {
                d.name = rename.trim();
              });
              setMessage("Projekt umbenannt.");
            }}
          >
            Namen speichern
          </Button>
          <Button onPress={() => setPanel("Löschen")}>
            Projekt entfernen …
          </Button>
        </>
      )}
      {panel === "Löschen" && (
        <>
          <Label>
            Dieses lokale Projekt und sein Verlauf werden entfernt. Exportiere
            vorher eine Sicherung, wenn du es behalten möchtest.
          </Label>
          <Button onPress={() => void act(() => saveProjectFile(project))}>
            Sicherung exportieren
          </Button>
          <Button
            onPress={() =>
              void act(async () => {
                await app.remove(project.id);
                router.replace("/");
              })
            }
          >
            Projekt endgültig entfernen
          </Button>
        </>
      )}
    </ScrollView>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          minHeight: 76,
          paddingHorizontal: wide ? 28 : 12,
          paddingVertical: 12,
          backgroundColor: t.surface,
          borderBottomWidth: 1,
          borderColor: t.line,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Button
          onPress={() => router.replace("/")}
          accessibilityLabel="Zurück zu Projekten"
        >
          <ArrowLeft size={20} color={t.text} />
        </Button>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Projektmenü"
          onPress={() => setPanel(panel === "Projektmenü" ? "" : "Projektmenü")}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            minHeight: 44,
          }}
        >
          <View>
            <Label bold size={wide ? 20 : 16}>
              {project.name}
            </Label>
            <Label size={11} muted>
              {app.saveStatus}
            </Label>
          </View>
          <ChevronDown size={17} color={t.muted} />
        </Pressable>
        <Button
          disabled={saving || !history.undoStack.length}
          onPress={() => restoreHistory("undo")}
          accessibilityLabel="Rückgängig"
        >
          <Undo2 size={18} color={t.text} />
        </Button>
        <Button
          disabled={saving || !history.redoStack.length}
          onPress={() => restoreHistory("redo")}
          accessibilityLabel="Wiederholen"
        >
          <Redo2 size={18} color={t.text} />
        </Button>
        {wide && (
          <Button onPress={() => setPanel("Export")}>Exportieren</Button>
        )}
      </View>
      {!!(message || app.error || audioError) && (
        <View
          style={{
            backgroundColor: app.error ? "#fff0ee" : t.tint,
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Label style={{ flex: 1, color: app.error ? t.danger : t.text }}>
            {app.error || message || audioError}
          </Label>
          <Button
            onPress={() => {
              setMessage("");
              app.setError("");
            }}
            accessibilityLabel="Hinweis schließen"
          >
            <X size={16} color={t.muted} />
          </Button>
        </View>
      )}
      <View style={{ flex: 1, flexDirection: "row" }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: wide ? 24 : 12, gap: 16 }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Button selected={mode === "2d"} onPress={() => setMode("2d")}>
                2D
              </Button>
              <Button selected={mode === "3d"} onPress={() => setMode("3d")}>
                3D
              </Button>
            </View>
            <Label muted size={12}>
              {project.stage.width} × {project.stage.depth} m ·{" "}
              {project.people.length} Personen
            </Label>
            <Button selected={paths} onPress={() => setPaths(!paths)}>
              <Route size={16} color={t.muted} />
              <Label>Laufwege</Label>
            </Button>
          </View>
          {mode === "3d" && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                ["angle", "Schräg"],
                ["front", "Publikum"],
                ["top", "Oben"],
              ].map(([key, label]) => (
                <Button
                  key={key}
                  selected={camera === key}
                  onPress={() => setCamera(key)}
                >
                  {label}
                </Button>
              ))}
            </View>
          )}
          <View
            style={{
              borderWidth: 1,
              borderColor: t.line,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {mode === "2d" ? (
              <Stage2D
                project={project}
                time={time}
                selected={selected}
                onSelect={select}
                onMove={playing ? undefined : move}
                showPaths={paths}
                snap={snap}
              />
            ) : (
              <RenderBoundary>
                <Suspense
                  fallback={
                    <ActivityIndicator
                      style={{ height: 300 }}
                      color={t.accent}
                    />
                  }
                >
                  <Stage3D
                    project={project}
                    time={time}
                    selected={selected}
                    onSelect={select}
                    camera={camera}
                  />
                </Suspense>
              </RenderBoundary>
            )}
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
            }}
          >
            <Label muted size={12}>
              {scene.transitionId
                ? "Bewegung im Übergang"
                : `Formation · ${scene.formationId ? project.formations.find((f) => f.id === scene.formationId)?.name : ""}`}
            </Label>
            <Label size={11} muted>
              {snap ? "Raster 0,25 m" : "Frei bewegen"}
            </Label>
          </View>
          <Card style={{ padding: 16, gap: 14 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Button
                onPress={() => {
                  setTime(0);
                  setPlaying(false);
                }}
                accessibilityLabel="Zum Anfang"
              >
                <SkipBack size={17} color={t.text} />
              </Button>
              <Button
                primary
                onPress={() => {
                  if (time >= duration) setTime(0);
                  setPlaying(!playing);
                }}
                accessibilityLabel={playing ? "Pause" : "Abspielen"}
              >
                {playing ? (
                  <Pause size={19} color="#fff" />
                ) : (
                  <Play size={19} color="#fff" />
                )}
              </Button>
              <View style={{ flex: 1 }} testID="playback-time">
                <Label size={17} bold>
                  {timeLabel(time)}{" "}
                  <Label muted size={12}>
                    / {timeLabel(duration)}
                  </Label>
                </Label>
                <Label size={11} muted>
                  {formatCounts(project.tempo, time)}
                </Label>
              </View>
              <Button
                onPress={() =>
                  setSpeed((v) => (v === 1 ? 0.5 : v === 0.5 ? 1.5 : 1))
                }
              >{`${speed}×`}</Button>
            </View>
            <Slider
              testID="timeline-slider"
              accessibilityLabel="Zeitposition"
              value={time}
              minimumValue={0}
              maximumValue={duration}
              step={0.01}
              minimumTrackTintColor={t.accent}
              maximumTrackTintColor={t.line}
              thumbTintColor={t.accent}
              onSlidingStart={() => setPlaying(false)}
              onValueChange={setTime}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {project.formations.map((f, index) => (
                <Pressable
                  key={f.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Formation auswählen: ${f.name}`}
                  accessibilityState={{ selected: formation.id === f.id }}
                  aria-pressed={formation.id === f.id}
                  onPress={() => chooseFormation(f.id)}
                  style={{
                    width: 154,
                    padding: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: formationIndex === index ? t.accent : t.line,
                    backgroundColor: formationIndex === index ? t.tint : t.bg,
                    gap: 7,
                  }}
                >
                  <Label size={10} muted>
                    {String(index + 1).padStart(2, "0")} ·{" "}
                    {timeLabel(formationStartTime(project, f.id))}
                  </Label>
                  <Label size={13} bold>
                    {f.name}
                  </Label>
                  <Label size={11} muted>
                    {f.holdSeconds.toFixed(2)} s halten
                  </Label>
                </Pressable>
              ))}
              <Button
                disabled={saving || project.formations.length >= 200}
                onPress={addFormation}
                accessibilityLabel="Formation hinzufügen"
                style={{ width: 62 }}
              >
                <Plus size={22} color={t.accent} />
              </Button>
            </ScrollView>
          </Card>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button
              selected={panel === "Formationen"}
              onPress={() => setPanel("Formationen")}
            >
              <Layers size={17} color={t.muted} />
              <Label>Formationen</Label>
            </Button>
            <Button onPress={() => setPanel("")}>
              <Move size={17} color={t.muted} />
              <Label>Position</Label>
            </Button>
            <Button onPress={() => setPanel("Weg")}>
              <Route size={17} color={t.muted} />
              <Label>Weg</Label>
            </Button>
            <Button onPress={() => setPanel("Anordnen")}>
              <Grid3X3 size={17} color={t.muted} />
              <Label>Anordnen</Label>
            </Button>
            <Button onPress={() => setPanel("Projektmenü")}>Mehr</Button>
          </View>
          {!wide && (
            <View
              style={{
                backgroundColor: t.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: t.line,
              }}
            >
              {panelContent}
            </View>
          )}
        </ScrollView>
        {wide && (
          <View
            style={{
              width: 285,
              backgroundColor: t.surface,
              borderLeftWidth: 1,
              borderColor: t.line,
            }}
          >
            {panelContent}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
