import React, { useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowRight,
  Plus,
  FolderOpen,
  Users,
  LayoutGrid,
  Settings2,
  Music2,
  ChevronRight,
  Upload,
  Layers,
} from "lucide-react-native";
import { Label, Button, Field, Card, useTheme } from "@choreoflow/ui";
import {
  createHistory,
  createId,
  generateTemplate,
  createProject,
  type TemplateType,
} from "@choreoflow/core";
import { Stage2D } from "../components/Stage2D";
import { useApp } from "../state";
import { pickProject } from "../transfer";

export const templateLabels: [TemplateType, string][] = [
  ["line", "Linie"],
  ["rows", "Reihen"],
  ["block", "Block"],
  ["circle", "Kreis"],
  ["semicircle", "Halbkreis"],
  ["v", "V-Formation"],
  ["inverted-v", "Umgekehrtes V"],
  ["diagonal", "Diagonale"],
  ["double-diagonal", "Zwei Diagonalen"],
];
export default function Library() {
  const app = useApp(),
    t = useTheme(),
    wide = useWindowDimensions().width > 850;
  const [tab, setTab] = useState("Projekte"),
    [query, setQuery] = useState(""),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [count, setCount] = useState("12"),
    [busy, setBusy] = useState(false);
  const open = (id: string) => router.push(`/editor/${encodeURIComponent(id)}`);
  const act = async (task: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      app.setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const projects = app.histories.filter((h) =>
    h.present.name.toLowerCase().includes(query.toLowerCase()),
  );
  const nav = (
    <>
      {[
        [FolderOpen, "Projekte"],
        [Users, "Besetzungen"],
        [LayoutGrid, "Vorlagen"],
      ].map(([Icon, title]) => {
        const I = Icon as typeof FolderOpen;
        return (
          <Pressable
            key={String(title)}
            accessibilityRole="button"
            onPress={() => {
              setTab(String(title));
              setCreating(false);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              minHeight: 48,
              borderRadius: 10,
              backgroundColor: tab === title ? t.tint : "transparent",
            }}
          >
            <I size={19} color={tab === title ? t.accent : t.muted} />
            <Label
              bold={tab === title}
              style={{ color: tab === title ? t.accent : t.muted }}
            >
              {String(title)}
            </Label>
          </Pressable>
        );
      })}
    </>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flex: 1, flexDirection: wide ? "row" : "column" }}>
        {wide ? (
          <View
            style={{
              width: 232,
              padding: 22,
              backgroundColor: t.surface,
              borderRightWidth: 1,
              borderColor: t.line,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
                marginTop: 16,
                marginBottom: 48,
              }}
            >
              <View
                style={{
                  backgroundColor: "#3366ef",
                  padding: 10,
                  borderRadius: 12,
                }}
              >
                <Layers color="#fff" size={23} />
              </View>
              <Label size={23} bold>
                ChoreoFlow
              </Label>
            </View>
            <Label
              size={10}
              muted
              bold
              style={{ letterSpacing: 2, marginBottom: 12, paddingLeft: 16 }}
            >
              DEIN ARBEITSRAUM
            </Label>
            <View style={{ gap: 6 }}>{nav}</View>
            <View style={{ flex: 1 }} />
            <View
              style={{
                gap: 14,
                padding: 14,
                borderRadius: 12,
                backgroundColor: t.bg,
              }}
            >
              <Label size={12} bold>
                Für deine nächste Probe.
              </Label>
              <Label size={12} muted>
                Deine Ideen. Deine Formation. Alles an einem Ort.
              </Label>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setTab("Einstellungen")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginTop: 20,
                minHeight: 48,
              }}
            >
              <View
                style={{
                  height: 36,
                  width: 36,
                  borderRadius: 18,
                  backgroundColor: t.tint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Label bold style={{ color: t.accent }}>
                  CF
                </Label>
              </View>
              <View>
                <Label size={13} bold>
                  Lokaler Arbeitsraum
                </Label>
                <Label size={11} muted>
                  Einstellungen
                </Label>
              </View>
              <Settings2 size={16} color={t.muted} />
            </Pressable>
          </View>
        ) : (
          <View
            style={{
              padding: 16,
              gap: 14,
              backgroundColor: t.surface,
              borderBottomWidth: 1,
              borderColor: t.line,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Label size={22} bold>
                ChoreoFlow
              </Label>
              <Button
                onPress={() => setTab("Einstellungen")}
                accessibilityLabel="Einstellungen"
              >
                <Settings2 size={18} color={t.text} />
              </Button>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              {nav}
            </View>
          </View>
        )}
        <ScrollView
          contentContainerStyle={{
            padding: wide ? 42 : 20,
            gap: 28,
            maxWidth: 1450,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <View style={{ gap: 6 }}>
              <Label size={11} muted bold style={{ letterSpacing: 1.5 }}>
                CHOREOGRAFIEN PLANEN. GEMEINSAM BEWEGEN.
              </Label>
              <Label size={wide ? 34 : 28} bold>
                {tab === "Projekte" ? "Deine Projekte" : tab}
              </Label>
              <Label muted>
                {tab === "Projekte"
                  ? "Aus einer Idee wird eine Formation."
                  : tab === "Besetzungen"
                    ? "Deine Teams, immer wieder einsatzbereit."
                    : tab === "Vorlagen"
                      ? "Ein guter Anfang für deine nächste Formation."
                      : "Dein Arbeitsraum, so wie du ihn brauchst."}
              </Label>
            </View>
            {tab === "Projekte" && (
              <Button primary onPress={() => setCreating(!creating)}>
                <Plus size={18} color="#fff" />
                <Label bold style={{ color: "#fff" }}>
                  Neues Projekt
                </Label>
              </Button>
            )}
          </View>
          {app.error !== "" && (
            <Card style={{ borderColor: t.danger }}>
              <Label style={{ color: t.danger }}>{app.error}</Label>
              <Button onPress={() => app.setError("")}>Schließen</Button>
            </Card>
          )}
          {!app.ready ? (
            <ActivityIndicator color={t.accent} size="large" />
          ) : null}
          {creating && (
            <Card>
              <Label size={20} bold>
                Neue Choreografie
              </Label>
              <Field
                label="Projektname"
                value={name}
                onChangeText={setName}
                placeholder="z. B. Saisonauftakt 2027"
                autoFocus
              />
              <Field
                label="Anzahl Personen (1–100)"
                value={count}
                onChangeText={setCount}
                keyboardType="number-pad"
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Button
                  primary
                  disabled={
                    busy ||
                    !name.trim() ||
                    !/^\d+$/.test(count) ||
                    Number(count) < 1 ||
                    Number(count) > 100
                  }
                  onPress={() =>
                    void act(async () =>
                      open(await app.add(name.trim(), Number(count))),
                    )
                  }
                >
                  Projekt erstellen
                </Button>
                <Button onPress={() => setCreating(false)}>Abbrechen</Button>
              </View>
            </Card>
          )}
          {tab === "Projekte" && (
            <>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View style={{ flex: 1, maxWidth: 420 }}>
                  <Field
                    label="Projekte durchsuchen"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Nach einem Projekt suchen …"
                  />
                </View>
                <View style={{ paddingTop: 24 }}>
                  <Button
                    disabled={busy}
                    onPress={() =>
                      void act(async () => {
                        const project = await pickProject();
                        if (project) {
                          project.id = createId("project");
                          await app.save(createHistory(project));
                          open(project.id);
                        }
                      })
                    }
                  >
                    <Upload size={17} color={t.muted} />
                    <Label>Importieren</Label>
                  </Button>
                </View>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Label size={16} bold>
                  Zuletzt bearbeitet
                </Label>
                <Label size={12} muted>
                  {projects.length} Projekte · auf diesem Gerät
                </Label>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
                {projects.map(({ present: p }) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Projekt öffnen: ${p.name}`}
                    onPress={() => open(p.id)}
                    style={({ pressed }) => ({
                      width: wide ? "31.8%" : "100%",
                      minWidth: wide ? 240 : undefined,
                      backgroundColor: t.surface,
                      borderRadius: 17,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: pressed ? t.accent : t.line,
                    })}
                  >
                    <View
                      style={{
                        padding: 20,
                        paddingBottom: 10,
                        backgroundColor: t.raised,
                      }}
                    >
                      <Stage2D
                        project={p}
                        time={0}
                        selected={[]}
                        onSelect={() => {}}
                        compact
                      />
                    </View>
                    <View style={{ padding: 20, gap: 14 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Label size={18} bold>
                          {p.name}
                        </Label>
                        <ArrowRight color={t.muted} size={18} />
                      </View>
                      <View style={{ flexDirection: "row", gap: 15 }}>
                        <View style={{ flexDirection: "row", gap: 5 }}>
                          <Users size={14} color={t.muted} />
                          <Label size={12} muted>
                            {p.people.length} Personen
                          </Label>
                        </View>
                        <Label size={12} muted>
                          {p.formations.length} Formationen
                        </Label>
                      </View>
                      <View style={{ height: 1, backgroundColor: t.line }} />
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <Label size={11} muted>
                          {new Date(p.updatedAt).toLocaleDateString("de-DE", {
                            day: "numeric",
                            month: "short",
                          })}
                        </Label>
                        <Label size={11} style={{ color: t.accent }}>
                          Im Editor öffnen →
                        </Label>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
              {projects.length === 0 && (
                <Card>
                  <Label bold>Noch kein passendes Projekt</Label>
                  <Label muted>
                    Erstelle eine Choreografie oder importiere eine eigene
                    Projektdatei.
                  </Label>
                </Card>
              )}
              <Card
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 8,
                  backgroundColor: t.tint,
                  borderColor: "transparent",
                }}
              >
                <View
                  style={{
                    padding: 13,
                    backgroundColor: t.surface,
                    borderRadius: 12,
                  }}
                >
                  <Music2 size={24} color={t.accent} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Label bold>Mehr Raum für deine Ideen</Label>
                  <Label size={13} muted>
                    Plane Formationen, entdecke Laufwege und sieh deine
                    Choreografie in Bewegung.
                  </Label>
                </View>
                <ChevronRight color={t.accent} size={20} />
              </Card>
            </>
          )}
          {tab === "Besetzungen" && (
            <>
              {app.casts.length === 0 ? (
                <Card>
                  <Users color={t.accent} size={28} />
                  <Label bold>Dein Team beginnt im Projekt</Label>
                  <Label muted>
                    Im Editor kannst du unter „Besetzung“ Personen bearbeiten
                    und das Team hier wiederverwenden.
                  </Label>
                </Card>
              ) : (
                app.casts.map((c) => (
                  <Card key={c.id}>
                    <Label size={20} bold>
                      {c.name}
                    </Label>
                    <Label muted>
                      {c.people.map((p) => p.label).join(" · ")}
                    </Label>
                    <Button
                      onPress={() =>
                        void act(async () => {
                          const p = createProject(c.name, c.people.length);
                          p.people = structuredClone(c.people);
                          p.groups = structuredClone(c.groups);
                          p.castSource = { id: c.id, revision: c.revision };
                          p.formations[0].positions = generateTemplate(
                            "rows",
                            c.people.map((p) => p.id),
                          );
                          p.formations[0].facing = Object.fromEntries(
                            c.people.map((p) => [p.id, 0]),
                          );
                          await app.save(createHistory(p));
                          open(p.id);
                        })
                      }
                    >
                      Projekt mit dieser Besetzung
                    </Button>
                  </Card>
                ))
              )}
            </>
          )}
          {tab === "Vorlagen" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
              {templateLabels.map(([kind, label]) => {
                const p = createProject(label, 12);
                p.formations[0].positions = generateTemplate(
                  kind,
                  p.people.map((p) => p.id),
                );
                return (
                  <Card
                    key={kind}
                    style={{
                      width: wide ? "31.8%" : "100%",
                      minWidth: wide ? 230 : undefined,
                    }}
                  >
                    <Stage2D
                      compact
                      project={p}
                      time={0}
                      selected={[]}
                      onSelect={() => {}}
                    />
                    <Label size={18} bold>
                      {label}
                    </Label>
                    <Button
                      onPress={() =>
                        void act(async () => {
                          await app.save(createHistory(p));
                          open(p.id);
                        })
                      }
                    >
                      Vorlage verwenden
                    </Button>
                  </Card>
                );
              })}
            </View>
          )}
          {tab === "Einstellungen" && (
            <>
              <Card>
                <Label size={19} bold>
                  Darstellung
                </Label>
                <View
                  style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                >
                  {(["system", "light", "dark"] as const).map((mode, i) => (
                    <Button
                      key={mode}
                      selected={app.theme === mode}
                      onPress={() => app.setTheme(mode)}
                    >
                      {["System", "Hell", "Dunkel"][i]}
                    </Button>
                  ))}
                </View>
              </Card>
              <Card>
                <Label size={19} bold>
                  Lokale Entwicklung
                </Label>
                <Label muted>
                  Projekte bleiben in diesem Browser oder auf diesem Gerät.
                  Exportiere regelmäßig eine Projektdatei als Sicherung.
                  Cloudkopien und Freigaben findest du im Projektmenü.
                </Label>
                <Label size={12} muted>
                  Technischer Entwicklungsstand · noch keine
                  Store-Veröffentlichung
                </Label>
              </Card>
            </>
          )}
          <Label size={11} muted style={{ marginTop: 18 }}>
            CHOREOFLOW · DEIN RAUM FÜR BEWEGUNG
          </Label>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
