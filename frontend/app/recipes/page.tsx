"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, Star, Pencil, Trash2, X, Clock, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Recipe } from "@/lib/types";

function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// Parse markdown list into plain text items
function parseListItems(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.replace(/^[\s]*[-*\d.]+[\s.)]?\s*/, "").trim())
    .filter(Boolean);
}

// Auto-bullet on Enter in the ingredients textarea.
// Always adds "- " on the next line. Shift+Enter for a plain newline.
// Pressing Enter on an empty "- " line ends the list.
function handleBulletKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (v: string) => void
) {
  if (e.key !== "Enter" || e.shiftKey) return;

  const textarea = e.currentTarget;
  const pos = textarea.selectionStart ?? 0;
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  const currentLine = value.substring(lineStart, pos);

  // Empty line → plain newline (no auto-bullet when nothing typed yet)
  if (currentLine.trim() === "") return;

  e.preventDefault();

  // Empty bullet "- " → remove it and end the list
  if (currentLine === "- ") {
    const newVal = value.substring(0, lineStart) + value.substring(pos);
    onChange(newVal);
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = lineStart;
    });
    return;
  }

  const insert = "\n- ";
  const newVal = value.substring(0, pos) + insert + value.substring(pos);
  onChange(newVal);
  requestAnimationFrame(() => {
    textarea.selectionStart = textarea.selectionEnd = pos + insert.length;
  });
}

// Auto-number on Enter in the instructions textarea.
// Always adds "N+1. " on the next line. Shift+Enter for a plain newline.
// Pressing Enter on an empty numbered line ends the list.
function handleNumberedKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (v: string) => void
) {
  if (e.key !== "Enter" || e.shiftKey) return;

  const textarea = e.currentTarget;
  const pos = textarea.selectionStart ?? 0;
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  const currentLine = value.substring(lineStart, pos);

  // Empty line → plain newline
  if (currentLine.trim() === "") return;

  e.preventDefault();

  const numMatch = currentLine.match(/^(\d+)\. /);

  if (numMatch) {
    const currentNum = parseInt(numMatch[1]);
    // Empty numbered line → end the list
    if (currentLine === `${currentNum}. `) {
      const newVal = value.substring(0, lineStart) + value.substring(pos);
      onChange(newVal);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = lineStart;
      });
      return;
    }
    const insert = `\n${currentNum + 1}. `;
    const newVal = value.substring(0, pos) + insert + value.substring(pos);
    onChange(newVal);
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = pos + insert.length;
    });
  } else {
    // Not yet in a numbered list — start one on the next line
    const insert = "\n1. ";
    const newVal = value.substring(0, pos) + insert + value.substring(pos);
    onChange(newVal);
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = pos + insert.length;
    });
  }
}

