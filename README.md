# أَثَر (Athar)

A fast, calm, eye-friendly open-source Android app for searching Prophetic Hadiths by any Arabic word (beginning, middle, or end), powered by **الموسوعة الحديثية — الدرر السنية (`dorar.net`)**.

## Features (v1.0)

- **11-Level Hadith Authenticity Taxonomy:** Distinguishes rulings on the Hadith as a whole from rulings on a specific narrator chain (Sanad):
  - **صحيح فقط (Sahih only):** `صحيح` (`Sahih`) · `إسناده صحيح` (`Sahih chain`)
  - **حسن (Hasan):** `حسن` (`Hasan`) · `إسناده حسن` (`Hasan chain`)
  - **لم يصح (Unauthentic):** `إسناده ضعيف` (`Weak chain`) · `ضعيف` (`Weak`) · `ضعيف جداً` (`Very weak`) · `منكر` (`Munkar`) · `موضوع` (`Fabricated`) · `باطل / لا أصل له` (`Baseless`)
  - **Special:** `حكم مفصّل` (`Detailed ruling`) for compound/split scholar verdicts and narrator notes
- **Classical Hadith-Science Glossary:** Tapping any badge displays its plain explanation alongside verified, self-contained verbatim definitions from standard Hadith-science works (*مقدمة ابن الصلاح*, *تيسير مصطلح الحديث*, *منهج النقد في علوم الحديث*, and *الوسيط في علوم ومصطلح الحديث*).
- **Scholarly Depth on Demand:**
  - Inline **التخريج (Primary Sources)** and exact verbatim scholar attribution (`حكم <المحدث>:`) on every card.
  - **المصادر الأصلية (Original Sources):** On-demand full verbatim passages and complete narrator chains (**أصول الحديث بالأسانيد**) from Al-Dorar without fabricating rulings on them.
  - **الصحيح البديل (Authentic Alternative):** One-tap verified authentic narrations on weak/unauthentic results when available.
  - **أحاديث مشابهة (Similar Narrations):** Related wordings on non-weak cards when available.
  - **Duplicate Stacking:** Groups repeated records of the same narration under one card with disagreement previews.
- **Forgiving Arabic Search:** Ignores tashkeel/hamza differences, highlights whole matched Arabic words inside diacritized Matn, and suggests/recovers common spelling slips with one-tap revert.
- **Bilingual, Theme-Aware & Snappy:** Full Arabic (RTL) and English (LTR) interface, System / Light / Dark themes, adjustable Hadith text size, locally bundled *Amiri* + *IBM Plex Sans Arabic* fonts, instant filter switching, and smooth reduced-motion-aware transitions.
- **Broad Android Support:** Built with Capacitor 8 for **Android 7.0 through Android 16** (`minSdk 24`, `compileSdk 36`, `targetSdk 36`) with Android 14–16 edge-to-edge safe areas and adaptive + monochrome launcher icons.

## Tech Stack

- **Web UI:** React 18, TypeScript (strict), Vite 6, Tailwind CSS 3, `lucide-react`
- **Typography:** `@fontsource/amiri`, `@fontsource/ibm-plex-sans-arabic`
- **Android Shell:** Capacitor 8 (`@capacitor/android`, `@capacitor/app`, `@capacitor/clipboard`, `@capacitor/share`, `@capacitor/status-bar`, `@capawesome/capacitor-android-edge-to-edge-support`)
- **Testing & Quality:** Vitest, ESLint, TypeScript (`tsc --noEmit`)

## Getting Started

### Prerequisites
- **Node.js** 20+ and **npm**
- For Android APK builds: **JDK 21** (`JAVA_HOME`) and **Android SDK 36** (`ANDROID_HOME`)

### Commands
```bash
npm install
npm run dev        # Local web dev server with Al-Dorar proxy
npm run validate   # ESLint (0 warnings), TypeScript check, Vitest suite, and Vite production build
```

On Windows PowerShell (to build an installable debug APK for Android 7–16):
```powershell
npm.cmd run validate
npm.cmd run android:debug
```

Debug APK output path:
`android/app/build/outputs/apk/debug/app-debug.apk`

## Data Attribution

All Hadith texts, scholar rulings, Takhrij citations, original book passages with chains, authentic alternatives, and similar narrations are retrieved live from **الموسوعة الحديثية — موقع الدرر السنية** ([dorar.net](https://dorar.net)). Athar preserves scholar verdicts verbatim and does not alter religious texts.

## License

Licensed under the [MIT License](LICENSE).
