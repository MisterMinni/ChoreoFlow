# UI conventions

German product UI. Blue interaction accent, separate participant colors, neutral stage, no ornamental imagery. Shared tokens in `packages/ui` support light/dark/system. Interactive controls have at least 44 logical pixels of height.

Library areas: Projekte, Besetzungen, Vorlagen. Profile/settings provide appearance and development context. Wide screens use a left navigation column; small screens use a compact top navigation.

Editor hides library navigation. Header contains Back, project menu, Undo and Redo with storage status. Stage, 2D/3D toggle, playback and formation timeline retain their positions. Project menu homes: Bühne, Besetzung, Musik, Notizen, Prüfen, Freigaben, Export, Projekteinstellungen. Wide-screen properties appear at right; small-screen properties continue below the stage and timeline.

Selection is labelled, multi-select is explicit, the participant list provides an alternative to dense stage hit targets. Movement during a transition is not accepted as a hidden new formation. Group endpoint consistency is validated and edits that break it fail visibly.

Remaining usability work: pinch/pan and selection rectangle, bottom sheet refinement, arbitrary path handles, 3D drag controls, keyboard focus review and real VoiceOver verification. Small-screen screenshot tests do not establish native accessibility compliance.