const EMPTY_FORM = {
  title: "",
  source_url: "",
  ingredients: "",
  steps: "",
  cook_time: "",
  category: "",
};

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [catFilter, setCatFilter] = useState<string>("all");
  const [favOnly, setFavOnly] = useState(false);

  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    fetchRecipes();
  }, []);

  async function fetchRecipes() {
    const data = await apiFetch("/recipes");
    setRecipes(data);
  }

  // Derived
  const categories = [...new Set(recipes.map((r) => r.category).filter(Boolean))] as string[];

  const filtered = recipes.filter((r) => {
    if (favOnly && !r.is_favorite) return false;
    if (catFilter !== "all" && r.category !== catFilter) return false;
    return true;
  });

  function syncRecipe(updated: Recipe) {
    setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (viewRecipe?.id === updated.id) setViewRecipe(updated);
  }

  // ---- Favorite toggle ----
  async function toggleFavorite(id: number, e?: React.MouseEvent) {
    e?.stopPropagation();
    const updated = await apiFetch(`/recipes/${id}/favorite`, { method: "PATCH" });
    syncRecipe(updated);
  }

  // ---- CRUD ----
  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setShowAddModal(true);
  }

  function openEdit(recipe: Recipe, e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditRecipe(recipe);
    setForm({
      title: recipe.title,
      source_url: recipe.source_url ?? "",
      ingredients: recipe.ingredients ?? "",
      steps: recipe.steps ?? "",
      cook_time: recipe.cook_time ?? "",
      category: recipe.category ?? "",
    });
  }

  function closeForm() {
    setShowAddModal(false);
    setEditRecipe(null);
    setForm(EMPTY_FORM);
  }

  async function saveRecipe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = {
      title: form.title,
      source_url: form.source_url || null,
      ingredients: form.ingredients || null,
      steps: form.steps || null,
      cook_time: form.cook_time || null,
      category: form.category || null,
    };

    if (editRecipe) {
      const updated = await apiFetch(`/recipes/${editRecipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      syncRecipe(updated);
    } else {
      const created = await apiFetch("/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setRecipes((prev) => [created, ...prev]);
    }
    closeForm();
  }

  async function confirmDelete() {
    if (deleteId === null) return;
    await apiFetch(`/recipes/${deleteId}`, { method: "DELETE" });
    setRecipes((prev) => prev.filter((r) => r.id !== deleteId));
    if (viewRecipe?.id === deleteId) setViewRecipe(null);
    setDeleteId(null);
  }

  const catDatalistId = "recipe-categories";

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recipes</h1>
          <p className="text-sm text-slate-400 mt-0.5">{todayLabel}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add Recipe
        </button>
      </div>

      {/* Category + favorites filter */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <button
          onClick={() => { setCatFilter("all"); setFavOnly(false); }}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            catFilter === "all" && !favOnly
              ? "bg-indigo-600 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          All
        </button>
        <button
          onClick={() => { setCatFilter("all"); setFavOnly(true); }}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1 ${
            favOnly
              ? "bg-amber-500 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Star size={11} className={favOnly ? "fill-white" : ""} />
          Favorites
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => { setCatFilter(catFilter === cat ? "all" : cat); setFavOnly(false); }}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              catFilter === cat && !favOnly
                ? "bg-indigo-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 text-sm mb-2">
            {recipes.length === 0
              ? "No recipes yet. Add one manually or paste a recipe URL."
              : "No recipes match this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((recipe) => {
            const ingredientItems = parseListItems(recipe.ingredients);
            const showCount = 4;
            const overflowCount = ingredientItems.length - showCount;

            return (
              <div
                key={recipe.id}
                onClick={() => setViewRecipe(recipe)}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-indigo-100 transition-all group relative flex flex-col gap-2"
              >
                {/* Star */}
                <button
                  onClick={(e) => toggleFavorite(recipe.id, e)}
                  className={`absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                    recipe.is_favorite
                      ? "text-amber-500"
                      : "text-slate-300 hover:text-amber-400 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <Star size={15} className={recipe.is_favorite ? "fill-amber-400" : ""} />
                </button>

                {/* Title */}
                <h3 className="text-sm font-semibold text-slate-900 leading-snug pr-8">{recipe.title}</h3>

                {/* Ingredients preview */}
                {ingredientItems.length > 0 && (
                  <ul className="flex flex-col gap-0.5 mt-1">
                    {ingredientItems.slice(0, showCount).map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 flex-shrink-0" />
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                    {overflowCount > 0 && (
                      <li className="text-xs text-slate-400 pl-2.5">+{overflowCount} more</li>
                    )}
                  </ul>
                )}

                {/* Meta */}
                <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
                  {recipe.cook_time && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock size={11} />
                      {recipe.cook_time}
                    </span>
                  )}
                  {recipe.category && (
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                      {recipe.category}
                    </span>
                  )}
                </div>

                {/* Edit / Delete on hover */}
                <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(recipe, e); setShowAddModal(true); }}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteId(recipe.id); }}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recipe View Modal */}
      {viewRecipe && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100 gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-900 leading-snug">{viewRecipe.title}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {viewRecipe.cook_time && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock size={11} /> {viewRecipe.cook_time}
                    </span>
                  )}
                  {viewRecipe.category && (
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                      {viewRecipe.category}
                    </span>
                  )}
                  {viewRecipe.source_url && (
                    <a
                      href={viewRecipe.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"
                    >
                      <ExternalLink size={11} /> Source
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleFavorite(viewRecipe.id)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    viewRecipe.is_favorite
                      ? "text-amber-500 bg-amber-50"
                      : "text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                  }`}
                >
                  <Star size={16} className={viewRecipe.is_favorite ? "fill-amber-400" : ""} />
                </button>
                <button
                  onClick={() => { openEdit(viewRecipe); setViewRecipe(null); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setViewRecipe(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-6">
              {viewRecipe.ingredients && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
                    Ingredients
                  </h3>
                  <MarkdownBody content={viewRecipe.ingredients} />
                </div>
              )}
              {viewRecipe.steps && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
                    Instructions
                  </h3>
                  <MarkdownBody content={viewRecipe.steps} />
                </div>
              )}
              {!viewRecipe.ingredients && !viewRecipe.steps && (
                <p className="text-slate-400 text-sm italic">No content yet.</p>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Add / Edit Modal */}
      {(showAddModal || editRecipe !== null) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {editRecipe ? "Edit Recipe" : "New Recipe"}
            </h2>
            <form onSubmit={saveRecipe} className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    required
                    placeholder="e.g. Pasta Carbonara"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cook Time</label>
                  <input
                    type="text"
                    value={form.cook_time}
                    onChange={(e) => setField("cook_time", e.target.value)}
                    placeholder="e.g. 30 minutes"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    list={catDatalistId}
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                    placeholder="e.g. Italian"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id={catDatalistId}>
                    {categories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Source URL</label>
                  <input
                    type="url"
                    value={form.source_url}
                    onChange={(e) => setField("source_url", e.target.value)}
                    placeholder="https://..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Ingredients
                  <span className="text-slate-400 font-normal ml-1 text-xs">(Enter → new bullet · Shift+Enter → plain line)</span>
                </label>
                <textarea
                  value={form.ingredients}
                  onChange={(e) => setField("ingredients", e.target.value)}
                  onKeyDown={(e) => handleBulletKeyDown(e, form.ingredients, (v) => setField("ingredients", v))}
                  rows={5}
                  placeholder={"- 200g spaghetti\n- 2 eggs\n- 100g pancetta"}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Instructions
                  <span className="text-slate-400 font-normal ml-1 text-xs">(Enter → next step · Shift+Enter → plain line)</span>
                </label>
                <textarea
                  value={form.steps}
                  onChange={(e) => setField("steps", e.target.value)}
                  onKeyDown={(e) => handleNumberedKeyDown(e, form.steps, (v) => setField("steps", v))}
                  rows={6}
                  placeholder={"1. Boil the pasta\n2. Fry the pancetta\n3. Mix eggs and cheese"}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
                />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editRecipe ? "Save changes" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Delete recipe?</h2>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this recipe.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
