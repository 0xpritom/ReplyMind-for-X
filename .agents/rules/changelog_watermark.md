---
name: Changelog Watermark Rule
description: Maintain version number and date in manifest.json
trigger: always_on
---

# Changelog Watermark Rule

Whenever you solve a problem, fix a bug, or add a feature in this extension, you MUST:
1. Update the `version` field in `manifest.json` (e.g. bump the patch version).
2. Update the `version_name` field in `manifest.json` to include the new version and today's date in the format: `X.Y.Z (Mon D, YYYY)` (e.g., `2.2.1 (Sep 9, 2026)`).

This ensures the extension UI is automatically watermarked with the correct version number and date on every update.
