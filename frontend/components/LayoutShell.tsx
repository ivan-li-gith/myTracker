"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import GlobalSearch from "@/components/GlobalSearch";
import QuickAddFAB from "@/components/QuickAddFAB";
import NotificationScheduler from "@/components/NotificationScheduler";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    function handleOpen() { setSearchOpen(true); }
    document.addEventListener("open-global-search", handleOpen);
    return () => document.removeEventListener("open-global-search", handleOpen);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", String(!c));
      return !c;
    });
  }

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={toggle} onSearchOpen={() => setSearchOpen(true)} />
      <main
        className={`flex-1 transition-[margin] duration-200 ${
          collapsed ? "md:ml-16" : "md:ml-64"
        } w-full min-h-screen`}
      >
        {children}
      </main>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickAddFAB />
      <NotificationScheduler />
    </>
  );
}
