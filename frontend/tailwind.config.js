/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FAF9FC',
        surface: '#FFFFFF',
        border: '#E3E0EC',
        'border-hover': '#C9BAF0',
        primary: '#6B5F94',
        'primary-hover': '#5A4F80',
        ink: '#2E2A3D',
        'ink-secondary': '#615A78',
        tag: '#EAE7F2',
        'tag-ink': '#544A73',
        muted: '#F0F0F3',
        'muted-ink': '#5C5C68',
        success: '#E3F3E6',
        'success-ink': '#227A3B',
        warning: '#FBF8EF',
        'warning-ink': '#6B5A26',
        danger: '#FBEAEA',
        'danger-ink': '#A23838',
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
