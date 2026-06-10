"use client";

import React from "react";
import Link from "next/link";
import { ExitIcon, FlashcardsActiveIcon, QuizIcon, AiChatActiveIcon, ArchitectIcon } from "./dashboard/components/Icons";

export default function LandingPage() {
  return (
    <div className="w-screen min-h-screen overflow-x-hidden flex flex-col justify-between relative bg-white font-roboto text-slate-800">
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 size-full z-0 pointer-events-none select-none overflow-hidden flex items-center justify-center">
        <img 
          alt="" 
          className="w-full h-full object-cover opacity-80" 
          src="/assets/d6c8b4888ff7865e6224d0a9c57587972911c1ee.svg" 
        />
      </div>

      {/* 1. Navigation Header */}
      <header className="z-10 w-full max-w-7xl mx-auto px-6 h-[70px] flex items-center justify-between">
        <div className="font-departure text-[28px] font-bold text-[#3d59c6] leading-none tracking-tight">
          zLearner_
        </div>
        <div className="flex items-center space-x-3">
          <Link 
            href="/login" 
            className="w-[100px] h-[36px] bg-slate-100 text-[#272727] rounded-lg flex items-center justify-center font-departure font-medium text-[14px] hover:bg-slate-200 border border-slate-200/50 transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            Login_
          </Link>
          <Link 
            href="/register" 
            className="w-[110px] h-[36px] bg-[#3d59c6] text-white rounded-lg flex items-center justify-center font-departure font-medium text-[14px] hover:bg-[#2b419c] transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            Register_
          </Link>
        </div>
      </header>

      {/* 2. Hero Section */}
      <main className="z-10 flex-1 max-w-7xl mx-auto px-6 py-12 flex flex-col justify-center items-center text-center space-y-12">
        <div className="space-y-4 max-w-3xl">
          <h1 className="font-departure text-[48px] sm:text-[64px] md:text-[80px] text-[#3d59c6] leading-none tracking-tight">
            zLearner_
          </h1>
          <p className="font-departure text-[18px] sm:text-[22px] md:text-[24px] text-[#3d59c6]/80 max-w-2xl mx-auto">
            Your AI-Powered Second Brain for Learning.
          </p>
          <p className="text-[15px] sm:text-[17px] text-slate-500 max-w-lg mx-auto font-roboto leading-relaxed pt-2">
            Organize courses, generate topics on demand, review flashcards, and take dynamic RAG-based quizzes. All in one unified retro-modern interface.
          </p>
        </div>

        {/* Action Buttons Box */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-lg">
          <Link 
            href="/register"
            className="w-full sm:w-[220px] h-[50px] bg-[#3d59c6] hover:bg-[#2b419c] text-white rounded-[12px] flex items-center justify-center font-departure text-[15px] sm:text-[16px] transition-all cursor-pointer active:scale-[0.98] shadow-md"
          >
            <span>Get Started_</span>
          </Link>
          <Link 
            href="/login"
            className="w-full sm:w-[220px] h-[50px] bg-white border-4 border-dashed border-[#3d59c6] text-[#3d59c6] rounded-[12px] flex items-center justify-center font-departure text-[15px] sm:text-[16px] hover:bg-[#3d59c6]/5 transition-all cursor-pointer active:scale-[0.98] shadow-sm"
          >
            <span>Login_</span>
          </Link>
        </div>

        {/* 3. Beautiful Retro Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full pt-8 text-left">
          
          {/* Card 1: Syllabus Architect */}
          <div className="border-4 border-dashed border-[#3d59c6]/70 rounded-[16px] bg-white/95 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-3">
              <div className="size-[40px] bg-[#3d59c6]/10 text-[#3d59c6] rounded-lg flex items-center justify-center">
                <ArchitectIcon className="size-[20px] text-[#3d59c6]" />
              </div>
              <h3 className="font-departure text-[18px] font-bold text-[#3d59c6]">Syllabus Architect_</h3>
              <p className="font-roboto text-[13.5px] text-slate-500 leading-relaxed">
                Generate structured, tailored learning paths on any topic, broken down into logically progressive modules.
              </p>
            </div>
          </div>

          {/* Card 2: AI RAG Chat */}
          <div className="border-4 border-dashed border-[#3d59c6]/70 rounded-[16px] bg-white/95 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-3">
              <div className="size-[40px] bg-[#3d59c6]/10 text-[#3d59c6] rounded-lg flex items-center justify-center">
                <AiChatActiveIcon className="size-[20px] text-[#3d59c6]" />
              </div>
              <h3 className="font-departure text-[18px] font-bold text-[#3d59c6]">Contextual AI Chat_</h3>
              <p className="font-roboto text-[13.5px] text-slate-500 leading-relaxed">
                Chat with an AI tutor that holds the direct context of your generated topic resources using local embedding RAG.
              </p>
            </div>
          </div>

          {/* Card 3: Active Recall Flashcards */}
          <div className="border-4 border-dashed border-[#3d59c6]/70 rounded-[16px] bg-white/95 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-3">
              <div className="size-[40px] bg-[#3d59c6]/10 text-[#3d59c6] rounded-lg flex items-center justify-center">
                <FlashcardsActiveIcon className="size-[20px] text-[#3d59c6]" />
              </div>
              <h3 className="font-departure text-[18px] font-bold text-[#3d59c6]">Recall Flashcards_</h3>
              <p className="font-roboto text-[13.5px] text-slate-500 leading-relaxed">
                Review automatically generated study flashcards mapping key definitions, objectives, and concept questions.
              </p>
            </div>
          </div>

          {/* Card 4: Assessment Quizzes */}
          <div className="border-4 border-dashed border-[#3d59c6]/70 rounded-[16px] bg-white/95 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-3">
              <div className="size-[40px] bg-[#3d59c6]/10 text-[#3d59c6] rounded-lg flex items-center justify-center">
                <QuizIcon className="size-[20px] text-[#3d59c6]" />
              </div>
              <h3 className="font-departure text-[18px] font-bold text-[#3d59c6]">Assessment Quizzes_</h3>
              <p className="font-roboto text-[13.5px] text-slate-500 leading-relaxed">
                Test your knowledge with dynamic multiple choice quizzes generated on demand and graded instantly.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* 4. Footer */}
      <footer className="z-10 w-full max-w-7xl mx-auto px-6 py-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="font-departure text-[12px] text-[#3d59c6]/60">
          © {new Date().getFullYear()} zLearner_ All rights reserved.
        </p>
        <p className="font-departure text-[12px] text-[#3d59c6]/60">
          AI-Powered Learning, Engineered for Clarity.
        </p>
      </footer>
    </div>
  );
}
