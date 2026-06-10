import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SignInButton from "./SignInButton";

function HeartbeatIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,12 6,12 8,5 10,19 12,12 22,12" />
    </svg>
  );
}

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className="min-h-[100dvh] bg-[#191b35] flex items-center justify-center p-4">
      <div className="w-full max-w-[360px] flex flex-col items-center gap-8">

        {/* Brand mark */}
        <div className="flex flex-col items-center gap-4">
          <div className="bg-indigo-500 w-16 h-16 rounded-2xl flex items-center justify-center shadow-[0_0_36px_rgba(99,102,241,0.5)]">
            <HeartbeatIcon />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">StillAlive</h1>
            <p className="text-slate-400 text-sm mt-1">Your personal life tracker</p>
          </div>
        </div>

        {/* Auth card */}
        <div className="w-full bg-[#0f1022] rounded-2xl border border-white/[0.07] shadow-2xl p-8 flex flex-col gap-5">
          <div>
            <p className="text-white font-semibold text-[15px]">Welcome back</p>
            <p className="text-slate-500 text-[13px] mt-1">Sign in to track your habits, finances, and goals.</p>
          </div>
          <SignInButton />
        </div>

      </div>
    </div>
  );
}
