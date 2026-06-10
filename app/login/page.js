"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ExitIcon } from "../dashboard/components/Icons";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      const res = await signIn("credentials", {
        username: username.trim(),
        password: password.trim(),
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        if (res.error === "CredentialsSignin") {
          setError("Invalid username or password.");
        } else {
          setError("Authentication failed. Please try again.");
        }
        setLoading(false);
      } else {
        // Redirect upon successful sign in
        window.location.href = callbackUrl;
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="relative border-4 border-[#3d59c6] border-dashed h-[420px] w-full max-w-[480px] rounded-[20px] bg-white/95 p-6 flex flex-col justify-between shadow-lg"
    >
      {/* Title */}
      <div className="text-center">
        <h2 className="font-departure text-[22px] md:text-[26px] text-[#3d59c6] uppercase tracking-tight select-none">
          Login
        </h2>
      </div>

      {/* Input Fields */}
      <div className="space-y-4 flex-1 flex flex-col justify-center">
        
        {/* Username */}
        <div className="space-y-1">
          <label className="block font-departure text-[16px] md:text-[18px] text-[#3d59c6] select-none">
            Username_
          </label>
          <input 
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            className="w-full h-[40px] bg-[#d9d9d9]/50 border-3 border-dashed border-[#3d59c6] rounded-[10px] px-3 font-departure text-[15px] text-[#3d59c6] outline-none focus:bg-[#d9d9d9]/80 transition-colors disabled:opacity-50"
            placeholder="e.g. admin"
            autoFocus
          />
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="block font-departure text-[16px] md:text-[18px] text-[#3d59c6] select-none">
            Password_
          </label>
          <input 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full h-[40px] bg-[#d9d9d9]/50 border-3 border-dashed border-[#3d59c6] rounded-[10px] px-3 font-departure text-[15px] text-[#3d59c6] outline-none focus:bg-[#d9d9d9]/80 transition-colors disabled:opacity-50"
            placeholder="••••••••"
          />
        </div>

        {/* Dynamic Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-2 font-departure text-xs text-center">
            {error}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="pt-2">
        <button 
          type="submit"
          disabled={loading}
          className="w-full h-[46px] bg-[#3d59c6] hover:bg-[#2b419c] rounded-[12px] flex items-center justify-center space-x-2 font-departure text-[18px] md:text-[22px] text-white transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed select-none relative shadow"
        >
          {loading ? (
            <span className="animate-pulse text-[16px]">Loading...</span>
          ) : (
            <>
              <ExitIcon className="size-[22px] text-white" />
              <span>Login_</span>
            </>
          )}
        </button>
      </div>

      {/* Register Link */}
      <p className="text-center font-departure text-[12px] text-[#3d59c6]/70 select-none">
        Don't have an account?{" "}
        <Link href="/register" className="text-[#3d59c6] underline hover:text-[#2b419c] transition-colors">
          Register
        </Link>
      </p>
    </form>
  );
}

export default function LoginSignupPage() {
  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col items-center justify-center relative bg-white px-4">
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 size-full z-0 pointer-events-none select-none overflow-hidden flex items-center justify-center">
        <img 
          alt="" 
          className="w-full h-full object-cover opacity-80" 
          src="/assets/d6c8b4888ff7865e6224d0a9c57587972911c1ee.svg" 
        />
      </div>

      {/* Main Content Card Container */}
      <div className="z-10 w-full max-w-[656px] flex flex-col items-center space-y-6 md:space-y-8">
        
        {/* Header Texts */}
        <div className="text-center space-y-2 select-none w-full">
          <h1 className="font-departure text-[56px] md:text-[72px] text-[#3d59c6] leading-none tracking-tight">
            zLearner_
          </h1>
          <p className="font-departure text-[14px] md:text-[18px] text-[#3d59c6]/80 whitespace-nowrap overflow-hidden text-ellipsis">
            Your AI-Powered Second Brain for Learning.
          </p>
        </div>

        {/* Login Form wrapped in Suspense for useSearchParams */}
        <Suspense fallback={
          <div className="relative border-4 border-[#3d59c6] border-dashed h-[420px] w-full max-w-[480px] rounded-[20px] bg-white/95 flex items-center justify-center shadow-lg">
            <div className="font-departure text-lg text-[#3d59c6] animate-pulse">Loading auth config...</div>
          </div>
        }>
          <LoginForm />
        </Suspense>

      </div>
    </div>
  );
}
