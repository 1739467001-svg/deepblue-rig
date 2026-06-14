/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        status: {
          running: '#22e07a',
          warning: '#ffc23d',
          fault: '#ff4d4d',
          offline: '#6b7280',
        },
      },
    },
  },
  plugins: [],
}
