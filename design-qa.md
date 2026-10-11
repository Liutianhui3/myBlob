# Chat model selector verification

Scope: the composer control immediately left of Send, the two-stage strength/model popover, and the Ultra slider appearance.

Reference: the three user-supplied screenshots. The implementation follows the compact gray pill, centered strength heading, model-name entry, default model row, selected checkmark, and blue-to-purple Ultra track. Popovers open upward to fit the existing bottom composer. Model choices are limited to the configured provider catalog.

Automated behavior checks cover session preferences, model capability fallback, the two-stage interaction, keyboard navigation, and the max/Ultra request value. These checks do not establish visual fidelity.

Visual comparison is blocked: the in-app browser is unavailable and the browser tool reported `unsupported Codex auth method: apikey`. No current rendered screenshot or light/dark/mobile visual comparison was captured. Existing `.artifacts/chat` screenshots predate this change.

final result: blocked
