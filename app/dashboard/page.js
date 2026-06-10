"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
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
  UserCircleIcon,
  CloseIcon,
  AiChatActiveIcon,
  FlashcardsActiveIcon,
  LineDividerVertical,
  SplitPaneDivider,
  TrashIcon,
  ExitIcon
} from "./components/Icons";

export default function DashboardPage() {
  // Navigation & UI States
  const [activeTopicId, setActiveTopicId] = useState(null); // Selected Topic ID
  const [learnings, setLearnings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ingestion & Adding state variables
  const [addingMode, setAddingMode] = useState(null); // 'learning' | 'topic' | null
  const [activeLearningIdForNewTopic, setActiveLearningIdForNewTopic] = useState(null);

  // Chat Histories mapped by Topic ID: { [topicId]: [messages] }
  const [chatHistoryMap, setChatHistoryMap] = useState({});
  const [newChatMessage, setNewChatMessage] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Refs for Chat Auto-Scroll and Generation tracking
  const chatEndRef = useRef(null);
  const newLearningIdRef = useRef(null);

  // Fetch learnings from the database on mount
  const fetchLearnings = async (selectFirst = false, forceTopicId = null) => {
    try {
      const res = await fetch("/api/learnings");
      if (res.ok) {
        const data = await res.json();
        setLearnings(data);
        
        if (forceTopicId) {
          setActiveTopicId(forceTopicId);
          // Auto-expand parent learning
          const parent = data.find(l => l.topics && l.topics.some(t => t.id === forceTopicId));
          if (parent) {
            setLearnings(prev => prev.map(l => l.id === parent.id ? { ...l, isExpanded: true } : l));
          }
        } else if (selectFirst && data.length > 0) {
          // Find first learning with topics and select it
          const firstWithTopics = data.find(l => l.topics && l.topics.length > 0);
          if (firstWithTopics) {
            setActiveTopicId(firstWithTopics.topics[0].id);
            // Expand that learning
            setLearnings(prev => prev.map(l => l.id === firstWithTopics.id ? { ...l, isExpanded: true } : l));
          } else if (data[0].topics && data[0].topics.length > 0) {
            setActiveTopicId(data[0].topics[0].id);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch learnings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const isNew = search.includes('new=true') || search.includes('action=');
    
    if (search.includes('action=new-learning')) {
      setActiveTopicId(null);
      setAddingMode('learning');
      setActiveLearningIdForNewTopic(null);
      fetchLearnings(false);
    } else if (search.includes('action=new-topic')) {
      const match = search.match(/learningId=([^&]+)/);
      const learningId = match ? match[1] : null;
      setActiveTopicId(null);
      setAddingMode('topic');
      setActiveLearningIdForNewTopic(learningId);
      fetchLearnings(false);
    } else {
      fetchLearnings(!isNew);
    }
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTopicId, chatHistoryMap, isAiTyping]);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  // Expand / Collapse a Learning module in the left sidebar
  const toggleLearningExpand = (learningId) => {
    setLearnings(learnings.map(l => {
      if (l.id === learningId) {
        return { ...l, isExpanded: !l.isExpanded };
      }
      return l;
    }));
  };

  // Guided to agent panel: sets activeTopicId to null
  const handleTriggerNewLearning = () => {
    setActiveTopicId(null);
    setAddingMode('learning');
    setActiveLearningIdForNewTopic(null);
    setNewChatMessage("");
  };

  const handleTriggerNewTopic = () => {
    // Determine active learning module
    let activeLearningId = null;
    if (activeTopicId) {
      const activeL = learnings.find(l => l.topics.some(t => t.id === activeTopicId));
      if (activeL) activeLearningId = activeL.id;
    }
    if (!activeLearningId && learnings.length > 0) {
      activeLearningId = learnings[0].id;
    }

    if (!activeLearningId) {
      // If no learnings exist, fall back to learning generation mode
      handleTriggerNewLearning();
      return;
    }

    setActiveTopicId(null);
    setAddingMode('topic');
    setActiveLearningIdForNewTopic(activeLearningId);
    setNewChatMessage("");
  };

  // Dynamic Content Editor (Streams changes directly into the right panel)
  const handleEditContent = async (instruction) => {
    if (!activeTopicId) return;

    setIsAiTyping(true);
    setIsGenerating(true);

    const userMsg = {
      id: `edit_user_${Date.now()}`,
      sender: "user",
      text: instruction,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Append instruction and loading status to the chat bubbles
    setChatHistoryMap(prev => ({
      ...prev,
      [activeTopicId]: [
        ...(prev[activeTopicId] || []),
        userMsg,
        {
          id: `edit_status_${Date.now()}`,
          sender: "ai",
          text: `🔄 **AI is updating topic content based on your request...**`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    }));

    try {
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: activeTopicId, instruction }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to edit content');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Clear the current markdown locally so the user sees it stream in fresh
      setLearnings(prev => prev.map(l => ({
        ...l,
        topics: l.topics.map(t => t.id === activeTopicId ? { ...t, contentMarkdown: '' } : t)
      })));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        
        // Stream chunk to local state
        setLearnings(prev => prev.map(l => ({
          ...l,
          topics: l.topics.map(t => {
            if (t.id === activeTopicId) {
              return { ...t, contentMarkdown: (t.contentMarkdown || '') + chunk };
            }
            return t;
          })
        })));
      }

      // Append completed status
      setChatHistoryMap(prev => ({
        ...prev,
        [activeTopicId]: [
          ...(prev[activeTopicId] || []),
          {
            id: `edit_complete_${Date.now()}`,
            sender: "ai",
            text: `✅ **Topic content edited successfully!**`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]
      }));

      // Full sync with the database
      await fetchLearnings(false, activeTopicId);
    } catch (error) {
      console.error("Editing error:", error);
      setChatHistoryMap(prev => ({
        ...prev,
        [activeTopicId]: [
          ...(prev[activeTopicId] || []),
          {
            id: `edit_error_${Date.now()}`,
            sender: "ai",
            text: `❌ **Failed to edit content:** ${error.message}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]
      }));
    } finally {
      setIsAiTyping(false);
      setIsGenerating(false);
    }
  };

  // Real-time SSE Course Generation
  const handleGenerate = async (prompt) => {
    if (!prompt.trim()) return;

    setIsAiTyping(true);
    setIsGenerating(true);

    const isTopicMode = addingMode === 'topic' && activeLearningIdForNewTopic;
    const currentModeText = isTopicMode ? 'topic' : 'course module';

    // Initial state: welcome/status log
    const initGenLog = [
      {
        id: `gen_init_${Date.now()}`,
        sender: "user",
        text: `Generate ${currentModeText} for: **${prompt}**`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      {
        id: `gen_status_0_${Date.now()}`,
        sender: "ai",
        text: `⚙️ Initializing course generator...`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];

    const tempId = `temp_gen_${Date.now()}`;
    setChatHistoryMap(prev => ({
      ...prev,
      [tempId]: initGenLog
    }));
    setActiveTopicId(tempId);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: prompt,
          targetAudience: 'general learners',
          learningId: isTopicMode ? activeLearningIdForNewTopic : undefined
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to start generation');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let activeGenTopicId = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === 'status') {
              setChatHistoryMap(prev => {
                const currentLog = prev[activeGenTopicId || tempId] || [];
                return {
                  ...prev,
                  [activeGenTopicId || tempId]: [
                    ...currentLog,
                    {
                      id: `gen_status_${Date.now()}_${Math.random()}`,
                      sender: 'ai',
                      text: event.message,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                  ]
                };
              });
            } else if (event.type === 'syllabus') {
              newLearningIdRef.current = event.learningId;
              activeGenTopicId = event.modules[0].topicId;

              if (event.singleTopic) {
                // Add single topic to the existing learning locally
                setLearnings(prev => prev.map(l => {
                  if (l.id === event.learningId) {
                    return {
                      ...l,
                      isExpanded: true,
                      topics: [
                        ...l.topics,
                        {
                          id: activeGenTopicId,
                          name: event.modules[0].title,
                          contentMarkdown: '',
                          flashcards: []
                        }
                      ]
                    };
                  }
                  return l;
                }));
              } else {
                // Create a full new learning module locally
                const newL = {
                  id: event.learningId,
                  name: prompt,
                  isExpanded: true,
                  topics: event.modules.map(mod => ({
                    id: mod.topicId,
                    name: mod.title,
                    contentMarkdown: '',
                    flashcards: []
                  }))
                };
                setLearnings(prev => [
                  { ...newL, isExpanded: true },
                  ...prev.map(l => ({ ...l, isExpanded: false }))
                ]);
              }

              // Transfer history log from tempId to the first generated topic ID
              setChatHistoryMap(prev => {
                const logs = prev[tempId] || [];
                const updated = { ...prev };
                delete updated[tempId];
                updated[activeGenTopicId] = [
                  ...logs,
                  {
                    id: `gen_syllabus_${Date.now()}`,
                    sender: 'ai',
                    text: `📐 Created syllabus event. Writing topic content...`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                ];
                return updated;
              });

              setActiveTopicId(activeGenTopicId);
              setAddingMode(null);
            } else if (event.type === 'content_token') {
              const topicIndex = event.moduleIndex;
              setLearnings(prev => {
                return prev.map(l => {
                  if (l.id === newLearningIdRef.current) {
                    const topics = l.topics.map((t, idx) => {
                      if (isTopicMode) {
                        // For single topic generation, update activeGenTopicId contentMarkdown
                        if (t.id === activeGenTopicId) {
                          return {
                            ...t,
                            contentMarkdown: (t.contentMarkdown || '') + event.token
                          };
                        }
                      } else {
                        // For full course syllabus generation
                        if (idx === topicIndex) {
                          return {
                            ...t,
                            contentMarkdown: (t.contentMarkdown || '') + event.token
                          };
                        }
                      }
                      return t;
                    });
                    return { ...l, topics };
                  }
                  return l;
                });
              });
            } else if (event.type === 'complete') {
              setChatHistoryMap(prev => {
                const currentLog = prev[activeGenTopicId] || [];
                return {
                  ...prev,
                  [activeGenTopicId]: [
                    ...currentLog,
                    {
                      id: `gen_complete_${Date.now()}`,
                      sender: 'ai',
                      text: `🎉 **Course Generation Complete!** All content generated and saved to database.`,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                  ]
                };
              });
            } else if (event.type === 'error') {
              setChatHistoryMap(prev => {
                const currentLog = prev[activeGenTopicId || tempId] || [];
                return {
                  ...prev,
                  [activeGenTopicId || tempId]: [
                    ...currentLog,
                    {
                      id: `gen_error_${Date.now()}`,
                      sender: 'ai',
                      text: `❌ **Error during generation:** ${event.message}`,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                  ]
                };
              });
            }
          } catch (err) {
            console.error("Error parsing SSE line:", err);
          }
        }
      }

      // Sync completely with the DB to fetch generated flashcards
      await fetchLearnings(false, activeGenTopicId);
    } catch (error) {
      console.error("Generation failed:", error);
      setChatHistoryMap(prev => {
        const currentLog = prev[activeGenTopicId || tempId] || [];
        return {
          ...prev,
          [activeGenTopicId || tempId]: [
            ...currentLog,
            {
              id: `gen_err_fatal_${Date.now()}`,
              sender: 'ai',
              text: `❌ **Connection lost or error:** ${error.message}`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]
        };
      });
    } finally {
      setIsAiTyping(false);
      setIsGenerating(false);
    }
  };

  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newChatMessage.trim()) return;

    const currentMsg = newChatMessage.trim();
    setNewChatMessage("");

    // If no activeTopicId, we are in the "Agent Panel" generator view
    if (!activeTopicId) {
      handleGenerate(currentMsg);
      return;
    }

    // In Dashboard: sending a chat message while viewing a topic triggers a content edit!
    handleEditContent(currentMsg);
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

  // Fetch active selection details
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
      text: activeTopicId 
        ? `✍️ **AI Ingestion Mode (Dashboard):** Ask me to edit or expand on this topic's content (e.g. *"add a section on LCD pixels"*), and I will update the content on the right in real time.` 
        : `👋 Hello! I am your AI learning assistant. Type a topic below to generate a new ${
            addingMode === 'topic' ? `topic under "${learnings.find(l => l.id === activeLearningIdForNewTopic)?.name || 'the active module'}"` : 'learning module'
          }!`,
      time: "Now"
    }
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white select-none">
      
      {/* A. GLOBAL TOP BAR */}
      <header className="h-[46px] flex-none bg-white flex items-center justify-between px-4 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] z-30">
        <div className="font-departure text-[28px] font-bold text-primary-blue leading-none tracking-tight">
          zLearner
        </div>
        
        <div className="flex items-center space-x-3">
          <Link 
            href="/reader"
            className="w-[157px] h-[36px] bg-primary-blue text-white rounded-lg flex items-center justify-center space-x-2 font-departure font-medium text-[15px] hover:bg-blue-700 transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            <FlashcardsActiveIcon className="size-[20px] text-white" />
            <span>Reader</span>
          </Link>
          
          <button 
            onClick={handleSignOut}
            className="w-[40px] h-[36px] bg-primary-grey text-text-grey rounded-lg flex items-center justify-center hover:bg-slate-200 transition-all cursor-pointer active:scale-95 shadow-sm border border-slate-100"
            title="Sign Out"
          >
            <ExitIcon className="size-[20px] text-text-grey" />
          </button>
        </div>
      </header>

      {/* B. MAIN VIEWPORT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 1. LEFT SIDEBAR PANEL */}
        <div className="w-[294px] h-full bg-white flex flex-col border-r border-slate-100 shadow-[2px_0px_4px_0px_rgba(0,0,0,0.05)] z-20 flex-none">
          <div className="h-[12px]"></div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-[12px] space-y-4 scrollbar-thin">
            {isLoading ? (
              <div className="text-slate-400 text-xs font-departure italic py-4 text-center">
                Loading database modules...
              </div>
            ) : learnings.length === 0 ? (
              <div className="text-slate-400 text-xs font-departure italic py-4 text-center">
                No learning modules. Create one!
              </div>
            ) : (
              <div className="space-y-3">
                {learnings.map((learning) => (
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
                        title="Delete Learning Module"
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
                                  setAddingMode(null);
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
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-[12px] space-y-2 border-t border-slate-50 bg-slate-50/30">
            <button 
              onClick={handleTriggerNewLearning}
              className="w-full h-[44px] flex items-center justify-center space-x-2 bg-primary-grey text-text-grey rounded-lg font-departure font-medium text-sm border border-transparent hover:bg-slate-300 transition-all cursor-pointer active:scale-[0.98]"
            >
              <AddLearningIcon className="size-[20px] text-text-grey" />
              <span>Add Learning</span>
            </button>

            <button 
              onClick={handleTriggerNewTopic}
              className="w-full h-[44px] flex items-center justify-center space-x-2 bg-primary-blue text-white rounded-lg font-departure font-medium text-sm border border-transparent hover:bg-blue-700 transition-all cursor-pointer active:scale-[0.98]"
            >
              <AddTopicIcon className="size-[20px] text-white" />
              <span>Add Topic</span>
            </button>
          </div>
        </div>

        {/* 2. SPLIT CHAT & READER PANEL */}
        <div className="flex-1 h-full bg-white relative overflow-hidden flex flex-col z-10">
          
          {/* Header Title displaying current learning/topic (EMPTY initially if creating) */}
          <div className="h-[46px] px-6 bg-white flex items-center justify-between border-b border-slate-100 shadow-[0px_1px_4px_0px_rgba(0,0,0,0.03)] z-10 flex-none">
            <div className="font-departure text-[18px] text-text-grey min-h-[24px]">
              {currentLearning && currentTopic ? (
                <>
                  <span className="text-primary-blue font-bold">
                    {currentLearning.name}
                  </span>
                  <span className="text-slate-400 mx-2">:</span>
                  <span className="text-slate-700">
                    {currentTopic.name}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {/* Split Pane View */}
          {activeTopicId ? (
            <div className="flex-1 flex overflow-hidden">
              
              {/* Column 1: Chat interface */}
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/10 border-r border-slate-50">
                
                {/* Chat message bubbles */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                  {chatMessages.map((message) => (
                    <div 
                      key={message.id}
                      className={`flex flex-col max-w-[85%] rounded-[12px] p-4 shadow-sm ${
                        message.sender === "user"
                          ? "bg-primary-grey text-text-grey ml-auto rounded-tr-none"
                          : "bg-primary-blue text-white mr-auto rounded-tl-none"
                      }`}
                    >
                      <div className="font-roboto text-[13px] leading-relaxed select-text">
                        <Markdown text={message.text} isAi={message.sender !== 'user'} fontClass="font-roboto" textSize="text-[13px]" />
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

                  {/* AI Typing Animation */}
                  {isAiTyping && (
                    <div className="flex items-center space-x-1 bg-primary-blue text-white rounded-[12px] rounded-tl-none p-4 max-w-[80px] shadow-sm mr-auto animate-pulse">
                      <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-100"></span>
                      <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-200"></span>
                      <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-300"></span>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Input Bar */}
                <form 
                  onSubmit={handleSendChatMessage}
                  className="p-4 bg-white border-t border-slate-100 flex items-end space-x-2 flex-none"
                >
                  <div className="flex-1 bg-primary-grey rounded-lg p-3 flex flex-col border border-slate-100 focus-within:border-primary-blue transition-colors">
                    <textarea 
                      value={newChatMessage}
                      onChange={(e) => setNewChatMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChatMessage();
                        }
                      }}
                      placeholder="Ask the agent to edit or update the content of this topic..."
                      rows={2}
                      className="w-full bg-transparent outline-none resize-none font-roboto text-[13px] text-text-grey placeholder-slate-400 border-none p-0 scrollbar-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={!newChatMessage.trim() || isGenerating}
                    className="size-[44px] flex-none flex items-center justify-center bg-primary-blue text-white rounded-lg shadow-md cursor-pointer hover:bg-blue-700 transition-all active:scale-[0.9] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PaperPlaneIcon className="size-[20px] text-white" />
                  </button>
                </form>
              </div>

              {/* Column Divider */}
              <div className="w-[8px] h-full flex items-center justify-center relative flex-none select-none">
                <SplitPaneDivider className="w-full h-full text-slate-200" />
              </div>

              {/* Column 2: Reader article viewport (Markdown rendered) */}
              <div className="flex-1 overflow-y-auto p-8 bg-white scrollbar-thin">
                <article className="space-y-8 animate-fade-in max-w-2xl mx-auto">
                  {currentTopic?.contentMarkdown ? (
                    <Markdown text={currentTopic.contentMarkdown} />
                  ) : (
                    <div className="text-slate-400 font-lora italic text-center py-12">
                      {isGenerating ? "✍️ Editing content..." : "No content generated yet. Ask AI to generate content."}
                    </div>
                  )}
                </article>
              </div>

            </div>
          ) : (
            /* Agent Panel Empty State (Main Scene 3) */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/10 relative">
              
              {/* Centered Message */}
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
                <h2 className="font-departure text-[66px] font-bold text-primary-blue leading-tight tracking-tight">
                  {addingMode === 'topic' ? "Add Topic Mode" : "Nothing to show!"}
                </h2>
                <p className="font-departure text-[33px] text-text-grey max-w-3xl leading-relaxed">
                  {addingMode === 'topic'
                    ? `Instruct the agent to generate a new topic under the module "${
                        learnings.find(l => l.id === activeLearningIdForNewTopic)?.name || ''
                      }"`
                    : "Start chatting with the agent regarding the learning or topic."}
                </p>
              </div>

              {/* Centered Input Box at Bottom */}
              <div className="w-full max-w-4xl mx-auto p-6 flex flex-col items-center flex-none">
                <form 
                  onSubmit={handleSendChatMessage}
                  className="w-full bg-primary-grey rounded-lg p-3 border border-slate-100 flex items-end space-x-2 shadow-sm"
                >
                  <div className="flex-1 flex flex-col">
                    <textarea 
                      value={newChatMessage}
                      onChange={(e) => setNewChatMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChatMessage();
                        }
                      }}
                      placeholder={
                        addingMode === 'topic'
                          ? `Enter a topic title (e.g. Active Matrix vs Passive Matrix) to add under the active module...`
                          : "Enter a topic/subject name (e.g. Intro to Machine Learning) to generate a new course..."
                      }
                      rows={2}
                      className="w-full bg-transparent outline-none resize-none font-roboto text-[13px] text-text-grey placeholder-slate-500 border-none p-0 scrollbar-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={!newChatMessage.trim() || isGenerating}
                    className="size-[40px] flex-none flex items-center justify-center bg-primary-blue text-white rounded-lg shadow cursor-pointer hover:bg-blue-700 transition-all active:scale-[0.9] disabled:opacity-50"
                  >
                    <PaperPlaneIcon className="size-[20px] text-white" />
                  </button>
                </form>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
