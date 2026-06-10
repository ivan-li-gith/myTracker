"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import {
  CreditCard as CreditCardIcon, Receipt, MoreHorizontal,
  CheckCircle2, Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2,
  ScanLine, Upload, Loader2, Users, ChevronDown,
  TrendingDown, TrendingUp, Wallet, Tag, DollarSign, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Send, RotateCcw, Zap, GraduationCap, Search, RefreshCw, Landmark, PiggyBank,
  ShoppingCart, Package, Coffee, Utensils, Fuel, ParkingSquare, Car, Tv, Heart, Dumbbell, Plane, Music, Building2, BarChart2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Expense, Category, CreditCard, MoneyTransfer, Bank, Person, UtilityBill, UtilityBillPriceHistoryEntry, UtilityReimbursement, Loan, StockHolding, StockLot, StockDividend } from "@/lib/types";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ---- Price history helper ----

function getUtilBillPriceForMonth(bill: UtilityBill, month: string): number {
  if (!bill.price_history?.length) return Number(bill.amount);
  const monthStart = `${month}-01`;
  const applicable = bill.price_history.filter((h) => h.effective_from <= monthStart);
  if (!applicable.length) {
    return Number(bill.price_history.reduce((min, h) => h.effective_from < min.effective_from ? h : min).amount);
  }
  return Number(applicable.reduce((latest, h) => h.effective_from > latest.effective_from ? h : latest).amount);
}

// ---- Helpers ----

