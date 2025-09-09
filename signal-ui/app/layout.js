// app/layout.js
import "./globals.css";

export const metadata = {
  title: "Trading UI",
  description: "Historical + live (v5)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}