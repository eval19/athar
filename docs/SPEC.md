# Spec: أَثَر (Athar) — v1 Android Hadith Search App

## 1. Objective
Build **أَثَر (Athar)**, a calm, fast, eye-friendly standalone Android app for searching hadiths by any Arabic word (beginning, middle, or end) powered by **Al-Dorar (الموسوعة الحديثية — الدرر السنية)**, with crisp custom branding, Arabic (primary, RTL) and English (LTR) UI coherence, forgiving Arabic search (diacritic normalization + typo recovery), unmistakable authenticity badges, lightweight grade filtering, clean Copy & Share actions, and seamless compatibility across Android 7 through Android 16 (`minSdk = 24`, `targetSdk = 36`).

## 2. Tech Stack
- **Frontend:** React 18, TypeScript (strict), Vite 6, Tailwind CSS 3, `lucide-react`
- **Typography:** Locally bundled `@fontsource/amiri` (Hadith Matn with full tashkeel clarity) + `@fontsource/ibm-plex-sans-arabic` (UI Arabic + Latin)
- **Android Shell:** Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/clipboard`, `@capacitor/share`, `@capacitor/status-bar`, `@capawesome/capacitor-android-edge-to-edge-support`)
- **Networking:** `CapacitorHttp` on native Android (direct HTTPS to `dorar.net/dorar_api.json`), Vite dev proxy in browser development
- **Testing & Quality:** Vitest, ESLint, TypeScript `tsc --noEmit`
- **Android Build:** Local JDK 21 + Android SDK 36 (`minSdk = 24`, `compileSdk = 36`, `targetSdk = 36`)

## 3. Commands
```powershell
npm.cmd run dev            # Local web dev server with Al-Dorar proxy
npm.cmd run lint           # ESLint (--max-warnings 0)
npm.cmd run typecheck      # Strict TypeScript check
npm.cmd test               # Vitest unit test suite
npm.cmd run build          # Production Vite build
npm.cmd run cap:sync       # Sync dist/ to android/
npm.cmd run android:debug  # Build installable debug APK (API 24..36)
```

## 4. Project Structure
```text
athar/
├── docs/
│   ├── intent/hadith-search-app.md
│   └── SPEC.md
├── tasks/
│   ├── plan.md
│   └── todo.md
├── src/
│   ├── domain/
│   │   ├── hadith.ts
│   │   ├── arabicNormalize.ts
│   │   ├── arabicVocab.ts
│   │   ├── typoSuggest.ts
│   │   ├── gradeClassifier.ts
│   │   └── dorarParser.ts
│   ├── services/
│   │   ├── hadithProvider.ts
│   │   ├── dorarClient.ts
│   │   ├── preferences.ts
│   │   └── shareCopy.ts
│   ├── i18n/
│   │   └── strings.ts
│   ├── components/
│   └── App.tsx
├── tests/
├── assets/
└── android/
```

## 5. Code Style
- Pure domain logic in `src/domain/` with zero DOM or Capacitor imports.
- Strict TypeScript with explicit types; semantic CSS custom properties (`--bg-canvas`, `--bg-card`, `--text-primary`, `--accent-primary`) for Light and Dark modes; native `<dialog>` for modals; ARIA labels and logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`) so RTL and LTR are symmetrically crisp.

## 6. Testing Strategy
- TDD (`red -> green -> refactor`) for all domain modules: `arabicNormalize`, `typoSuggest`, `gradeClassifier`, `dorarParser`, and `shareCopy`.
- Live Dorar API verification + full web build + Android APK build (`minSdk 24`, `targetSdk 36`) + Android emulator / viewport UI verification in Arabic RTL & English LTR (Light and Dark modes).

## 7. Boundaries
- **Always:** Preserve Dorar's exact hadith wording and exact scholar verdict verbatim; credit `dorar.net`; keep `muajjin/` strictly read-only/untouched; run `lint`, `typecheck`, `test`, and `build` before completion claims.
- **Ask first:** New dependencies outside approved spec, v2 features (Major Books full-Sanad, offline DB, Play Store signing).
- **Never:** Hit unauthorized private endpoints (`search.hadeeth.com`), alter religious text/rulings, add ads/trackers, or request unnecessary Android permissions.

## 8. Success Criteria
1. Installable APK builds cleanly with `minSdk = 24`, `compileSdk = 36`, `targetSdk = 36` and respects Android 14–16 edge-to-edge safe areas.
2. Searching any Arabic word returns parsed Al-Dorar hadiths with diacritic-safe word highlighting and smooth pagination.
3. Typo recovery resolves slips like `النارر` and `الناور` to `النار`, displaying results with a clear revertible banner.
4. One-tap grade filters (`الكل`, `صحيح فقط`, `حسن`, `ضعيف`) work accurately without misclassifying weak/negated verdicts as Sahih.
5. Copy and native Android Share produce clean formatted hadith text.
6. Arabic (RTL) and English (LTR) switch cleanly in Light and Dark modes with custom **أَثَر (Athar)** branding and adaptive Android icons.