function formatAmount(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtAxis(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${v < 0 ? "-" : ""}$${(abs / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

const PORTFOLIO_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#f97316", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#a78bfa"];

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const MERCHANT_ICONS: [RegExp, React.ElementType][] = [
  [/amazon/i, Package],
  [/costco|walmart|target|sam.s club|whole foods|trader joe|kroger|safeway|aldi|publix|wegman|sprouts|grocery|market/i, ShoppingCart],
  [/starbucks|dunkin|peet|coffee|cafe/i, Coffee],
  [/mcdonald|burger king|wendy|chick.fil|taco bell|kfc|popeye|panda|subway|chipotle|five guys|shake shack|pizza|sushi|ramen|pho|restaurant|dining|diner|bistro|eatery|kitchen/i, Utensils],
  [/shell|chevron|exxon|mobil|bp |valero|sunoco|gas station|gas & go/i, Fuel],
  [/parking|valet/i, ParkingSquare],
  [/uber|lyft|taxi/i, Car],
  [/netflix|hulu|disney\+|paramount|peacock|hbo|max\b|prime video|apple tv|twitch/i, Tv],
  [/spotify|apple music|tidal|pandora/i, Music],
  [/cvs|walgreen|rite aid|pharmacy|clinic|medical|dental|doctor|hospital/i, Heart],
  [/gym|fitness|planet fitness|la fitness|equinox|ymca|crossfit/i, Dumbbell],
  [/delta|united|american air|southwest|jetblue|spirit|frontier|airline|airways/i, Plane],
  [/hotel|marriott|hilton|hyatt|sheraton|airbnb|motel|inn\b|resort/i, Building2],
];

function getMerchantIcon(name: string): React.ElementType {
  for (const [pattern, Icon] of MERCHANT_ICONS) {
    if (pattern.test(name)) return Icon;
  }
  return Receipt;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: -1 | 1) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- Row menu ----

function RowMenu({ onEdit, onDelete, onLogPrice, onReturn }: {
  onEdit: () => void;
  onDelete: () => void;
  onLogPrice?: () => void;
  onReturn?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        (!dropRef.current || !dropRef.current.contains(e.target as Node))
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  return (
    <div>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-slate-300 hover:bg-white/[0.1] rounded-md"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && createPortal(
        <div
          ref={dropRef}
          className="fixed z-50 bg-[#1e2245] border border-white/[0.1] rounded-lg shadow-lg py-1 w-32 text-sm"
          style={{ top: pos.top, right: pos.right }}
        >
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-300 hover:bg-white/[0.05] transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
          {onReturn && (
            <button
              onClick={() => { setOpen(false); onReturn(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-emerald-600 hover:bg-emerald-500/10 transition-colors"
            >
              <RotateCcw size={14} /> Return
            </button>
          )}
          {onLogPrice && (
            <button
              onClick={() => { setOpen(false); onLogPrice(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-violet-600 hover:bg-violet-500/10 transition-colors"
            >
              <DollarSign size={14} /> Inc price
            </button>
          )}
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ---- Finance Summary ----

const BAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-sky-500", "bg-emerald-500",
  "bg-amber-500", "bg-rose-500", "bg-pink-500", "bg-cyan-500",
];

const CARD_COLOR_MAP: Record<string, string> = {
  slate: "#64748b", blue: "#3b82f6", violet: "#8b5cf6",
  emerald: "#10b981", amber: "#f59e0b", rose: "#f43f5e",
  sky: "#0ea5e9", pink: "#ec4899",
};

function resolveCardColor(color: string | null, idx: number): string {
  if (color && CARD_COLOR_MAP[color]) return CARD_COLOR_MAP[color];
  const fallbacks = Object.values(CARD_COLOR_MAP);
  return fallbacks[idx % fallbacks.length];
}

// ---- Receipt Scanner ----

type ScannedRow = { name: string; amount: string; date: string; category_id: string; notes: string };

function ScanModal({
  onClose,
  onSave,
  expenseCategories,
  creditCards,
}: {
  onClose: () => void;
  onSave: (rows: ScannedRow[], creditCardId: string) => Promise<void>;
  expenseCategories: Category[];
  creditCards: CreditCard[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<ScannedRow[] | null>(null);
  const [creditCardId, setCreditCardId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
  }, []);

  async function scan() {
    if (!files.length) return;
    setScanning(true);
    setError(null);
    try {
      const results = await Promise.all(
        files.map((file) => {
          const form = new FormData();
          form.append("file", file);
          return apiFetch("/scan/receipt", { method: "POST", body: form });
        })
      );
      const all = results.flatMap((r) =>
        (r.transactions ?? []).map((t: { name: string; amount: number; date: string }) => ({
          name: t.name,
          amount: String(t.amount),
          date: t.date,
          category_id: "",
          notes: "",
        }))
      );
      if (!all.length) {
        setError("No transactions found in any of the files. Try clearer images.");
      } else {
        setRows(all);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed. Check your ANTHROPIC_API_KEY and try again.");
    } finally {
      setScanning(false);
    }
  }

  function updateRow(i: number, field: keyof ScannedRow, value: string) {
    setRows((prev) => prev ? prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r) : prev);
  }

  function removeRow(i: number) {
    setRows((prev) => prev ? prev.filter((_, idx) => idx !== i) : prev);
  }

  async function handleSave() {
    if (!rows?.length) return;
    setSaving(true);
    try {
      await onSave(rows, creditCardId);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.07]">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ScanLine size={18} className="text-indigo-500" />
            Scan Receipt or Bill
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!rows ? (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  dragging ? "border-indigo-400 bg-indigo-500/20" : "border-white/[0.1] hover:border-indigo-300 hover:bg-white/[0.05]"
                }`}
              >
                <Upload size={28} className="text-slate-400" />
                <div className="text-center">
                  {files.length === 0 ? (
                    <>
                      <p className="text-sm font-medium text-slate-300">Drop files here or click to browse</p>
                      <p className="text-xs text-slate-400 mt-1">JPEG, PNG, or PDF — multiple files supported</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-300">{files.length} file{files.length !== 1 ? "s" : ""} selected</p>
                      <p className="text-xs text-slate-400 mt-1">{files.map((f) => f.name).join(", ")}</p>
                    </>
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    if (picked.length) setFiles((prev) => [...prev, ...picked]);
                    e.target.value = "";
                  }}
                />
              </div>

              {files.length > 0 && (
                <button
                  onClick={() => setFiles([])}
                  className="text-xs text-slate-400 hover:text-slate-300 self-start transition-colors"
                >
                  Clear selection
                </button>
              )}

              {error && <p className="text-sm text-red-500 text-center">{error}</p>}

              <button
                onClick={scan}
                disabled={!files.length || scanning}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {scanning
                  ? <><Loader2 size={16} className="animate-spin" /> Scanning{files.length > 1 ? ` ${files.length} files` : ""}…</>
                  : <><ScanLine size={16} /> Scan with Claude</>}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-500">
                Review and edit the extracted transactions before saving.
              </p>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-300 shrink-0">Credit card for all</label>
                <select
                  value={creditCardId}
                  onChange={(e) => setCreditCardId(e.target.value)}
                  className="flex-1 border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                >
                  <option value="">None</option>
                  {creditCards.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.last_four ? ` ····${c.last_four}` : ""}</option>
                  ))}
                </select>
              </div>

              <div className="border border-white/[0.1] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#14162e] text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-2.5">Description</th>
                      <th className="text-left px-4 py-2.5 w-28">Amount</th>
                      <th className="text-left px-4 py-2.5 w-32">Date</th>
                      <th className="text-left px-4 py-2.5 w-36">Category</th>
                      <th className="text-left px-4 py-2.5">Notes</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.07]">
                    {rows.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <input
                            value={row.name}
                            onChange={(e) => updateRow(i, "name", e.target.value)}
                            className="w-full border border-white/[0.1] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-[#14162e] text-slate-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => updateRow(i, "amount", e.target.value)}
                            className="w-full border border-white/[0.1] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-[#14162e] text-slate-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => updateRow(i, "date", e.target.value)}
                            className="w-full border border-white/[0.1] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-[#14162e] text-slate-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.category_id}
                            onChange={(e) => updateRow(i, "category_id", e.target.value)}
                            className="w-full border border-white/[0.1] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-[#1e2245]"
                          >
                            <option value="">None</option>
                            {expenseCategories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.notes}
                            onChange={(e) => updateRow(i, "notes", e.target.value)}
                            placeholder="Optional"
                            className="w-full border border-white/[0.1] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-[#14162e] text-slate-200"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => removeRow(i)}
                            className="text-slate-300 hover:text-red-400 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => { setRows(null); setFiles([]); setError(null); }}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors self-start"
              >
                ← Scan different files
              </button>
            </div>
          )}
        </div>

        {rows && (
          <div className="flex gap-3 justify-end p-6 border-t border-white/[0.07]">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!rows.length || saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : `Save ${rows.length} transaction${rows.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Constants ----

const EMPTY_EXPENSE = { name: "", amount: "", date: "", category_id: "", credit_card_id: "", notes: "", service_period_start: "", service_period_end: "" };
const EMPTY_CC_FORM = { name: "", color: "blue" };
const EMPTY_TRANSFER = { name: "", date: "", direction: "sent", person: "", platform: "", bank_id: "", from_bank_id: "", to_bank_id: "", category_id: "", credit_card_id: "", amount: "", notes: "" };
const EMPTY_BANK_FORM = { name: "", account_type: "checking" as "checking" | "savings", starting_balance: "", starting_balance_as_of: "" };
const UTILITY_NAMES = ["Electric", "Water", "Internet", "Gas", "Trash"];
const EMPTY_BILL = { utility: "", is_recurring: false, service_period_start: "", service_period_end: "", charge_date: "", charge_day: "", billing_start: "", amount: "", split_with: "", notes: "" };
const EMPTY_LOAN = { name: "", disbursement_date: "", original_principal: "", unpaid_principal: "", interest_rate: "", unpaid_interest: "", total_interest_paid: "0", notes: "" };

// ---- Page ----

export default function PaymentsAndExpensesPage() {
  return (
    <Suspense>
      <PaymentsAndExpensesPageInner />
    </Suspense>
  );
}

function PaymentsAndExpensesPageInner() {
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "credit_card" | "expense" | "transfer" | "loan" | "stock" | "bank"; id: number } | null>(null);

  const [showScanModal, setShowScanModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "transfers" | "loans" | "stocks">("overview");
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [highlightKind, setHighlightKind] = useState<"expense" | "transfer" | "stock" | null>(null);

  // Stocks
  const [stocks, setStocks] = useState<StockHolding[]>([]);
  const [portfolioSlide, setPortfolioSlide] = useState(0);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editStock, setEditStock] = useState<StockHolding | null>(null);
  const [stockForm, setStockForm] = useState({ ticker: "", company_name: "", shares: "", buy_price: "", purchased_at: "", notes: "" });
  const [stockSaveError, setStockSaveError] = useState<string | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(new Set());
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [expandedStockIds, setExpandedStockIds] = useState<Set<number>>(new Set());
  const [addingLotForId, setAddingLotForId] = useState<number | null>(null);
  const [lotForm, setLotForm] = useState({ shares: "", buy_price: "", purchased_at: "" });
  const [lotSaveError, setLotSaveError] = useState<string | null>(null);
  const [selectedLotIds, setSelectedLotIds] = useState<Set<number>>(new Set());
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellForm, setSellForm] = useState({ sold_price: "", sold_at: "" });
  const [sellSaveError, setSellSaveError] = useState<string | null>(null);
  const [stockFilter] = useState("");
  const [stockSortCol, setStockSortCol] = useState<string>("ticker");
  const [stockSortDir, setStockSortDir] = useState<"asc" | "desc">("asc");
  const [showDividendModal, setShowDividendModal] = useState(false);
  const [dividendModalHoldingId, setDividendModalHoldingId] = useState<number | null>(null);
  const [editingDividend, setEditingDividend] = useState<StockDividend | null>(null);
  const [dividendModalForm, setDividendModalForm] = useState({ paid_at: "", dividend_per_share: "", shares_held: "", reinvested: false, notes: "" });
  const [dividendModalError, setDividendModalError] = useState<string | null>(null);

  // Split state
  const [knownPeople, setKnownPeople] = useState<Person[]>([]);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [catDropOpen, setCatDropOpen] = useState(false);
  const catDropRef = useRef<HTMLDivElement>(null);
  const [cardDropOpen, setCardDropOpen] = useState(false);
  const cardDropRef = useRef<HTMLDivElement>(null);
  // Expense sort & filter
  const [expenseSort, setExpenseSort] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [transferSort, setTransferSort] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [cardFilterIds, setCardFilterIds] = useState<Set<number | null>>(new Set());
  const [ccFilterDropOpen, setCcFilterDropOpen] = useState(false);
  const ccFilterDropRef = useRef<HTMLDivElement>(null);
  const [catFilterId, setCatFilterId] = useState<number | null | "all">("all");
  const [transferCatFilterId, setTransferCatFilterId] = useState<number | null | "all">("all");
  const [transferTypeFilter, setTransferTypeFilter] = useState<"all" | "in" | "out" | "cc" | "internal">("all");
  const [merchantBreakdownOpen, setMerchantBreakdownOpen] = useState(false);
  const merchantBreakdownRef = useRef<HTMLDivElement>(null);

  // Inline category creation (expense modal)
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Credit card modal
  const [showCreditCardModal, setShowCreditCardModal] = useState(false);
  const [editCreditCard, setEditCreditCard] = useState<CreditCard | null>(null);
  const [creditCardForm, setCreditCardForm] = useState(EMPTY_CC_FORM);
  const [ccSaveError, setCCSaveError] = useState<string | null>(null);

  // Inline card creation (inside expense modal)
  const [addingCard, setAddingCard] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [newCardColor, setNewCardColor] = useState("blue");

  // Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);
  const [expenseSaveError, setExpenseSaveError] = useState<string | null>(null);

  // Money transfers
  const [moneyTransfers, setMoneyTransfers] = useState<MoneyTransfer[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editTransfer, setEditTransfer] = useState<MoneyTransfer | null>(null);
  const [transferForm, setTransferForm] = useState(EMPTY_TRANSFER);
  const [transferType, setTransferType] = useState<"bank" | "in" | "out" | "cc" | "">("");
  const [transferSaveError, setTransferSaveError] = useState<string | null>(null);

  // Banks
  const [banks, setBanks] = useState<Bank[]>([]);
  // Bank modal (add/edit bank account)
  const [showBankModal, setShowBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [bankModalForm, setBankModalForm] = useState(EMPTY_BANK_FORM);
  const [bankModalError, setBankModalError] = useState<string | null>(null);
  // From-bank dropdown in transfer form
  const [fromBankDropOpen, setFromBankDropOpen] = useState(false);
  const fromBankDropRef = useRef<HTMLDivElement>(null);
  const [addingFromBank, setAddingFromBank] = useState(false);
  const [newFromBankName, setNewFromBankName] = useState("");
  // To-bank dropdown in transfer form
  const [toBankDropOpen, setToBankDropOpen] = useState(false);
  const toBankDropRef = useRef<HTMLDivElement>(null);
  const [addingToBank, setAddingToBank] = useState(false);
  const [newToBankName, setNewToBankName] = useState("");
  const [personDropOpen, setPersonDropOpen] = useState(false);
  const personDropRef = useRef<HTMLDivElement>(null);

  // Utility ledger
  const [utilityBills, setUtilityBills] = useState<UtilityBill[]>([]);
  const [utilityReimbursements, setUtilityReimbursements] = useState<UtilityReimbursement[]>([]);
  const [showBillModal, setShowBillModal] = useState(false);
  const [editBill, setEditBill] = useState<UtilityBill | null>(null);
  const [billForm, setBillForm] = useState(EMPTY_BILL);
  const [billSaveError, setBillSaveError] = useState<string | null>(null);
  const [billSplitPeople, setBillSplitPeople] = useState<string[]>([]);
  const [billSplitDropOpen, setBillSplitDropOpen] = useState(false);
  const billSplitDropRef = useRef<HTMLDivElement>(null);
  const [utilitiesOpen, setUtilitiesOpen] = useState(true);
  const [utilBillsOpen, setUtilBillsOpen] = useState(true);
  const [utilBalancesOpen, setUtilBalancesOpen] = useState(true);
  const [expandedUtilPersons, setExpandedUtilPersons] = useState<Set<string>>(new Set());
  const [showUtilLogPriceModal, setShowUtilLogPriceModal] = useState(false);
  const [utilLogPriceTarget, setUtilLogPriceTarget] = useState<UtilityBill | null>(null);
  const [utilLogPriceForm, setUtilLogPriceForm] = useState({ amount: "", effectiveMonth: "" });
  const [utilLogPriceSaveError, setUtilLogPriceSaveError] = useState<string | null>(null);


  // College loans
  const [loans, setLoans] = useState<Loan[]>([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN);
  const [loanSaveError, setLoanSaveError] = useState<string | null>(null);

  // Section collapse state
  const [owedOpen, setOwedOpen] = useState(true);
  const [trendHalf, setTrendHalf] = useState<"H1" | "H2">("H1");
  const [showAllCats, setShowAllCats] = useState(false);
  const [showAllCards, setShowAllCards] = useState(false);
  const [expandedOverviewCats, setExpandedOverviewCats] = useState<Set<string>>(new Set());
  const [expandedOverviewCatMerchants, setExpandedOverviewCatMerchants] = useState<Set<string>>(new Set());
  const [expandedOverviewCards, setExpandedOverviewCards] = useState<Set<string>>(new Set());
  const [expandedOverviewCardMerchants, setExpandedOverviewCardMerchants] = useState<Set<string>>(new Set());
  const [expandedOwedIds, setExpandedOwedIds] = useState<Set<string>>(new Set());
  const [expandedLedgerGroups, setExpandedLedgerGroups] = useState<Set<string>>(new Set());
  const [recordPaymentId, setRecordPaymentId] = useState<string | null>(null);
  const [recordPaymentAmount, setRecordPaymentAmount] = useState("");
  const [recordPaymentDate, setRecordPaymentDate] = useState(toLocalDate(new Date()));
  const [recordPaymentNotes, setRecordPaymentNotes] = useState("");

  // All-time data for the split ledger
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allTransfers, setAllTransfers] = useState<MoneyTransfer[]>([]);


  useEffect(() => {
    apiFetch("/categories").then(setExpenseCategories).catch(console.error);
    apiFetch("/credit-cards").then(setCreditCards).catch(console.error);
    apiFetch("/banks").then(setBanks).catch(console.error);
    apiFetch("/people").then(setKnownPeople).catch(console.error);
    apiFetch("/expenses").then(setAllExpenses).catch(console.error);
    apiFetch("/money-transfers").then(setAllTransfers).catch(console.error);
    apiFetch("/utility-bills").then(setUtilityBills).catch(console.error);
    apiFetch("/utility-reimbursements").then(setUtilityReimbursements).catch(console.error);
    apiFetch("/loans").then(setLoans).catch(console.error);
    apiFetch("/stocks").then(setStocks).catch(console.error);
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (catDropRef.current && !catDropRef.current.contains(e.target as Node)) setCatDropOpen(false);
      if (cardDropRef.current && !cardDropRef.current.contains(e.target as Node)) setCardDropOpen(false);
      if (fromBankDropRef.current && !fromBankDropRef.current.contains(e.target as Node)) setFromBankDropOpen(false);
      if (toBankDropRef.current && !toBankDropRef.current.contains(e.target as Node)) setToBankDropOpen(false);
      if (personDropRef.current && !personDropRef.current.contains(e.target as Node)) setPersonDropOpen(false);
      if (billSplitDropRef.current && !billSplitDropRef.current.contains(e.target as Node)) setBillSplitDropOpen(false);
      if (ccFilterDropRef.current && !ccFilterDropRef.current.contains(e.target as Node)) setCcFilterDropOpen(false);
      if (merchantBreakdownRef.current && !merchantBreakdownRef.current.contains(e.target as Node)) setMerchantBreakdownOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    apiFetch(`/expenses?month=${selectedMonth}`).then(setExpenses).catch(console.error);
    apiFetch(`/money-transfers?month=${selectedMonth}`).then(setMoneyTransfers).catch(console.error);
  }, [selectedMonth]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const month = searchParams.get("month");
    const id = searchParams.get("id");
    const holdingId = searchParams.get("holdingId");
    if (tab && ["overview", "expenses", "transfers", "loans", "stocks"].includes(tab)) {
      setActiveTab(tab as "overview" | "expenses" | "transfers" | "loans" | "stocks");
    }
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      setSelectedMonth(month);
    }
    if (id) {
      setHighlightId(Number(id));
      setHighlightKind(tab === "transfers" ? "transfer" : "expense");
    } else if (holdingId) {
      setHighlightId(Number(holdingId));
      setHighlightKind("stock");
    } else {
      setHighlightId(null);
      setHighlightKind(null);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!highlightId || !highlightKind) return;
    const elemId =
      highlightKind === "expense" ? `expense-row-${highlightId}` :
      highlightKind === "transfer" ? `transfer-row-${highlightId}` :
      `stock-row-${highlightId}`;
    const el = document.getElementById(elemId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => {
      setHighlightId(null);
      setHighlightKind(null);
    }, 2500);
    return () => clearTimeout(t);
  }, [highlightId, highlightKind, expenses, moneyTransfers, stocks, activeTab]);

  const getCatName = (id: number | null, cats: Category[]) =>
    id != null ? (cats.find((c) => c.id === id)?.name ?? null) : null;

  const getCardDisplayName = (id: number | null) => {
    if (id == null) return null;
    const card = creditCards.find((c) => c.id === id);
    if (!card) return null;
    return card.last_four ? `${card.name} ····${card.last_four}` : card.name;
  };

  const filteredExpenses = expenses
    .filter((e) => cardFilterIds.size === 0 || cardFilterIds.has(e.credit_card_id))
    .filter((e) => catFilterId === "all" || e.category_id === catFilterId);

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    if (expenseSort === "date-asc") return a.date.localeCompare(b.date);
    if (expenseSort === "amount-desc") return Math.abs(Number(b.amount)) - Math.abs(Number(a.amount));
    if (expenseSort === "amount-asc") return Math.abs(Number(a.amount)) - Math.abs(Number(b.amount));
    return b.date.localeCompare(a.date);
  });

  const isInternalTransfer = (t: MoneyTransfer) => t.from_bank_id != null && t.to_bank_id != null;
  const transferMonthCatIds = new Set(moneyTransfers.map((t) => t.category_id));
  const transferPillCats = [
    ...(transferMonthCatIds.has(null) ? [{ id: null as number | null, name: "Uncategorized" }] : []),
    ...expenseCategories.filter((c) => transferMonthCatIds.has(c.id)),
  ];
  const typeFilteredTransfers = (() => {
    switch (transferTypeFilter) {
      case "in":       return moneyTransfers.filter(t => t.direction === "received" && !isInternalTransfer(t));
      case "out":      return moneyTransfers.filter(t => t.direction === "sent" && !isInternalTransfer(t) && t.credit_card_id == null);
      case "cc":       return moneyTransfers.filter(t => t.credit_card_id != null);
      case "internal": return moneyTransfers.filter(isInternalTransfer);
      default:         return moneyTransfers;
    }
  })();
  const filteredTransfers = transferCatFilterId === "all"
    ? typeFilteredTransfers
    : typeFilteredTransfers.filter((t) => t.category_id === transferCatFilterId);
  const sortedTransfers = [...filteredTransfers].sort((a, b) => {
    if (transferSort === "date-asc") return a.date.localeCompare(b.date);
    if (transferSort === "amount-desc") return Number(b.amount) - Number(a.amount);
    if (transferSort === "amount-asc") return Number(a.amount) - Number(b.amount);
    return b.date.localeCompare(a.date);
  });
  const isTransferDateSort = transferSort === "date-desc" || transferSort === "date-asc";
  type TransferDateGroup = { date: string; label: string; dayNet: number; items: MoneyTransfer[] };
  const transferDateGroups: TransferDateGroup[] = [];
  if (isTransferDateSort) {
    for (const t of sortedTransfers) {
      let group = transferDateGroups.find((g) => g.date === t.date);
      if (!group) {
        const [ty, tm, td] = t.date.split("-").map(Number);
        const label = new Date(ty, tm - 1, td).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        group = { date: t.date, label, dayNet: 0, items: [] };
        transferDateGroups.push(group);
      }
      group.dayNet += t.direction === "received" ? Number(t.amount) : -Number(t.amount);
      group.items.push(t);
    }
  }

  const merchantFreqMap = new Map<string, { count: number; displayName: string }>();
  for (const e of filteredExpenses) {
    const key = e.name.toLowerCase().trim();
    const existing = merchantFreqMap.get(key);
    if (!existing) {
      merchantFreqMap.set(key, { count: 1, displayName: e.name });
    } else {
      existing.count++;
    }
  }
  const repeatMerchants = [...merchantFreqMap.values()]
    .filter((m) => m.count > 1)
    .sort((a, b) => b.count - a.count);
  const oneOffCount = [...merchantFreqMap.values()].filter((m) => m.count === 1).length;

  const isDateSort = expenseSort === "date-desc" || expenseSort === "date-asc";
  type ExpenseDateGroup = { date: string; label: string; dayTotal: number; items: Expense[] };
  const expenseDateGroups: ExpenseDateGroup[] = [];
  if (isDateSort) {
    for (const e of sortedExpenses) {
      let group = expenseDateGroups.find((g) => g.date === e.date);
      if (!group) {
        const [ey, em, ed] = e.date.split("-").map(Number);
        const label = new Date(ey, em - 1, ed).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        group = { date: e.date, label, dayTotal: 0, items: [] };
        expenseDateGroups.push(group);
      }
      group.dayTotal += Number(e.amount);
      group.items.push(e);
    }
  }

  // ---- Credit Cards ----

  async function saveCreditCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCCSaveError(null);
    const body = { name: creditCardForm.name, color: creditCardForm.color || null };
    try {
      const updated = await apiFetch(`/credit-cards/${editCreditCard!.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setCreditCards((prev) => prev.map((c) => c.id === editCreditCard!.id ? updated : c));
      setShowCreditCardModal(false);
      setEditCreditCard(null);
      setCreditCardForm(EMPTY_CC_FORM);
    } catch (err) {
      setCCSaveError(err instanceof Error ? err.message : "Failed to save credit card");
    }
  }

  function resetInlineCard() {
    setAddingCard(false);
    setNewCardName("");
    setNewCardColor("blue");
  }

  async function addCardInline() {
    const name = newCardName.trim();
    if (!name) return;
    const created = await apiFetch("/credit-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: newCardColor }),
    });
    setCreditCards((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setExpenseForm((f) => ({ ...f, credit_card_id: String(created.id) }));
    setTransferForm((f) => ({ ...f, credit_card_id: String(created.id) }));
    resetInlineCard();
  }

  async function deleteCreditCard(id: number) {
    await apiFetch(`/credit-cards/${id}`, { method: "DELETE" });
    setCreditCards((prev) => prev.filter((c) => c.id !== id));
    if (expenseForm.credit_card_id === String(id)) setExpenseForm((f) => ({ ...f, credit_card_id: "" }));
    if (transferForm.credit_card_id === String(id)) setTransferForm((f) => ({ ...f, credit_card_id: "" }));
  }

  // ---- Year search ----

  // ---- Money Transfers ----

  async function addBankInlineFrom() {
    const name = newFromBankName.trim();
    if (!name) return;
    const created: Bank = await apiFetch("/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBanks((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setTransferForm((f) => ({ ...f, from_bank_id: String(created.id) }));
    setNewFromBankName("");
    setAddingFromBank(false);
  }

  async function addBankInlineTo() {
    const name = newToBankName.trim();
    if (!name) return;
    const created: Bank = await apiFetch("/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBanks((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setTransferForm((f) => ({ ...f, to_bank_id: String(created.id) }));
    setNewToBankName("");
    setAddingToBank(false);
  }

  async function deleteBank(id: number) {
    await apiFetch(`/banks/${id}`, { method: "DELETE" });
    setBanks((prev) => prev.filter((b) => b.id !== id));
    if (transferForm.from_bank_id === String(id)) setTransferForm((f) => ({ ...f, from_bank_id: "" }));
    if (transferForm.to_bank_id === String(id)) setTransferForm((f) => ({ ...f, to_bank_id: "" }));
  }

  function resetTransferBankDropState() {
    setFromBankDropOpen(false); setAddingFromBank(false); setNewFromBankName("");
    setToBankDropOpen(false); setAddingToBank(false); setNewToBankName("");
  }

  // Bank account CRUD (for transfers tab)
  function openAddBankAccount(type: "checking" | "savings") {
    setEditingBank(null);
    setBankModalForm({ ...EMPTY_BANK_FORM, account_type: type });
    setBankModalError(null);
    setShowBankModal(true);
  }

  function openEditBankAccount(bank: Bank) {
    setEditingBank(bank);
    setBankModalForm({
      name: bank.name,
      account_type: (bank.account_type as "checking" | "savings") ?? "checking",
      starting_balance: bank.starting_balance != null ? String(bank.starting_balance) : "",
      starting_balance_as_of: bank.starting_balance_as_of ?? "",
    });
    setBankModalError(null);
    setShowBankModal(true);
  }

  async function saveBankAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBankModalError(null);
    try {
      const body = {
        name: bankModalForm.name.trim(),
        account_type: bankModalForm.account_type,
        starting_balance: bankModalForm.starting_balance ? parseFloat(bankModalForm.starting_balance) : null,
        starting_balance_as_of: bankModalForm.starting_balance_as_of || null,
      };
      if (editingBank) {
        const updated: Bank = await apiFetch(`/banks/${editingBank.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setBanks((prev) => prev.map((b) => b.id === editingBank.id ? updated : b).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const created: Bank = await apiFetch("/banks", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setBanks((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowBankModal(false);
      setEditingBank(null);
    } catch (err) {
      setBankModalError(err instanceof Error ? err.message : "Failed to save bank");
    }
  }

  async function deleteBankAccount(id: number) {
    await apiFetch(`/banks/${id}`, { method: "DELETE" });
    setBanks((prev) => prev.filter((b) => b.id !== id));
  }

  function openAddTransfer() {
    setEditTransfer(null);
    setTransferForm({ ...EMPTY_TRANSFER, date: toLocalDate(new Date()) });
    setTransferType("");
    setTransferSaveError(null);
    resetTransferBankDropState();
    setPersonDropOpen(false); setAddingPerson(false); setNewPersonName("");
    setShowTransferModal(true);
  }

  function openEditTransfer(t: MoneyTransfer) {
    setEditTransfer(t);
    const legacyFromBank = t.from_bank_id != null ? String(t.from_bank_id) : (t.direction === "sent" && t.bank_id != null ? String(t.bank_id) : "");
    const legacyToBank = t.to_bank_id != null ? String(t.to_bank_id) : (t.direction === "received" && t.bank_id != null ? String(t.bank_id) : "");
    const derivedType: "bank" | "in" | "out" | "cc" =
      (t.credit_card_id != null) ? "cc" :
      (legacyFromBank !== "" && legacyToBank !== "") ? "bank" :
      t.direction === "received" ? "in" : "out";
    setTransferType(derivedType);
    setTransferForm({
      name: t.name ?? "",
      date: t.date,
      direction: t.direction,
      person: t.person,
      platform: t.platform ?? "",
      bank_id: t.bank_id != null ? String(t.bank_id) : "",
      from_bank_id: legacyFromBank,
      to_bank_id: legacyToBank,
      category_id: t.category_id != null ? String(t.category_id) : "",
      credit_card_id: t.credit_card_id != null ? String(t.credit_card_id) : "",
      amount: String(t.amount),
      notes: t.notes ?? "",
    });
    setTransferSaveError(null);
    resetTransferBankDropState();
    setPersonDropOpen(false); setAddingPerson(false); setNewPersonName("");
    setShowTransferModal(true);
  }

  async function persistTransfer(): Promise<void> {
    const direction = transferType === "in" ? "received" : "sent";
    const body = {
      name: transferForm.name.trim() || null,
      date: transferForm.date,
      direction,
      person: (transferType === "bank" || transferType === "cc") ? "" : transferForm.person.trim(),
      platform: (transferType === "bank" || transferType === "cc") ? null : (transferForm.platform.trim() || null),
      bank_id: null,
      from_bank_id: (transferType === "bank" || transferType === "out" || transferType === "cc") && transferForm.from_bank_id ? parseInt(transferForm.from_bank_id) : null,
      to_bank_id: (transferType === "bank" || transferType === "in") && transferForm.to_bank_id ? parseInt(transferForm.to_bank_id) : null,
      category_id: transferForm.category_id ? parseInt(transferForm.category_id) : null,
      credit_card_id: transferType === "cc" && transferForm.credit_card_id ? parseInt(transferForm.credit_card_id) : null,
      amount: parseFloat(transferForm.amount),
      notes: transferForm.notes.trim() || null,
    };
    if (editTransfer) {
      const updated: MoneyTransfer = await apiFetch(`/money-transfers/${editTransfer.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setAllTransfers((prev) => prev.map((t) => t.id === editTransfer.id ? updated : t));
      if (updated.date.startsWith(selectedMonth)) {
        setMoneyTransfers((prev) => prev.map((t) => t.id === editTransfer.id ? updated : t));
      } else {
        setMoneyTransfers((prev) => prev.filter((t) => t.id !== editTransfer.id));
      }
    } else {
      const created: MoneyTransfer = await apiFetch("/money-transfers", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setAllTransfers((prev) => [created, ...prev]);
      if (created.date.startsWith(selectedMonth)) {
        setMoneyTransfers((prev) => [created, ...prev]);
      }
    }
  }

  async function saveTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTransferSaveError(null);
    try {
      await persistTransfer();
      setShowTransferModal(false);
      setEditTransfer(null);
      setTransferForm(EMPTY_TRANSFER);
      resetTransferBankDropState();
      setPersonDropOpen(false); setAddingPerson(false); setNewPersonName("");
    } catch (err) {
      setTransferSaveError(err instanceof Error ? err.message : "Failed to save transfer");
    }
  }

  async function saveTransferAndAddAnother() {
    setTransferSaveError(null);
    try {
      await persistTransfer();
      setTransferForm((f) => ({ ...EMPTY_TRANSFER, date: f.date }));
      resetTransferBankDropState();
      setPersonDropOpen(false); setAddingPerson(false); setNewPersonName("");
    } catch (err) {
      setTransferSaveError(err instanceof Error ? err.message : "Failed to save transfer");
    }
  }

  // ---- Utility Ledger ----

  function openAddBill() {
    setEditBill(null);
    setBillForm({ ...EMPTY_BILL, charge_date: toLocalDate(new Date()) });
    setBillSplitPeople([]);
    setBillSaveError(null);
    setShowBillModal(true);
  }

  function openEditBill(b: UtilityBill) {
    setEditBill(b);
    setBillForm({
      utility: b.utility,
      is_recurring: b.is_recurring,
      service_period_start: b.service_period_start ?? "",
      service_period_end: b.service_period_end ?? "",
      charge_date: b.charge_date ?? "",
      charge_day: b.charge_day != null ? String(b.charge_day) : "",
      billing_start: b.billing_start ? b.billing_start.substring(0, 7) : "",
      amount: String(b.amount),
      split_with: b.split_with ?? "",
      notes: b.notes ?? "",
    });
    setBillSplitPeople(b.split_with ? b.split_with.split(",") : []);
    setBillSaveError(null);
    setShowBillModal(true);
  }

  async function saveBill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBillSaveError(null);
    try {
      const isRec = billForm.is_recurring;
      const body = {
        utility: billForm.utility.trim(),
        is_recurring: isRec,
        service_period_start: !isRec && billForm.service_period_start ? billForm.service_period_start : null,
        service_period_end: !isRec && billForm.service_period_end ? billForm.service_period_end : null,
        charge_date: !isRec && billForm.charge_date ? billForm.charge_date : null,
        charge_day: isRec && billForm.charge_day ? parseInt(billForm.charge_day) : null,
        billing_start: isRec && billForm.billing_start ? `${billForm.billing_start}-01` : null,
        amount: parseFloat(billForm.amount),
        split_with: billSplitPeople.length > 0 ? billSplitPeople.join(",") : null,
        notes: billForm.notes.trim() || null,
      };
      if (editBill) {
        const updated: UtilityBill = await apiFetch(`/utility-bills/${editBill.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setUtilityBills((prev) => prev.map((b) => b.id === editBill.id ? updated : b));
      } else {
        const created: UtilityBill = await apiFetch("/utility-bills", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setUtilityBills((prev) => [created, ...prev]);
      }
      setShowBillModal(false);
      setEditBill(null);
      setBillForm(EMPTY_BILL);
      setBillSplitPeople([]);
    } catch (err) {
      setBillSaveError(err instanceof Error ? err.message : "Failed to save bill");
    }
  }

  async function deleteBill(id: number) {
    await apiFetch(`/utility-bills/${id}`, { method: "DELETE" });
    setUtilityBills((prev) => prev.filter((b) => b.id !== id));
  }

  async function saveUtilLogPrice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!utilLogPriceTarget) return;
    setUtilLogPriceSaveError(null);
    const amount = parseFloat(utilLogPriceForm.amount);
    if (isNaN(amount) || amount <= 0) { setUtilLogPriceSaveError("Amount must be a positive number"); return; }
    if (!utilLogPriceForm.effectiveMonth) { setUtilLogPriceSaveError("Effective month is required"); return; }
    try {
      const entry: UtilityBillPriceHistoryEntry = await apiFetch(`/utility-bills/${utilLogPriceTarget.id}/price-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, effective_from: `${utilLogPriceForm.effectiveMonth}-01` }),
      });
      setUtilityBills((prev) => prev.map((b) =>
        b.id === utilLogPriceTarget.id
          ? { ...b, amount, price_history: [...b.price_history, entry] }
          : b
      ));
      setShowUtilLogPriceModal(false);
      setUtilLogPriceTarget(null);
      setUtilLogPriceForm({ amount: "", effectiveMonth: "" });
    } catch (err) {
      setUtilLogPriceSaveError(err instanceof Error ? err.message : "Failed to save price change");
    }
  }

  async function togglePersonPaid(name: string, isPaid: boolean, owed: number, existingReimbs: UtilityReimbursement[]) {
    if (isPaid) {
      await Promise.all(existingReimbs.map((r) => apiFetch(`/utility-reimbursements/${r.id}`, { method: "DELETE" })));
      const ids = new Set(existingReimbs.map((r) => r.id));
      setUtilityReimbursements((prev) => prev.filter((r) => !ids.has(r.id)));
    } else {
      const created: UtilityReimbursement = await apiFetch("/utility-reimbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: name, amount: owed, date: `${selectedMonth}-01` }),
      });
      setUtilityReimbursements((prev) => [created, ...prev]);
    }
  }

  // Utility balance: per person, what they owe vs what they've paid — scoped to selectedMonth
  const utilityBalances = (() => {
    const today = new Date();
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const todayDay = today.getDate();
    const todayStr = `${todayMonth}-${String(todayDay).padStart(2, "0")}`;
    const personMap = new Map<string, { owed: number; paid: number; bills: { bill: UtilityBill; share: number }[]; reimbursements: UtilityReimbursement[] }>();
    for (const bill of utilityBills) {
      if (!bill.split_with) continue;
      const names = bill.split_with.split(",").map((n) => n.trim());
      const shareRatio = 1 / (names.length + 1);
      let monthShare: number | null = null;
      if (bill.is_recurring && bill.billing_start) {
        const billStart = bill.billing_start.substring(0, 7);
        if (billStart <= selectedMonth) {
          const chargeOccurred =
            selectedMonth < todayMonth ||
            (selectedMonth === todayMonth && (bill.charge_day != null ? todayDay >= bill.charge_day : true));
          if (chargeOccurred) monthShare = getUtilBillPriceForMonth(bill, selectedMonth) * shareRatio;
        }
      } else {
        if (bill.charge_date && bill.charge_date.startsWith(selectedMonth) && bill.charge_date <= todayStr) {
          monthShare = Number(bill.amount) * shareRatio;
        }
      }
      if (monthShare === null) continue;
      for (const name of names) {
        if (!personMap.has(name)) personMap.set(name, { owed: 0, paid: 0, bills: [], reimbursements: [] });
        const entry = personMap.get(name)!;
        entry.owed += monthShare;
        entry.bills.push({ bill, share: monthShare });
      }
    }
    for (const r of utilityReimbursements) {
      if (!r.date.startsWith(selectedMonth)) continue;
      if (!personMap.has(r.person)) personMap.set(r.person, { owed: 0, paid: 0, bills: [], reimbursements: [] });
      const entry = personMap.get(r.person)!;
      entry.paid += Number(r.amount);
      entry.reimbursements.push(r);
    }
    return Array.from(personMap.entries())
      .map(([name, data]) => ({ name, ...data, outstanding: data.owed - data.paid }))
      .filter((e) => e.owed > 0 || e.paid > 0)
      .sort((a, b) => b.outstanding - a.outstanding);
  })();

  // ---- Expenses ----

  async function addExpenseCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const created: Category = await apiFetch("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setExpenseCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setExpenseForm((f) => ({ ...f, category_id: String(created.id) }));
    setNewCatName("");
    setAddingCat(false);
  }

  async function addTransferCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const created: Category = await apiFetch("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setExpenseCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setTransferForm((f) => ({ ...f, category_id: String(created.id) }));
    setNewCatName("");
    setAddingCat(false);
  }

  async function addNewPerson() {
    const name = newPersonName.trim();
    if (!name) return;
    if (!knownPeople.find((p) => p.name === name)) {
      try {
        const created: Person = await apiFetch("/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
        setKnownPeople((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        // already exists or other error — still allow selecting the name locally
      }
    }
    setNewPersonName("");
    setAddingPerson(false);
  }

  async function deleteCategory(id: number) {
    await apiFetch(`/categories/${id}`, { method: "DELETE" });
    setExpenseCategories((prev) => prev.filter((c) => c.id !== id));
    if (expenseForm.category_id === String(id)) setExpenseForm((f) => ({ ...f, category_id: "" }));
    if (transferForm.category_id === String(id)) setTransferForm((f) => ({ ...f, category_id: "" }));
  }

  async function removePerson(name: string) {
    const person = knownPeople.find((p) => p.name === name);
    if (person) {
      await apiFetch(`/people/${person.id}`, { method: "DELETE" });
      setKnownPeople((prev) => prev.filter((p) => p.id !== person.id));
    }
  }

  function openAddExpense() {
    setEditExpense(null);
    setExpenseForm({ ...EMPTY_EXPENSE, date: toLocalDate(new Date()) });
    setExpenseSaveError(null);
    setAddingCat(false); setNewCatName(""); setCatDropOpen(false);
    setCardDropOpen(false);
    resetInlineCard();
    setShowExpenseModal(true);
  }

  function openEditExpense(ex: Expense) {
    setEditExpense(ex);
    setExpenseForm({
      name: ex.name,
      amount: String(ex.amount),
      date: ex.date,
      category_id: ex.category_id != null && expenseCategories.find((c) => c.id === ex.category_id)
        ? String(ex.category_id) : "",
      credit_card_id: ex.credit_card_id != null && creditCards.find((c) => c.id === ex.credit_card_id)
        ? String(ex.credit_card_id) : "",
      notes: ex.notes ?? "",
      service_period_start: ex.service_period_start ?? "",
      service_period_end: ex.service_period_end ?? "",
    });
    setExpenseSaveError(null);
    setAddingPerson(false); setNewPersonName("");
    setAddingCat(false); setNewCatName(""); setCatDropOpen(false);
    setCardDropOpen(false);
    resetInlineCard();
    setShowExpenseModal(true);
  }

  async function persistExpense(): Promise<Expense | null> {
    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount)) throw new Error("Amount is required and must be a valid number");
    const body = {
      name: expenseForm.name,
      amount,
      date: expenseForm.date,
      category_id: expenseForm.category_id ? parseInt(expenseForm.category_id) : null,
      credit_card_id: expenseForm.credit_card_id ? parseInt(expenseForm.credit_card_id) : null,
      notes: expenseForm.notes || null,
      service_period_start: expenseForm.service_period_start || null,
      service_period_end: expenseForm.service_period_end || null,
    };
    if (editExpense) {
      const updated = await apiFetch(`/expenses/${editExpense.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setExpenses((prev) => prev.map((ex) => (ex.id === editExpense.id ? updated : ex)));
      setAllExpenses((prev) => prev.map((ex) => ex.id === editExpense.id ? updated : ex));
      return updated;
    } else {
      const created = await apiFetch("/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setAllExpenses((prev) => [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      if (created.date.startsWith(selectedMonth)) {
        setExpenses((prev) => [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      }
      return created;
    }
  }

  async function saveExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExpenseSaveError(null);
    try {
      await persistExpense();
      setShowExpenseModal(false);
      setEditExpense(null);
      setExpenseForm(EMPTY_EXPENSE);
    } catch (err) {
      setExpenseSaveError(err instanceof Error ? err.message : "Failed to save expense");
    }
  }

  async function saveExpenseAndAddAnother() {
    setExpenseSaveError(null);
    try {
      await persistExpense();
      setExpenseForm({ ...EMPTY_EXPENSE, date: expenseForm.date });
    } catch (err) {
      setExpenseSaveError(err instanceof Error ? err.message : "Failed to save expense");
    }
  }

  async function deleteExpense(id: number) {
    await apiFetch(`/expenses/${id}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((ex) => ex.id !== id));
    setAllExpenses((prev) => prev.filter((ex) => ex.id !== id));
  }

  async function returnExpense(expense: Expense) {
    if (Number(expense.amount) <= 0) return;
    const updated = await apiFetch(`/expenses/${expense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: -Math.abs(Number(expense.amount)) }),
    });
    setExpenses((prev) => prev.map((ex) => ex.id === expense.id ? updated : ex));
    setAllExpenses((prev) => prev.map((ex) => ex.id === expense.id ? updated : ex));
  }

  // ---- Loans ----

  async function saveLoan(e: React.FormEvent) {
    e.preventDefault();
    setLoanSaveError(null);
    try {
      const body = {
        name: loanForm.name,
        disbursement_date: loanForm.disbursement_date,
        original_principal: loanForm.original_principal,
        unpaid_principal: loanForm.unpaid_principal,
        interest_rate: loanForm.interest_rate,
        unpaid_interest: loanForm.unpaid_interest,
        total_interest_paid: loanForm.total_interest_paid,
        notes: loanForm.notes.trim() || null,
      };
      if (editLoan) {
        await apiFetch(`/loans/${editLoan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/loans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const fresh: Loan[] = await apiFetch("/loans");
      setLoans(fresh ?? []);
      setShowLoanModal(false);
      setEditLoan(null);
      setLoanForm(EMPTY_LOAN);
    } catch (err) {
      setLoanSaveError(err instanceof Error ? err.message : "Failed to save loan");
    }
  }

  // ---- Stocks ----

  function openAddStock() {
    setEditStock(null);
    setStockForm({ ticker: "", company_name: "", shares: "", buy_price: "", purchased_at: "", notes: "" });
    setStockSaveError(null);
    setShowStockModal(true);
  }

  function openEditStock(s: StockHolding) {
    setEditStock(s);
    const activeLots = s.lots.filter((l) => l.sold_price == null);
    const singleLot = activeLots.length === 1 ? activeLots[0] : null;
    setStockForm({
      ticker: s.ticker,
      company_name: s.company_name ?? "",
      shares: singleLot ? String(singleLot.shares) : "",
      buy_price: singleLot ? String(singleLot.buy_price) : "",
      purchased_at: singleLot?.purchased_at ?? "",
      notes: s.notes ?? "",
    });
    setStockSaveError(null);
    setShowStockModal(true);
  }

  async function saveStock(e: React.FormEvent) {
    e.preventDefault();
    setStockSaveError(null);
    try {
      if (editStock) {
        const holdingBody = {
          ticker: stockForm.ticker.trim().toUpperCase(),
          company_name: stockForm.company_name.trim() || null,
          notes: stockForm.notes.trim() || null,
        };
        let updated: StockHolding = await apiFetch(`/stocks/${editStock.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(holdingBody),
        });
        const activeLots = editStock.lots.filter((l) => l.sold_price == null);
        if (activeLots.length === 1 && (stockForm.shares || stockForm.buy_price)) {
          const lotBody: Record<string, unknown> = {};
          if (stockForm.shares) lotBody.shares = parseFloat(stockForm.shares);
          if (stockForm.buy_price) lotBody.buy_price = parseFloat(stockForm.buy_price);
          if (stockForm.purchased_at) lotBody.purchased_at = stockForm.purchased_at;
          updated = await apiFetch(`/stocks/lots/${activeLots[0].id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lotBody),
          });
        }
        setStocks((prev) => prev.map((s) => s.id === editStock.id ? updated : s));
      } else {
        const body = {
          ticker: stockForm.ticker.trim().toUpperCase(),
          company_name: stockForm.company_name.trim() || null,
          notes: stockForm.notes.trim() || null,
          shares: parseFloat(stockForm.shares),
          buy_price: parseFloat(stockForm.buy_price),
          purchased_at: stockForm.purchased_at || null,
        };
        const created: StockHolding = await apiFetch("/stocks", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setStocks((prev) => [...prev, created].sort((a, b) => a.ticker.localeCompare(b.ticker)));
      }
      setShowStockModal(false);
      setEditStock(null);
      setStockForm({ ticker: "", company_name: "", shares: "", buy_price: "", purchased_at: "", notes: "" });
    } catch (err) {
      setStockSaveError(err instanceof Error ? err.message : "Failed to save stock");
    }
  }

  async function refreshStockPrice(id: number) {
    setRefreshingIds((prev) => new Set(prev).add(id));
    try {
      const updated: StockHolding = await apiFetch(`/stocks/${id}/refresh-price`, { method: "POST" });
      setStocks((prev) => prev.map((s) => s.id === id ? updated : s));
    } finally {
      setRefreshingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function refreshAllPrices() {
    if (stocks.length === 0) return;
    setRefreshingAll(true);
    try {
      const updated = await Promise.allSettled(
        stocks.map((s) => apiFetch(`/stocks/${s.id}/refresh-price`, { method: "POST" }) as Promise<StockHolding>)
      );
      setStocks((prev) =>
        prev.map((s, i) => {
          const result = updated[i];
          return result.status === "fulfilled" ? result.value : s;
        })
      );
    } finally {
      setRefreshingAll(false);
    }
  }

  function toggleStockExpand(id: number) {
    setExpandedStockIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); if (addingLotForId === id) setAddingLotForId(null); }
      else next.add(id);
      return next;
    });
  }

  async function addLot(holdingId: number) {
    setLotSaveError(null);
    try {
      const body = {
        shares: parseFloat(lotForm.shares),
        buy_price: parseFloat(lotForm.buy_price),
        purchased_at: lotForm.purchased_at || null,
      };
      const updated: StockHolding = await apiFetch(`/stocks/${holdingId}/lots`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setStocks((prev) => prev.map((s) => s.id === holdingId ? updated : s));
      setAddingLotForId(null);
      setLotForm({ shares: "", buy_price: "", purchased_at: "" });
    } catch (err) {
      setLotSaveError(err instanceof Error ? err.message : "Failed to add lot");
    }
  }

  async function deleteLot(lot: StockLot) {
    const updated: StockHolding = await apiFetch(`/stocks/lots/${lot.id}`, { method: "DELETE" });
    setStocks((prev) => prev.map((s) => s.id === lot.stock_holding_id ? updated : s));
  }

  async function unsellLot(lot: StockLot) {
    const updated: StockHolding = await apiFetch(`/stocks/lots/${lot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sold_price: null, sold_at: null }),
    });
    setStocks((prev) => prev.map((s) => s.id === lot.stock_holding_id ? updated : s));
  }

  async function sellSelectedLots() {
    if (selectedLotIds.size === 0 || !sellForm.sold_price) return;
    setSellSaveError(null);
    try {
      const updatedHoldings: StockHolding[] = await apiFetch("/stocks/lots/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_ids: Array.from(selectedLotIds),
          sold_price: parseFloat(sellForm.sold_price),
          sold_at: sellForm.sold_at || null,
        }),
      });
      setStocks((prev) => {
        const map = new Map(updatedHoldings.map((h) => [h.id, h]));
        return prev.map((s) => map.get(s.id) ?? s);
      });
      setSelectedLotIds(new Set());
      setShowSellModal(false);
      setSellForm({ sold_price: "", sold_at: "" });
    } catch (err) {
      setSellSaveError(err instanceof Error ? err.message : "Failed to record sale");
    }
  }

  async function saveDividendModal() {
    if (!dividendModalHoldingId) return;
    setDividendModalError(null);
    try {
      const body = {
        paid_at: dividendModalForm.paid_at,
        dividend_per_share: parseFloat(dividendModalForm.dividend_per_share),
        shares_held: parseFloat(dividendModalForm.shares_held),
        reinvested: dividendModalForm.reinvested,
        notes: dividendModalForm.notes.trim() || null,
      };
      const updated: StockHolding = editingDividend
        ? await apiFetch(`/stocks/dividends/${editingDividend.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await apiFetch(`/stocks/${dividendModalHoldingId}/dividends`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setStocks((prev) => prev.map((s) => s.id === dividendModalHoldingId ? updated : s));
      setShowDividendModal(false);
      setEditingDividend(null);
      setDividendModalForm({ paid_at: "", dividend_per_share: "", shares_held: "", reinvested: false, notes: "" });
    } catch (err) {
      setDividendModalError(err instanceof Error ? err.message : "Failed to save dividend");
    }
  }

  async function deleteDividend(dividend: StockDividend) {
    const updated: StockHolding = await apiFetch(`/stocks/dividends/${dividend.id}`, { method: "DELETE" });
    setStocks((prev) => prev.map((s) => s.id === dividend.stock_holding_id ? updated : s));
  }

  // ---- Credit Card Reminders ----

  // ---- Misc ----

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "credit_card") await deleteCreditCard(deleteTarget.id);
    else if (deleteTarget.type === "expense") await deleteExpense(deleteTarget.id);
    else if (deleteTarget.type === "stock") {
      await apiFetch(`/stocks/${deleteTarget.id}`, { method: "DELETE" });
      setStocks((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    } else if (deleteTarget.type === "loan") {
      await apiFetch(`/loans/${deleteTarget.id}`, { method: "DELETE" });
      const fresh: Loan[] = await apiFetch("/loans");
      setLoans(fresh ?? []);
    } else if (deleteTarget.type === "bank") {
      await deleteBankAccount(deleteTarget.id);
    } else {
      await apiFetch(`/money-transfers/${deleteTarget.id}`, { method: "DELETE" });
      setMoneyTransfers((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setAllTransfers((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  }

  async function saveScanResults(rows: ScannedRow[], creditCardId: string) {
    const created = await Promise.all(
      rows.map((row) =>
        apiFetch("/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            amount: parseFloat(row.amount),
            date: row.date,
            category_id: row.category_id ? parseInt(row.category_id) : null,
            credit_card_id: creditCardId ? parseInt(creditCardId) : null,
            notes: row.notes.trim() || null,
          }),
        })
      )
    );
    const inMonth = created.filter((ex: Expense) => ex.date.startsWith(selectedMonth));
    setAllExpenses((prev) => [...created, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
    if (inMonth.length) {
      setExpenses((prev) => [...inMonth, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
    }
  }

  // All-time per-person split ledger
  type CatPersonData = { categoryId: number | null; categoryName: string; person: Person };
  const catPersonMap = new Map<string, CatPersonData>();
  const catInsertOrder: (number | null)[] = [];

  const catGroupMap2 = new Map<number | null, CatPersonData[]>();
  for (const catId of catInsertOrder) {
    if (!catGroupMap2.has(catId)) catGroupMap2.set(catId, []);
  }
  for (const data of catPersonMap.values()) {
    catGroupMap2.get(data.categoryId)!.push(data);
  }

  const categoryBalances = catInsertOrder
    .map((catId) => {
      const entries = catGroupMap2.get(catId) ?? [];
      return {
        categoryId: catId,
        categoryName: entries[0]?.categoryName ?? "Uncategorized",
        people: entries
          .map((entry) => {
            const totalOwed = 0;
            // Only deduct transfers tagged with the same category
            const payments = allTransfers.filter(
              (t) =>
                t.person === entry.person.name &&
                t.direction === "received" &&
                t.category_id === catId
            );
            const totalPaid = payments.reduce((s, t) => s + Number(t.amount), 0);
            return { ...entry, totalOwed, totalPaid, outstanding: totalOwed - totalPaid, payments };
          })
          .filter((e) => e.totalOwed > 0),
      };
    })
    .filter((g) => g.people.length > 0);

  async function recordPayment(person: Person, categoryId: number | null) {
    const amount = parseFloat(recordPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    const body = {
      name: null,
      direction: "received",
      person: person.name,
      platform: null,
      bank_id: null,
      category_id: categoryId,
      amount,
      date: recordPaymentDate,
      notes: recordPaymentNotes.trim() || null,
    };
    const created: MoneyTransfer = await apiFetch("/money-transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setAllTransfers((prev) => [created, ...prev]);
    if (created.date.startsWith(selectedMonth)) {
      setMoneyTransfers((prev) => [created, ...prev]);
    }
    setRecordPaymentId(null);
    setRecordPaymentAmount("");
    setRecordPaymentDate(toLocalDate(new Date()));
    setRecordPaymentNotes("");
  }

  const trendYear = new Date().getFullYear();
  const trendCurrentCalMonth = new Date().getMonth() + 1;
  const showHalfToggle = trendCurrentCalMonth > 6;
  const trendStart = trendHalf === "H1" ? 1 : 7;
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const m = trendStart + i;
    return `${trendYear}-${String(m).padStart(2, "0")}`;
  });
  const trendData = trendMonths.map((m) => ({
    month: m,
    label: new Date(m + "-02").toLocaleString("default", { month: "short" }),
    total: allExpenses.filter((e) => e.date.startsWith(m) && Number(e.amount) > 0).reduce((s, e) => s + Number(e.amount), 0),
  }));
  const trendMax = Math.max(...trendData.map((d) => d.total), 1);

  // Summary card and overview breakdown computations
  const summaryGrossSpend = expenses.reduce((s, e) => Number(e.amount) > 0 ? s + Number(e.amount) : s, 0);
  const summaryRefunds = expenses.reduce((s, e) => Number(e.amount) < 0 ? s + Math.abs(Number(e.amount)) : s, 0);
  const summaryNetSpend = summaryGrossSpend - summaryRefunds;
  const summaryPositiveCount = expenses.filter((e) => Number(e.amount) > 0).length;
  const summaryRefundCount = expenses.filter((e) => Number(e.amount) < 0).length;
  // Last day of the selected month as a YYYY-MM-DD string for balance cutoff
  const selectedMonthEnd = (() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
  })();

  // Bank balance: starting_balance + all inflows/outflows from asOf through end of selected month
  function bankCurrentBalance(bank: Bank): number {
    if (bank.starting_balance == null) return 0;
    const asOf = bank.starting_balance_as_of ?? "1900-01-01";
    const base = Number(bank.starting_balance);
    const inflow = allTransfers.filter(t => t.to_bank_id === bank.id && t.date >= asOf && t.date <= selectedMonthEnd).reduce((s, t) => s + Number(t.amount), 0);
    const outflow = allTransfers.filter(t => t.from_bank_id === bank.id && t.date >= asOf && t.date <= selectedMonthEnd).reduce((s, t) => s + Number(t.amount), 0);
    return base + inflow - outflow;
  }
  function bankTotalIn(bank: Bank): number {
    const asOf = bank.starting_balance_as_of ?? "1900-01-01";
    return allTransfers.filter(t => t.to_bank_id === bank.id && t.date >= asOf && t.date <= selectedMonthEnd).reduce((s, t) => s + Number(t.amount), 0);
  }
  function bankTotalOut(bank: Bank): number {
    const asOf = bank.starting_balance_as_of ?? "1900-01-01";
    return allTransfers.filter(t => t.from_bank_id === bank.id && t.date >= asOf && t.date <= selectedMonthEnd).reduce((s, t) => s + Number(t.amount), 0);
  }
  const checkingBanks = banks.filter(b => b.account_type === "checking");
  const savingsBanks = banks.filter(b => b.account_type === "savings");

  function bankDisplayName(id: number): string {
    const bank = banks.find(b => b.id === id);
    if (!bank) return "?";
    const hasDuplicate = banks.some(b => b.id !== bank.id && b.name === bank.name);
    if (hasDuplicate && bank.account_type) return `${bank.name} (${bank.account_type})`;
    return bank.name;
  }

  const isCashTransfer = (t: MoneyTransfer) => t.platform === "Cash";

  // Transfer tab stats
  const statCcPaidThisMonth = moneyTransfers.filter(t => t.credit_card_id != null).reduce((s, t) => s + Number(t.amount), 0);
  const overviewCcByCard: { id: number; name: string; total: number }[] = (() => {
    const map = new Map<number, number>();
    for (const t of moneyTransfers) {
      if (t.credit_card_id != null) map.set(t.credit_card_id, (map.get(t.credit_card_id) ?? 0) + Number(t.amount));
    }
    return Array.from(map.entries()).map(([id, total]) => {
      const card = creditCards.find(c => c.id === id);
      return { id, name: card ? (card.name + (card.last_four ? ` ····${card.last_four}` : "")) : "Unknown", total };
    }).sort((a, b) => b.total - a.total);
  })();
  const statMoneyIn = moneyTransfers.filter(t => t.direction === "received" && !isInternalTransfer(t)).reduce((s, t) => s + Number(t.amount), 0);
  const statMoneyOut = moneyTransfers.filter(t => t.direction === "sent" && !isInternalTransfer(t) && t.credit_card_id == null).reduce((s, t) => s + Number(t.amount), 0);

  const sentTransfers = moneyTransfers.filter((t) => t.direction === "sent" && !isInternalTransfer(t));
  const receivedTransfers = moneyTransfers.filter((t) => t.direction === "received" && !isInternalTransfer(t));
  const internalTransfers = moneyTransfers.filter(isInternalTransfer);
  const summarySent = sentTransfers.reduce((s, t) => s + Number(t.amount), 0);
  const summaryReceived = receivedTransfers.reduce((s, t) => s + Number(t.amount), 0);
  const summaryInternal = internalTransfers.reduce((s, t) => s + Number(t.amount), 0);
  const summarySentCount = sentTransfers.length;
  const summaryReceivedCount = receivedTransfers.length;
  const summaryGrandTotal = summaryNetSpend + (summarySent - summaryReceived);
  const transferNet = summaryReceived - summarySent;

  const TOP_N = 5;
  const overviewCatTotals = new Map<number | null, number>();
  for (const e of expenses) {
    const amt = Number(e.amount);
    if (amt !== 0) overviewCatTotals.set(e.category_id, (overviewCatTotals.get(e.category_id) ?? 0) + amt);
  }
  for (const t of moneyTransfers) {
    if (t.category_id != null) {
      const amt = t.direction === "sent" ? Number(t.amount) : -Number(t.amount);
      overviewCatTotals.set(t.category_id, (overviewCatTotals.get(t.category_id) ?? 0) + amt);
    }
  }
  const overviewCatGross = Array.from(overviewCatTotals.values()).filter((v) => v > 0).reduce((s, v) => s + v, 0);
  const overviewCatNameTotals = new Map<string, number>();
  for (const [id, total] of overviewCatTotals.entries()) {
    const name = id != null ? (expenseCategories.find((c) => c.id === id)?.name ?? "Unknown") : "Uncategorized";
    overviewCatNameTotals.set(name, (overviewCatNameTotals.get(name) ?? 0) + total);
  }
  const overviewCatBreakdown = Array.from(overviewCatNameTotals.entries())
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, total], i) => ({
      name,
      total,
      pct: overviewCatGross > 0 ? (total / overviewCatGross) * 100 : 0,
      color: BAR_COLORS[i % BAR_COLORS.length],
    }));
  const overviewCardTotals = new Map<number | null, number>();
  for (const e of expenses) {
    const amt = Number(e.amount);
    if (amt > 0) overviewCardTotals.set(e.credit_card_id, (overviewCardTotals.get(e.credit_card_id) ?? 0) + amt);
  }
  const overviewCardGross = Array.from(overviewCardTotals.values()).reduce((s, v) => s + v, 0);
  const overviewCardNameData = new Map<string, { total: number; rawColor: string | null; ids: (number | null)[] }>();
  for (const [id, total] of overviewCardTotals.entries()) {
    const card = creditCards.find((c) => c.id === id);
    const name = card ? `${card.name}${card.last_four ? ` ····${card.last_four}` : ""}` : "No card";
    const existing = overviewCardNameData.get(name);
    if (existing) {
      existing.total += total;
      existing.ids.push(id);
    } else {
      overviewCardNameData.set(name, { total, rawColor: card?.color ?? null, ids: [id] });
    }
  }
  const overviewCardBreakdown = Array.from(overviewCardNameData.entries())
    .map(([name, { total, rawColor, ids }], i) => ({
      name,
      total,
      ids,
      pct: overviewCardGross > 0 ? (total / overviewCardGross) * 100 : 0,
      color: resolveCardColor(rawColor, i),
    }))
    .sort((a, b) => b.total - a.total);

  const activeStockHoldings = stocks.filter((s) => Number(s.shares) > 0);
  const portfolioTotalValue = activeStockHoldings.reduce((sum, s) => sum + Number(s.shares) * Number(s.current_price), 0);
  const portfolioTotalCost = activeStockHoldings.reduce((sum, s) => sum + Number(s.shares) * Number(s.buy_price), 0);
  const portfolioUnrealized = portfolioTotalValue - portfolioTotalCost;
  const portfolioRealized = stocks.reduce((sum, s) => sum + Number(s.realized_gain), 0);
  const portfolioTotalDividends = stocks.reduce((sum, s) => sum + Number(s.total_dividends), 0);
  const portfolioDividendsCurrentYear = new Date().getFullYear();
  const portfolioDividendsThisYear = stocks.flatMap((s) => s.dividends)
    .filter((d) => new Date(d.paid_at).getFullYear() === portfolioDividendsCurrentYear)
    .reduce((sum, d) => sum + Number(d.total_received), 0);
  const portfolioDividendsBeforeThisYear = portfolioTotalDividends - portfolioDividendsThisYear;
  const portfolioAllocationData = activeStockHoldings.map((s) => ({
    name: s.ticker,
    value: +(Number(s.shares) * Number(s.current_price)).toFixed(2),
  }));
  const _gainValues = activeStockHoldings.map((s) => +(Number(s.shares) * Number(s.current_price) - Number(s.shares) * Number(s.buy_price)).toFixed(2));
  const totalPositiveGain = _gainValues.filter((g) => g > 0).reduce((s, g) => s + g, 0);
  const totalAbsLoss = _gainValues.filter((g) => g < 0).reduce((s, g) => s + Math.abs(g), 0);
  const portfolioGainLossData = activeStockHoldings
    .map((s) => {
      const gain = +(Number(s.shares) * Number(s.current_price) - Number(s.shares) * Number(s.buy_price)).toFixed(2);
      const cost = Number(s.shares) * Number(s.buy_price);
      const returnPct = +(cost > 0 ? (gain / cost) * 100 : 0).toFixed(1);
      const base = gain >= 0 ? totalPositiveGain : totalAbsLoss;
      const sharePct = +(base > 0 ? (Math.abs(gain) / base) * 100 : 0).toFixed(0);
      return { name: s.ticker, gain, returnPct, sharePct };
    })
    .sort((a, b) => b.gain - a.gain);
  const portfolioCostVsValueData = activeStockHoldings.map((s) => ({
    name: s.ticker,
    cost: +(Number(s.shares) * Number(s.buy_price)).toFixed(2),
    value: +(Number(s.shares) * Number(s.current_price)).toFixed(2),
  }));
  const dividendByMonth = new Map<string, number>();
  for (const holding of stocks) {
    for (const div of holding.dividends) {
      const month = div.paid_at.substring(0, 7);
      dividendByMonth.set(month, (dividendByMonth.get(month) ?? 0) + Number(div.total_received));
    }
  }
  const portfolioDividendTimeline = Array.from(dividendByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({
      label: new Date(month + "-15").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      total: +total.toFixed(2),
    }));
  const portfolioSlideCount = activeStockHoldings.length === 0 ? 0 : portfolioDividendTimeline.length > 0 ? 4 : 3;

  const monthCatIds = new Set(expenses.map((e) => e.category_id));
  const pillCats = [
    ...(monthCatIds.has(null) ? [{ id: null as number | null, name: "Uncategorized" }] : []),
    ...expenseCategories.filter((c) => monthCatIds.has(c.id)),
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto min-h-[calc(100vh-2rem)] relative pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-white tracking-tight">Finances</h1>
        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* Month selector */}
          <div className="flex items-center gap-1 border border-white/[0.1] rounded-lg px-1 py-1">
            <button
              onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              disabled={selectedMonth <= "2026-01"}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-white/[0.07] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-medium text-slate-300 min-w-[130px] text-center">
              {formatMonthLabel(selectedMonth)}
            </span>
            <button
              onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-white/[0.07] transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          {/* Search trigger */}
          <button
            onClick={() => document.dispatchEvent(new CustomEvent("open-global-search"))}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/[0.1] text-slate-500 hover:bg-white/[0.07] hover:text-slate-300 transition-colors"
            aria-label="Search"
          >
            <Search size={16} />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 bg-[#1e2245]/[0.07] p-1 rounded-xl w-fit">
        {(["overview", "expenses", "transfers", "loans", "stocks"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all duration-150 ${
              activeTab === tab
                ? "bg-[#1e2245] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {/* Overview Row 1: Total | Transactions | Transfers | CC Paid */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Wallet size={13} className="text-indigo-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Total</p>
            </div>
            <p className="text-2xl font-bold text-white leading-none">{formatAmount(summaryGrandTotal)}</p>
            <div className="text-[11px] text-slate-400 mt-1.5 flex flex-col gap-0.5">
              <span>transactions · {formatAmount(summaryNetSpend)}</span>
              {moneyTransfers.length > 0 && (
                <span>transfers · {summarySent >= summaryReceived ? "" : "−"}{formatAmount(Math.abs(summarySent - summaryReceived))}</span>
              )}
            </div>
          </div>

          <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Receipt size={13} className="text-indigo-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Transactions</p>
            </div>
            <p className="text-2xl font-bold text-white leading-none">{formatAmount(summaryNetSpend)}</p>
            <div className="text-[11px] text-slate-400 mt-1.5 flex flex-col gap-0.5">
              <span>{summaryPositiveCount} expense{summaryPositiveCount !== 1 ? "s" : ""} · {formatAmount(summaryGrossSpend)}</span>
              {summaryRefundCount > 0 && <span>{summaryRefundCount} refund{summaryRefundCount !== 1 ? "s" : ""} · −{formatAmount(summaryRefunds)}</span>}
            </div>
          </div>

          <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Send size={13} className="text-violet-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Transfers</p>
            </div>
            <p className={`text-2xl font-bold leading-none ${transferNet > 0 ? "text-emerald-600" : transferNet < 0 ? "text-rose-600" : "text-white"}`}>
              {transferNet > 0 ? "+" : transferNet < 0 ? "−" : ""}{formatAmount(Math.abs(transferNet))}
            </p>
            <div className="text-[11px] text-slate-400 mt-1.5 flex flex-col gap-0.5">
              {summarySentCount > 0 && <span><span className="text-rose-500">{summarySentCount} out</span> · −{formatAmount(summarySent)}</span>}
              {summaryReceivedCount > 0 && <span><span className="text-emerald-600">{summaryReceivedCount} in</span> · +{formatAmount(summaryReceived)}</span>}
              {internalTransfers.length > 0 && <span><span className="text-slate-500">{internalTransfers.length} internal</span> · {formatAmount(summaryInternal)}</span>}
            </div>
          </div>

          <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <CreditCardIcon size={13} className="text-blue-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">CC Paid</p>
            </div>
            <p className="text-2xl font-bold text-blue-600 leading-none">{formatAmount(statCcPaidThisMonth)}</p>
            <div className="text-[11px] text-slate-400 mt-1.5 flex flex-col gap-0.5">
              {overviewCcByCard.length === 0
                ? <span>no payments this month</span>
                : overviewCcByCard.map(({ id, name, total }) => (
                  <span key={id}>{name} · {formatAmount(total)}</span>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Overview Row 2: Loans | Portfolio | Unrealized+Realized | Dividends */}
      {activeTab === "overview" && (stocks.length > 0 || loans.length > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <GraduationCap size={13} className="text-indigo-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Loans</p>
            </div>
            <p className="text-2xl font-bold text-white leading-none">
              {formatAmount(loans.reduce((s, l) => s + Number(l.unpaid_principal) + Number(l.unpaid_interest), 0))}
            </p>
            <div className="text-[11px] text-slate-400 mt-1.5 flex flex-col gap-0.5">
              <span className="text-amber-500">{formatAmount(loans.reduce((s, l) => s + Number(l.unpaid_interest), 0))} interest</span>
            </div>
          </div>

          <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <BarChart2 size={13} className="text-indigo-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Portfolio</p>
            </div>
            <p className="text-2xl font-bold text-white leading-none">{formatAmount(portfolioTotalValue)}</p>
            <p className="text-[11px] text-slate-400 mt-1.5">{activeStockHoldings.length} holding{activeStockHoldings.length !== 1 ? "s" : ""}</p>
          </div>

          <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={13} className="text-indigo-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Unrealized</p>
            </div>
            <p className={`text-2xl font-bold leading-none ${portfolioUnrealized >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
              {portfolioUnrealized >= 0 ? "+" : ""}{formatAmount(portfolioUnrealized)}
            </p>
            {portfolioTotalCost > 0 && (
              <p className={`text-[11px] mt-1 ${portfolioUnrealized >= 0 ? "text-emerald-500" : "text-rose-400"}`}>
                {portfolioUnrealized >= 0 ? "+" : ""}{((portfolioUnrealized / portfolioTotalCost) * 100).toFixed(1)}% return
              </p>
            )}
            <p className={`text-[11px] mt-0.5 ${portfolioRealized >= 0 ? "text-emerald-500" : "text-rose-400"}`}>
              realized · {portfolioRealized >= 0 ? "+" : ""}{formatAmount(portfolioRealized)}
            </p>
          </div>

          <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign size={13} className="text-indigo-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Dividends</p>
            </div>
            <p className="text-2xl font-bold text-indigo-600 leading-none">{formatAmount(portfolioDividendsThisYear)}</p>
            <p className="text-[11px] text-slate-300 mt-1">{formatAmount(portfolioTotalDividends)} total</p>
            {portfolioDividendsBeforeThisYear > 0 && (
              <p className="text-[11px] text-slate-300">{formatAmount(portfolioDividendsBeforeThisYear)} before {portfolioDividendsCurrentYear}</p>
            )}
          </div>
        </div>
      )}

      {/* Spend Trend Chart */}
      {activeTab === "overview" && (
        <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 pt-4 pb-3 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">6-Month Spend Trend</p>
            {showHalfToggle && (
              <div className="flex gap-0.5 bg-[#1e2245]/[0.07] rounded-md p-0.5">
                <button
                  onClick={() => setTrendHalf("H1")}
                  className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-all ${trendHalf === "H1" ? "bg-[#1e2245] text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                >
                  Jan–Jun
                </button>
                <button
                  onClick={() => setTrendHalf("H2")}
                  className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-all ${trendHalf === "H2" ? "bg-[#1e2245] text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                >
                  Jul–Dec
                </button>
              </div>
            )}
          </div>
          <div className="flex items-end gap-2" style={{ height: "72px" }}>
            {trendData.map(({ month, label, total }) => (
              <div key={month} className="flex-1 flex flex-col items-center justify-end gap-1">
                {total > 0 && (
                  <span className="text-[9px] text-slate-400 font-medium leading-none">
                    ${Math.round(total).toLocaleString()}
                  </span>
                )}
                <div
                  className={`w-full rounded-sm transition-all ${month === selectedMonth ? "bg-indigo-500" : "bg-indigo-500/20"}`}
                  style={{ height: `${Math.max((total / trendMax) * 44, total > 0 ? 3 : 0)}px` }}
                />
                <span className={`text-[10px] font-semibold leading-none ${month === selectedMonth ? "text-indigo-600" : "text-slate-400"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}



      {activeTab === "overview" && <>

      {/* Spend by Category + Credit Card */}
      {(overviewCatBreakdown.length > 0 || overviewCardBreakdown.length > 0) && (
        <div className="bg-[#1e2245] border border-white/[0.1] rounded-xl p-5 shadow-sm mb-6">
          {overviewCatBreakdown.length > 0 && (
            <div className={overviewCardBreakdown.length > 0 ? "mb-5" : ""}>
              <div className="flex items-center gap-2 mb-4">
                <Tag size={14} className="text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spend by Category</h3>
              </div>
              <div className="flex flex-col gap-2">
                {(showAllCats ? overviewCatBreakdown : overviewCatBreakdown.slice(0, TOP_N)).map((cat) => {
                  const catItems = [
                    ...expenses
                      .filter((e) => {
                        if (Number(e.amount) === 0) return false;
                        const name = e.category_id != null
                          ? (expenseCategories.find((c) => c.id === e.category_id)?.name ?? "Unknown")
                          : "Uncategorized";
                        return name === cat.name;
                      })
                      .map((e) => ({ id: e.id, name: e.name, date: e.date, amount: Number(e.amount) })),
                    ...moneyTransfers
                      .filter((t) => t.category_id != null && (expenseCategories.find((c) => c.id === t.category_id)?.name ?? "Unknown") === cat.name)
                      .map((t) => ({ id: -t.id, name: t.name || (t.person ? `Transfer · ${t.person}` : "Transfer"), date: t.date, amount: t.direction === "sent" ? Number(t.amount) : -Number(t.amount) })),
                  ];
                  const isExpanded = expandedOverviewCats.has(cat.name);
                  const merchantMap = new Map<string, { displayName: string; items: typeof catItems; total: number }>();
                  for (const e of catItems) {
                    const key = e.name.toLowerCase().trim();
                    if (!merchantMap.has(key)) merchantMap.set(key, { displayName: e.name, items: [], total: 0 });
                    const g = merchantMap.get(key)!;
                    g.items.push(e);
                    g.total += e.amount;
                  }
                  const merchantGroups = [...merchantMap.values()].sort((a, b) => {
                    const aLatest = a.items.reduce((max, i) => i.date > max ? i.date : max, "");
                    const bLatest = b.items.reduce((max, i) => i.date > max ? i.date : max, "");
                    return bLatest.localeCompare(aLatest);
                  });
                  return (
                    <div key={cat.name}>
                      <div
                        className="flex items-center gap-3 cursor-pointer rounded-lg -mx-2 px-2 py-1 hover:bg-white/[0.05] transition-colors"
                        onClick={() => setExpandedOverviewCats((prev) => { const n = new Set(prev); n.has(cat.name) ? n.delete(cat.name) : n.add(cat.name); return n; })}
                      >
                        <span className="text-sm font-medium text-slate-300 w-32 shrink-0 truncate">{cat.name}</span>
                        <div className="flex-1 h-2 bg-[#1e2245]/[0.07] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${cat.color}`} style={{ width: `${cat.pct}%` }} />
                        </div>
                        <div className="flex items-center gap-2 shrink-0 w-28 justify-end">
                          <span className="text-xs text-slate-400 font-medium">{cat.pct.toFixed(0)}%</span>
                          <span className="text-sm font-semibold text-slate-200">{formatAmount(cat.total)}</span>
                        </div>
                        <ChevronDown size={12} className={`shrink-0 text-slate-300 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                      </div>
                      {isExpanded && merchantGroups.length > 0 && (
                        <div className="mt-1.5 mb-1 flex flex-col gap-0.5">
                          {merchantGroups.map((group) => {
                            const mKey = `${cat.name}:${group.displayName.toLowerCase()}`;
                            const isGroupExpanded = expandedOverviewCatMerchants.has(mKey);
                            if (group.items.length === 1) {
                              const e = group.items[0];
                              return (
                                <div key={mKey} className="grid grid-cols-[1fr_4.5rem_5.5rem] items-center text-xs bg-[#14162e] rounded-lg px-3 py-2">
                                  <span className="text-slate-300 font-medium truncate pr-2">{e.name}</span>
                                  <span className="text-slate-400 text-right">{formatDate(e.date)}</span>
                                  <span className={`font-semibold text-right ${e.amount < 0 ? "text-emerald-600" : "text-rose-500"}`}>{e.amount < 0 ? "+" : "−"}{formatAmount(Math.abs(e.amount))}</span>
                                </div>
                              );
                            }
                            return (
                              <div key={mKey}>
                                <button
                                  onClick={() => setExpandedOverviewCatMerchants((prev) => { const n = new Set(prev); n.has(mKey) ? n.delete(mKey) : n.add(mKey); return n; })}
                                  className="w-full grid grid-cols-[1fr_4.5rem_5.5rem] items-center text-xs bg-[#14162e] hover:bg-white/[0.07] rounded-lg px-3 py-2 transition-colors"
                                >
                                  <span className="font-medium text-slate-300 text-left truncate pr-2">
                                    {group.displayName}
                                    <span className="text-slate-400 ml-1.5">×{group.items.length}</span>
                                  </span>
                                  <span />
                                  <span className={`font-semibold text-right ${group.total < 0 ? "text-emerald-600" : "text-rose-500"}`}>{group.total < 0 ? "+" : "−"}{formatAmount(Math.abs(group.total))}</span>
                                </button>
                                {isGroupExpanded && (
                                  <div className="flex flex-col gap-0.5 mt-0.5">
                                    {group.items.slice().sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                                      <div key={e.id} className="grid grid-cols-[1fr_4.5rem_5.5rem] items-center text-xs bg-[#1e2245] border border-white/[0.07] rounded-md px-3 py-1.5">
                                        <span />
                                        <span className="text-slate-400 text-right">{formatDate(e.date)}</span>
                                        <span className={`font-medium text-right ${e.amount < 0 ? "text-emerald-600" : "text-rose-500"}`}>{e.amount < 0 ? "+" : "−"}{formatAmount(Math.abs(e.amount))}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {overviewCatBreakdown.length > TOP_N && (
                <button
                  onClick={() => setShowAllCats((v) => !v)}
                  className="mt-4 text-xs text-slate-400 hover:text-slate-300 font-medium flex items-center gap-1 transition-colors"
                >
                  <ChevronDown size={13} className={`transition-transform ${showAllCats ? "rotate-180" : ""}`} />
                  {showAllCats ? "Show less" : `${overviewCatBreakdown.length - TOP_N} more`}
                </button>
              )}
            </div>
          )}

          {overviewCatBreakdown.length > 0 && overviewCardBreakdown.length > 0 && (
            <div className="border-t border-white/[0.07] my-5" />
          )}

          {overviewCardBreakdown.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CreditCardIcon size={14} className="text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spend by Credit Card</h3>
              </div>
              <div className="flex flex-col gap-2">
                {(showAllCards ? overviewCardBreakdown : overviewCardBreakdown.slice(0, TOP_N)).map((card) => {
                  const cardItems = expenses
                    .filter((e) => card.ids.includes(e.credit_card_id) && Number(e.amount) > 0)
                    .map((e) => ({ id: e.id, name: e.name, date: e.date, amount: Number(e.amount) }));
                  const isExpanded = expandedOverviewCards.has(card.name);
                  const merchantMap = new Map<string, { displayName: string; items: typeof cardItems; total: number }>();
                  for (const e of cardItems) {
                    const key = e.name.toLowerCase().trim();
                    if (!merchantMap.has(key)) merchantMap.set(key, { displayName: e.name, items: [], total: 0 });
                    const g = merchantMap.get(key)!;
                    g.items.push(e);
                    g.total += e.amount;
                  }
                  const merchantGroups = [...merchantMap.values()].sort((a, b) => {
                    const aLatest = a.items.reduce((max, i) => i.date > max ? i.date : max, "");
                    const bLatest = b.items.reduce((max, i) => i.date > max ? i.date : max, "");
                    return bLatest.localeCompare(aLatest);
                  });
                  return (
                    <div key={card.name}>
                      <div
                        className="flex items-center gap-3 cursor-pointer rounded-lg -mx-2 px-2 py-1 hover:bg-white/[0.05] transition-colors"
                        onClick={() => setExpandedOverviewCards((prev) => { const n = new Set(prev); n.has(card.name) ? n.delete(card.name) : n.add(card.name); return n; })}
                      >
                        <span className="text-sm font-medium text-slate-300 w-36 shrink-0 truncate">{card.name}</span>
                        <div className="flex-1 h-2 bg-[#1e2245]/[0.07] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${card.pct}%`, backgroundColor: card.color }} />
                        </div>
                        <div className="flex items-center gap-2 shrink-0 w-28 justify-end">
                          <span className="text-xs text-slate-400 font-medium">{card.pct.toFixed(0)}%</span>
                          <span className="text-sm font-semibold text-slate-200">{formatAmount(card.total)}</span>
                        </div>
                        <ChevronDown size={12} className={`shrink-0 text-slate-300 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                      </div>
                      {isExpanded && merchantGroups.length > 0 && (
                        <div className="mt-1.5 mb-1 flex flex-col gap-0.5">
                          {merchantGroups.map((group) => {
                            const mKey = `${card.name}:${group.displayName.toLowerCase()}`;
                            const isGroupExpanded = expandedOverviewCardMerchants.has(mKey);
                            if (group.items.length === 1) {
                              const e = group.items[0];
                              return (
                                <div key={mKey} className="grid grid-cols-[1fr_4.5rem_5.5rem] items-center text-xs bg-[#14162e] rounded-lg px-3 py-2">
                                  <span className="text-slate-300 font-medium truncate pr-2">{e.name}</span>
                                  <span className="text-slate-400 text-right">{formatDate(e.date)}</span>
                                  <span className="font-semibold text-right text-rose-500">−{formatAmount(e.amount)}</span>
                                </div>
                              );
                            }
                            return (
                              <div key={mKey}>
                                <button
                                  onClick={() => setExpandedOverviewCardMerchants((prev) => { const n = new Set(prev); n.has(mKey) ? n.delete(mKey) : n.add(mKey); return n; })}
                                  className="w-full grid grid-cols-[1fr_4.5rem_5.5rem] items-center text-xs bg-[#14162e] hover:bg-white/[0.07] rounded-lg px-3 py-2 transition-colors"
                                >
                                  <span className="font-medium text-slate-300 text-left truncate pr-2">
                                    {group.displayName}
                                    <span className="text-slate-400 ml-1.5">×{group.items.length}</span>
                                  </span>
                                  <span />
                                  <span className="font-semibold text-right text-rose-500">−{formatAmount(group.total)}</span>
                                </button>
                                {isGroupExpanded && (
                                  <div className="flex flex-col gap-0.5 mt-0.5">
                                    {group.items.slice().sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                                      <div key={e.id} className="grid grid-cols-[1fr_4.5rem_5.5rem] items-center text-xs bg-[#1e2245] border border-white/[0.07] rounded-md px-3 py-1.5">
                                        <span />
                                        <span className="text-slate-400 text-right">{formatDate(e.date)}</span>
                                        <span className="font-medium text-right text-rose-500">−{formatAmount(e.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {overviewCardBreakdown.length > TOP_N && (
                <button
                  onClick={() => setShowAllCards((v) => !v)}
                  className="mt-4 text-xs text-slate-400 hover:text-slate-300 font-medium flex items-center gap-1 transition-colors"
                >
                  <ChevronDown size={13} className={`transition-transform ${showAllCards ? "rotate-180" : ""}`} />
                  {showAllCards ? "Show less" : `${overviewCardBreakdown.length - TOP_N} more`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stock Portfolio Overview */}
      {stocks.length > 0 && (
        <div className="bg-[#1e2245] border border-white/[0.1] rounded-xl p-5 shadow-sm mb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Portfolio Overview</h3>
            </div>
            {portfolioSlideCount > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 mr-1">{portfolioSlide + 1} / {portfolioSlideCount}</span>
                <button
                  onClick={() => setPortfolioSlide((s) => (s - 1 + portfolioSlideCount) % portfolioSlideCount)}
                  className="p-1 rounded hover:bg-white/[0.07] text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPortfolioSlide((s) => (s + 1) % portfolioSlideCount)}
                  className="p-1 rounded hover:bg-white/[0.07] text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Slideshow */}
          {activeStockHoldings.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                {(["Allocation", "Unrealized Gain / Loss", "Cost Basis vs. Market Value", "Dividend Income Timeline"] as const)[portfolioSlide]}
              </p>

              {/* Slide 0: Allocation donut */}
              {portfolioSlide === 0 && (
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie
                      data={portfolioAllocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={150}
                      dataKey="value"
                      stroke="none"
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
                        if (percent < 0.05) return null;
                        const RADIAN = Math.PI / 180;
                        const r = innerRadius + (outerRadius - innerRadius) * 0.55;
                        const x = cx + r * Math.cos(-midAngle * RADIAN);
                        const y = cy + r * Math.sin(-midAngle * RADIAN);
                        return (
                          <g>
                            <text x={x} y={y - 7} fill="white" textAnchor="middle" fontSize={13} fontWeight={700}>{name}</text>
                            <text x={x} y={y + 9} fill="white" textAnchor="middle" fontSize={11}>{(percent * 100).toFixed(0)}%</text>
                          </g>
                        );
                      }}
                      labelLine={false}
                    >
                      {portfolioAllocationData.map((_, i) => (
                        <Cell key={i} fill={PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatAmount(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}

              {/* Slide 1: Unrealized Gain / Loss progress bars */}
              {portfolioSlide === 1 && (
                <div className="flex flex-col gap-2">
                  {portfolioGainLossData.map((d) => (
                    <div key={d.name} className="flex items-center gap-3 rounded-lg -mx-2 px-2 py-1">
                      <span className="text-sm font-medium text-slate-300 w-16 shrink-0 truncate">{d.name}</span>
                      <div className="flex-1 h-2 bg-[#1e2245]/[0.07] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${d.sharePct}%`, backgroundColor: d.gain >= 0 ? "#10b981" : "#f43f5e" }}
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-36 justify-end">
                        <span className={`text-xs font-medium ${d.gain >= 0 ? "text-emerald-500" : "text-rose-400"}`}>
                          {d.sharePct}%
                        </span>
                        <span className={`text-sm font-semibold ${d.gain >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                          {d.gain >= 0 ? "+" : ""}{formatAmount(d.gain)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Slide 2: Cost Basis vs. Market Value grouped bar */}
              {portfolioSlide === 2 && (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={portfolioCostVsValueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                      <Tooltip formatter={(v) => formatAmount(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                      <Bar dataKey="cost" name="Cost Basis" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="value" name="Market Value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-3 h-3 rounded-sm bg-slate-500" />
                      Cost Basis
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-3 h-3 rounded-sm bg-indigo-500" />
                      Market Value
                    </div>
                  </div>
                </>
              )}

              {/* Slide 3: Dividend Income Timeline */}
              {portfolioSlide === 3 && portfolioDividendTimeline.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={portfolioDividendTimeline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip formatter={(v) => [formatAmount(Number(v)), "Dividends"]} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Bar dataKey="total" name="Dividends" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </div>
      )}

      {/* Bitches Who Owe Me Section */}
      {categoryBalances.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4 border-b border-white/[0.1] pb-2">
            <button
              onClick={() => setOwedOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider hover:text-slate-300 transition-colors"
            >
              <Users size={16} className="text-rose-500" />
              Bitches Who Owe Me
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${owedOpen ? "" : "-rotate-90"}`} />
            </button>
          </div>

          {owedOpen && (
            <div className="space-y-4">
              {categoryBalances.map(({ categoryId, categoryName, people }) => (
                <div key={`cat-${categoryId}`} className="bg-[#1e2245] rounded-xl border border-white/[0.1] shadow-sm overflow-hidden">
                  {/* Category header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-[#14162e] border-b border-white/[0.1]">
                    <Tag size={12} className="text-violet-500 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{categoryName}</span>
                  </div>

                  <div className="divide-y divide-white/[0.07]">
                    {people.map(({ person, totalOwed, totalPaid, outstanding, payments }) => {
                      const personKey = `${categoryId}:${person.id}`;
                      const isExpanded = expandedOwedIds.has(personKey);
                      const isRecording = recordPaymentId === personKey;
                      const settled = outstanding <= 0.005;
                      return (
                        <div key={personKey}>
                          {/* Person row */}
                          <div className="flex items-center gap-3 px-4 py-3">
                            <button
                              onClick={() => setExpandedOwedIds((prev) => {
                                const n = new Set(prev);
                                n.has(personKey) ? n.delete(personKey) : n.add(personKey);
                                return n;
                              })}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                            >
                              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 text-xs font-bold shrink-0">
                                {person.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white">{person.name}</p>
                                <p className="text-xs text-slate-400">
                                  {formatAmount(totalOwed)}{totalPaid > 0 && <> − {formatAmount(totalPaid)} = <span className={settled ? "text-emerald-600" : "text-rose-500"}>{formatAmount(outstanding)}</span></>}
                                </p>
                              </div>
                              <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                            </button>
                            <div className="flex items-center gap-3 shrink-0">
                              {settled ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600">Settled</span>
                              ) : (
                                <span className="text-sm font-semibold text-rose-600">{formatAmount(outstanding)}</span>
                              )}
                              {!settled && (
                                <button
                                  onClick={() => {
                                    if (isRecording) {
                                      setRecordPaymentId(null);
                                    } else {
                                      setRecordPaymentId(personKey);
                                      setRecordPaymentAmount("");
                                      setRecordPaymentDate(toLocalDate(new Date()));
                                      setRecordPaymentNotes("");
                                    }
                                  }}
                                  className="text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-medium transition-colors"
                                >
                                  Record payment
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Inline payment form */}
                          {isRecording && (
                            <div className="px-4 pb-3 pt-1 bg-emerald-500/10/60 border-t border-emerald-100">
                              <p className="text-xs font-medium text-emerald-400 mb-2">Recording payment from {person.name}</p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  placeholder="Amount"
                                  value={recordPaymentAmount}
                                  onChange={(e) => setRecordPaymentAmount(e.target.value)}
                                  className="w-28 text-sm border border-white/[0.1] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-[#14162e] text-slate-200"
                                  autoFocus
                                />
                                <input
                                  type="date"
                                  value={recordPaymentDate}
                                  onChange={(e) => setRecordPaymentDate(e.target.value)}
                                  className="text-sm border border-white/[0.1] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-[#14162e] text-slate-200"
                                />
                                <input
                                  type="text"
                                  placeholder="Notes (optional)"
                                  value={recordPaymentNotes}
                                  onChange={(e) => setRecordPaymentNotes(e.target.value)}
                                  className="flex-1 text-sm border border-white/[0.1] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-[#14162e] text-slate-200"
                                />
                                <button
                                  onClick={() => recordPayment(person, categoryId)}
                                  disabled={!recordPaymentAmount || isNaN(parseFloat(recordPaymentAmount))}
                                  className="text-xs px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors disabled:opacity-40"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setRecordPaymentId(null)}
                                  className="text-slate-400 hover:text-slate-300"
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Expanded transaction list */}
                          {isExpanded && (() => {
                            const paymentsKey = `${personKey}:payments`;
                            const paymentsExpanded = expandedLedgerGroups.has(paymentsKey);
                            return (
                              <div className="bg-[#14162e]/60 border-t border-white/[0.07] divide-y divide-white/[0.07]">
                                {/* Category-matched payments received */}
                                {payments.length > 0 && (
                                  <div>
                                    <button
                                      onClick={() => setExpandedLedgerGroups((prev) => { const n = new Set(prev); n.has(paymentsKey) ? n.delete(paymentsKey) : n.add(paymentsKey); return n; })}
                                      className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-white/[0.07] text-left"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                        <span className="text-xs text-slate-300">Payments received</span>
                                        {payments.length > 1 && <span className="text-xs text-slate-400 shrink-0">{payments.length}×</span>}
                                        <ChevronDown size={11} className={`text-slate-400 shrink-0 transition-transform ${paymentsExpanded ? "" : "-rotate-90"}`} />
                                      </div>
                                      <span className="text-xs font-medium text-emerald-600 shrink-0 ml-3">−{formatAmount(totalPaid)}</span>
                                    </button>
                                    {paymentsExpanded && payments.map((t) => (
                                      <div key={t.id} className="flex items-center justify-between pl-10 pr-5 py-1.5 bg-[#1e2245]/[0.07]/50">
                                        <span className="text-xs text-slate-400">{formatDate(t.date)} · {t.notes ?? "Payment received"}</span>
                                        <span className="text-xs text-slate-400">−{formatAmount(Number(t.amount))}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      </>}

      {/* Utilities Section - hidden until placement is decided */}
      {false && <section className="mb-8">
        <div className="flex items-center justify-between mb-4 border-b border-white/[0.1] pb-2">
          <button onClick={() => setUtilitiesOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider hover:text-slate-300 transition-colors">
            <Zap size={16} className="text-amber-500" />
            Utilities
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${utilitiesOpen ? "" : "-rotate-90"}`} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={openAddBill} className="text-slate-400 hover:text-amber-600 hover:bg-amber-500/10 p-1 rounded-md transition-colors" aria-label="Add utility bill">
              <Plus size={20} />
            </button>
          </div>
        </div>

        {utilitiesOpen && (
          <div className="space-y-4">

            {/* Balance summary */}
            {utilityBalances.length > 0 && (
              <div className="bg-[#1e2245] rounded-xl border border-white/[0.1] shadow-sm overflow-hidden">
                <button onClick={() => setUtilBalancesOpen((o) => !o)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-left hover:bg-amber-500/20/60 transition-colors">
                  <Users size={12} className="text-amber-600 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Who Owes Me</span>
                  <ChevronDown size={11} className={`text-amber-500 ml-auto transition-transform ${utilBalancesOpen ? "" : "-rotate-90"}`} />
                </button>
                {utilBalancesOpen && (
                  <div className="divide-y divide-white/[0.07]">
                    {utilityBalances.map(({ name, owed, outstanding, bills, reimbursements }) => {
                      const settled = outstanding <= 0.005;
                      const isExpanded = expandedUtilPersons.has(name);
                      return (
                        <div key={name}>
                          <div className="flex items-center hover:bg-white/[0.05] transition-colors">
                            <button
                              onClick={() => setExpandedUtilPersons((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; })}
                              className="flex-1 flex items-center gap-3 px-4 py-3 text-left">
                              <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 text-xs font-bold shrink-0">
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white">{name}</p>
                                <p className="text-xs text-slate-400">{formatAmount(owed)}</p>
                              </div>
                              <ChevronDown size={13} className={`text-slate-400 transition-transform mr-2 ${isExpanded ? "" : "-rotate-90"}`} />
                            </button>
                            <button
                              onClick={() => togglePersonPaid(name, settled, owed, reimbursements)}
                              className="pr-4 pl-1 py-3 shrink-0">
                              {settled
                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">Paid ✓</span>
                                : <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium border border-rose-200">Unpaid</span>
                              }
                            </button>
                          </div>
                          {isExpanded && bills.length > 0 && (
                            <div className="bg-[#14162e]/60 border-t border-white/[0.07] divide-y divide-white/[0.07]">
                              {bills.map(({ bill, share }) => (
                                <div key={bill.id} className="flex items-center justify-between px-5 py-2">
                                  <div className="min-w-0">
                                    <span className="text-xs text-slate-300">{bill.utility}</span>
                                    <span className="text-xs text-slate-400 ml-2">
                                      {bill.service_period_start ? formatDate(bill.service_period_start) : "—"} – {bill.service_period_end ? formatDate(bill.service_period_end) : "—"}
                                    </span>
                                  </div>
                                  <span className="text-xs font-medium text-rose-500 ml-3">+{formatAmount(share)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Bills list */}
            <div className="bg-[#1e2245] rounded-xl border border-white/[0.1] shadow-sm overflow-hidden">
              <button onClick={() => setUtilBillsOpen((o) => !o)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#14162e] border-b border-white/[0.1] text-left hover:bg-white/[0.07] transition-colors">
                <Zap size={12} className="text-amber-500 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Bills</span>
                <ChevronDown size={11} className={`text-slate-400 ml-auto transition-transform ${utilBillsOpen ? "" : "-rotate-90"}`} />
              </button>
              {utilBillsOpen && (() => {
                const billsToday = new Date();
                const billsTodayMonth = `${billsToday.getFullYear()}-${String(billsToday.getMonth() + 1).padStart(2, "0")}`;
                const billsTodayDay = billsToday.getDate();
                const billsTodayStr = `${billsTodayMonth}-${String(billsTodayDay).padStart(2, "0")}`;
                const visibleBills = utilityBills.filter((b) =>
                  b.is_recurring
                    ? b.billing_start != null && b.billing_start.substring(0, 7) <= selectedMonth
                    : b.charge_date != null && b.charge_date.startsWith(selectedMonth)
                );
                return visibleBills.length === 0
                  ? <p className="px-4 py-6 text-sm text-slate-400 text-center">No utility bills for this month.</p>
                  : <ul className="divide-y divide-white/[0.07]">
                    {visibleBills.map((b) => {
                      const monthAmount = b.is_recurring ? getUtilBillPriceForMonth(b, selectedMonth) : Number(b.amount);
                      const names = b.split_with ? b.split_with.split(",") : [];
                      const share = names.length > 0 ? monthAmount / (names.length + 1) : null;
                      const sinceMo = b.billing_start ? b.billing_start.substring(0, 7) : null;
                      const isUpcoming = b.is_recurring
                        ? selectedMonth > billsTodayMonth || (selectedMonth === billsTodayMonth && b.charge_day != null && billsTodayDay < b.charge_day)
                        : b.charge_date != null && b.charge_date > billsTodayStr;
                      return (
                        <li key={b.id} className="group flex items-center justify-between p-4 hover:bg-white/[0.05] transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-200">{b.utility}</p>
                              {isUpcoming
                                ? <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded">Upcoming</span>
                                : b.is_recurring && <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Recurring</span>
                              }
                            </div>
                            {b.is_recurring ? (
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 block">
                                {b.charge_day ? `${ordinal(b.charge_day)} of each month` : "Monthly"}
                                {sinceMo ? ` · since ${sinceMo}` : ""}
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 block">
                                Service: {b.service_period_start ? formatDate(b.service_period_start) : "—"} – {b.service_period_end ? formatDate(b.service_period_end) : "—"} · Charged {b.charge_date ? formatDate(b.charge_date) : "—"}
                              </span>
                            )}
                            {names.length > 0 && share != null && (
                              <p className="text-xs text-amber-600 font-medium mt-0.5">
                                Split with {names.join(", ")} · {formatAmount(share)} each
                              </p>
                            )}
                            {b.notes && <p className="text-xs text-slate-400 mt-0.5">{b.notes}</p>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="font-bold text-slate-200">{formatAmount(monthAmount)}</span>
                            <RowMenu
                              onEdit={() => openEditBill(b)}
                              onDelete={() => deleteBill(b.id)}
                              onLogPrice={b.is_recurring ? () => { setUtilLogPriceTarget(b); setShowUtilLogPriceModal(true); setUtilLogPriceForm({ amount: "", effectiveMonth: "" }); setUtilLogPriceSaveError(null); } : undefined}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>;
              })()}
            </div>

          </div>
        )}
      </section>}


      {/* Transfers Tab */}
      {activeTab === "transfers" && <>

      {/* Transfer overview stats */}
      <section className="mb-6">
        <div className="grid grid-cols-3 gap-3">
          {/* CC Paid this month */}
          <div className="bg-[#1e2245] rounded-xl border border-white/[0.1] shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <CreditCardIcon size={13} className="text-blue-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">CC Paid</p>
            </div>
            <p className="text-lg font-bold text-blue-600 tabular-nums">{formatAmount(statCcPaidThisMonth)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{formatMonthLabel(selectedMonth)}</p>
          </div>

          {/* Money In this month */}
          <div className="bg-[#1e2245] rounded-xl border border-white/[0.1] shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowDownLeft size={13} className="text-emerald-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Money In</p>
            </div>
            <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatAmount(statMoneyIn)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{formatMonthLabel(selectedMonth)}</p>
          </div>

          {/* Money Out this month */}
          <div className="bg-[#1e2245] rounded-xl border border-white/[0.1] shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowUpRight size={13} className="text-rose-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Money Out</p>
            </div>
            <p className="text-lg font-bold text-rose-500 tabular-nums">{formatAmount(statMoneyOut)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{formatMonthLabel(selectedMonth)}</p>
          </div>

        </div>
      </section>

      {/* Checking Accounts */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3 border-b border-white/[0.1] pb-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
            <Landmark size={16} className="text-blue-500" />
            Checking Accounts
          </div>
          <button onClick={() => openAddBankAccount("checking")} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded-md transition-colors" aria-label="Add checking account">
            <Plus size={18} />
          </button>
        </div>
        {checkingBanks.length === 0 ? (
          <div className="bg-[#1e2245] rounded-xl border border-white/[0.1] p-6 text-center text-sm text-slate-400">
            No checking accounts yet. <button onClick={() => openAddBankAccount("checking")} className="text-blue-500 hover:underline">Add one</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {checkingBanks.map((bank) => {
              const balance = bankCurrentBalance(bank);
              const totalIn = bankTotalIn(bank);
              const totalOut = bankTotalOut(bank);
              return (
                <div key={bank.id} className="bg-[#1e2245] rounded-xl border border-white/[0.1] shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-white">{bank.name}</p>
                      {bank.starting_balance_as_of && (
                        <p className="text-[11px] text-slate-400 mt-0.5">Starting {formatDate(bank.starting_balance_as_of)}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditBankAccount(bank)} className="p-1 text-slate-300 hover:text-blue-500 transition-colors rounded"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteTarget({ type: "bank", id: bank.id })} className="p-1 text-slate-300 hover:text-red-400 transition-colors rounded"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {bank.starting_balance != null && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Starting balance</span>
                        <span className="font-medium">{formatAmount(Number(bank.starting_balance))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-emerald-600">
                      <span>+ Money in</span>
                      <span className="font-medium">{formatAmount(totalIn)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-rose-500">
                      <span>− Money out</span>
                      <span className="font-medium">{formatAmount(totalOut)}</span>
                    </div>
                    <div className="border-t border-white/[0.07] pt-1.5 flex justify-between text-sm">
                      <span className="font-semibold text-slate-300">Balance end of {formatMonthLabel(selectedMonth)}</span>
                      <span className={`font-bold tabular-nums ${balance >= 0 ? "text-white" : "text-rose-600"}`}>{formatAmount(balance)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Savings Accounts */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3 border-b border-white/[0.1] pb-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
            <PiggyBank size={16} className="text-emerald-500" />
            Savings Accounts
          </div>
          <button onClick={() => openAddBankAccount("savings")} className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-500/10 p-1 rounded-md transition-colors" aria-label="Add savings account">
            <Plus size={18} />
          </button>
        </div>
        {savingsBanks.length === 0 ? (
          <div className="bg-[#1e2245] rounded-xl border border-white/[0.1] p-6 text-center text-sm text-slate-400">
            No savings accounts yet. <button onClick={() => openAddBankAccount("savings")} className="text-emerald-500 hover:underline">Add one</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savingsBanks.map((bank) => {
              const balance = bankCurrentBalance(bank);
              const totalIn = bankTotalIn(bank);
              const totalOut = bankTotalOut(bank);
              return (
                <div key={bank.id} className="bg-[#1e2245] rounded-xl border border-white/[0.1] shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-white">{bank.name}</p>
                      {bank.starting_balance_as_of && (
                        <p className="text-[11px] text-slate-400 mt-0.5">Starting {formatDate(bank.starting_balance_as_of)}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditBankAccount(bank)} className="p-1 text-slate-300 hover:text-emerald-500 transition-colors rounded"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteTarget({ type: "bank", id: bank.id })} className="p-1 text-slate-300 hover:text-red-400 transition-colors rounded"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {bank.starting_balance != null && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Starting balance</span>
                        <span className="font-medium">{formatAmount(Number(bank.starting_balance))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-emerald-600">
                      <span>+ Money in</span>
                      <span className="font-medium">{formatAmount(totalIn)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-rose-500">
                      <span>− Money out</span>
                      <span className="font-medium">{formatAmount(totalOut)}</span>
                    </div>
                    <div className="border-t border-white/[0.07] pt-1.5 flex justify-between text-sm">
                      <span className="font-semibold text-slate-300">Balance end of {formatMonthLabel(selectedMonth)}</span>
                      <span className={`font-bold tabular-nums ${balance >= 0 ? "text-white" : "text-rose-600"}`}>{formatAmount(balance)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Transfer list */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 border-b border-white/[0.1] pb-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
            <Send size={16} className="text-violet-500" />
            Money Transfers
            <span className="text-xs font-semibold text-slate-400 normal-case tracking-normal ml-1">
              {filteredTransfers.length} transfer{filteredTransfers.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={transferSort}
              onChange={(e) => setTransferSort(e.target.value as typeof transferSort)}
              className="text-xs border border-white/[0.1] rounded-md px-2 py-1 text-slate-400 bg-[#14162e] focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
            >
              <option value="date-desc">Newest</option>
              <option value="date-asc">Oldest</option>
              <option value="amount-desc">Highest</option>
              <option value="amount-asc">Lowest</option>
            </select>
            <button
              onClick={openAddTransfer}
              className="text-slate-400 hover:text-violet-600 hover:bg-violet-500/10 p-1 rounded-md transition-colors"
              aria-label="Add transfer"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Filters — type + category in one row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {([
            { value: "all", label: "All" },
            { value: "in", label: "Money In" },
            { value: "out", label: "Money Out" },
            { value: "cc", label: "CC Payments" },
            { value: "internal", label: "Internal" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTransferTypeFilter(value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${transferTypeFilter === value ? "bg-violet-500 text-white" : "bg-white/[0.05] text-slate-400 hover:bg-white/[0.1]"}`}
            >
              {label}
            </button>
          ))}
          {transferPillCats.length > 1 && (
            <>
              <span className="w-px bg-white/[0.15] self-stretch mx-1" />
              {transferPillCats.map((cat) => (
                <button
                  key={cat.id ?? "uncat"}
                  onClick={() => setTransferCatFilterId((prev) => (prev === cat.id ? "all" : cat.id))}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${transferCatFilterId === cat.id ? "bg-violet-500 text-white" : "bg-white/[0.05] text-slate-400 hover:bg-white/[0.1]"}`}
                >
                  {cat.name}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="bg-[#1e2245] rounded-xl border border-white/[0.1] shadow-sm overflow-hidden">
          {moneyTransfers.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <div className="w-12 h-12 bg-[#14162e] rounded-full flex items-center justify-center mb-3">
                <Send size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm font-medium">No transfers for this month.</p>
            </div>
          ) : sortedTransfers.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <p className="text-slate-500 text-sm font-medium">No transfers match the selected filter.</p>
              <button onClick={() => setTransferCatFilterId("all")} className="mt-2 text-xs text-violet-500 hover:underline">
                Clear filter
              </button>
            </div>
          ) : isTransferDateSort ? (
            <div>
              {transferDateGroups.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center justify-between px-4 py-2 bg-[#14162e] border-b border-white/[0.07] sticky top-0 z-10">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{group.label}</span>
                    <span className={`text-xs font-semibold ${group.dayNet > 0 ? "text-emerald-600" : group.dayNet < 0 ? "text-rose-500" : "text-slate-500"}`}>
                      {group.dayNet > 0 ? "+" : group.dayNet < 0 ? "−" : ""}{formatAmount(Math.abs(group.dayNet))}
                    </span>
                  </div>
                  {group.items.map((t) => {
                    const isSent = t.direction === "sent";
                    const catName = t.category_id != null ? (expenseCategories.find((c) => c.id === t.category_id)?.name ?? null) : null;
                    const isHighlighted = highlightId === t.id && highlightKind === "transfer";
                    const fromBankName = t.from_bank_id != null ? bankDisplayName(t.from_bank_id) : null;
                    const toBankName = t.to_bank_id != null ? bankDisplayName(t.to_bank_id) : null;
                    const isInternal = isInternalTransfer(t);
                    return (
                      <div key={t.id} id={`transfer-row-${t.id}`} className={`group flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.05] transition-colors border-b border-white/[0.05] last:border-b-0${isHighlighted ? " highlight-row" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isInternal ? "bg-[#1e2245]/[0.07]" : isSent ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                          {isInternal ? <ArrowLeftRight size={13} className="text-slate-500" /> : isSent ? <ArrowUpRight size={13} className="text-red-500" /> : <ArrowDownLeft size={13} className="text-emerald-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-slate-200">
                            {t.name || (isInternal ? `${fromBankName ?? "?"} → ${toBankName ?? "?"}` : isCashTransfer(t) && isSent ? (toBankName ? `Cash → ${toBankName}` : "Cash Deposit") : isCashTransfer(t) && !isSent ? `Cash from ${t.person}` : isSent ? "Sent to " + t.person : "Received from " + t.person)}
                          </span>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {isInternal && <span className="text-xs bg-[#1e2245]/[0.07] text-slate-500 px-2 py-0.5 rounded-full font-medium shrink-0">Internal</span>}
                            {catName && <span className="text-xs bg-indigo-500/20 text-indigo-600 px-2 py-0.5 rounded-full font-medium shrink-0">{catName}</span>}
                            {fromBankName && !isInternal && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium shrink-0">{fromBankName} →</span>}
                            {toBankName && !isInternal && <span className="text-xs bg-violet-500/10 text-violet-600 px-2 py-0.5 rounded-full font-medium shrink-0">→ {toBankName}</span>}
                            {!fromBankName && !toBankName && t.platform && <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${t.platform === "Cash" ? "bg-amber-500/10 text-amber-400" : "bg-violet-500/10 text-violet-600"}`}>{t.platform}</span>}
                            {t.person && t.name && !isInternal && <span className="text-xs text-slate-400 shrink-0">{isSent ? "→" : "←"} {t.person}</span>}
                            {t.notes && <span className="text-xs text-slate-400 truncate max-w-[200px]">{t.notes}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-bold tabular-nums ${isInternal ? "text-slate-500" : isSent ? "text-rose-600" : "text-emerald-600"}`}>
                            {isInternal ? "" : isSent ? "−" : "+"}{formatAmount(Number(t.amount))}
                          </span>
                          <RowMenu onEdit={() => openEditTransfer(t)} onDelete={() => setDeleteTarget({ type: "transfer", id: t.id })} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div>
              {sortedTransfers.map((t) => {
                const isSent = t.direction === "sent";
                const catName = t.category_id != null ? (expenseCategories.find((c) => c.id === t.category_id)?.name ?? null) : null;
                const isHighlighted = highlightId === t.id && highlightKind === "transfer";
                const fromBankName = t.from_bank_id != null ? bankDisplayName(t.from_bank_id) : null;
                const toBankName = t.to_bank_id != null ? bankDisplayName(t.to_bank_id) : null;
                const isInternal = isInternalTransfer(t);
                return (
                  <div key={t.id} id={`transfer-row-${t.id}`} className={`group flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.05] transition-colors border-b border-white/[0.07] last:border-b-0${isHighlighted ? " highlight-row" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isInternal ? "bg-[#1e2245]/[0.07]" : isSent ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                      {isInternal ? <ArrowLeftRight size={13} className="text-slate-500" /> : isSent ? <ArrowUpRight size={13} className="text-red-500" /> : <ArrowDownLeft size={13} className="text-emerald-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-200">
                        {t.name || (isInternal ? `${fromBankName ?? "?"} → ${toBankName ?? "?"}` : isCashTransfer(t) && isSent ? (toBankName ? `Cash → ${toBankName}` : "Cash Deposit") : isCashTransfer(t) && !isSent ? `Cash from ${t.person}` : isSent ? "Sent to " + t.person : "Received from " + t.person)}
                      </span>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide shrink-0">{formatDate(t.date)}</span>
                        {isInternal && <span className="text-xs bg-[#1e2245]/[0.07] text-slate-500 px-2 py-0.5 rounded-full font-medium shrink-0">Internal</span>}
                        {catName && <span className="text-xs bg-indigo-500/20 text-indigo-600 px-2 py-0.5 rounded-full font-medium shrink-0">{catName}</span>}
                        {fromBankName && !isInternal && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium shrink-0">{fromBankName} →</span>}
                        {toBankName && !isInternal && <span className="text-xs bg-violet-500/10 text-violet-600 px-2 py-0.5 rounded-full font-medium shrink-0">→ {toBankName}</span>}
                        {!fromBankName && !toBankName && t.platform && <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${t.platform === "Cash" ? "bg-amber-500/10 text-amber-400" : "bg-violet-500/10 text-violet-600"}`}>{t.platform}</span>}
                        {t.person && t.name && !isInternal && <span className="text-xs text-slate-400 shrink-0">{isSent ? "→" : "←"} {t.person}</span>}
                        {t.notes && <span className="text-xs text-slate-400 truncate max-w-[200px]">{t.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold tabular-nums ${isInternal ? "text-slate-500" : isSent ? "text-rose-600" : "text-emerald-600"}`}>
                        {isInternal ? "" : isSent ? "−" : "+"}{formatAmount(Number(t.amount))}
                      </span>
                      <RowMenu onEdit={() => openEditTransfer(t)} onDelete={() => setDeleteTarget({ type: "transfer", id: t.id })} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      </>}

      {/* College Loans Tab */}
      {activeTab === "loans" && <>
      {/* Loans KPI Strip */}
      {loans.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total Balance</p>
            <p className="text-2xl font-bold text-white mt-1">
              {formatAmount(loans.reduce((s, l) => s + Number(l.unpaid_principal) + Number(l.unpaid_interest), 0))}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{loans.length} loan{loans.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Unpaid Principal</p>
            <p className="text-2xl font-bold text-white mt-1">
              {formatAmount(loans.reduce((s, l) => s + Number(l.unpaid_principal), 0))}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {formatAmount(loans.reduce((s, l) => s + Number(l.original_principal), 0))} original
            </p>
          </div>
          <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Accrued Interest</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {formatAmount(loans.reduce((s, l) => s + Number(l.unpaid_interest), 0))}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {formatAmount(loans.reduce((s, l) => s + Number(l.total_interest_paid), 0))} paid to date
            </p>
          </div>
        </div>
      )}

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 border-b border-white/[0.1] pb-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
            <GraduationCap size={16} className="text-indigo-500" />
            College Loans
          </div>
          <button
            onClick={() => { setEditLoan(null); setLoanForm({ ...EMPTY_LOAN, disbursement_date: toLocalDate(new Date()) }); setLoanSaveError(null); setShowLoanModal(true); }}
            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-500/20 p-1 rounded-md transition-colors"
            aria-label="Add loan"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-[#1e2245] rounded-xl border border-white/[0.1] shadow-sm overflow-hidden">
              {loans.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center">
                  <div className="w-12 h-12 bg-[#14162e] rounded-full flex items-center justify-center mb-3">
                    <GraduationCap size={24} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">No loans added yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.07] bg-[#14162e]">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Loan</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Disbursed</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Orig. Principal</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unpaid Principal</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unpaid Interest</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Interest Paid</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-indigo-500/20/60">Current Balance</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.07]">
                      {loans.map((loan) => (
                        <tr key={loan.id} className="group hover:bg-white/[0.05] transition-colors">
                          <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                            {loan.name}
                            {loan.notes && (
                              <span className="block text-xs text-slate-400 font-normal mt-0.5 max-w-[180px] truncate">{loan.notes}</span>
                            )}
                            {Number(loan.original_principal) > 0 && (() => {
                              const paidPct = Math.round((1 - Number(loan.unpaid_principal) / Number(loan.original_principal)) * 100);
                              return (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <div className="w-24 h-1.5 bg-[#1e2245]/[0.07] rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${paidPct}%` }} />
                                  </div>
                                  <span className="text-[10px] text-slate-400">{paidPct}% paid</span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(loan.disbursement_date)}</td>
                          <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatAmount(Number(loan.original_principal))}</td>
                          <td className="px-4 py-3 text-right text-slate-200 font-medium whitespace-nowrap">{formatAmount(Number(loan.unpaid_principal))}</td>
                          <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{Number(loan.interest_rate).toFixed(4).replace(/\.?0+$/, "")}%</td>
                          <td className="px-4 py-3 text-right text-amber-600 font-medium whitespace-nowrap">{formatAmount(Number(loan.unpaid_interest))}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 whitespace-nowrap">{formatAmount(Number(loan.total_interest_paid))}</td>
                          <td className="px-4 py-3 text-right font-bold text-white whitespace-nowrap bg-indigo-500/20/30">
                            {formatAmount(Number(loan.unpaid_principal) + Number(loan.unpaid_interest))}
                          </td>
                          <td className="px-4 py-3">
                            <RowMenu
                              onEdit={() => {
                                setEditLoan(loan);
                                setLoanForm({ name: loan.name, disbursement_date: loan.disbursement_date, original_principal: String(loan.original_principal), unpaid_principal: String(loan.unpaid_principal), interest_rate: String(loan.interest_rate), unpaid_interest: String(loan.unpaid_interest), total_interest_paid: String(loan.total_interest_paid), notes: loan.notes ?? "" });
                                setLoanSaveError(null);
                                setShowLoanModal(true);
                              }}
                              onDelete={() => setDeleteTarget({ type: "loan", id: loan.id })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
      </section>
      </>}

      {/* Stocks Tab */}
      {activeTab === "stocks" && (() => {
        const totalInvested = stocks.reduce((s, h) => s + Number(h.shares) * Number(h.buy_price), 0);
        const currentValue = stocks.reduce((s, h) => s + Number(h.shares) * Number(h.current_price), 0);
        const unrealizedGain = currentValue - totalInvested;
        const unrealizedGainPct = totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0;
        const totalRealizedGain = stocks.reduce((s, h) => s + Number(h.realized_gain), 0);
        const totalDividends = stocks.reduce((s, h) => s + Number(h.total_dividends), 0);
        const totalReturn = unrealizedGain + totalRealizedGain + totalDividends;
        return (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Card 1: Portfolio */}
              <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-6 py-5">
                <div className="flex items-center gap-1.5 mb-3">
                  <Wallet size={13} className="text-indigo-400" />
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Portfolio</p>
                </div>
                <p className="text-3xl font-bold text-white leading-none">{formatAmount(currentValue)}</p>
                <p className="text-[11px] text-slate-400 mt-1">current value</p>
                <div className="mt-4 pt-4 border-t border-white/[0.07] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Invested</p>
                    <p className="text-sm font-bold text-slate-300 mt-0.5">{formatAmount(totalInvested)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Holdings</p>
                    <p className="text-sm font-bold text-slate-300 mt-0.5">{stocks.filter((h) => Number(h.shares) > 0).length}</p>
                  </div>
                </div>
              </div>

              {/* Card 2: Total Return */}
              <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-6 py-5">
                <div className="flex items-center gap-1.5 mb-3">
                  {totalReturn >= 0 ? <TrendingUp size={13} className="text-emerald-500" /> : <TrendingDown size={13} className="text-rose-500" />}
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Total Return</p>
                </div>
                <p className={`text-3xl font-bold leading-none ${totalReturn >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {totalReturn >= 0 ? "+" : ""}{formatAmount(totalReturn)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">unrealized + realized + dividends</p>
                <div className="mt-4 pt-4 border-t border-white/[0.07] grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Unrealized</p>
                    <p className={`text-sm font-bold mt-0.5 ${unrealizedGain >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {unrealizedGain >= 0 ? "+" : ""}{formatAmount(unrealizedGain)}
                    </p>
                    <p className={`text-[10px] ${unrealizedGain >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{unrealizedGain >= 0 ? "+" : ""}{unrealizedGainPct.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Realized</p>
                    <p className={`text-sm font-bold mt-0.5 ${totalRealizedGain >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {totalRealizedGain >= 0 ? "+" : ""}{formatAmount(totalRealizedGain)}
                    </p>
                    <p className="text-[10px] text-slate-400">from sold</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Dividends</p>
                    <p className="text-sm font-bold text-amber-600 mt-0.5">{formatAmount(totalDividends)}</p>
                    <p className="text-[10px] text-slate-400">{stocks.reduce((n, h) => n + h.dividends.length, 0)} payments</p>
                  </div>
                </div>
              </div>

              {/* Card 3: Dividend Income */}
              {(() => {
                const allDividends = stocks.flatMap((h) => h.dividends);
                const currentYear = new Date().getFullYear();
                const thisYearTotal = allDividends
                  .filter((d) => new Date(d.paid_at).getFullYear() === currentYear)
                  .reduce((s, d) => s + Number(d.total_received), 0);
                const beforeThisYear = totalDividends - thisYearTotal;
                const cashTotal = allDividends.filter((d) => !d.reinvested).reduce((s, d) => s + Number(d.total_received), 0);
                const drip = allDividends.filter((d) => d.reinvested).reduce((s, d) => s + Number(d.total_received), 0);
                const topEarner = stocks
                  .filter((h) => h.dividends.length > 0)
                  .map((h) => ({ ticker: h.ticker, total: h.dividends.reduce((s, d) => s + Number(d.total_received), 0) }))
                  .sort((a, b) => b.total - a.total)[0] ?? null;
                return (
                <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-6 py-5">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Zap size={13} className="text-amber-400" />
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Dividend Income</p>
                  </div>
                  <p className="text-3xl font-bold text-amber-600 leading-none">{formatAmount(thisYearTotal)}</p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    {formatAmount(totalDividends)} total
                  </p>
                  {beforeThisYear > 0 && (
                    <p className="text-[11px] text-slate-300">
                      {formatAmount(beforeThisYear)} before {currentYear}
                    </p>
                  )}
                  <div className="mt-4 pt-4 border-t border-white/[0.07] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Top Earner</p>
                      {topEarner ? (
                        <>
                          <p className="text-sm font-bold text-slate-300 mt-0.5">{topEarner.ticker}</p>
                          <p className="text-[10px] text-amber-600 font-semibold">{formatAmount(topEarner.total)}</p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-300 mt-0.5">—</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Cash vs DRIP</p>
                      <p className="text-sm font-bold text-slate-300 mt-0.5">{formatAmount(cashTotal)}</p>
                      <p className="text-[10px] text-emerald-600 font-semibold">{formatAmount(drip)} reinvested</p>
                    </div>
                  </div>
                </div>
                );
              })()}
            </div>

            {/* Holdings table */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4 border-b border-white/[0.1] pb-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
                  <BarChart2 size={16} className="text-indigo-500" />
                  Holdings
                  <span className="text-xs font-semibold text-slate-400 normal-case tracking-normal ml-1">
                    {stocks.length} position{stocks.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {stocks.length > 0 && (
                    <button
                      onClick={refreshAllPrices}
                      disabled={refreshingAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.1] text-slate-600 rounded-lg text-xs font-semibold hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw size={14} className={refreshingAll ? "animate-spin" : ""} />
                      Refresh All
                    </button>
                  )}
                  <button
                    onClick={openAddStock}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={14} /> Add Stock
                  </button>
                </div>
              </div>

              {stocks.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">
                  No holdings yet. Add your first stock to get started.
                </div>
              ) : (() => {
                const filterQ = stockFilter.trim().toLowerCase();
                const matches = (h: StockHolding) =>
                  !filterQ ||
                  h.ticker.toLowerCase().includes(filterQ) ||
                  (h.company_name ?? "").toLowerCase().includes(filterQ);
                const sortHoldings = (list: StockHolding[]) => {
                  if (!stockSortCol) return list;
                  return [...list].sort((a, b) => {
                    let av: number | string, bv: number | string;
                    const aVal = Number(a.shares) * Number(a.current_price);
                    const bVal = Number(b.shares) * Number(b.current_price);
                    switch (stockSortCol) {
                      case "ticker":     av = a.ticker; bv = b.ticker; break;
                      case "shares":     av = Number(a.shares); bv = Number(b.shares); break;
                      case "buy_price":  av = Number(a.buy_price); bv = Number(b.buy_price); break;
                      case "cur_price":  av = Number(a.current_price); bv = Number(b.current_price); break;
                      case "invested":   av = Number(a.shares) * Number(a.buy_price); bv = Number(b.shares) * Number(b.buy_price); break;
                      case "value":      av = aVal; bv = bVal; break;
                      case "gain":       av = aVal - Number(a.shares) * Number(a.buy_price); bv = bVal - Number(b.shares) * Number(b.buy_price); break;
                      case "alloc":      av = aVal; bv = bVal; break;
                      default:           return 0;
                    }
                    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
                    return stockSortDir === "asc" ? cmp : -cmp;
                  });
                };
                const toggleSort = (col: string) => {
                  if (stockSortCol === col) setStockSortDir((d) => d === "asc" ? "desc" : "asc");
                  else { setStockSortCol(col); setStockSortDir("asc"); }
                };
                const SortTh = ({ col, children, className }: { col: string; children: React.ReactNode; className?: string }) => (
                  <th
                    onClick={() => toggleSort(col)}
                    className={`cursor-pointer select-none px-5 py-3 hover:bg-white/[0.07] transition-colors ${className ?? "text-right"}`}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      {children}
                      {stockSortCol === col
                        ? stockSortDir === "asc"
                          ? <ChevronRight size={11} className="rotate-90 text-indigo-500" />
                          : <ChevronRight size={11} className="-rotate-90 text-indigo-500" />
                        : <ChevronRight size={11} className="rotate-90 opacity-20" />}
                    </span>
                  </th>
                );
                const activeHoldings = sortHoldings(stocks.filter((h) => Number(h.shares) > 0 && matches(h)));
                const soldHoldings = stocks.filter((h) => h.lots.some((l) => l.sold_price != null) && matches(h));
                const netRealizedGain = soldHoldings.reduce((s, h) => s + Number(h.realized_gain), 0);
                const netSoldCost = soldHoldings.reduce((s, h) => s + h.lots.filter((l) => l.sold_price != null).reduce((a, l) => a + Number(l.shares) * Number(l.buy_price), 0), 0);
                return (
                <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#14162e] text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="w-8" />
                        <th className="text-right px-2 py-3 text-slate-300 font-medium w-6">#</th>
                        <SortTh col="ticker" className="text-left px-5 py-3">Ticker</SortTh>
                        <SortTh col="shares">Shares</SortTh>
                        <SortTh col="buy_price">Avg Buy Price</SortTh>
                        <SortTh col="cur_price">Current Price</SortTh>
                        <SortTh col="invested">Invested Value</SortTh>
                        <SortTh col="value">Current Value</SortTh>
                        <SortTh col="gain">Gain / Loss</SortTh>
                        <SortTh col="alloc">Allocation</SortTh>
                        <th className="w-16" />
                      </tr>
                    </thead>
                    {(activeHoldings.length === 0 && soldHoldings.length === 0) ? (
                      <tbody><tr><td colSpan={11} className="text-center py-10 text-slate-400 text-xs">No holdings match your filter.</td></tr></tbody>
                    ) : null}
                    {activeHoldings.map((h, idx) => {
                        const isExpanded = expandedStockIds.has(h.id);
                        const costBasis = Number(h.shares) * Number(h.buy_price);
                        const value = Number(h.shares) * Number(h.current_price);
                        const gain = value - costBasis;
                        const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
                        const isUp = gain >= 0;
                        const allocPct = currentValue > 0 ? (value / currentValue) * 100 : 0;
                        return (
                          <tbody key={h.id} className="divide-y divide-white/[0.07]">
                            <tr id={`stock-row-${h.id}`} className={`group hover:bg-white/[0.05] transition-colors${highlightId === h.id && highlightKind === "stock" ? " highlight-row" : ""}`}>
                              <td className="pl-3 py-3">
                                <button
                                  onClick={() => toggleStockExpand(h.id)}
                                  className="p-0.5 text-slate-300 hover:text-slate-300 transition-colors"
                                >
                                  <ChevronRight size={14} className={`transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} />
                                </button>
                              </td>
                              <td className="px-2 py-3 text-right text-[11px] text-slate-300 font-medium tabular-nums">{idx + 1}</td>
                              <td className="px-5 py-3">
                                <div className="font-bold text-white">{h.ticker}</div>
                                {h.company_name && <div className="text-xs text-slate-400 mt-0.5">{h.company_name}</div>}
                                {h.lots.length > 1 && <div className="text-[10px] text-indigo-400 mt-0.5">{h.lots.length} lots</div>}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-300">{Number(h.shares).toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                              <td className="px-5 py-3 text-right text-slate-300">{formatAmount(Number(h.buy_price))}</td>
                              <td className="px-5 py-3 text-right text-slate-300">{formatAmount(Number(h.current_price))}</td>
                              <td className="px-5 py-3 text-right text-slate-600">{formatAmount(costBasis)}</td>
                              <td className="px-5 py-3 text-right font-semibold text-white">{formatAmount(value)}</td>
                              <td className="px-5 py-3 text-right">
                                <div className={`font-semibold ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
                                  {isUp ? "+" : ""}{formatAmount(gain)}
                                </div>
                                <div className={`text-xs mt-0.5 ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
                                  {isUp ? "+" : ""}{gainPct.toFixed(2)}%
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="text-slate-300 font-medium">{allocPct.toFixed(1)}%</div>
                                <div className="mt-1 h-1 w-full bg-[#1e2245]/[0.07] rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.min(allocPct, 100)}%` }} />
                                </div>
                              </td>
                              <td className="pr-3 py-3">
                                <div className="flex items-center justify-end gap-0.5">
                                  <button
                                    onClick={() => refreshStockPrice(h.id)}
                                    disabled={refreshingIds.has(h.id)}
                                    title="Refresh price"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-500/20 rounded-md disabled:cursor-not-allowed"
                                  >
                                    <RefreshCw size={14} className={refreshingIds.has(h.id) ? "animate-spin" : ""} />
                                  </button>
                                  <RowMenu
                                    onEdit={() => openEditStock(h)}
                                    onDelete={() => setDeleteTarget({ type: "stock", id: h.id })}
                                  />
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (() => {
                                      const activeLots = h.lots.filter((l) => l.sold_price == null);
                                      const selectedInHolding = h.lots.filter((l) => selectedLotIds.has(l.id));
                                      return (
                              <tr>
                                <td colSpan={11} className="pb-3 pt-0 bg-[#14162e]/40">
                                  <div className="mx-4 ml-10 border border-white/[0.07] rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                      <colgroup>
                                        <col className="w-8" />
                                        <col />
                                        <col className="w-24" />
                                        <col className="w-24" />
                                        <col className="w-24" />
                                        <col className="w-24" />
                                        <col className="w-16" />
                                      </colgroup>

                                      {/* ── LOTS section ── */}
                                      <tbody>
                                        <tr className="bg-[#14162e] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                          <td className="px-2 py-2 text-center">
                                            {activeLots.length > 0 && (
                                              <input
                                                type="checkbox"
                                                checked={activeLots.every((l) => selectedLotIds.has(l.id))}
                                                onChange={(e) => setSelectedLotIds((prev) => {
                                                  const next = new Set(prev);
                                                  activeLots.forEach((l) => e.target.checked ? next.add(l.id) : next.delete(l.id));
                                                  return next;
                                                })}
                                                className="accent-indigo-600 cursor-pointer"
                                              />
                                            )}
                                          </td>
                                          <td className="px-4 py-2">
                                            <span className="flex items-center gap-1.5">
                                              <BarChart2 size={10} className="text-indigo-400" /> Purchase Date
                                              <span className="text-indigo-500 font-semibold normal-case tracking-normal ml-1">
                                                · {h.lots.length} lot{h.lots.length !== 1 ? "s" : ""}
                                              </span>
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-right">Shares</td>
                                          <td className="px-4 py-2 text-right">Buy Price</td>
                                          <td className="px-4 py-2 text-right">Cost Basis</td>
                                          <td className="px-4 py-2 text-right">Status</td>
                                          <td />
                                        </tr>
                                      </tbody>
                                      <tbody className="divide-y divide-white/[0.07]">
                                        {[...h.lots].sort((a, b) => {
                                          if (!a.purchased_at && !b.purchased_at) return 0;
                                          if (!a.purchased_at) return 1;
                                          if (!b.purchased_at) return -1;
                                          return b.purchased_at.localeCompare(a.purchased_at);
                                        }).map((lot) => {
                                          const isSold = lot.sold_price != null;
                                          const profit = isSold ? (Number(lot.sold_price) - Number(lot.buy_price)) * Number(lot.shares) : null;
                                          return (
                                            <tr key={lot.id} className={`group/lot transition-colors ${isSold ? "opacity-50" : "hover:bg-[#1e2245]"}`}>
                                              <td className="px-2 py-2 text-center">
                                                {!isSold && (
                                                  <input
                                                    type="checkbox"
                                                    checked={selectedLotIds.has(lot.id)}
                                                    onChange={(e) => setSelectedLotIds((prev) => {
                                                      const next = new Set(prev);
                                                      e.target.checked ? next.add(lot.id) : next.delete(lot.id);
                                                      return next;
                                                    })}
                                                    className="accent-indigo-600 cursor-pointer"
                                                  />
                                                )}
                                              </td>
                                              <td className="px-4 py-2 text-slate-500">
                                                {lot.purchased_at
                                                  ? new Date(lot.purchased_at + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                  : <span className="text-slate-300">—</span>}
                                              </td>
                                              <td className="px-4 py-2 text-right text-slate-300">{Number(lot.shares).toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                                              <td className="px-4 py-2 text-right text-slate-300">{formatAmount(Number(lot.buy_price))}</td>
                                              <td className="px-4 py-2 text-right text-slate-600">{formatAmount(Number(lot.shares) * Number(lot.buy_price))}</td>
                                              <td className="px-4 py-2 text-right">
                                                {isSold ? (
                                                  <div>
                                                    <span className="text-slate-400">Sold @ {formatAmount(Number(lot.sold_price))}</span>
                                                    {profit != null && (
                                                      <div className={`text-[10px] font-semibold mt-0.5 ${profit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                                        {profit >= 0 ? "+" : ""}{formatAmount(profit)}
                                                      </div>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <span className="text-emerald-500 font-medium">Active</span>
                                                )}
                                              </td>
                                              <td className="pr-2 py-2 text-right">
                                                <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/lot:opacity-100 transition-opacity">
                                                  {isSold && (
                                                    <button onClick={() => unsellLot(lot)} title="Undo sell" className="p-1 text-slate-300 hover:text-indigo-500 rounded">
                                                      <RotateCcw size={12} />
                                                    </button>
                                                  )}
                                                  {!isSold && activeLots.length > 1 && (
                                                    <button onClick={() => deleteLot(lot)} className="p-1 text-slate-300 hover:text-red-500 rounded">
                                                      <Trash2 size={12} />
                                                    </button>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      {selectedInHolding.length > 0 && (
                                        <tbody>
                                          <tr>
                                            <td colSpan={7} className="px-4 py-2 bg-indigo-500/20 border-t border-indigo-100">
                                              <div className="flex items-center justify-between">
                                                <span className="text-xs text-indigo-400 font-medium">{selectedInHolding.length} lot{selectedInHolding.length !== 1 ? "s" : ""} selected</span>
                                                <button onClick={() => { setSellForm({ sold_price: "", sold_at: "" }); setSellSaveError(null); setShowSellModal(true); }} className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 transition-colors">
                                                  <DollarSign size={11} /> Sell selected
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        </tbody>
                                      )}
                                      <tbody>
                                        <tr>
                                          <td colSpan={7} className="border-t border-white/[0.07]">
                                            {addingLotForId === h.id ? (
                                              <div className="p-3 bg-[#1e2245] flex flex-wrap items-end gap-2">
                                                <div>
                                                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Shares *</label>
                                                  <input type="number" step="0.000001" min="0" required value={lotForm.shares} onChange={(e) => setLotForm((f) => ({ ...f, shares: e.target.value }))} placeholder="e.g. 10" className="w-24 border border-white/[0.1] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                                                </div>
                                                <div>
                                                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Buy Price *</label>
                                                  <input type="number" step="0.0001" min="0" required value={lotForm.buy_price} onChange={(e) => setLotForm((f) => ({ ...f, buy_price: e.target.value }))} placeholder="0.00" className="w-24 border border-white/[0.1] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                                                </div>
                                                <div>
                                                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Date (optional)</label>
                                                  <input type="date" value={lotForm.purchased_at} onChange={(e) => setLotForm((f) => ({ ...f, purchased_at: e.target.value }))} className="border border-white/[0.1] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                                                </div>
                                                {lotSaveError && <p className="w-full text-xs text-red-500">{lotSaveError}</p>}
                                                <button onClick={() => addLot(h.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition-colors">Add</button>
                                                <button onClick={() => { setAddingLotForId(null); setLotForm({ shares: "", buy_price: "", purchased_at: "" }); setLotSaveError(null); }} className="px-3 py-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors">Cancel</button>
                                              </div>
                                            ) : (
                                              <div className="p-2">
                                                <button onClick={() => { setAddingLotForId(h.id); setLotForm({ shares: "", buy_price: "", purchased_at: "" }); setLotSaveError(null); }} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 hover:bg-indigo-500/20 rounded-md transition-colors">
                                                  <Plus size={12} /> Add lot
                                                </button>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      </tbody>

                                      {/* ── DIVIDENDS section ── */}
                                      <tbody>
                                        <tr className="bg-[#14162e] text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-t-2 border-white/[0.1]">
                                          <td className="px-2 py-2 text-center">
                                            <Zap size={10} className="text-amber-400 mx-auto" />
                                          </td>
                                          <td className="px-4 py-2">
                                            <span className="flex items-center gap-1.5">
                                              Pay Date
                                              {h.dividends.length > 0 && (
                                                <span className="text-amber-600 font-semibold normal-case tracking-normal ml-1">
                                                  · {formatAmount(Number(h.total_dividends))} total
                                                </span>
                                              )}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-right">$/Share</td>
                                          <td className="px-4 py-2 text-right">Shares Held</td>
                                          <td className="px-4 py-2 text-right">Total</td>
                                          <td className="px-4 py-2 text-center">Type</td>
                                          <td />
                                        </tr>
                                      </tbody>
                                      <tbody className="divide-y divide-white/[0.07]">
                                        {[...h.dividends].sort((a, b) => b.paid_at.localeCompare(a.paid_at)).map((div) => (
                                          <tr key={div.id} className="group/div hover:bg-[#1e2245] transition-colors">
                                            <td className="px-2 py-2" />
                                            <td className="px-4 py-2 text-slate-500">
                                              {new Date(div.paid_at + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                            </td>
                                            <td className="px-4 py-2 text-right text-slate-300">{formatAmount(Number(div.dividend_per_share))}</td>
                                            <td className="px-4 py-2 text-right text-slate-300">{Number(div.shares_held).toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-amber-600">{formatAmount(Number(div.total_received))}</td>
                                            <td className="px-4 py-2 text-center">
                                              {div.reinvested
                                                ? <span className="inline-block px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded text-[10px] font-medium">DRIP</span>
                                                : <span className="inline-block px-1.5 py-0.5 bg-[#1e2245]/[0.07] text-slate-400 rounded text-[10px]">Cash</span>}
                                            </td>
                                            <td className="pr-2 py-2">
                                              <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/div:opacity-100 transition-opacity">
                                                <button onClick={() => { setEditingDividend(div); setDividendModalHoldingId(div.stock_holding_id); setDividendModalForm({ paid_at: div.paid_at, dividend_per_share: String(div.dividend_per_share), shares_held: String(div.shares_held), reinvested: div.reinvested, notes: div.notes ?? "" }); setDividendModalError(null); setShowDividendModal(true); }} className="p-1 text-slate-300 hover:text-indigo-500 rounded">
                                                  <Pencil size={12} />
                                                </button>
                                                <button onClick={() => deleteDividend(div)} className="p-1 text-slate-300 hover:text-red-500 rounded">
                                                  <Trash2 size={12} />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tbody>
                                        <tr>
                                          <td colSpan={7} className="border-t border-white/[0.07] p-2">
                                            <button onClick={() => { setEditingDividend(null); setDividendModalHoldingId(h.id); setDividendModalForm({ paid_at: "", dividend_per_share: "", shares_held: String(Number(h.shares)), reinvested: false, notes: "" }); setDividendModalError(null); setShowDividendModal(true); }} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-300 font-medium px-2 py-1 hover:bg-amber-500/10 rounded-md transition-colors">
                                              <Plus size={12} /> Log dividend
                                            </button>
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                                      );
                                    })()}
                          </tbody>
                        );
                      })}
                    {soldHoldings.length > 0 && (
                      <>
                        <tbody>
                          <tr>
                            <td colSpan={11} className="px-5 py-2 bg-[#14162e] border-t border-b border-white/[0.1]">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Sold</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-xs text-slate-400">{formatAmount(netSoldCost)} invested</span>
                                  <span className={`text-xs font-semibold ${netRealizedGain >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                    {netRealizedGain >= 0 ? "+" : ""}{formatAmount(netRealizedGain)} realized
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                        {soldHoldings.map((h, idx) => {
                          const isExpanded = expandedStockIds.has(h.id);
                          const soldLots = h.lots.filter((l) => l.sold_price != null);
                          const totalSoldShares = soldLots.reduce((s, l) => s + Number(l.shares), 0);
                          const totalCost = soldLots.reduce((s, l) => s + Number(l.shares) * Number(l.buy_price), 0);
                          const totalProceeds = soldLots.reduce((s, l) => s + Number(l.shares) * Number(l.sold_price!), 0);
                          const avgBuyPrice = totalSoldShares > 0 ? totalCost / totalSoldShares : 0;
                          const avgSellPrice = totalSoldShares > 0 ? totalProceeds / totalSoldShares : 0;
                          const realizedGain = Number(h.realized_gain);
                          const gainPct = totalCost > 0 ? (realizedGain / totalCost) * 100 : 0;
                          const isUp = realizedGain >= 0;
                          const soldAllocPct = netRealizedGain !== 0 ? (realizedGain / Math.abs(netRealizedGain)) * 100 : 0;
                          return (
                            <tbody key={h.id} className="divide-y divide-white/[0.07]">
                              <tr className="group bg-[#14162e]/40 hover:bg-white/[0.05] transition-colors">
                                <td className="pl-3 py-3">
                                  <button
                                    onClick={() => toggleStockExpand(h.id)}
                                    className="p-0.5 text-slate-300 hover:text-slate-500 transition-colors"
                                  >
                                    <ChevronRight size={14} className={`transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} />
                                  </button>
                                </td>
                                <td className="px-2 py-3 text-right text-[11px] text-slate-300 font-medium tabular-nums">{idx + 1}</td>
                                <td className="px-5 py-3">
                                  <div className="font-bold text-slate-500">{h.ticker}</div>
                                  {h.company_name && <div className="text-xs text-slate-400 mt-0.5">{h.company_name}</div>}
                                  <div className="text-[10px] text-slate-400 mt-0.5">{soldLots.length} lot{soldLots.length !== 1 ? "s" : ""} closed</div>
                                </td>
                                <td className="px-5 py-3 text-right text-slate-400">{totalSoldShares.toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                                <td className="px-5 py-3 text-right text-slate-400">{formatAmount(avgBuyPrice)}</td>
                                <td className="px-5 py-3 text-right text-slate-500 font-medium">{formatAmount(avgSellPrice)}</td>
                                <td className="px-5 py-3 text-right text-slate-400">{formatAmount(totalCost)}</td>
                                <td className="px-5 py-3 text-right text-slate-500 font-medium">{formatAmount(totalProceeds)}</td>
                                <td className="px-5 py-3 text-right">
                                  <div className={`font-semibold ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
                                    {isUp ? "+" : ""}{formatAmount(realizedGain)}
                                  </div>
                                  <div className={`text-xs mt-0.5 ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
                                    {isUp ? "+" : ""}{gainPct.toFixed(2)}%
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <div className={`font-medium text-sm ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
                                    {soldAllocPct >= 0 ? "+" : ""}{soldAllocPct.toFixed(1)}%
                                  </div>
                                  <div className="mt-1 h-1 w-full bg-[#1e2245]/[0.07] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${isUp ? "bg-emerald-400" : "bg-rose-400"}`}
                                      style={{ width: `${Math.min(Math.abs(soldAllocPct), 100)}%` }}
                                    />
                                  </div>
                                </td>
                                <td className="pr-3 py-3">
                                  <RowMenu
                                    onEdit={() => openEditStock(h)}
                                    onDelete={() => setDeleteTarget({ type: "stock", id: h.id })}
                                  />
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={11} className="pb-3 pt-0 bg-[#14162e]/20">
                                    <div className="mx-4 ml-10 border border-white/[0.07] rounded-xl overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead className="bg-[#14162e] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                          <tr>
                                            <th className="text-left px-4 py-2">Buy Date</th>
                                            <th className="text-left px-4 py-2">Sell Date</th>
                                            <th className="text-right px-4 py-2">Shares</th>
                                            <th className="text-right px-4 py-2">Buy Price</th>
                                            <th className="text-right px-4 py-2">Sell Price</th>
                                            <th className="text-right px-4 py-2">Cost Basis</th>
                                            <th className="text-right px-4 py-2">Proceeds</th>
                                            <th className="text-right px-4 py-2">Gain / Loss</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.07]">
                                          {soldLots.map((lot) => {
                                            const lotProfit = (Number(lot.sold_price!) - Number(lot.buy_price)) * Number(lot.shares);
                                            const lotProceed = Number(lot.sold_price!) * Number(lot.shares);
                                            const lotCost = Number(lot.buy_price) * Number(lot.shares);
                                            const isLotUp = lotProfit >= 0;
                                            return (
                                              <tr key={lot.id} className="hover:bg-[#1e2245] transition-colors">
                                                <td className="px-4 py-2 text-slate-500">
                                                  {lot.purchased_at
                                                    ? new Date(lot.purchased_at + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                    : <span className="text-slate-300">—</span>}
                                                </td>
                                                <td className="px-4 py-2 text-slate-500">
                                                  {lot.sold_at
                                                    ? new Date(lot.sold_at + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                    : <span className="text-slate-300">—</span>}
                                                </td>
                                                <td className="px-4 py-2 text-right text-slate-600">{Number(lot.shares).toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                                                <td className="px-4 py-2 text-right text-slate-600">{formatAmount(Number(lot.buy_price))}</td>
                                                <td className="px-4 py-2 text-right text-slate-300 font-medium">{formatAmount(Number(lot.sold_price))}</td>
                                                <td className="px-4 py-2 text-right text-slate-500">{formatAmount(lotCost)}</td>
                                                <td className="px-4 py-2 text-right text-slate-300">{formatAmount(lotProceed)}</td>
                                                <td className="px-4 py-2 text-right">
                                                  <div className={`font-semibold ${isLotUp ? "text-emerald-600" : "text-rose-600"}`}>{isLotUp ? "+" : ""}{formatAmount(lotProfit)}</div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          );
                        })}
                      </>
                    )}
                  </table>
                </div>
                );
              })()}
            </section>
          </>
        );
      })()}

      {/* Expenses Section */}
      {activeTab === "expenses" && <>
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 border-b border-white/[0.1] pb-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
            <Receipt size={16} className="text-indigo-500" />
            Expenses
            <span className="text-xs font-semibold text-slate-400 normal-case tracking-normal ml-1">
              {filteredExpenses.length} transaction{filteredExpenses.length !== 1 ? "s" : ""}
            </span>
            {filteredExpenses.length > 0 && (
              <div className="relative" ref={merchantBreakdownRef}>
                <button
                  onClick={() => setMerchantBreakdownOpen((o) => !o)}
                  title="Merchant breakdown"
                  className={`p-1 rounded-md transition-colors normal-case tracking-normal ${merchantBreakdownOpen ? "bg-indigo-500/20 text-indigo-600" : "text-slate-300 hover:text-slate-500 hover:bg-white/[0.07]"}`}
                >
                  <BarChart2 size={14} />
                </button>
                {merchantBreakdownOpen && (
                  <div className="absolute left-0 top-full mt-2 bg-[#1e2245] border border-white/[0.1] rounded-xl shadow-lg z-30 w-56 py-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pb-1.5">Merchant breakdown</p>
                    <div className="border-t border-white/[0.07] mb-1" />
                    {repeatMerchants.map((m) => {
                      const Icon = getMerchantIcon(m.displayName);
                      return (
                        <div key={m.displayName} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/[0.05]">
                          <div className="w-6 h-6 rounded-full bg-[#1e2245]/[0.07] flex items-center justify-center shrink-0">
                            <Icon size={12} className="text-slate-400" />
                          </div>
                          <span className="text-xs text-slate-300 flex-1 truncate font-medium">{m.displayName}</span>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-500/20 rounded-full px-1.5 py-0.5 leading-none shrink-0">{m.count}</span>
                        </div>
                      );
                    })}
                    {oneOffCount > 0 && (
                      <>
                        {repeatMerchants.length > 0 && <div className="border-t border-white/[0.07] my-1" />}
                        <div className="flex items-center gap-2.5 px-3 py-1.5 text-slate-400">
                          <div className="w-6 h-6 rounded-full bg-[#14162e] flex items-center justify-center shrink-0">
                            <Receipt size={12} />
                          </div>
                          <span className="text-xs flex-1">{oneOffCount} one-off{oneOffCount !== 1 ? "s" : ""}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={expenseSort}
              onChange={(e) => setExpenseSort(e.target.value as typeof expenseSort)}
              className="text-xs border border-white/[0.1] rounded-md px-2 py-1 text-slate-400 bg-[#14162e] focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
            >
              <option value="date-desc">Newest</option>
              <option value="date-asc">Oldest</option>
              <option value="amount-desc">Highest</option>
              <option value="amount-asc">Lowest</option>
            </select>

            {creditCards.length > 0 && (
              <div className="relative" ref={ccFilterDropRef}>
                <button
                  onClick={() => setCcFilterDropOpen((o) => !o)}
                  className={`flex items-center gap-1 text-xs border rounded-md px-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    cardFilterIds.size > 0
                      ? "border-indigo-400 bg-indigo-500/20 text-indigo-400"
                      : "border-white/[0.1] bg-[#1e2245] text-slate-600 hover:border-white/[0.2]"
                  }`}
                >
                  <CreditCardIcon size={12} />
                  {cardFilterIds.size > 0 ? `${cardFilterIds.size} card${cardFilterIds.size !== 1 ? "s" : ""}` : "All cards"}
                  <ChevronDown size={12} />
                </button>
                {ccFilterDropOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-[#1e2245] border border-white/[0.1] rounded-lg shadow-lg z-20 min-w-[160px] py-1">
                    <button
                      onClick={() => setCardFilterIds(new Set())}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-white/[0.05] font-medium"
                    >
                      Clear filter
                    </button>
                    <div className="border-t border-white/[0.07] my-1" />
                    {[{ id: null as null | number, name: "No card" }, ...creditCards].map((card) => {
                      const isSelected = cardFilterIds.has(card.id);
                      return (
                        <button
                          key={card.id ?? "none"}
                          onClick={() => setCardFilterIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(card.id)) next.delete(card.id); else next.add(card.id);
                            return next;
                          })}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.05]"
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? "bg-indigo-500 border-indigo-500" : "border-white/[0.2]"}`}>
                            {isSelected && <span className="text-white text-[9px] font-bold">✓</span>}
                          </span>
                          {card.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowScanModal(true)}
              className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-500/20 p-1 rounded-md transition-colors"
              aria-label="Scan receipt"
              title="Scan receipt or bill"
            >
              <ScanLine size={20} />
            </button>
            <button
              onClick={openAddExpense}
              className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-500/20 p-1 rounded-md transition-colors"
              aria-label="Add expense"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Category filter pills */}
        {pillCats.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => setCatFilterId("all")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${catFilterId === "all" ? "bg-indigo-500 text-white" : "bg-white/[0.05] text-slate-400 hover:bg-white/[0.1]"}`}
            >
              All
            </button>
            {pillCats.map((cat) => (
              <button
                key={cat.id ?? "uncat"}
                onClick={() => setCatFilterId((prev) => (prev === cat.id ? "all" : cat.id))}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${catFilterId === cat.id ? "bg-indigo-500 text-white" : "bg-white/[0.05] text-slate-400 hover:bg-white/[0.1]"}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div className="bg-[#1e2245] rounded-xl border border-white/[0.1] shadow-sm overflow-hidden">
          {sortedExpenses.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <p className="text-slate-500 text-sm font-medium">
                {cardFilterIds.size > 0 || catFilterId !== "all" ? "No expenses match the selected filters." : "No expenses logged for this month."}
              </p>
              {(cardFilterIds.size > 0 || catFilterId !== "all") && (
                <button onClick={() => { setCardFilterIds(new Set()); setCatFilterId("all"); }} className="mt-2 text-xs text-indigo-500 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : isDateSort ? (
            <div>
              {expenseDateGroups.map((group) => (
                <div key={group.date}>
                  {/* Day header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-[#14162e] border-b border-white/[0.07] sticky top-0 z-10">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{group.label}</span>
                    <span className={`text-xs font-semibold ${group.dayTotal < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                      {group.dayTotal < 0 ? "+" : ""}{formatAmount(Math.abs(group.dayTotal))}
                    </span>
                  </div>
                  {/* Expense rows */}
                  {group.items.map((expense) => {
                    const isReturn = Number(expense.amount) < 0;
                    const catName = getCatName(expense.category_id, expenseCategories);
                    const cardName = getCardDisplayName(expense.credit_card_id);
                    const MerchantIcon = isReturn ? RotateCcw : getMerchantIcon(expense.name);
                    const isHighlighted = highlightId === expense.id && highlightKind === "expense";
                    return (
                      <div key={expense.id} id={`expense-row-${expense.id}`} className={`group flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.05] transition-colors border-b border-white/[0.05] last:border-b-0${isHighlighted ? " highlight-row" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isReturn ? "bg-emerald-500/10" : "bg-[#1e2245]/[0.07]"}`}>
                          <MerchantIcon size={13} className={isReturn ? "text-emerald-500" : "text-slate-400"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-200">{expense.name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {catName && (
                              <span className="text-xs bg-indigo-500/20 text-indigo-600 px-2 py-0.5 rounded-full font-medium shrink-0">{catName}</span>
                            )}
                            {cardName && (
                              <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full font-medium shrink-0 flex items-center gap-1">
                                <CreditCardIcon size={10} />{cardName}
                              </span>
                            )}
                            {expense.notes && (
                              <span className="text-xs text-slate-400 truncate max-w-[200px]">{expense.notes}</span>
                            )}
                          </div>
                          {expense.service_period_start && expense.service_period_end && (
                            <p className="text-xs text-amber-600 font-medium mt-0.5">
                              Service: {formatDate(expense.service_period_start)} – {formatDate(expense.service_period_end)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-bold tabular-nums ${isReturn ? "text-emerald-600" : "text-rose-600"}`}>
                            {isReturn ? "+" : "−"}{formatAmount(Math.abs(Number(expense.amount)))}
                          </span>
                          <RowMenu
                            onEdit={() => openEditExpense(expense)}
                            onDelete={() => setDeleteTarget({ type: "expense", id: expense.id })}
                            onReturn={!isReturn ? () => returnExpense(expense) : undefined}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            /* Amount-sorted flat list */
            <div>
              {sortedExpenses.map((expense) => {
                const isReturn = Number(expense.amount) < 0;
                const catName = getCatName(expense.category_id, expenseCategories);
                const cardName = getCardDisplayName(expense.credit_card_id);
                const MerchantIcon = isReturn ? RotateCcw : getMerchantIcon(expense.name);
                const isHighlighted = highlightId === expense.id && highlightKind === "expense";
                return (
                  <div key={expense.id} id={`expense-row-${expense.id}`} className={`group flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.05] transition-colors border-b border-white/[0.07] last:border-b-0${isHighlighted ? " highlight-row" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isReturn ? "bg-emerald-500/10" : "bg-[#1e2245]/[0.07]"}`}>
                      <MerchantIcon size={13} className={isReturn ? "text-emerald-500" : "text-slate-400"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-200">{expense.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide shrink-0">{formatDate(expense.date)}</span>
                        {catName && (
                          <span className="text-xs bg-indigo-500/20 text-indigo-600 px-2 py-0.5 rounded-full font-medium shrink-0">{catName}</span>
                        )}
                        {cardName && (
                          <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full font-medium shrink-0 flex items-center gap-1">
                            <CreditCardIcon size={10} />{cardName}
                          </span>
                        )}
                        {expense.notes && (
                          <span className="text-xs text-slate-400 truncate max-w-[200px]">{expense.notes}</span>
                        )}
                      </div>
                      {expense.service_period_start && expense.service_period_end && (
                        <p className="text-xs text-amber-600 font-medium mt-0.5">
                          Service: {formatDate(expense.service_period_start)} – {formatDate(expense.service_period_end)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold tabular-nums ${isReturn ? "text-emerald-600" : "text-rose-600"}`}>
                        {isReturn ? "+" : "−"}{formatAmount(Math.abs(Number(expense.amount)))}
                      </span>
                      <RowMenu
                        onEdit={() => openEditExpense(expense)}
                        onDelete={() => setDeleteTarget({ type: "expense", id: expense.id })}
                        onReturn={!isReturn ? () => returnExpense(expense) : undefined}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      </>}

      {/* Credit Card Modal */}
      {showCreditCardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-white">
                {editCreditCard ? "Edit Credit Card" : "Add Credit Card"}
              </h2>
              <button onClick={() => { setShowCreditCardModal(false); setEditCreditCard(null); setCreditCardForm(EMPTY_CC_FORM); }} className="text-slate-400 hover:text-slate-300 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveCreditCard} className="flex flex-col gap-4 p-6">
              {ccSaveError && (
                <div className="text-sm text-red-600 bg-red-500/10 border border-red-200 rounded-lg px-3 py-2">{ccSaveError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Card Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={creditCardForm.name}
                  onChange={(e) => setCreditCardForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Chase Sapphire"
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.entries(CARD_COLOR_MAP).map(([key, hex]) => (
                    <button key={key} type="button" onClick={() => setCreditCardForm((f) => ({ ...f, color: key }))}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${creditCardForm.color === key ? "border-white/[0.5] scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={() => { setShowCreditCardModal(false); setEditCreditCard(null); setCreditCardForm(EMPTY_CC_FORM); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
                  {editCreditCard ? "Save changes" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (() => {
        const closeModal = () => {
          setShowExpenseModal(false);
          setEditExpense(null);
          setExpenseForm(EMPTY_EXPENSE);
          setExpenseSaveError(null);
          setAddingCat(false); setNewCatName(""); setCatDropOpen(false);
          setCardDropOpen(false);
          resetInlineCard();
        };

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 pb-0">
                <h2 className="text-lg font-semibold text-white">{editExpense ? "Edit Expense" : "New Expense"}</h2>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-300 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={saveExpense} className="flex flex-col gap-4 p-6">
                {expenseSaveError && (
                  <div className="text-sm text-red-600 bg-red-500/10 border border-red-200 rounded-lg px-3 py-2">
                    {expenseSaveError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                  <input type="text" required value={expenseForm.name}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Groceries, Uber"
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Amount
                      <span className="text-slate-400 font-normal ml-1 text-xs">(negative = refund)</span>
                    </label>
                    <input type="number" step="0.01" required value={expenseForm.amount}
                      onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
                    <input type="date" required value={expenseForm.date}
                      onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                  </div>
                </div>

                {/* Service period */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Service period
                    <span className="text-slate-400 font-normal ml-1 text-xs">(optional)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">From</label>
                      <input type="date" value={expenseForm.service_period_start}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, service_period_start: e.target.value }))}
                        className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">To</label>
                      <input type="date" value={expenseForm.service_period_end}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, service_period_end: e.target.value }))}
                        className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                    </div>
                  </div>
                </div>

                {/* Category with inline add */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-300">Category</label>
                    {!addingCat && (
                      <button type="button" onClick={() => { setAddingCat(true); setNewCatName(""); setCatDropOpen(false); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 transition-colors">
                        <Plus size={12} /> New
                      </button>
                    )}
                  </div>
                  {addingCat ? (
                    <div className="flex gap-2">
                      <input type="text" autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExpenseCategory(); } if (e.key === "Escape") { setAddingCat(false); setNewCatName(""); } }}
                        placeholder="Category name"
                        className="flex-1 border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                      <button type="button" onClick={addExpenseCategory} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Add</button>
                      <button type="button" onClick={() => { setAddingCat(false); setNewCatName(""); }} className="px-2 py-2 text-slate-400 hover:text-slate-300 transition-colors"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="relative" ref={catDropRef}>
                      <button type="button"
                        onClick={() => setCatDropOpen((o) => !o)}
                        className="w-full flex items-center justify-between border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-left bg-[#14162e] text-slate-200 hover:border-white/[0.2] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                        <span className={expenseForm.category_id ? "text-slate-200" : "text-slate-400"}>
                          {expenseForm.category_id
                            ? (expenseCategories.find((c) => c.id === parseInt(expenseForm.category_id))?.name ?? "None")
                            : "None"}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${catDropOpen ? "rotate-180" : ""}`} />
                      </button>
                      {catDropOpen && (
                        <div className="absolute z-20 w-full bg-[#1e2245] border border-white/[0.1] rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                          <button type="button"
                            onClick={() => { setExpenseForm((f) => ({ ...f, category_id: "" })); setCatDropOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.05]">
                            None
                          </button>
                          {expenseCategories.map((c) => (
                            <div key={c.id} className="flex items-center group/opt">
                              <button type="button"
                                onClick={() => { setExpenseForm((f) => ({ ...f, category_id: String(c.id) })); setCatDropOpen(false); }}
                                className="flex-1 text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05]">
                                {c.name}
                              </button>
                              <button type="button"
                                onClick={() => deleteCategory(c.id)}
                                className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Credit card selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-300">Credit Card</label>
                    {!addingCard && (
                      <button type="button"
                        onClick={() => { setCardDropOpen(false); setAddingCard(true); setNewCardName(""); setNewCardColor("blue"); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 transition-colors">
                        <Plus size={12} /> New
                      </button>
                    )}
                  </div>
                  {addingCard ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={newCardName}
                        onChange={(e) => setNewCardName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); addCardInline(); }
                          if (e.key === "Escape") resetInlineCard();
                        }}
                        placeholder="e.g. Chase Sapphire"
                        className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {Object.entries(CARD_COLOR_MAP).map(([key, hex]) => (
                            <button key={key} type="button" onClick={() => setNewCardColor(key)}
                              className={`w-5 h-5 rounded-full border-2 transition-all ${newCardColor === key ? "border-white/[0.5] scale-110" : "border-transparent"}`}
                              style={{ backgroundColor: hex }} />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => addCardInline()}
                            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                            Add
                          </button>
                          <button type="button" onClick={resetInlineCard}
                            className="px-2 py-1.5 text-slate-400 hover:text-slate-300 transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative" ref={cardDropRef}>
                      <button type="button"
                        onClick={() => setCardDropOpen((o) => !o)}
                        className="w-full flex items-center justify-between border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-left bg-[#14162e] text-slate-200 hover:border-white/[0.2] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                        <span className={expenseForm.credit_card_id ? "text-slate-200" : "text-slate-400"}>
                          {expenseForm.credit_card_id
                            ? (() => { const c = creditCards.find((c) => c.id === parseInt(expenseForm.credit_card_id)); return c ? `${c.name}${c.last_four ? ` ····${c.last_four}` : ""}` : "None"; })()
                            : "None"}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${cardDropOpen ? "rotate-180" : ""}`} />
                      </button>
                      {cardDropOpen && (
                        <div className="absolute z-20 w-full bg-[#1e2245] border border-white/[0.1] rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                          <button type="button"
                            onClick={() => { setExpenseForm((f) => ({ ...f, credit_card_id: "" })); setCardDropOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.05]">
                            None
                          </button>
                          {creditCards.map((c) => (
                            <div key={c.id} className="flex items-center group/opt">
                              <button type="button"
                                onClick={() => { setExpenseForm((f) => ({ ...f, credit_card_id: String(c.id) })); setCardDropOpen(false); }}
                                className="flex-1 text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05]">
                                {c.name}{c.last_four ? ` ····${c.last_four}` : ""}
                              </button>
                              <button type="button"
                                onClick={() => deleteCreditCard(c.id)}
                                className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                  <textarea value={expenseForm.notes}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Optional notes"
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600 resize-none" />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={closeModal}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors">Cancel</button>
                  {!editExpense && (
                    <button
                      type="button"
                      onClick={saveExpenseAndAddAnother}
                      className="px-4 py-2 text-sm border border-white/[0.1] text-slate-300 rounded-lg hover:bg-white/[0.05] transition-colors"
                    >
                      Save & add another
                    </button>
                  )}
                  <button type="submit"
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    {editExpense ? "Save changes" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Utility log price modal */}
      {showUtilLogPriceModal && utilLogPriceTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <DollarSign size={18} className="text-amber-500" />
                Log price change
              </h2>
              <button
                onClick={() => { setShowUtilLogPriceModal(false); setUtilLogPriceTarget(null); }}
                className="text-slate-400 hover:text-slate-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Recording a price change for <span className="font-medium text-slate-300">{utilLogPriceTarget.utility}</span>.
            </p>
            <form onSubmit={saveUtilLogPrice} className="flex flex-col gap-4">
              {utilLogPriceSaveError && (
                <div className="text-sm text-red-600 bg-red-500/10 border border-red-200 rounded-lg px-3 py-2">
                  {utilLogPriceSaveError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">New price</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  autoFocus
                  value={utilLogPriceForm.amount}
                  onChange={(e) => setUtilLogPriceForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Effective from</label>
                <input
                  type="month"
                  required
                  value={utilLogPriceForm.effectiveMonth}
                  onChange={(e) => setUtilLogPriceForm((f) => ({ ...f, effectiveMonth: e.target.value }))}
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
                <p className="text-xs text-slate-400 mt-1">The month from which this new price takes effect.</p>
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setShowUtilLogPriceModal(false); setUtilLogPriceTarget(null); setUtilLogPriceSaveError(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scan modal */}
      {showScanModal && (
        <ScanModal
          onClose={() => setShowScanModal(false)}
          onSave={saveScanResults}
          expenseCategories={expenseCategories}
          creditCards={creditCards}
        />
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4">
              <h2 className="text-lg font-semibold text-white">
                {editTransfer ? "Edit Transfer" : "New Transfer"}
              </h2>
              <button onClick={() => { setShowTransferModal(false); setEditTransfer(null); setTransferForm(EMPTY_TRANSFER); setTransferType(""); resetTransferBankDropState(); setCatDropOpen(false); setAddingCat(false); setNewCatName(""); setPersonDropOpen(false); setAddingPerson(false); setNewPersonName(""); }} className="text-slate-400 hover:text-slate-300 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Type selector */}
            <div className="px-6 pb-4">
              <div className="grid grid-cols-2 gap-2">
                {([
                  { t: "bank" as const, label: "Bank Transfer", icon: <ArrowLeftRight size={15} />, desc: "Move between accounts", active: "border-white/[0.3] bg-[#14162e] text-slate-300" },
                  { t: "in" as const, label: "Money In", icon: <ArrowDownLeft size={15} />, desc: "Received from someone", active: "border-emerald-400 bg-emerald-500/10 text-emerald-400" },
                  { t: "out" as const, label: "Money Out", icon: <ArrowUpRight size={15} />, desc: "Sent to someone", active: "border-red-400 bg-red-500/10 text-red-600" },
                  { t: "cc" as const, label: "CC Payment", icon: <CreditCardIcon size={15} />, desc: "Pay a credit card", active: "border-blue-400 bg-blue-50 text-blue-700" },
                ]).map(({ t, label, icon, desc, active }) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTransferType(t);
                      setTransferSaveError(null);
                      setTransferForm((f) => ({
                        ...f,
                        from_bank_id: t === "in" ? "" : f.from_bank_id,
                        to_bank_id: (t === "out" || t === "cc") ? "" : f.to_bank_id,
                        platform: (t === "bank" || t === "cc") ? "" : f.platform,
                        person: (t === "bank" || t === "cc") ? "" : f.person,
                        credit_card_id: t !== "cc" ? "" : f.credit_card_id,
                      }));
                    }}
                    className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-center transition-colors ${
                      transferType === t ? active : "border-white/[0.1] text-slate-400 hover:border-white/[0.2] hover:text-slate-300"
                    }`}
                  >
                    {icon}
                    <span className="text-xs font-semibold leading-tight">{label}</span>
                    <span className="text-[10px] leading-tight opacity-70">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {transferType !== "" && (
              <form onSubmit={saveTransfer} className="flex flex-col gap-4 px-6 pb-6">
                {transferSaveError && (
                  <div className="text-sm text-red-600 bg-red-500/10 border border-red-200 rounded-lg px-3 py-2">{transferSaveError}</div>
                )}

                {/* Amount + Date row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Amount</label>
                    <input
                      type="number"
                      required
                      autoFocus
                      min="0.01"
                      step="0.01"
                      value={transferForm.amount}
                      onChange={(e) => setTransferForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={transferForm.date}
                      onChange={(e) => setTransferForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                    />
                  </div>
                </div>

                {/* Platform — Money In / Out only */}
                {(transferType === "in" || transferType === "out") && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Platform</label>
                    <div className="flex flex-wrap gap-2">
                      {["Zelle", "Venmo", "Cash"].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTransferForm((f) => ({ ...f, platform: f.platform === p ? "" : p }))}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            transferForm.platform === p
                              ? p === "Cash" ? "bg-amber-500/10 border-amber-300 text-amber-400"
                                : "bg-violet-500/10 border-violet-300 text-violet-600"
                              : "border-white/[0.1] text-slate-500 hover:border-white/[0.2]"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                      <input
                        type="text"
                        value={["Zelle", "Venmo", "Cash"].includes(transferForm.platform) ? "" : transferForm.platform}
                        onChange={(e) => setTransferForm((f) => ({ ...f, platform: e.target.value }))}
                        placeholder="Other…"
                        className="flex-1 min-w-[80px] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                      />
                    </div>
                  </div>
                )}

                {/* Person — Money In / Out only */}
                {(transferType === "in" || transferType === "out") && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      {transferType === "in" ? "Received From" : transferType === "out" ? "Sent To" : <>Paid by <span className="text-xs font-normal text-slate-400">(leave blank if you paid)</span></>}
                    </label>
                    <div className="relative" ref={personDropRef}>
                      <button type="button"
                        onClick={() => { setPersonDropOpen((o) => !o); setAddingPerson(false); setNewPersonName(""); }}
                        className="w-full flex items-center justify-between border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-left bg-[#14162e] text-slate-200 hover:border-white/[0.2] transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                        <span className={transferForm.person ? "text-slate-200" : "text-slate-400"}>
                          {transferForm.person || "Select person…"}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${personDropOpen ? "rotate-180" : ""}`} />
                      </button>
                      {personDropOpen && (
                        <div className="absolute z-20 w-full bg-[#1e2245] border border-white/[0.1] rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                          {transferForm.person && (
                            <button type="button"
                              onClick={() => { setTransferForm((f) => ({ ...f, person: "" })); setPersonDropOpen(false); }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.05]">None</button>
                          )}
                          {knownPeople.length === 0 && !addingPerson && (
                            <p className="px-3 py-2 text-sm text-slate-400">No people yet — add one below.</p>
                          )}
                          {knownPeople.map((p) => (
                            <div key={p.id} className="flex items-center group/opt">
                              <button type="button"
                                onClick={() => { setTransferForm((f) => ({ ...f, person: p.name })); setPersonDropOpen(false); setAddingPerson(false); setNewPersonName(""); }}
                                className={`flex-1 text-left px-3 py-2 text-sm transition-colors ${transferForm.person === p.name ? "bg-violet-500/10 text-violet-400 font-medium" : "text-slate-300 hover:bg-white/[0.05]"}`}>
                                {p.name}
                              </button>
                              <button type="button"
                                onClick={() => { removePerson(p.name); if (transferForm.person === p.name) setTransferForm((f) => ({ ...f, person: "" })); }}
                                className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                          <div className={knownPeople.length > 0 ? "border-t border-white/[0.07] mt-1 pt-1" : ""}>
                            {addingPerson ? (
                              <div className="flex gap-1.5 px-2 py-1.5">
                                <input type="text" autoFocus value={newPersonName}
                                  onChange={(e) => setNewPersonName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const name = newPersonName.trim();
                                      if (name) { addNewPerson().then(() => { setTransferForm((f) => ({ ...f, person: name })); setPersonDropOpen(false); }); }
                                    }
                                    if (e.key === "Escape") { setAddingPerson(false); setNewPersonName(""); }
                                  }}
                                  placeholder="Person name"
                                  className="flex-1 border border-violet-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                                <button type="button"
                                  onClick={() => { const name = newPersonName.trim(); if (name) { addNewPerson().then(() => { setTransferForm((f) => ({ ...f, person: name })); setPersonDropOpen(false); }); } }}
                                  className="px-2.5 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                                <button type="button" onClick={() => { setAddingPerson(false); setNewPersonName(""); }} className="px-1.5 text-slate-400 hover:text-slate-300 transition-colors"><X size={14} /></button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setAddingPerson(true)}
                                className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-violet-600 hover:bg-violet-500/10 transition-colors">
                                <Plus size={13} /> New person
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* From Bank — Bank Transfer + Money Out + CC Payment */}
                {(transferType === "bank" || transferType === "out" || transferType === "cc") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-300">
                        {transferType === "bank" ? "From Account" : "From Account"}
                        {transferType === "out" && <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>}
                      </label>
                      {!addingFromBank && (
                        <button type="button" onClick={() => { setFromBankDropOpen(false); setAddingFromBank(true); setNewFromBankName(""); }}
                          className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-0.5 transition-colors">
                          <Plus size={12} /> New
                        </button>
                      )}
                    </div>
                    {addingFromBank ? (
                      <div className="flex gap-2">
                        <input type="text" autoFocus value={newFromBankName} onChange={(e) => setNewFromBankName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBankInlineFrom(); } if (e.key === "Escape") { setAddingFromBank(false); setNewFromBankName(""); } }}
                          placeholder="Account name"
                          className="flex-1 border border-violet-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                        <button type="button" onClick={addBankInlineFrom} className="px-3 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                        <button type="button" onClick={() => { setAddingFromBank(false); setNewFromBankName(""); }} className="px-2 py-2 text-slate-400 hover:text-slate-300 transition-colors"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="relative" ref={fromBankDropRef}>
                        <button type="button"
                          onClick={() => setFromBankDropOpen((o) => !o)}
                          className="w-full flex items-center justify-between border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-left bg-[#14162e] text-slate-200 hover:border-white/[0.2] transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                          <span className={transferForm.from_bank_id ? "text-slate-200" : "text-slate-400"}>
                            {transferForm.from_bank_id ? bankDisplayName(parseInt(transferForm.from_bank_id)) : "None"}
                          </span>
                          <ChevronDown size={14} className={`text-slate-400 transition-transform ${fromBankDropOpen ? "rotate-180" : ""}`} />
                        </button>
                        {fromBankDropOpen && (
                          <div className="absolute z-20 w-full bg-[#1e2245] border border-white/[0.1] rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                            <button type="button"
                              onClick={() => { setTransferForm((f) => ({ ...f, from_bank_id: "" })); setFromBankDropOpen(false); }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.05]">None</button>
                            {banks.map((b) => (
                              <div key={b.id} className="flex items-center group/opt">
                                <button type="button"
                                  onClick={() => { setTransferForm((f) => ({ ...f, from_bank_id: String(b.id) })); setFromBankDropOpen(false); }}
                                  className={`flex-1 text-left px-3 py-2 text-sm transition-colors ${transferForm.from_bank_id === String(b.id) ? "bg-violet-500/10 text-violet-400 font-medium" : "text-slate-300 hover:bg-white/[0.05]"}`}>
                                  {bankDisplayName(b.id)}
                                </button>
                                <button type="button" onClick={() => deleteBank(b.id)}
                                  className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors"><X size={13} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* To Bank — Bank Transfer + Money In */}
                {(transferType === "bank" || transferType === "in") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-300">
                        {transferType === "bank" ? "To Account" : "To Account"}
                        {transferType === "in" && <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>}
                      </label>
                      {!addingToBank && (
                        <button type="button" onClick={() => { setToBankDropOpen(false); setAddingToBank(true); setNewToBankName(""); }}
                          className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-0.5 transition-colors">
                          <Plus size={12} /> New
                        </button>
                      )}
                    </div>
                    {addingToBank ? (
                      <div className="flex gap-2">
                        <input type="text" autoFocus value={newToBankName} onChange={(e) => setNewToBankName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBankInlineTo(); } if (e.key === "Escape") { setAddingToBank(false); setNewToBankName(""); } }}
                          placeholder="Account name"
                          className="flex-1 border border-violet-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                        <button type="button" onClick={addBankInlineTo} className="px-3 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                        <button type="button" onClick={() => { setAddingToBank(false); setNewToBankName(""); }} className="px-2 py-2 text-slate-400 hover:text-slate-300 transition-colors"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="relative" ref={toBankDropRef}>
                        <button type="button"
                          onClick={() => setToBankDropOpen((o) => !o)}
                          className="w-full flex items-center justify-between border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-left bg-[#14162e] text-slate-200 hover:border-white/[0.2] transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                          <span className={transferForm.to_bank_id ? "text-slate-200" : "text-slate-400"}>
                            {transferForm.to_bank_id ? bankDisplayName(parseInt(transferForm.to_bank_id)) : "None"}
                          </span>
                          <ChevronDown size={14} className={`text-slate-400 transition-transform ${toBankDropOpen ? "rotate-180" : ""}`} />
                        </button>
                        {toBankDropOpen && (
                          <div className="absolute z-20 w-full bg-[#1e2245] border border-white/[0.1] rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                            <button type="button"
                              onClick={() => { setTransferForm((f) => ({ ...f, to_bank_id: "" })); setToBankDropOpen(false); }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.05]">None</button>
                            {banks.map((b) => (
                              <div key={b.id} className="flex items-center group/opt">
                                <button type="button"
                                  onClick={() => { setTransferForm((f) => ({ ...f, to_bank_id: String(b.id) })); setToBankDropOpen(false); }}
                                  className={`flex-1 text-left px-3 py-2 text-sm transition-colors ${transferForm.to_bank_id === String(b.id) ? "bg-violet-500/10 text-violet-400 font-medium" : "text-slate-300 hover:bg-white/[0.05]"}`}>
                                  {bankDisplayName(b.id)}
                                </button>
                                <button type="button" onClick={() => deleteBank(b.id)}
                                  className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors"><X size={13} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Credit Card — CC Payment only */}
                {transferType === "cc" && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-300">Credit Card <span className="text-xs font-normal text-slate-400">(optional)</span></label>
                      {!addingCard && (
                        <button type="button"
                          onClick={() => { setCardDropOpen(false); setAddingCard(true); setNewCardName(""); setNewCardColor("blue"); }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5 transition-colors">
                          <Plus size={12} /> New
                        </button>
                      )}
                    </div>
                    {addingCard ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={newCardName}
                          onChange={(e) => setNewCardName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); addCardInline(); }
                            if (e.key === "Escape") resetInlineCard();
                          }}
                          placeholder="e.g. Discover it"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {Object.entries(CARD_COLOR_MAP).map(([key, hex]) => (
                              <button key={key} type="button" onClick={() => setNewCardColor(key)}
                                className={`w-5 h-5 rounded-full border-2 transition-all ${newCardColor === key ? "border-white/[0.5] scale-110" : "border-transparent"}`}
                                style={{ backgroundColor: hex }} />
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => addCardInline()}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Add</button>
                            <button type="button" onClick={resetInlineCard}
                              className="px-2 py-1.5 text-slate-400 hover:text-slate-300 transition-colors"><X size={16} /></button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative" ref={cardDropRef}>
                        <button type="button"
                          onClick={() => setCardDropOpen((o) => !o)}
                          className="w-full flex items-center justify-between border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-left bg-[#14162e] text-slate-200 hover:border-white/[0.2] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                          <span className={transferForm.credit_card_id ? "text-slate-200" : "text-slate-400"}>
                            {transferForm.credit_card_id
                              ? (() => { const c = creditCards.find((c) => c.id === parseInt(transferForm.credit_card_id)); return c ? `${c.name}${c.last_four ? ` ····${c.last_four}` : ""}` : "None"; })()
                              : "None"}
                          </span>
                          <ChevronDown size={14} className={`text-slate-400 transition-transform ${cardDropOpen ? "rotate-180" : ""}`} />
                        </button>
                        {cardDropOpen && (
                          <div className="absolute z-20 w-full bg-[#1e2245] border border-white/[0.1] rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                            <button type="button"
                              onClick={() => { setTransferForm((f) => ({ ...f, credit_card_id: "" })); setCardDropOpen(false); }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.05]">None</button>
                            {creditCards.map((c) => (
                              <div key={c.id} className="flex items-center group/opt">
                                <button type="button"
                                  onClick={() => { setTransferForm((f) => ({ ...f, credit_card_id: String(c.id) })); setCardDropOpen(false); }}
                                  className={`flex-1 text-left px-3 py-2 text-sm transition-colors ${transferForm.credit_card_id === String(c.id) ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-300 hover:bg-white/[0.05]"}`}>
                                  {c.name}{c.last_four ? ` ····${c.last_four}` : ""}
                                </button>
                                <button type="button"
                                  onClick={() => deleteCreditCard(c.id)}
                                  className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors"><X size={13} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Category — Money In / Out only */}
                {(transferType === "in" || transferType === "out") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-300">Category <span className="text-xs font-normal text-slate-400">(optional)</span></label>
                      {!addingCat && (
                        <button type="button" onClick={() => { setAddingCat(true); setNewCatName(""); setCatDropOpen(false); }}
                          className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-0.5 transition-colors">
                          <Plus size={12} /> New
                        </button>
                      )}
                    </div>
                    {addingCat ? (
                      <div className="flex gap-2">
                        <input type="text" autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTransferCategory(); } if (e.key === "Escape") { setAddingCat(false); setNewCatName(""); } }}
                          placeholder="Category name"
                          className="flex-1 border border-violet-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                        <button type="button" onClick={addTransferCategory} className="px-3 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                        <button type="button" onClick={() => { setAddingCat(false); setNewCatName(""); }} className="px-2 py-2 text-slate-400 hover:text-slate-300 transition-colors"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="relative" ref={catDropRef}>
                        <button type="button"
                          onClick={() => setCatDropOpen((o) => !o)}
                          className="w-full flex items-center justify-between border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-left bg-[#14162e] text-slate-200 hover:border-white/[0.2] transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                          <span className={transferForm.category_id ? "text-slate-200" : "text-slate-400"}>
                            {transferForm.category_id ? (expenseCategories.find((c) => c.id === parseInt(transferForm.category_id))?.name ?? "None") : "None"}
                          </span>
                          <ChevronDown size={14} className={`text-slate-400 transition-transform ${catDropOpen ? "rotate-180" : ""}`} />
                        </button>
                        {catDropOpen && (
                          <div className="absolute z-20 w-full bg-[#1e2245] border border-white/[0.1] rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                            <button type="button"
                              onClick={() => { setTransferForm((f) => ({ ...f, category_id: "" })); setCatDropOpen(false); }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.05]">None</button>
                            {expenseCategories.map((c) => (
                              <div key={c.id} className="flex items-center group/opt">
                                <button type="button"
                                  onClick={() => { setTransferForm((f) => ({ ...f, category_id: String(c.id) })); setCatDropOpen(false); }}
                                  className="flex-1 text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05]">{c.name}</button>
                                <button type="button" onClick={() => deleteCategory(c.id)}
                                  className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors"><X size={13} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Name / label — optional, collapsed */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Label <span className="text-xs font-normal text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    value={transferForm.name}
                    onChange={(e) => setTransferForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={transferType === "bank" ? "e.g. Savings top-up" : "e.g. Rent split, Utilities"}
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Notes <span className="text-xs font-normal text-slate-400">(optional)</span></label>
                  <textarea
                    rows={2}
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Any extra details…"
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600 resize-none"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => { setShowTransferModal(false); setEditTransfer(null); setTransferForm(EMPTY_TRANSFER); setTransferType(""); resetTransferBankDropState(); setCatDropOpen(false); setAddingCat(false); setNewCatName(""); setPersonDropOpen(false); setAddingPerson(false); setNewPersonName(""); }}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors">Cancel</button>
                  {!editTransfer && (
                    <button type="button" onClick={saveTransferAndAddAnother}
                      className="px-4 py-2 text-sm border border-white/[0.1] text-slate-300 rounded-lg hover:bg-white/[0.05] transition-colors">
                      Save & add another
                    </button>
                  )}
                  <button type="submit" className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                    {editTransfer ? "Save changes" : "Add transfer"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Bill Modal */}
      {showBillModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-white">{editBill ? "Edit Utility Bill" : "New Utility Bill"}</h2>
              <button onClick={() => { setShowBillModal(false); setEditBill(null); setBillForm(EMPTY_BILL); setBillSplitPeople([]); }} className="text-slate-400 hover:text-slate-300 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={saveBill} className="flex flex-col gap-4 p-6">
              {billSaveError && <div className="text-sm text-red-600 bg-red-500/10 border border-red-200 rounded-lg px-3 py-2">{billSaveError}</div>}

              {/* Utility name + type toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Utility</label>
                <input list="utility-names" type="text" required autoFocus value={billForm.utility}
                  onChange={(e) => setBillForm((f) => ({ ...f, utility: e.target.value }))}
                  placeholder="Electric, Water, Internet…"
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                <datalist id="utility-names">{UTILITY_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
              </div>

              {/* Recurring toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Bill type</label>
                <div className="flex gap-2">
                  {[{ value: false, label: "One-time" }, { value: true, label: "Recurring" }].map(({ value, label }) => (
                    <button key={String(value)} type="button"
                      onClick={() => setBillForm((f) => ({ ...f, is_recurring: value }))}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${billForm.is_recurring === value ? "bg-amber-500/10 border-amber-400 text-amber-400" : "border-white/[0.1] text-slate-500 hover:border-white/[0.2]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* One-time: service period + charge date */}
              {!billForm.is_recurring && (<>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Service Period</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">From</label>
                      <input type="date" required={!billForm.is_recurring} value={billForm.service_period_start}
                        onChange={(e) => setBillForm((f) => ({ ...f, service_period_start: e.target.value }))}
                        className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">To</label>
                      <input type="date" required={!billForm.is_recurring} value={billForm.service_period_end}
                        onChange={(e) => setBillForm((f) => ({ ...f, service_period_end: e.target.value }))}
                        className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Charge Date</label>
                    <input type="date" required={!billForm.is_recurring} value={billForm.charge_date}
                      onChange={(e) => setBillForm((f) => ({ ...f, charge_date: e.target.value }))}
                      className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Amount</label>
                    <input type="number" required min="0.01" step="0.01" value={billForm.amount}
                      onChange={(e) => setBillForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                  </div>
                </div>
              </>)}

              {/* Recurring: billing start + charge day + amount */}
              {billForm.is_recurring && (<>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Billing start</label>
                    <input type="month" required={billForm.is_recurring} value={billForm.billing_start}
                      onChange={(e) => setBillForm((f) => ({ ...f, billing_start: e.target.value }))}
                      className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Charge day</label>
                    <input type="number" required={billForm.is_recurring} min="1" max="31" value={billForm.charge_day}
                      onChange={(e) => setBillForm((f) => ({ ...f, charge_day: e.target.value }))}
                      placeholder="e.g. 15"
                      className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Monthly amount
                    <span className="text-slate-400 font-normal ml-1 text-xs">— use Log price to record increases</span>
                  </label>
                  <input type="number" required min="0.01" step="0.01" value={billForm.amount}
                    onChange={(e) => setBillForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                </div>
                {/* Price history display when editing */}
                {editBill && editBill.price_history.length > 0 && (
                  <div className="bg-[#14162e] rounded-lg px-3 py-2 space-y-1">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Price history</p>
                    {[...editBill.price_history]
                      .filter((h) => h.effective_from !== "2000-01-01")
                      .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
                      .map((h) => (
                        <div key={h.id} className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {new Date(h.effective_from + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </span>
                          <span className="text-xs font-medium text-slate-300">{formatAmount(Number(h.amount))}/mo</span>
                        </div>
                      ))}
                  </div>
                )}
              </>)}

              {/* Split with */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  Split with
                </label>
                <div className="relative" ref={billSplitDropRef}>
                  <button type="button"
                    onClick={() => { setBillSplitDropOpen((o) => !o); setAddingPerson(false); setNewPersonName(""); }}
                    className="w-full flex items-center justify-between border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-left bg-[#14162e] text-slate-200 hover:border-white/[0.2] transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50">
                    <span className={billSplitPeople.length ? "text-slate-200" : "text-slate-400"}>
                      {billSplitPeople.length ? billSplitPeople.join(", ") : "Select roommates…"}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${billSplitDropOpen ? "rotate-180" : ""}`} />
                  </button>
                  {billSplitDropOpen && (
                    <div className="absolute z-20 w-full bg-[#1e2245] border border-white/[0.1] rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                      {knownPeople.length === 0 && !addingPerson && (
                        <p className="px-3 py-2 text-sm text-slate-400">No people yet — add one below.</p>
                      )}
                      {knownPeople.map((p) => {
                        const selected = billSplitPeople.includes(p.name);
                        return (
                          <div key={p.id} className="flex items-center group/opt">
                            <button type="button"
                              onClick={() => setBillSplitPeople((prev) => selected ? prev.filter((n) => n !== p.name) : [...prev, p.name])}
                              className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${selected ? "bg-amber-500/10/60 text-amber-400 font-medium hover:bg-amber-500/10" : "text-slate-300 hover:bg-white/[0.05]"}`}>
                              <span className="w-3.5 shrink-0 flex items-center">
                                {selected && <CheckCircle2 size={13} className="text-amber-500" />}
                              </span>
                              {p.name}
                            </button>
                            <button type="button"
                              onClick={() => { removePerson(p.name); setBillSplitPeople((prev) => prev.filter((n) => n !== p.name)); }}
                              className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                      <div className={knownPeople.length > 0 ? "border-t border-white/[0.07] mt-1 pt-1" : ""}>
                        {addingPerson ? (
                          <div className="flex gap-1.5 px-2 py-1.5">
                            <input type="text" autoFocus value={newPersonName}
                              onChange={(e) => setNewPersonName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewPerson(); } if (e.key === "Escape") { setAddingPerson(false); setNewPersonName(""); } }}
                              placeholder="Person name"
                              className="flex-1 border border-amber-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600" />
                            <button type="button" onClick={addNewPerson} className="px-2.5 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">Add</button>
                            <button type="button" onClick={() => { setAddingPerson(false); setNewPersonName(""); }} className="px-1.5 text-slate-400 hover:text-slate-300 transition-colors"><X size={14} /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setAddingPerson(true)}
                            className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-amber-600 hover:bg-amber-500/10 transition-colors">
                            <Plus size={13} /> New person
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {billSplitPeople.length > 0 && (() => {
                  const total = parseFloat(billForm.amount) || 0;
                  const per = total > 0 ? total / (billSplitPeople.length + 1) : 0;
                  return per > 0 ? (
                    <p className="text-xs text-amber-600 font-medium bg-amber-500/10 rounded-md px-3 py-2 mt-2">
                      Split with {billSplitPeople.join(", ")} · {formatAmount(per)} each
                    </p>
                  ) : null;
                })()}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                <textarea rows={2} value={billForm.notes}
                  onChange={(e) => setBillForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes"
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600 resize-none" />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setShowBillModal(false); setEditBill(null); setBillForm(EMPTY_BILL); setBillSplitPeople([]); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
                  {editBill ? "Save changes" : "Add bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Modal */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-white">
                {editStock ? "Edit Holding" : "Add Stock"}
              </h2>
              <button onClick={() => { setShowStockModal(false); setEditStock(null); }} className="text-slate-400 hover:text-slate-300 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveStock} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Ticker Symbol *</label>
                  <input
                    type="text"
                    required
                    value={stockForm.ticker}
                    onChange={(e) => setStockForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                    placeholder="e.g. AAPL"
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Company Name (optional)</label>
                  <input
                    type="text"
                    value={stockForm.company_name}
                    onChange={(e) => setStockForm((f) => ({ ...f, company_name: e.target.value }))}
                    placeholder="e.g. Apple Inc."
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                  />
                </div>
              </div>

              {!editStock ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Shares *</label>
                      <input
                        type="number" step="0.000001" min="0" required
                        value={stockForm.shares}
                        onChange={(e) => setStockForm((f) => ({ ...f, shares: e.target.value }))}
                        placeholder="e.g. 10"
                        className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Buy Price (per share) *</label>
                      <input
                        type="number" step="0.0001" min="0" required
                        value={stockForm.buy_price}
                        onChange={(e) => setStockForm((f) => ({ ...f, buy_price: e.target.value }))}
                        placeholder="0.00"
                        className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Purchase Date (optional)</label>
                    <input
                      type="date"
                      value={stockForm.purchased_at}
                      onChange={(e) => setStockForm((f) => ({ ...f, purchased_at: e.target.value }))}
                      className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                    />
                  </div>
                </>
              ) : (() => {
                const activeLots = editStock.lots.filter((l) => l.sold_price == null);
                if (activeLots.length === 1) {
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1">Shares</label>
                          <input
                            type="number" step="0.000001" min="0"
                            value={stockForm.shares}
                            onChange={(e) => setStockForm((f) => ({ ...f, shares: e.target.value }))}
                            className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1">Buy Price (per share)</label>
                          <input
                            type="number" step="0.0001" min="0"
                            value={stockForm.buy_price}
                            onChange={(e) => setStockForm((f) => ({ ...f, buy_price: e.target.value }))}
                            className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Purchase Date (optional)</label>
                        <input
                          type="date"
                          value={stockForm.purchased_at}
                          onChange={(e) => setStockForm((f) => ({ ...f, purchased_at: e.target.value }))}
                          className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                        />
                      </div>
                    </>
                  );
                }
                return (
                  <p className="text-xs text-slate-400 bg-[#14162e] rounded-lg px-3 py-2">
                    This holding has {activeLots.length} active lots. Expand the row in the table to edit shares and buy price per lot.
                  </p>
                );
              })()}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={stockForm.notes}
                  onChange={(e) => setStockForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600 resize-none"
                />
              </div>

              {stockSaveError && <p className="text-sm text-red-500">{stockSaveError}</p>}

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setShowStockModal(false); setEditStock(null); setStockForm({ ticker: "", company_name: "", shares: "", buy_price: "", purchased_at: "", notes: "" }); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  {editStock ? "Save changes" : "Add stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sell Lots Modal */}
      {showSellModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-white">Record Sale</h2>
              <button onClick={() => setShowSellModal(false)} className="text-slate-400 hover:text-slate-300 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-slate-500">
                Selling {selectedLotIds.size} lot{selectedLotIds.size !== 1 ? "s" : ""}. Enter the price you sold at (per share).
              </p>
              {sellSaveError && (
                <div className="text-sm text-red-600 bg-red-500/10 border border-red-200 rounded-lg px-3 py-2">{sellSaveError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Sell Price (per share) *</label>
                <input
                  type="number" step="0.0001" min="0" required autoFocus
                  value={sellForm.sold_price}
                  onChange={(e) => setSellForm((f) => ({ ...f, sold_price: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Sale Date (optional)</label>
                <input
                  type="date"
                  value={sellForm.sold_at}
                  onChange={(e) => setSellForm((f) => ({ ...f, sold_at: e.target.value }))}
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setShowSellModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors">Cancel</button>
                <button
                  type="button"
                  disabled={!sellForm.sold_price}
                  onClick={sellSelectedLots}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dividend Modal */}
      {showDividendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-white">
                {editingDividend ? "Edit Dividend" : "Log Dividend"}
              </h2>
              <button onClick={() => { setShowDividendModal(false); setEditingDividend(null); }} className="text-slate-400 hover:text-slate-300 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {dividendModalError && (
                <div className="text-sm text-red-600 bg-red-500/10 border border-red-200 rounded-lg px-3 py-2">{dividendModalError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Shares Held *</label>
                  <input
                    type="number" step="0.000001" min="0" required autoFocus
                    value={dividendModalForm.shares_held}
                    onChange={(e) => setDividendModalForm((f) => ({ ...f, shares_held: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">$/Share *</label>
                  <input
                    type="number" step="0.000001" min="0" required
                    value={dividendModalForm.dividend_per_share}
                    onChange={(e) => setDividendModalForm((f) => ({ ...f, dividend_per_share: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Pay Date *</label>
                  <input
                    type="date" required
                    value={dividendModalForm.paid_at}
                    onChange={(e) => setDividendModalForm((f) => ({ ...f, paid_at: e.target.value }))}
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Total</label>
                  <div className="w-full border border-white/[0.07] bg-[#14162e] rounded-lg px-3 py-2 text-sm text-amber-600 font-semibold">
                    {dividendModalForm.dividend_per_share && dividendModalForm.shares_held
                      ? formatAmount(parseFloat(dividendModalForm.dividend_per_share) * parseFloat(dividendModalForm.shares_held))
                      : <span className="text-slate-300">—</span>}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={dividendModalForm.notes}
                  onChange={(e) => setDividendModalForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Q3 2025 dividend"
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="dividend-reinvested"
                  checked={dividendModalForm.reinvested}
                  onChange={(e) => setDividendModalForm((f) => ({ ...f, reinvested: e.target.checked }))}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span className="text-sm text-slate-300">Reinvested (DRIP)</span>
              </label>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setShowDividendModal(false); setEditingDividend(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors">Cancel</button>
                <button
                  type="button"
                  disabled={!dividendModalForm.paid_at || !dividendModalForm.dividend_per_share || !dividendModalForm.shares_held}
                  onClick={saveDividendModal}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editingDividend ? "Save changes" : "Log dividend"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loan Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-white">
                {editLoan ? "Edit Loan" : "Add Loan"}
              </h2>
              <button onClick={() => { setShowLoanModal(false); setEditLoan(null); setLoanForm(EMPTY_LOAN); }} className="text-slate-400 hover:text-slate-300 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveLoan} className="flex flex-col gap-4 p-6">
              {loanSaveError && (
                <div className="text-sm text-red-600 bg-red-500/10 border border-red-200 rounded-lg px-3 py-2">{loanSaveError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Loan Name / Provider</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={loanForm.name}
                  onChange={(e) => setLoanForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Subsidized Loan 1"
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Disbursement Date</label>
                <input
                  type="date"
                  required
                  value={loanForm.disbursement_date}
                  onChange={(e) => setLoanForm((f) => ({ ...f, disbursement_date: e.target.value }))}
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Original Principal ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={loanForm.original_principal}
                    onChange={(e) => setLoanForm((f) => ({ ...f, original_principal: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={loanForm.interest_rate}
                    onChange={(e) => setLoanForm((f) => ({ ...f, interest_rate: e.target.value }))}
                    placeholder="e.g. 4.5"
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Unpaid Principal ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={loanForm.unpaid_principal}
                    onChange={(e) => setLoanForm((f) => ({ ...f, unpaid_principal: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Unpaid Interest ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={loanForm.unpaid_interest}
                    onChange={(e) => setLoanForm((f) => ({ ...f, unpaid_interest: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Total Interest Paid to Date ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={loanForm.total_interest_paid}
                  onChange={(e) => setLoanForm((f) => ({ ...f, total_interest_paid: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={loanForm.notes}
                  onChange={(e) => setLoanForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setShowLoanModal(false); setEditLoan(null); setLoanForm(EMPTY_LOAN); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  {editLoan ? "Save changes" : "Add loan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Account Modal */}
      {showBankModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-white">
                {editingBank ? "Edit Account" : `New ${bankModalForm.account_type === "savings" ? "Savings" : "Checking"} Account`}
              </h2>
              <button onClick={() => { setShowBankModal(false); setEditingBank(null); }} className="text-slate-400 hover:text-slate-300 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={saveBankAccount} className="flex flex-col gap-4 p-6">
              {bankModalError && <div className="text-sm text-red-600 bg-red-500/10 border border-red-200 rounded-lg px-3 py-2">{bankModalError}</div>}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Bank Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={bankModalForm.name}
                  onChange={(e) => setBankModalForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Chase, Wells Fargo, Marcus"
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Account Type</label>
                <div className="flex gap-2">
                  {(["checking", "savings"] as const).map((type) => (
                    <button key={type} type="button"
                      onClick={() => setBankModalForm((f) => ({ ...f, account_type: type }))}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors capitalize ${bankModalForm.account_type === type ? "bg-violet-500/10 border-violet-300 text-violet-400" : "border-white/[0.1] text-slate-500 hover:border-white/[0.2]"}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Starting Balance</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bankModalForm.starting_balance}
                  onChange={(e) => setBankModalForm((f) => ({ ...f, starting_balance: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Balance As Of</label>
                <input
                  type="date"
                  value={bankModalForm.starting_balance_as_of}
                  onChange={(e) => setBankModalForm((f) => ({ ...f, starting_balance_as_of: e.target.value }))}
                  className="w-full border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 bg-[#14162e] text-slate-200 placeholder-slate-600"
                />
                <p className="text-xs text-slate-400 mt-1">All transfers from this date onward will update the balance.</p>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setShowBankModal(false); setEditingBank(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                  {editingBank ? "Save changes" : "Add account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-white mb-1">
              Delete {deleteTarget.type}?
            </h2>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this entry.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-white transition-colors">Cancel</button>
              <button onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
