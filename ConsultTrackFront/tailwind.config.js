/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'cdg-blue': '#003366',
                'cdg-green': '#2D6A4F',
                'cdg-gold': '#C5A059',
            },
        },
    },
    plugins: [],
}