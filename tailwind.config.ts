import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ui: ['"IBM Plex Sans Arabic"', 'system-ui', '-apple-system', 'sans-serif'],
        hadith: ['"Amiri"', '"Noto Naskh Arabic"', 'Georgia', 'serif'],
      },
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        subtle: 'var(--bg-subtle)',
        ink: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
        faint: 'var(--text-tertiary)',
        line: 'var(--border-subtle)',
        'line-strong': 'var(--border-strong)',
        brand: {
          DEFAULT: 'var(--brand-primary)',
          soft: 'var(--brand-soft)',
          ink: 'var(--brand-ink)',
        },
        gold: {
          DEFAULT: 'var(--gold-accent)',
          soft: 'var(--gold-soft)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
