import type { ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { ChatWidget } from "@/components/ChatWidget";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <ClientOnly fallback={null}>
        <ChatWidget />
      </ClientOnly>
    </div>
  );
}