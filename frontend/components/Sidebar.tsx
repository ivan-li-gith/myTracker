"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare, CreditCard, Briefcase,
  Menu, X, LayoutDashboard, User, Activity,
  PanelLeftClose, PanelLeftOpen, ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

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

const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Reminders", icon: CheckSquare },
  { href: "/payments", label: "Finance", icon: CreditCard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
];

const MORE_NAV: NavItem[] = [];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    const today = todayStr();
    const weekStart = getWeekStart();

    Promise.allSettled([
      apiFetch("/tasks"),
      apiFetch("/habits"),
      apiFetch("/payments"),
      apiFetch("/jobs"),
    ]).then(([t, h, p, j]) => {
      const next: Record<string, number> = {};

      if (t.status === "fulfilled") {
        const pending = (t.value || []).filter((x: { completed: boolean }) => !x.completed).length;
        if (pending > 0) next["/tasks"] = (next["/tasks"] ?? 0) + pending;
      }

      if (h.status === "fulfilled") {
        const habitsNeeded = (h.value || []).filter((x: { logged_dates?: string[]; target_freq?: number }) => {
          if (x.logged_dates?.includes(today)) return false;
          const logsThisWeek = (x.logged_dates || []).filter((d: string) => d >= weekStart).length;
          return logsThisWeek < (x.target_freq ?? 7);
        }).length;
        if (habitsNeeded > 0) next["/tasks"] = (next["/tasks"] ?? 0) + habitsNeeded;
      }

      if (p.status === "fulfilled") {
        const unpaid = (p.value || []).filter((x: { is_paid: boolean }) => !x.is_paid).length;
        if (unpaid > 0) next["/payments"] = unpaid;
      }

      if (j.status === "fulfilled") {
        const active = (j.value || []).filter((x: { status: string }) =>
          x.status === "phone_screen" || x.status === "interview"
        ).length;
        if (active > 0) next["/jobs"] = active;
      }

      setBadges(next);
    });
  }, [pathname]);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function renderNavItem(item: NavItem, isMobile = false) {
    const active = isActive(item.href);
    const Icon = item.icon;
    const hasActiveChild = item.children?.some((c) => isActive(c.href));
    const badge = badges[item.href];

    return (
      <div key={item.href}>
        <Link
          href={item.href}
          title={collapsed && !isMobile ? item.label : undefined}
          onClick={isMobile ? () => setMobileOpen(false) : undefined}
          className={`relative flex items-center gap-3 rounded-md text-sm font-medium transition-all duration-150 ${
            collapsed && !isMobile ? "justify-center px-0 py-2.5" : "px-3 py-2"
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
          {(!collapsed || isMobile) && (
            <>
              <span className="truncate flex-1">{item.label}</span>
              {badge !== undefined && (
                <span className="ml-auto text-[11px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full leading-none">
                  {badge}
                </span>
              )}
            </>
          )}
          {collapsed && !isMobile && badge !== undefined && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-indigo-500 rounded-full" />
          )}
        </Link>

        {/* Children — expanded only */}
        {(!collapsed || isMobile) && item.children && (
          <div className="ml-3 pl-3 border-l border-slate-200 mt-0.5 mb-0.5 flex flex-col gap-0.5">
            {item.children.map((child) => {
              const childActive = isActive(child.href);
              const ChildIcon = child.icon;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={isMobile ? () => setMobileOpen(false) : undefined}
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

        {/* Collapsed children — standalone icons */}
        {collapsed && !isMobile && item.children && (
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
  }

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

  function renderMoreSection(isMobile = false) {
    const isMoreActive = MORE_NAV.some((item) => isActive(item.href));

    if (collapsed && !isMobile) {
      // Collapsed: show More items as plain icons, no toggle needed
      return (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-0.5">
          {MORE_NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center justify-center py-2.5 rounded-md transition-all duration-150 ${
                  active
                    ? "bg-slate-100 text-indigo-600"
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <Icon size={18} />
              </Link>
            );
          })}
        </div>
      );
    }

    return (
      <div className="mt-3 pt-2 border-t border-slate-100">
        <button
          onClick={() => setMoreExpanded((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 w-full rounded-md text-xs font-semibold transition-colors ${
            isMoreActive
              ? "text-slate-700"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <ChevronRight
            size={13}
            className={`transition-transform duration-150 flex-shrink-0 ${moreExpanded || isMoreActive ? "rotate-90" : ""}`}
          />
          More
        </button>
        {(moreExpanded || isMoreActive) && (
          <div className="mt-0.5 flex flex-col gap-0.5">
            {MORE_NAV.map((item) => renderNavItem(item, isMobile))}
          </div>
        )}
      </div>
    );
  }

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

        <nav className="flex flex-col gap-0.5 mt-4 flex-1 overflow-y-auto">
          {PRIMARY_NAV.map((item) => renderNavItem(item))}
          {renderMoreSection()}
        </nav>
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
            <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
              {PRIMARY_NAV.map((item) => renderNavItem(item, true))}
              {renderMoreSection(true)}
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
