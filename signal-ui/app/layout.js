import "./globals.css";
import { StoreProvider } from "@/lib/store";

export const metadata = { title: "Trading UI", description: "Historical-only (v5)" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}