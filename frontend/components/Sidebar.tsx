"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare, CreditCard, Briefcase, BookOpen, ChefHat,
  Menu, X, LayoutDashboard, User, Activity, FileText,
  PanelLeftClose, PanelLeftOpen, ChevronRight,
} from "lucide-react";

interface NavChild {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  children?: NavChild[];
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Habits & Tasks", icon: CheckSquare },
  { href: "/payments", label: "Payments & Expenses", icon: CreditCard },
  {
    href: "/jobs", label: "Jobs", icon: Briefcase,
    children: [
      { href: "/resumes", label: "Resumes", icon: FileText },
    ],
  },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  // Desktop nav content
  const desktopNav = (
    <nav className="flex flex-col gap-0.5 mt-4 flex-1 overflow-y-auto">
      {NAV.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        const hasActiveChild = item.children?.some((c) => isActive(c.href));

        return (
          <div key={item.href}>
            <Link
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-md text-sm font-medium transition-all duration-150 ${
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"
              } ${
                active || hasActiveChild
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon
                size={18}
                className={`flex-shrink-0 ${active || hasActiveChild ? "text-indigo-600" : "text-slate-400"}`}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>

            {/* Children — only shown when expanded */}
            {!collapsed && item.children && (
              <div className="ml-3 pl-3 border-l border-slate-200 mt-0.5 mb-0.5 flex flex-col gap-0.5">
                {item.children.map((child) => {
                  const childActive = isActive(child.href);
                  const ChildIcon = child.icon;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                        childActive
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      }`}
                    >
                      <ChildIcon
                        size={14}
                        className={`flex-shrink-0 ${childActive ? "text-indigo-500" : "text-slate-400"}`}
                      />
                      <span className="truncate">{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Collapsed children — show as standalone icon rows */}
            {collapsed && item.children && (
              <div className="flex flex-col gap-0.5 mt-0.5">
                {item.children.map((child) => {
                  const childActive = isActive(child.href);
                  const ChildIcon = child.icon;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      title={child.label}
                      className={`flex items-center justify-center py-2 rounded-md transition-all duration-150 ${
                        childActive
                          ? "bg-slate-100 text-indigo-500"
                          : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      }`}
                    >
                      <ChildIcon size={15} className="flex-shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  const userProfile = collapsed ? (
    <div className="mt-auto border-t border-slate-200 pt-3 pb-2 flex justify-center">
      <div className="bg-indigo-100 p-1.5 rounded-full text-indigo-600">
        <User size={16} />
      </div>
    </div>
  ) : (
    <div className="mt-auto border-t border-slate-200 pt-4 pb-2">
      <button className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
        <div className="bg-indigo-100 p-1.5 rounded-full text-indigo-600 flex-shrink-0">
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
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-full bg-white border-r border-slate-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-[width] duration-200 overflow-hidden ${
          collapsed ? "w-16 px-2 py-5" : "w-64 px-4 py-5"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center mb-2 ${collapsed ? "justify-center" : "justify-between px-1"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2 px-2">
              <div className="bg-indigo-600 w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0">
                <Activity size={14} className="text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">myTracker</span>
            </div>
          )}
          <button
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md p-1.5 transition-colors flex-shrink-0 ${
              collapsed ? "" : "ml-auto"
            }`}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {desktopNav}
        {userProfile}
      </aside>

      {/* Mobile header */}
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

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
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
              >
                <X size={20} />
              </button>
            </div>
            {/* Mobile nav — same structure but always expanded */}
            <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
              {NAV.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                const hasActiveChild = item.children?.some((c) => isActive(c.href));
                return (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                        active || hasActiveChild
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon size={18} className={active || hasActiveChild ? "text-indigo-600" : "text-slate-400"} />
                      {item.label}
                    </Link>
                    {item.children && (
                      <div className="ml-3 pl-3 border-l border-slate-200 mt-0.5 mb-0.5 flex flex-col gap-0.5">
                        {item.children.map((child) => {
                          const childActive = isActive(child.href);
                          const ChildIcon = child.icon;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setMobileOpen(false)}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                                childActive
                                  ? "bg-slate-100 text-slate-900"
                                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                              }`}
                            >
                              <ChildIcon size={14} className={childActive ? "text-indigo-500" : "text-slate-400"} />
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
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
          </aside>
        </div>
      )}
    </>
  );
}
