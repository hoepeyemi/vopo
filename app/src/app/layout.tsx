import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from "sonner";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { LiveBackground } from "@/components/live-background";

export const metadata: Metadata = {
  title: "vasmo - AI Treasury Agent",
  description: "Autonomous AI manages your invoices 24/7. Tokenize, optimize yield, settle via x402.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-mono antialiased bg-[#0a0a0a] text-[#e5e5e5] scan-pulse corner-glow">
        <LiveBackground />
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#111111',
              border: '1px solid #1f1f1f',
              color: '#e5e5e5',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            },
          }}
        />
        <KeyboardShortcutsProvider />
      </body>
    </html>
  );
}
