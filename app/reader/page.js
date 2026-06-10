"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Markdown from "../../components/Markdown";

import {
  HamburgerIcon,
  AddLearningIcon,
  AddTopicIcon,
  PaperPlaneIcon,
  FlashcardsTabIcon,
  AiChatTabIcon,
  LineDividerHorizontal,
  CaretDownIcon,
  ChevronRightIcon,
  HomeIcon,
  CloseIcon,
  AiChatActiveIcon,
  FlashcardsActiveIcon,
  LineDividerVertical,
  TrashIcon,
  QuizIcon,
  RefreshIcon
} from "../dashboard/components/Icons";

export default function ReaderPage() {
  const router = useRouter();

  // Navigation & UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState("chat"); // "chat" | "cards" | "quiz"
  const [activeTopicId, setActiveTopicId] = useState(null); // Selected Topic ID
  const [learnings, setLearnings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Chat Histories mapped by Topic ID
  const [chatHistoryMap, setChatHistoryMap] = useState({});
  const [newChatMessage, setNewChatMessage] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Flipped state for MindMap cards: { [cardIndex]: boolean }
  const [flippedCards, setFlippedCards] = useState({});

  // Quiz State Variables
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState({}); // { [questionIdx]: selectedOptionString }
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Quiz Generator function
  const generateQuiz = async (topicId) => {
    if (!topicId) return;
    setQuizLoading(true);
    setQuizQuestions([]);
    setSelectedQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(0);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.questions) {
          setQuizQuestions(data.questions);
        }
      } else {
        console.error("Failed to generate quiz");
      }
    } catch (err) {
      console.error("Quiz API error:", err);
    } finally {
      setQuizLoading(false);
    }
  };

  // Reset/fetch quiz on topic change
  useEffect(() => {
    setQuizQuestions([]);
    setSelectedQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(0);
    if (activeRightTab === "quiz" && activeTopicId) {
      generateQuiz(activeTopicId);
    }
  }, [activeTopicId]);

  // Refs for Chat Auto-Scroll
  const chatEndRef = useRef(null);

  // Fetch learnings and topics from database
  const fetchLearnings = async (selectFirst = false) => {
    try {
      const res = await fetch("/api/learnings");
      if (res.ok) {
        const data = await res.json();
        setLearnings(data);
        if (selectFirst && data.length > 0) {
          const firstWithTopics = data.find(l => l.topics && l.topics.length > 0);
          if (firstWithTopics) {
            setActiveTopicId(firstWithTopics.topics[0].id);
            setLearnings(prev => prev.map(l => l.id === firstWithTopics.id ? { ...l, isExpanded: true } : l));
          } else if (data[0].topics && data[0].topics.length > 0) {
            setActiveTopicId(data[0].topics[0].id);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load learnings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLearnings(true);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTopicId, chatHistoryMap, isAiTyping]);

  // Expand / Collapse a Learning module in the left sidebar
  const toggleLearningExpand = (learningId) => {
    setLearnings(learnings.map(l => {
      if (l.id === learningId) {
        return { ...l, isExpanded: !l.isExpanded };
      }
      return l;
    }));
  };

  const handleTriggerNewLearningInDashboard = () => {
    router.push("/dashboard?action=new-learning");
  };

  const handleTriggerNewTopicInDashboard = () => {
    let activeLearningId = null;
    if (activeTopicId) {
      const activeL = learnings.find(l => l.topics.some(t => t.id === activeTopicId));
      if (activeL) activeLearningId = activeL.id;
    }
    if (!activeLearningId && learnings.length > 0) {
      activeLearningId = learnings[0].id;
    }

    if (activeLearningId) {
      router.push(`/dashboard?action=new-topic&learningId=${activeLearningId}`);
    } else {
      router.push("/dashboard?action=new-learning");
    }
  };

  // AI Chat API handler
  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newChatMessage.trim() || !activeTopicId) return;

    const currentMsg = newChatMessage.trim();
    setNewChatMessage("");

    const userMsg = {
      id: `m_user_${Date.now()}`,
      sender: "user",
      text: currentMsg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const currentTopicMessages = chatHistoryMap[activeTopicId] || [];
    const updatedMessages = [...currentTopicMessages, userMsg];

    setChatHistoryMap(prev => ({
      ...prev,
      [activeTopicId]: updatedMessages
    }));

    setIsAiTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: activeTopicId,
          message: currentMsg,
          history: currentTopicMessages
        })
      });

      if (res.ok) {
        const aiMsg = await res.json();
        setChatHistoryMap(prev => ({
          ...prev,
          [activeTopicId]: [...(prev[activeTopicId] || []), aiMsg]
        }));
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to get chat answer');
      }
    } catch (error) {
      console.error("Reader chat error:", error);
      setChatHistoryMap(prev => ({
        ...prev,
        [activeTopicId]: [
          ...(prev[activeTopicId] || []),
          {
            id: `m_ai_err_${Date.now()}`,
            sender: 'ai',
            text: `⚠️ Failed to get reply: ${error.message}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]
      }));
    } finally {
      setIsAiTyping(false);
    }
  };

  // Delete Learning from DB
  const handleDeleteLearning = async (learningId) => {
    if (!confirm("Are you sure you want to delete this learning module and all its topics?")) return;
    try {
      const res = await fetch(`/api/learnings?id=${learningId}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const targetLearning = learnings.find(l => l.id === learningId);
          const activeBelongsToDeleted = targetLearning?.topics?.some(t => t.id === activeTopicId) || activeTopicId === learningId;

          const updated = learnings.filter(l => l.id !== learningId);
          setLearnings(updated);

          if (activeBelongsToDeleted) {
            const another = updated.find(l => l.topics && l.topics.length > 0);
            if (another) {
              setActiveTopicId(another.topics[0].id);
            } else {
              setActiveTopicId(null);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to delete learning:", error);
    }
  };

  // Delete Topic from DB
  const handleDeleteTopic = async (topicId) => {
    if (!confirm("Are you sure you want to delete this topic?")) return;
    try {
      const res = await fetch(`/api/topics?id=${topicId}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLearnings(prev => prev.map(l => ({
            ...l,
            topics: l.topics.filter(t => t.id !== topicId)
          })));

          if (activeTopicId === topicId) {
            const updated = learnings.map(l => ({
              ...l,
              topics: l.topics.filter(t => t.id !== topicId)
            }));
            const another = updated.find(l => l.topics && l.topics.length > 0);
            if (another) {
              setActiveTopicId(another.topics[0].id);
            } else {
              setActiveTopicId(null);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to delete topic:", error);
    }
  };

  // Toggle flipped state for a flashcard index
  const toggleCardFlip = (index) => {
    setFlippedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Fetch content for selected topic
  let currentTopic = null;
  let currentLearning = null;

  for (const l of learnings) {
    const t = l.topics.find(topic => topic.id === activeTopicId);
    if (t) {
      currentTopic = t;
      currentLearning = l;
      break;
    }
  }

  // Active chat messages list
  const chatMessages = chatHistoryMap[activeTopicId] || [
    {
      id: "m_welcome",
      sender: "ai",
      text: `📚 Welcome to the study session! Ask me any questions about the concepts detailed on the left side.`,
      time: "Now"
    }
  ];

  // Dynamic Flashcards from DB
  const flashcards = currentTopic?.flashcards || [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white select-none">
      
      {/* 1. LEFT SIDEBAR PANEL */}
      <div 
        className={`h-full bg-white flex flex-col relative transition-all duration-300 border-r border-slate-100 shadow-[2px_0px_4px_0px_rgba(0,0,0,0.1)] z-20 ${
          isSidebarOpen ? "w-[294px]" : "w-[66px]"
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-[46px] flex items-center justify-between px-[10px] relative">
          {isSidebarOpen ? (
            <>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="size-[46px] flex items-center justify-center cursor-pointer hover:bg-slate-50 rounded-full transition-colors text-primary-blue"
                title="Collapse Sidebar"
              >
                <CloseIcon className="size-[24px]" />
              </button>
              
              <Link 
                href="/dashboard"
                className="size-[46px] flex items-center justify-center cursor-pointer hover:bg-slate-50 rounded-full transition-colors text-primary-blue"
                title="Back to Dashboard"
              >
                <HomeIcon className="size-[32px]" />
              </Link>
            </>
          ) : (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="size-[46px] flex items-center justify-center cursor-pointer hover:bg-slate-50 rounded-full transition-colors absolute left-[10px] top-0 text-primary-blue"
              title="Expand Sidebar"
            >
              <HamburgerIcon className="size-[24px]" />
            </button>
          )}
        </div>

        {/* Header Divider Line */}
        <div className="w-full px-[6px]">
          <LineDividerVertical className="w-full h-[9px] text-slate-200/50" />
        </div>

        {/* Sidebar Middle Content: Learnings & Topics List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-[12px] space-y-4 scrollbar-thin">
          {isSidebarOpen ? (
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-slate-400 text-xs font-departure italic py-4 text-center">
                  Loading courses...
                </div>
              ) : learnings.length === 0 ? (
                <div className="text-slate-400 text-xs font-departure italic py-4 text-center">
                  No courses found.
                </div>
              ) : (
                learnings.map((learning) => (
                  <div key={learning.id} className="border-b border-slate-50 pb-2">
                    {/* Learning Title Bar */}
                    <div 
                      className="flex items-center justify-between cursor-pointer p-2 hover:bg-slate-50 rounded-md transition-all active:scale-[0.98]"
                    >
                      <div 
                        onClick={() => toggleLearningExpand(learning.id)}
                        className="flex items-center space-x-2 flex-1"
                      >
                        <div className="transition-transform duration-200">
                          {learning.isExpanded ? (
                            <CaretDownIcon className="size-[18px] text-primary-blue" />
                          ) : (
                            <ChevronRightIcon className="size-[18px] text-slate-400" />
                          )}
                        </div>
                        <span className="font-departure text-[15px] font-bold text-primary-blue">
                          {learning.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLearning(learning.id);
                        }}
                        className="p-1 text-slate-300 hover:text-red-600 rounded transition-colors"
                        title="Delete Course Module"
                      >
                        <TrashIcon className="size-[13px]" />
                      </button>
                    </div>

                    {/* Topics List */}
                    {learning.isExpanded && (
                      <div className="pl-6 mt-1 space-y-1 border-l-2 border-slate-100 ml-[10px]">
                        {learning.topics.length === 0 ? (
                          <div className="text-slate-400 text-xs font-departure italic py-1 pl-2">
                            (No topics)
                          </div>
                        ) : (
                          learning.topics.map((topic) => (
                            <div 
                              key={topic.id}
                              className={`flex items-center justify-between p-1 px-2 rounded-md font-roboto text-[14px] cursor-pointer transition-all ${
                                activeTopicId === topic.id 
                                  ? "text-primary-blue font-semibold bg-blue-50/50" 
                                  : "text-text-grey hover:bg-slate-50 hover:text-slate-900"
                              }`}
                            >
                              <span
                                onClick={() => {
                                  setActiveTopicId(topic.id);
                                  setFlippedCards({}); // Reset flipped cards state when changing topics
                                }}
                                className={`flex-1 hover:underline ${
                                  activeTopicId === topic.id ? "underline" : ""
                                }`}
                              >
                                {topic.name}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTopic(topic.id);
                                }}
                                className="p-1 text-slate-300 hover:text-red-600 rounded transition-colors"
                                title="Delete Topic"
                              >
                                <TrashIcon className="size-[12px]" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Collapsed List Mini Icons View */
            <div className="flex flex-col items-center space-y-4 pt-2">
              {learnings.map((learning, idx) => (
                <button
                  key={learning.id}
                  onClick={() => {
                    setIsSidebarOpen(true);
                    toggleLearningExpand(learning.id);
                  }}
                  className={`size-[40px] flex items-center justify-center rounded-lg border font-departure font-bold text-sm transition-all hover:bg-blue-50 active:scale-95 ${
                    learnings.some(l => l.id === learning.id && l.topics.some(t => t.id === activeTopicId))
                      ? "border-primary-blue bg-blue-50/30 text-primary-blue"
                      : "border-slate-200 text-slate-500"
                  }`}
                  title={`${learning.name} (${learning.topics.length} topics)`}
                >
                  L{idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer Buttons: redirect to dashboard */}
        <div className="p-[12px] space-y-2 border-t border-slate-50 bg-slate-50/30">
          {isSidebarOpen ? (
            <>
              <button 
                onClick={handleTriggerNewLearningInDashboard}
                className="w-full h-[44px] flex items-center justify-center space-x-2 bg-primary-grey text-text-grey rounded-lg font-departure font-medium text-sm border border-transparent hover:bg-slate-300 transition-all cursor-pointer active:scale-[0.98]"
              >
                <AddLearningIcon className="size-[20px] text-text-grey" />
                <span>Add Learning</span>
              </button>

              <button 
                onClick={handleTriggerNewTopicInDashboard}
                className="w-full h-[44px] flex items-center justify-center space-x-2 bg-primary-blue text-white rounded-lg font-departure font-medium text-sm border border-transparent hover:bg-blue-700 transition-all cursor-pointer active:scale-[0.98]"
              >
                <AddTopicIcon className="size-[20px] text-white" />
                <span>Add Topic</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <button 
                onClick={handleTriggerNewLearningInDashboard}
                className="size-[40px] flex items-center justify-center bg-primary-grey text-text-grey rounded-lg border border-transparent hover:bg-slate-300 transition-all cursor-pointer active:scale-[0.95]"
                title="Add Learning Module"
              >
                <AddLearningIcon className="size-[20px] text-text-grey" />
              </button>

              <button 
                onClick={handleTriggerNewTopicInDashboard}
                className="size-[40px] flex items-center justify-center bg-primary-blue text-white rounded-lg border border-transparent hover:bg-blue-700 transition-all cursor-pointer active:scale-[0.95]"
                title="Add Topic"
              >
                <AddTopicIcon className="size-[20px] text-white" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. CENTER CONTENT PANEL */}
      <div className="flex-1 h-full flex flex-col bg-white overflow-hidden z-10">
        
        {/* Topic Title Bar Header */}
        <div className="h-[46px] px-6 bg-white flex items-center border-b border-slate-100 shadow-[0px_1px_4px_0px_rgba(0,0,0,0.05)]">
          <div className="font-departure text-[18px] text-text-grey">
            {currentLearning && currentTopic ? (
              <>
                <span className="text-primary-blue font-bold">
                  {currentLearning.name}
                </span>
                <span className="text-slate-400 mx-2">/</span>
                <span className="text-slate-700">
                  {currentTopic.name}
                </span>
              </>
            ) : (
              <span>Select a topic to start reading</span>
            )}
          </div>
        </div>

        {/* Topic Body Content Scroll View */}
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full scrollbar-thin">
          {activeTopicId && currentTopic ? (
            <article className="space-y-8 animate-fade-in select-text">
              {currentTopic.contentMarkdown ? (
                <Markdown text={currentTopic.contentMarkdown} />
              ) : (
                <div className="text-slate-400 font-lora italic text-center py-12">
                  No content generated yet for this topic. Generate it first in the dashboard!
                </div>
              )}
            </article>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 pt-12">
              <h2 className="font-departure text-[48px] font-bold text-primary-blue tracking-tight">
                Nothing to show!
              </h2>
              <p className="font-departure text-[20px] text-slate-500 max-w-md">
                Create a new learning module or add topics in the dashboard to get started!
              </p>
              <div className="flex items-center space-x-4 pt-4">
                <button 
                  onClick={handleTriggerNewLearningInDashboard}
                  className="px-6 h-[48px] flex items-center justify-center space-x-2 bg-primary-grey text-text-grey rounded-lg font-departure font-medium border border-transparent hover:bg-slate-300 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  <AddLearningIcon className="size-[20px] text-text-grey" />
                  <span>Add Learning</span>
                </button>
                <button 
                  onClick={handleTriggerNewTopicInDashboard}
                  className="px-6 h-[48px] flex items-center justify-center space-x-2 bg-primary-blue text-white rounded-lg font-departure font-medium border border-transparent hover:bg-blue-700 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  <AddTopicIcon className="size-[20px] text-white" />
                  <span>Add Topic</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. RIGHT PANEL (AI CHAT & MINDMAP) */}
      <div className="w-[367px] h-full bg-white flex flex-col border-l border-slate-100 shadow-[-2px_0px_4px_0px_rgba(0,0,0,0.1)] z-20 relative">
        
        {/* Right Sidebar Tabs Header */}
        <div className="h-[46px] flex items-center justify-between px-[9px] bg-white border-b border-slate-100 gap-1">
          <button 
            onClick={() => setActiveRightTab("chat")}
            className={`flex-1 h-[32px] flex items-center justify-center space-x-1 rounded-lg font-departure font-medium text-[13px] cursor-pointer transition-all active:scale-[0.97] ${
              activeRightTab === "chat"
                ? "bg-primary-blue text-white shadow-sm"
                : "bg-primary-grey text-text-grey hover:bg-slate-200"
            }`}
          >
            {activeRightTab === "chat" ? (
              <AiChatActiveIcon className="size-[15px] text-white" />
            ) : (
              <AiChatTabIcon className="size-[15px] text-text-grey" />
            )}
            <span>Chat</span>
          </button>

          <button 
            onClick={() => setActiveRightTab("cards")}
            className={`flex-1 h-[32px] flex items-center justify-center space-x-1 rounded-lg font-departure font-medium text-[13px] cursor-pointer transition-all active:scale-[0.97] ${
              activeRightTab === "cards"
                ? "bg-primary-blue text-white shadow-sm"
                : "bg-primary-grey text-text-grey hover:bg-slate-200"
            }`}
          >
            {activeRightTab === "cards" ? (
              <FlashcardsActiveIcon className="size-[15px] text-white" />
            ) : (
              <FlashcardsTabIcon className="size-[15px] text-text-grey" />
            )}
            <span>Cards</span>
          </button>

          <button 
            onClick={() => {
              setActiveRightTab("quiz");
              if (quizQuestions.length === 0 && activeTopicId) {
                generateQuiz(activeTopicId);
              }
            }}
            className={`flex-1 h-[32px] flex items-center justify-center space-x-1 rounded-lg font-departure font-medium text-[13px] cursor-pointer transition-all active:scale-[0.97] ${
              activeRightTab === "quiz"
                ? "bg-primary-blue text-white shadow-sm"
                : "bg-primary-grey text-text-grey hover:bg-slate-200"
            }`}
          >
            <QuizIcon className={`size-[15px] ${activeRightTab === "quiz" ? "text-white" : "text-text-grey"}`} />
            <span>Quiz</span>
          </button>
        </div>

        {/* Tab Contents View */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeRightTab === "chat" ? (
            /* TAB 1: AI Chat View */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
              
              {/* Chat Message History */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {chatMessages.map((message) => (
                  <div 
                    key={message.id}
                    className={`flex flex-col max-w-[85%] rounded-[12px] p-3 shadow-sm ${
                      message.sender === "user"
                        ? "bg-primary-grey text-text-grey ml-auto rounded-tr-none"
                        : "bg-primary-blue text-white mr-auto rounded-tl-none"
                    }`}
                  >
                    <div className="font-roboto text-[13.5px] leading-relaxed select-text">
                      <Markdown text={message.text} isAi={message.sender !== 'user'} fontClass="font-roboto" />
                    </div>
                    <span 
                      className={`text-[10px] text-right mt-1 opacity-70 font-departure ${
                        message.sender === "user" ? "text-slate-500" : "text-blue-100"
                      }`}
                    >
                      {message.time}
                    </span>
                  </div>
                ))}
                
                {/* AI Typing Indicator */}
                {isAiTyping && (
                  <div className="flex items-center space-x-1 bg-primary-blue text-white rounded-[12px] rounded-tl-none p-3 max-w-[80px] shadow-sm mr-auto animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-100"></span>
                    <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-200"></span>
                    <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-300"></span>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form 
                onSubmit={handleSendChatMessage}
                className="p-3 bg-white border-t border-slate-100 flex items-end space-x-2"
              >
                <div className="flex-1 bg-primary-grey rounded-lg p-2 flex flex-col border border-slate-100 focus-within:border-primary-blue transition-colors">
                  <textarea 
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChatMessage();
                      }
                    }}
                    placeholder="Ask the AI tutor about this topic..."
                    rows={2}
                    className="w-full bg-transparent outline-none resize-none font-roboto text-[13.5px] text-text-grey placeholder-slate-400 border-none p-0 scrollbar-none"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!newChatMessage.trim() || !activeTopicId}
                  className={`size-[40px] flex-none flex items-center justify-center bg-primary-blue text-white rounded-lg shadow-md cursor-pointer hover:bg-blue-700 transition-all active:scale-[0.9] disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <PaperPlaneIcon className="size-[20px] text-white" />
                </button>
              </form>
            </div>
          ) : activeRightTab === "cards" ? (
            /* TAB 2: Cards View - Interactive Flashcards */
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 scrollbar-thin">
              {activeTopicId && flashcards.length > 0 ? (
                flashcards.map((card, idx) => {
                  const isFlipped = !!flippedCards[idx];
                  return (
                    <div 
                      key={`card-${idx}`}
                      onClick={() => toggleCardFlip(idx)}
                      className={`cursor-pointer min-h-[120px] bg-white border border-slate-200/50 rounded-lg p-4 shadow-sm hover:shadow transition-all duration-300 relative flex flex-col justify-between overflow-hidden group select-text active:scale-[0.99]`}
                    >
                      {/* Decorative indicator showing the flashcard index */}
                      <span className="absolute top-2 right-3 font-departure text-[11px] text-slate-300">
                        {idx + 1} / {flashcards.length}
                      </span>
                      
                      {/* Card Content */}
                      <div className="space-y-2 select-text">
                        {!isFlipped ? (
                          <>
                            <span className="text-[10px] uppercase font-departure text-primary-blue tracking-wider font-bold">Front (Concept Question)</span>
                            <h3 className="font-roboto font-semibold text-[16px] text-slate-800 leading-snug">
                              {card.front}
                            </h3>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] uppercase font-departure text-slate-400 tracking-wider font-bold">Back (Explanation)</span>
                            <p className="font-roboto text-[14px] text-text-grey leading-relaxed whitespace-pre-wrap">
                              {card.back}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="text-[11px] font-departure text-slate-400 text-right mt-2 group-hover:text-primary-blue transition-colors">
                        Click to {isFlipped ? "see question" : "reveal answer"} ↻
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="border border-dashed border-primary-blue/30 bg-blue-50/20 rounded-lg p-6 text-center font-roboto text-[13px] text-slate-500 space-y-2 py-12">
                  <p className="font-bold text-primary-blue">No flashcards generated yet.</p>
                  <p>Flashcard review cards are automatically generated when the course topic is created by the agent in the dashboard!</p>
                </div>
              )}
            </div>
          ) : (
            /* TAB 3: Quiz View */
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 scrollbar-thin flex flex-col justify-between">
              <div className="space-y-4">
                {!activeTopicId ? (
                  <div className="text-slate-400 font-roboto italic text-center py-12">
                    Select a topic to start the quiz.
                  </div>
                ) : quizLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-12">
                    <div className="size-8 border-4 border-primary-blue border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-departure text-[13px] text-slate-500 animate-pulse">
                      Generating quiz from RAG context...
                    </p>
                  </div>
                ) : quizQuestions.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <p className="text-slate-400 font-roboto italic">No quiz generated for this topic.</p>
                    <button
                      onClick={() => generateQuiz(activeTopicId)}
                      className="px-4 py-2 bg-primary-blue text-white rounded-lg font-departure text-[13px] hover:bg-blue-700 transition-all active:scale-95 shadow-sm"
                    >
                      Generate Quiz
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {quizQuestions.map((q, qIdx) => {
                      const isCorrectAnswer = (opt) => opt === q.correctAnswer;
                      const isUserSelected = (opt) => selectedQuizAnswers[qIdx] === opt;

                      return (
                        <div key={`quiz-q-${qIdx}`} className="bg-white border border-slate-200/50 rounded-lg p-4 shadow-sm space-y-3">
                          <h4 className="font-departure font-bold text-[14px] text-slate-800 leading-snug">
                            <span className="text-primary-blue font-departure mr-1">Q{qIdx + 1}.</span>
                            {q.questionText}
                          </h4>
                          
                          <div className="space-y-2">
                            {q.options.map((opt, oIdx) => {
                              let optionStyle = "border-slate-200 hover:bg-slate-50 text-slate-700";
                              let indicator = "";

                              if (quizSubmitted) {
                                if (isCorrectAnswer(opt)) {
                                  optionStyle = "border-green-500 bg-green-50/50 text-green-700 font-medium";
                                  indicator = " ✓";
                                } else if (isUserSelected(opt)) {
                                  optionStyle = "border-red-500 bg-red-50/50 text-red-700";
                                  indicator = " ✗";
                                } else {
                                  optionStyle = "border-slate-200 opacity-60 text-slate-500";
                                }
                              } else if (isUserSelected(opt)) {
                                optionStyle = "border-primary-blue bg-blue-50/30 text-primary-blue font-medium";
                              }

                              return (
                                <button
                                  key={`opt-${qIdx}-${oIdx}`}
                                  disabled={quizSubmitted}
                                  onClick={() => {
                                    setSelectedQuizAnswers(prev => ({
                                      ...prev,
                                      [qIdx]: opt
                                    }));
                                  }}
                                  className={`w-full text-left p-2.5 rounded-lg border text-[13px] transition-all font-roboto cursor-pointer flex items-center justify-between ${optionStyle}`}
                                >
                                  <span>{opt}</span>
                                  <span className="font-departure font-bold">{indicator}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {quizSubmitted && (
                      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-md text-center space-y-2">
                        <div className="text-[12px] uppercase font-departure text-slate-400 tracking-wider font-bold">Quiz Result</div>
                        <h3 className="font-departure text-[22px] font-bold text-slate-800">
                          Your Score: <span className={quizScore >= 3 ? "text-green-600" : "text-amber-600"}>{quizScore} / {quizQuestions.length}</span>
                        </h3>
                        <p className="text-[12px] text-slate-500 font-roboto">
                          {quizScore === quizQuestions.length ? "Perfect Score! Excellent understanding! 🌟" : "Keep learning and try again! 💪"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {activeTopicId && quizQuestions.length > 0 && (
                <div className="pt-4 border-t border-slate-200/50 bg-white/20 p-2 rounded-lg flex flex-col space-y-2">
                  {!quizSubmitted ? (
                    <button
                      onClick={() => {
                        let score = 0;
                        quizQuestions.forEach((q, idx) => {
                          if (selectedQuizAnswers[idx] === q.correctAnswer) {
                            score++;
                          }
                        });
                        setQuizScore(score);
                        setQuizSubmitted(true);
                      }}
                      disabled={Object.keys(selectedQuizAnswers).length < quizQuestions.length}
                      className="w-full h-[40px] bg-primary-blue text-white rounded-lg font-departure font-medium text-[13px] hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                    >
                      Submit Answers
                    </button>
                  ) : (
                    <button
                      onClick={() => generateQuiz(activeTopicId)}
                      className="w-full h-[40px] bg-primary-grey text-text-grey rounded-lg font-departure font-medium text-[13px] hover:bg-slate-300 transition-all active:scale-[0.98] cursor-pointer shadow-sm border border-slate-100 flex items-center justify-center space-x-1"
                    >
                      <RefreshIcon className="size-[15px] text-text-grey" />
                      <span>Generate New Quiz</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
