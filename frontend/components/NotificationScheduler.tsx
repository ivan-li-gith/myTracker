"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/api";

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

async function runChecks(today: string) {
  const weekStart = getWeekStart();
  const hour = new Date().getHours();

  const [paymentsResult, habitsResult, jobsResult] = await Promise.allSettled([
    apiFetch("/payments"),
    apiFetch("/habits"),
    apiFetch("/jobs"),
  ]);

  if (paymentsResult.status === "fulfilled") {
    const urgent = (paymentsResult.value || []).filter(
      (p: { is_paid: boolean; days_until_due: number }) =>
        !p.is_paid && p.days_until_due >= 0 && p.days_until_due <= 2
    );
    if (urgent.length > 0) {
      new Notification("Payment due soon", {
        body: urgent.map((p: { name: string }) => p.name).join(", "),
        icon: "/favicon.ico",
        tag: "payments-due",
      });
    }
  }

  if (habitsResult.status === "fulfilled" && hour >= 18) {
    const unlogged = (habitsResult.value || []).filter(
      (h: { logged_dates?: string[]; target_freq?: number }) => {
        if (h.logged_dates?.includes(today)) return false;
        const logsThisWeek = (h.logged_dates || []).filter((d: string) => d >= weekStart).length;
        return logsThisWeek < (h.target_freq ?? 7);
      }
    );
    if (unlogged.length > 0) {
      new Notification("Don't forget your habits", {
        body: `${unlogged.length} habit${unlogged.length === 1 ? "" : "s"} not logged today`,
        icon: "/favicon.ico",
        tag: "habits-reminder",
      });
    }
  }

  if (jobsResult.status === "fulfilled") {
    const stale = (jobsResult.value || []).filter(
      (j: { status: string | null; date_applied: string | null }) => {
        if (j.status !== "phone_screen" && j.status !== "interview") return false;
        if (!j.date_applied) return false;
        const days = Math.floor((Date.now() - new Date(j.date_applied).getTime()) / 86400000);
        return days >= 14;
      }
    );
    if (stale.length > 0) {
      new Notification("Job applications need follow-up", {
        body: `${stale.length} application${stale.length === 1 ? "" : "s"} in progress for 2+ weeks`,
        icon: "/favicon.ico",
        tag: "jobs-followup",
      });
    }
  }
}

export default function NotificationScheduler() {
  useEffect(() => {
    const today = todayStr();
    const key = `notified-${today}`;
    if (sessionStorage.getItem(key)) return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      sessionStorage.setItem(key, "1");
      runChecks(today);
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          sessionStorage.setItem(key, "1");
          runChecks(today);
        }
      });
    }
  }, []);

  return null;
}
