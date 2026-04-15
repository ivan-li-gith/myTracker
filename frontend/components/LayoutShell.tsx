"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", String(!c));
      return !c;
    });
  }

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main
        className={`flex-1 transition-[margin] duration-200 ${
          collapsed ? "md:ml-16" : "md:ml-64"
        } w-full min-h-screen`}
      >
        {children}
      </main>
    </>
  );
}
