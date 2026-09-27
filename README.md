# Quanta Question Bank v7 — Smart Import

Quanta v7 keeps the minimal Supabase question bank workflow, while Smart Import runs from the browser using a Gemini API key stored locally in the user's browser settings.

## What changed

- Smart Import uses the selected AI model to reconstruct Subject → Chapter → Topic, Q/A blocks, PYQ/reference tags, explanations and mathematics.
- Supports `Q1.`, `Q1:`, `Q1)`, `Q1\\.` and Markdown-wrapped variants.
- Answers can be inline or several lines later.
- Numeric citations such as `[১]` are not treated as PYQ tags.
- Slashes inside answers such as `g/m^2` and `kcal/m^2/yr` are not treated as taxonomy paths.
- Incomplete blocks are preserved instead of being silently discarded.
- Large pastes are split into bounded AI chunks and re-joined with duplicate protection.
- Local deterministic parser remains available as an explicit fallback.
- Math/LaTeX is preserved instead of being flattened.
- Settings lets you switch between the two supplied model IDs:
  - `gemini-3.5-flash-lite`
  - `gemma-4-31b-it`

> Model availability is controlled by the Google/Gemini API account and may vary. The app is configured with the exact IDs supplied for this project; if Google reports a model-not-found/unsupported error, switch models in Settings or update the model IDs in `src/lib/ai.js` and the Edge Function allow-list.

## Smart Import API key setup

1. Sign in to Quanta.
2. Open Settings → Smart Import.
3. Choose `gemini-3.5-flash-lite` or `gemma-4-31b-it`.
4. Paste your Gemini API key and click **Save key**.

The key is stored only in browser `localStorage`. Quanta sends it directly to the Google Gemini API from the browser; it is not written to Supabase. Remove it from Settings at any time. Because it is browser-stored, protect the key with suitable Google API restrictions and do not use a server-secret/service-account credential here.

## Netlify

Build command:

```text
npm run build
```

Publish directory:

```text
dist
```

Netlify only needs the public Supabase variables:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

There is no Gemini environment variable to configure in Netlify. The Gemini key is entered by the user in Quanta Settings and stored locally in that browser.

## Import workflow

Paste the raw NotebookLM/AI output → choose the AI model → **Smart analyze** → inspect the structured preview → **Import**.

The preview keeps any incomplete block visible. For an AI response failure, Quanta automatically shows the local deterministic parser as an explicit fallback rather than pretending the AI parse succeeded.
