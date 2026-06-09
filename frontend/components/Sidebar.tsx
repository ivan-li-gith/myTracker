"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare, CreditCard, Briefcase, ClipboardList,
  Menu, X, LayoutDashboard, Activity,
  PanelLeftClose, PanelLeftOpen, LogOut,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

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
  { href: "/work-log", label: "Work Log", icon: ClipboardList },
];

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
  const [badges, setBadges] = useState<Record<string, number>>({});
  const { data: session } = useSession();

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
    const isExpanded = !collapsed || isMobile;

    return (
      <div key={item.href}>
        <Link
          href={item.href}
          title={!isExpanded ? item.label : undefined}
          onClick={isMobile ? () => setMobileOpen(false) : undefined}
          className={`relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 ${
            !isExpanded ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
          } ${
            active || hasActiveChild
              ? "bg-white/[0.08] text-white"
              : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
          }`}
        >
          {/* Active left indicator bar */}
          {(active || hasActiveChild) && isExpanded && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
          )}

          <Icon
            size={18}
            className={`flex-shrink-0 transition-colors ${
              active || hasActiveChild ? "text-indigo-400" : ""
            }`}
          />

          {isExpanded && (
            <>
              <span className="truncate flex-1">{item.label}</span>
              {badge !== undefined && (
                <span className="ml-auto text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full leading-none">
                  {badge}
                </span>
              )}
            </>
          )}

          {!isExpanded && badge !== undefined && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-400 rounded-full" />
          )}
        </Link>

        {/* Children — expanded only */}
        {isExpanded && item.children && (
          <div className="ml-3 pl-3 border-l border-white/[0.06] mt-0.5 mb-0.5 flex flex-col gap-0.5">
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
                      ? "bg-white/[0.08] text-white"
                      : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                  }`}
                >
                  <ChildIcon
                    size={14}
                    className={`flex-shrink-0 ${childActive ? "text-indigo-400" : "text-slate-500"}`}
                  />
                  <span className="truncate">{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Collapsed children — standalone icons */}
        {!isExpanded && !isMobile && item.children && (
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
                      ? "bg-white/[0.08] text-indigo-400"
                      : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300"
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

  const logo = (
    <div className="flex items-center gap-2.5">
      <div className="bg-indigo-500 w-7 h-7 rounded-lg flex items-center justify-center shadow-[0_0_14px_rgba(99,102,241,0.45)] flex-shrink-0">
        <Activity size={14} className="text-white" />
      </div>
      <span className="text-base font-bold text-white tracking-tight">myTracker</span>
    </div>
  );

  const avatar = session?.user?.image ? (
    <Image
      src={session.user.image}
      alt="avatar"
      width={28}
      height={28}
      className="rounded-full flex-shrink-0"
    />
  ) : (
    <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-xs font-bold flex-shrink-0">
      {session?.user?.name?.[0] ?? "?"}
    </div>
  );

  const userProfile = (
    <div className="border-t border-white/[0.06] pt-3 pb-1">
      {collapsed ? (
        <div className="flex flex-col items-center gap-1">
          {avatar}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] rounded-md p-1.5 transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2">
          {avatar}
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="text-slate-200 text-xs font-semibold leading-none truncate">
              {session?.user?.name ?? "—"}
            </span>
            <span className="text-slate-500 text-[10px] mt-0.5 leading-none truncate">
              {session?.user?.email ?? ""}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="text-slate-500 hover:text-red-400 hover:bg-white/[0.06] rounded-md p-1.5 transition-colors flex-shrink-0"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-full bg-[#0f1022] border-r border-white/[0.07] z-20 transition-[width] duration-200 overflow-hidden ${
          collapsed ? "w-16 px-2 py-5" : "w-60 px-3 py-5"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center mb-4 ${collapsed ? "flex-col gap-2" : "justify-between px-1"}`}>
          {collapsed ? (
            <>
              <div className="bg-indigo-500 w-8 h-8 rounded-lg flex items-center justify-center shadow-[0_0_14px_rgba(99,102,241,0.45)] flex-shrink-0">
                <Activity size={16} className="text-white" />
              </div>
              <button
                onClick={onToggle}
                title="Expand sidebar"
                className="text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] rounded-md p-1.5 transition-colors"
              >
                <PanelLeftOpen size={15} />
              </button>
            </>
          ) : (
            <>
              {logo}
              <button
                onClick={onToggle}
                title="Collapse sidebar"
                className="text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] rounded-md p-1.5 transition-colors ml-auto flex-shrink-0"
              >
                <PanelLeftClose size={15} />
              </button>
            </>
          )}
        </div>

        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
          {PRIMARY_NAV.map((item) => renderNavItem(item))}
        </nav>

        {userProfile}
      </aside>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between bg-[#0f1022] border-b border-white/[0.06] px-4 py-3 sticky top-0 z-30">
        {logo}
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-400 hover:text-white p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-60 bg-[#0f1022] h-full px-3 py-5 flex flex-col border-r border-white/[0.06]">
            <div className="flex items-center justify-between px-1 mb-5">
              {logo}
              <button
                onClick={() => setMobileOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
              {PRIMARY_NAV.map((item) => renderNavItem(item, true))}
            </nav>
            <div className="border-t border-white/[0.06] pt-3 pb-1">
              <div className="flex items-center gap-2 px-3 py-2">
                {avatar}
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-slate-200 text-xs font-semibold leading-none truncate">
                    {session?.user?.name ?? "—"}
                  </span>
                  <span className="text-slate-500 text-[10px] mt-0.5 leading-none truncate">
                    {session?.user?.email ?? ""}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  title="Sign out"
                  className="text-slate-500 hover:text-red-400 hover:bg-white/[0.06] rounded-md p-1.5 transition-colors flex-shrink-0"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
