/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Peyda', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['14px', { lineHeight: '1.5' }],
        title: ['16px', { lineHeight: '1.4' }],
        'title-lg': ['18px', { lineHeight: '1.35' }],
        section: ['14px', { lineHeight: '1.4' }],
        kpi: ['20px', { lineHeight: '1.2' }],
        'kpi-lg': ['24px', { lineHeight: '1.2' }],
      },
      fontWeight: {
        section: '500',
        title: '600',
        kpi: '700',
      },
      borderRadius: {
        card: '20px',
        panel: '24px',
      },
      maxWidth: {
        data: '1400px',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      boxShadow: {
        glass: '0 12px 40px rgb(0 0 0 / 0.35)',
        'glass-lg': '0 20px 60px rgb(0 0 0 / 0.45)',
      },
    },
  },
  plugins: [],
};
