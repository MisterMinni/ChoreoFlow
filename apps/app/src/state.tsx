import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import { getRepository, type ProjectRepository } from "@choreoflow/data";
import {
  createHistory,
  createProject,
  type ProjectHistory,
  type Cast,
} from "@choreoflow/core";
import { ThemeContext, palettes } from "@choreoflow/ui";
type ThemeMode = "system" | "light" | "dark";
type State = {
  histories: ProjectHistory[];
  casts: Cast[];
  ready: boolean;
  error: string;
  saveStatus: string;
  theme: ThemeMode;
  setTheme: (v: ThemeMode) => void;
  save: (h: ProjectHistory) => Promise<void>;
  add: (name: string, count: number) => Promise<string>;
  remove: (id: string) => Promise<void>;
  saveCast: (cast: Cast) => Promise<void>;
  setError: (s: string) => void;
};
const StateContext = createContext<State>(null!);
export const useApp = () => useContext(StateContext);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [histories, setHistories] = useState<ProjectHistory[]>([]),
    [casts, setCasts] = useState<Cast[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [saveStatus, setSaveStatus] = useState("Laden …"),
    [theme, setThemeState] = useState<ThemeMode>("system");
  const repo = useRef<ProjectRepository | null>(null);
  const system = useColorScheme();
  const queue = useRef(Promise.resolve());
  const blockedProjects = useRef(new Set<string>());
  const pendingSaves = useRef(0);
  useEffect(() => {
    let live = true;
    getRepository()
      .then(async (r) => {
        repo.current = r;
        const [items, mode, castItems] = await Promise.all([
          r.list(),
          r.getSetting<ThemeMode>("theme"),
          r.listCasts(),
        ]);
        if (live) {
          setHistories(items);
          setCasts(castItems);
          setThemeState(mode ?? "system");
          setReady(true);
          setSaveStatus("Lokal gespeichert");
        }
      })
      .catch((e) => {
        if (live) {
          setError(String(e));
          setSaveStatus("Speicher nicht verfügbar");
        }
      });
    return () => {
      live = false;
    };
  }, []);
  const save = async (h: ProjectHistory) => {
    const blockedMessage =
      "Weitere Änderungen sind nach einem Speicherfehler gesperrt. Bitte den sichtbaren Entwurf als Projektdatei exportieren und die App neu laden.";
    if (blockedProjects.current.has(h.present.id)) {
      setError(blockedMessage);
      throw new Error(blockedMessage);
    }
    setHistories((current) => {
      const found = current.some((x) => x.present.id === h.present.id);
      return found
        ? current.map((x) => (x.present.id === h.present.id ? h : x))
        : [h, ...current];
    });
    pendingSaves.current += 1;
    setSaveStatus("Wird gespeichert …");
    const operation = queue.current.then(async () => {
      try {
        if (blockedProjects.current.has(h.present.id))
          throw new Error(blockedMessage);
        if (!repo.current) throw new Error("Speicher noch nicht bereit");
        await repo.current.save(h);
      } catch (e) {
        // Latch before the next queued write starts. Keep the visible draft for
        // export, but never let a later edit persist after an earlier failure.
        blockedProjects.current.add(h.present.id);
        throw e;
      }
    });
    queue.current = operation.catch(() => {});
    try {
      await operation;
    } catch (e) {
      const message = `Speichern fehlgeschlagen. ${blockedMessage} ${String(e)}`;
      setError(message);
      throw new Error(message, { cause: e });
    } finally {
      pendingSaves.current -= 1;
      setSaveStatus(
        blockedProjects.current.size > 0
          ? "Nicht gespeichert"
          : pendingSaves.current > 0
            ? "Wird gespeichert …"
            : "Lokal gespeichert",
      );
    }
  };
  const value: State = {
    histories,
    casts,
    ready,
    error,
    saveStatus,
    theme,
    setError,
    save,
    setTheme: (mode) => {
      setThemeState(mode);
      void repo.current
        ?.setSetting("theme", mode)
        .catch((e) => setError(String(e)));
    },
    add: async (name, count) => {
      const h = createHistory(createProject(name, count));
      await save(h);
      return h.present.id;
    },
    remove: async (id) => {
      await queue.current;
      await repo.current?.remove(id);
      setHistories((items) => items.filter((h) => h.present.id !== id));
    },
    saveCast: async (cast) => {
      await repo.current?.saveCast(cast);
      setCasts(await repo.current!.listCasts());
    },
  };
  return (
    <StateContext.Provider value={value}>
      <ThemeContext.Provider
        value={
          palettes[
            theme === "system" ? (system === "dark" ? "dark" : "light") : theme
          ]
        }
      >
        {children}
      </ThemeContext.Provider>
    </StateContext.Provider>
  );
}
