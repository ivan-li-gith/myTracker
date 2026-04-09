"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Activity, CreditCard, Receipt, Briefcase, BookOpen, ChefHat, Menu, X, LayoutDashboard } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/habits", label: "Habits", icon: Activity },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <nav className="flex flex-col gap-1 mt-6">
      {navLinks.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-indigo-50 text-indigo-600 font-medium"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 bg-white border-r border-slate-100 px-4 py-6">
        <span className="text-xl font-bold text-indigo-600 px-3">myTracker</span>
        {navContent}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-30">
        <span className="text-lg font-bold text-indigo-600">myTracker</span>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-600"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-60 bg-white h-full px-4 py-6 flex flex-col">
            <div className="flex items-center justify-between px-3">
              <span className="text-xl font-bold text-indigo-600">myTracker</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
