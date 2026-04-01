/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        teal: { 500: "#028090", 600: "#026d7b" },
        mint: { 500: "#02C39A" },
        coral: { 500: "#E85D4E" },
        gold: { 500: "#F0B429" },
      },
    },
  },
  plugins: [],
};
