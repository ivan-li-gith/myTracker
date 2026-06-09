import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import SignInButton from "./SignInButton";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className="min-h-screen bg-[#191b35] flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 p-10 bg-[#0f1022] rounded-2xl border border-white/[0.07] shadow-2xl w-full max-w-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-indigo-500 w-12 h-12 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
            <Activity size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">myTracker</h1>
          <p className="text-slate-400 text-sm text-center">Your personal life tracker. Sign in to continue.</p>
        </div>

        <SignInButton />
      </div>
    </div>
  );
}
