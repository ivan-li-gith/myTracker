"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, X, Plus, Trash2 } from "lucide-react";

export default function BillSplitterModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  
  // Start with two empty participants by default
  const [participants, setParticipants] = useState([
    { name: "", amount: "" },
    { name: "", amount: "" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addParticipant = () => {
    setParticipants([...participants, { name: "", amount: "" }]);
  };

  const removeParticipant = (index: number) => {
    const newParticipants = [...participants];
    newParticipants.splice(index, 1);
    setParticipants(newParticipants);
  };

  const updateParticipant = (index: number, field: "name" | "amount", value: string) => {
    const newParticipants = [...participants];
    newParticipants[index][field] = value;
    setParticipants(newParticipants);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !total) return;

    setIsSubmitting(true);
    
    // Format the data to match the backend expectations
    const formattedParticipants = participants
      .filter(p => p.name.trim() !== "") // Remove empty rows
      .map(p => ({
        name: p.name,
        amount: parseFloat(p.amount) || 0
      }));

    try {
      const response = await fetch("http://localhost:8000/expense-splits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title,
          total: parseFloat(total),
          participants: formattedParticipants,
        }),
      });

      if (response.ok) {
        setTitle("");
        setTotal("");
        setParticipants([{ name: "", amount: "" }, { name: "", amount: "" }]);
        setIsOpen(false);
        router.refresh();
      } else {
        console.error("Failed to split bill. Status:", response.status);
      }
    } catch (error) {
      console.error("Error splitting bill:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
      >
        <Calculator size={16} />
        Bill Splitter
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calculator size={20} className="text-indigo-600" />
                Split a Bill
              </h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expense Title</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Utility bill"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3 border-b border-slate-100 pb-2">
                  Participants & Shares
                </label>
                <div className="space-y-3">
                  {participants.map((p, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => updateParticipant(index, "name", e.target.value)}
                        placeholder="Name"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                      <div className="relative w-28">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={p.amount}
                          onChange={(e) => updateParticipant(index, "amount", e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeParticipant(index)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addParticipant}
                  className="mt-3 flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <Plus size={16} /> Add person
                </button>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !total}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Split"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}