/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 明亮海洋色系 - 阳光能照进来的感觉
        ocean: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        // 糖果珊瑚粉
        coral: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
        },
        // 暖沙黄
        sand: {
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
        },
        // 章鱼堡标志性的科技蓝
        octo: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
        },
        // 糖果色按钮
        candy: {
          pink: '#f472b6',
          orange: '#fb923c',
          yellow: '#facc15',
          green: '#4ade80',
          purple: '#a78bfa',
        }
      },
      fontFamily: {
        'game': ['"ZCOOL KuaiLe"', '"Comic Sans MS"', 'cursive', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(34, 211, 238, 0.3)',
        'glow-blue': '0 0 20px rgba(96, 165, 250, 0.2)',
      },
    },
  },
  plugins: [],
}