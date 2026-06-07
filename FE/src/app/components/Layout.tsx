import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface LayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  activeNav: string;
  onNavChange: (nav: string) => void;
}

export function Layout({
  children,
  pageTitle,
  activeNav,
  onNavChange,
}: LayoutProps) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar activeNav={activeNav} onNavChange={onNavChange} />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header pageTitle={pageTitle} />
        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}
