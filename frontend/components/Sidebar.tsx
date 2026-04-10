"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  CheckSquare, CreditCard, Briefcase, BookOpen, ChefHat, Menu, X, LayoutDashboard, User, Activity
} from "lucide-react";

const navLinks = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Habits & Tasks", icon: CheckSquare },
  // Combined Payments & Expenses
  { href: "/payments", label: "Payments & Expenses", icon: CreditCard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <nav className="flex flex-col gap-1 mt-6 flex-1">
      {navLinks.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-slate-100 text-slate-900 shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Icon size={18} className={isActive ? "text-indigo-600" : "text-slate-400"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const userProfile = (
    <div className="mt-auto border-t border-slate-200 pt-4 pb-2">
      <button className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
        <div className="bg-indigo-100 p-1.5 rounded-full text-indigo-600">
          <User size={16} />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-slate-900 text-xs font-semibold">My Account</span>
          <span className="text-slate-400 text-[10px]">Settings & Preferences</span>
        </div>
      </button>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 px-4 py-5 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
        <div className="flex items-center gap-2 px-3 mb-2">
          <div className="bg-indigo-600 w-6 h-6 rounded-md flex items-center justify-center shadow-sm">
            <Activity size={14} className="text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">myTracker</span>
        </div>
        {navContent}
        {userProfile}
      </aside>

      <header className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
           <div className="bg-indigo-600 w-6 h-6 rounded-md flex items-center justify-center">
            <Activity size={14} className="text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">myTracker</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-500 hover:text-slate-900 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-white h-full px-4 py-5 flex flex-col shadow-2xl animate-in slide-in-from-left-2 duration-200">
            <div className="flex items-center justify-between px-3 mb-4">
               <div className="flex items-center gap-2">
                <div className="bg-indigo-600 w-6 h-6 rounded-md flex items-center justify-center">
                  <Activity size={14} className="text-white" />
                </div>
                <span className="text-lg font-bold text-slate-900 tracking-tight">myTracker</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full p-1 transition-colors"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            {navContent}
            {userProfile}
          </aside>
        </div>
      )}
    </>
  );
}