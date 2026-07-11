/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Compass,
  History,
  Target,
  User,
  Heart,
  AlertCircle,
  Play,
  Pause,
  ChevronRight,
  Edit2,
  CheckCircle,
  RefreshCw,
  ArrowLeft,
  X,
  Plus,
  BookOpen,
  Calendar,
  Frown,
  Meh,
  Smile,
  LogOut,
  Sliders,
  ChevronDown,
  Info
} from "lucide-react";
import { CheckinEntry, UserData } from "./types";

const STORAGE_KEY = "anchor_user_data_v1";

export default function App() {
  // --- STATE ---
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Setup Form
  const [setupName, setSetupName] = useState("");
  const [setupGoal, setSetupGoal] = useState("");
  const [setupError, setSetupError] = useState("");

  // Check-in input
  const [checkinText, setCheckinText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [latestResponse, setLatestResponse] = useState<CheckinEntry | null>(null);

  // Active Screen / Active Tab (for mobile view tabs: 'dashboard', 'breathing', 'cognitive')
  const [activeTab, setActiveTab] = useState<"dashboard" | "breathing" | "cognitive">("dashboard");

  // Selected entry for detailed view modal
  const [selectedEntry, setSelectedEntry] = useState<CheckinEntry | null>(null);

  // Settings / Edit Profile modal
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGoal, setEditGoal] = useState("");

  // Breathing Visualizer State
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<"inhale" | "hold" | "exhale" | "hold-out">("inhale");
  const [breathingSeconds, setBreathingSeconds] = useState(4);
  const breathingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cognitive Reframing tool state (interactive self-guided CBT helper)
  const [cbtThought, setCbtThought] = useState("");
  const [cbtFacts, setCbtFacts] = useState("");
  const [cbtDistortion, setCbtDistortion] = useState("Comparison Trap");
  const [cbtReframe, setCbtReframe] = useState("");
  const [cbtStep, setCbtStep] = useState(1); // Steps: 1 (The Thought), 2 (The Facts), 3 (The Reframe)

  // System API check
  const [serverHealth, setServerHealth] = useState<{ status: string; hasApiKey: boolean } | null>(null);

  // --- PERSISTENCE & INIT ---
  useEffect(() => {
    // Load local storage data
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.name) {
          setUserData(parsed);
          setEditName(parsed.name);
          setEditGoal(parsed.goal || "");
        }
      } catch (e) {
        console.error("Failed to parse user data", e);
      }
    }
    setIsInitialized(true);

    // Fetch server health/api status
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setServerHealth(data))
      .catch((err) => console.error("Server API health check failed:", err));
  }, []);

  const saveUserData = (newData: UserData) => {
    setUserData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  };

  // --- BREATHING INTERACTION ---
  useEffect(() => {
    if (isBreathing) {
      setBreathingSeconds(4);
      setBreathingPhase("inhale");
      
      const runBreathingLoop = () => {
        breathingTimerRef.current = setInterval(() => {
          setBreathingSeconds((prev) => {
            if (prev <= 1) {
              // Transition to next phase
              setBreathingPhase((currentPhase) => {
                switch (currentPhase) {
                  case "inhale":
                    return "hold";
                  case "hold":
                    return "exhale";
                  case "exhale":
                    return "hold-out";
                  case "hold-out":
                    return "inhale";
                }
              });
              return 4; // Reset to 4 seconds for Box breathing (4-4-4-4)
            }
            return prev - 1;
          });
        }, 1000);
      };
      
      runBreathingLoop();
    } else {
      if (breathingTimerRef.current) {
        clearInterval(breathingTimerRef.current);
      }
      setBreathingPhase("inhale");
      setBreathingSeconds(4);
    }

    return () => {
      if (breathingTimerRef.current) {
        clearInterval(breathingTimerRef.current);
      }
    };
  }, [isBreathing]);

  // --- FORM HANDLERS ---
  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupName.trim()) {
      setSetupError("Please enter your name.");
      return;
    }
    if (!setupGoal.trim()) {
      setSetupError("Please share what you are working toward.");
      return;
    }

    const initialData: UserData = {
      name: setupName.trim(),
      goal: setupGoal.trim(),
      entries: [],
    };

    saveUserData(initialData);
    setEditName(initialData.name);
    setEditGoal(initialData.goal);
    setSetupError("");
  };

  const handleEditProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;
    if (!editName.trim() || !editGoal.trim()) return;

    const updated = {
      ...userData,
      name: editName.trim(),
      goal: editGoal.trim(),
    };
    saveUserData(updated);
    setIsEditingProfile(false);
  };

  const handleCheckinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !checkinText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setApiError("");
    setLatestResponse(null);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: userData.name,
          goal: userData.goal,
          text: checkinText.trim(),
          recentEntries: userData.entries,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Server error communicating with Gemini.");
      }

      const parsedAI = await res.json();
      
      const newEntry: CheckinEntry = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        date: new Date().toISOString(),
        text: checkinText.trim(),
        mood: parsedAI.mood_score,
        aiResponse: parsedAI.response,
      };

      const updatedEntries = [...userData.entries, newEntry];
      saveUserData({
        ...userData,
        entries: updatedEntries,
      });

      setLatestResponse(newEntry);
      setCheckinText("");
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Something went wrong. Please check your network or try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete an entry
  const handleDeleteEntry = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent modal trigger
    if (!userData) return;
    if (!confirm("Are you sure you want to delete this entry?")) return;

    const filtered = userData.entries.filter((entry) => entry.id !== id);
    saveUserData({
      ...userData,
      entries: filtered,
    });
    if (selectedEntry?.id === id) {
      setSelectedEntry(null);
    }
  };

  // Reset all application data (logout / start fresh)
  const handleResetAllData = () => {
    if (confirm("Are you sure you want to reset all data? This deletes your history and cannot be undone.")) {
      localStorage.removeItem(STORAGE_KEY);
      setUserData(null);
      setSetupName("");
      setSetupGoal("");
      setLatestResponse(null);
    }
  };

  // --- STATS COMPUTATIONS ---
  const entriesCount = userData?.entries.length || 0;

  const computeStreak = (entries: CheckinEntry[]): number => {
    if (entries.length === 0) return 0;
    
    // Sort unique dates ascending (YYYY-MM-DD format)
    const sortedDays = [...new Set(entries.map((e) => {
      const d = new Date(e.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }))].sort();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    const lastDay = sortedDays[sortedDays.length - 1];
    
    // If the latest check-in is not today and not yesterday, streak is broken (0)
    if (lastDay !== todayStr && lastDay !== yesterdayStr) {
      return 0;
    }

    let streak = 1;
    // Iterate backwards and count consecutive days
    for (let i = sortedDays.length - 1; i > 0; i--) {
      const cur = new Date(sortedDays[i]);
      const prev = new Date(sortedDays[i - 1]);
      
      const diffTime = Math.abs(cur.getTime() - prev.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        streak++;
      } else if (diffDays > 1) {
        break;
      }
    }
    return streak;
  };

  const currentStreak = userData ? computeStreak(userData.entries) : 0;

  const latestMood = userData?.entries.length 
    ? userData.entries[userData.entries.length - 1].mood 
    : null;

  const averageMood = userData?.entries.length
    ? Math.round((userData.entries.reduce((sum, e) => sum + e.mood, 0) / userData.entries.length) * 10) / 10
    : null;

  // Render mood description/color helper
  const getMoodConfig = (score: number) => {
    if (score >= 8) return { label: "Confident", color: "bg-sage/20 text-dark border-sage", icon: Smile };
    if (score >= 5) return { label: "Balanced", color: "bg-slate/20 text-dark border-slate", icon: Meh };
    return { label: "Anxious", color: "bg-amber-100 text-amber-900 border-amber-300", icon: Frown };
  };

  // Prepopulate CBT helper to make it a direct, complete checkin
  const useCbtReframeAsCheckin = () => {
    if (!cbtThought || !cbtReframe) return;
    const combinedText = `Working through a worry using CBT:
- Original thought: "${cbtThought}"
- Identified Trap: ${cbtDistortion}
- Objective evidence & reframe: "${cbtReframe}"`;
    setCheckinText(combinedText);
    setActiveTab("dashboard");
    // Scroll to checkin area if needed
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Reset CBT tool
    setCbtThought("");
    setCbtFacts("");
    setCbtReframe("");
    setCbtStep(1);
  };

  // --- RENDER COMPONENT ---
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-sage border-t-transparent rounded-full animate-spin" />
          <p className="text-muted font-medium text-sm font-sans">Preparing your calm companion...</p>
        </div>
      </div>
    );
  }

  // SCREEN 1: Setup Screen
  if (!userData) {
    return (
      <div className="relative min-h-screen bg-cream flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 font-sans overflow-hidden">
        {/* Animated Mesh-style Background Decorations (Static blur blobs) */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#84B59F] opacity-30 rounded-full blur-[80px] pointer-events-none z-0"></div>
        <div className="absolute top-1/2 -right-24 w-[500px] h-[500px] bg-[#50808E] opacity-20 rounded-full blur-[100px] pointer-events-none z-0"></div>
        <div className="absolute bottom-0 left-1/3 w-[600px] h-[400px] bg-[#69A297] opacity-25 rounded-full blur-[90px] pointer-events-none z-0"></div>

        <div className="relative z-10 max-w-md w-full mx-auto space-y-8 bg-white/50 backdrop-blur-2xl border border-white/60 p-8 rounded-[32px] shadow-2xl shadow-slate-900/5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-dark text-sage mb-4 shadow-lg">
              <Compass className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-dark tracking-tight">KelpAI</h1>
            <p className="mt-2 text-sm text-muted">
              AI-guided calm for the career decisions that stress students out most.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSetup}>
            {setupError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{setupError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-dark uppercase tracking-wider mb-2">
                  What should we call you?
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/30 border border-slate/30 rounded-xl text-dark text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-sage/40 transition-all"
                  placeholder="e.g. Alex"
                />
              </div>

              <div>
                <label htmlFor="goal" className="block text-xs font-semibold text-dark uppercase tracking-wider mb-2">
                  What career milestone are you working toward?
                </label>
                <textarea
                  id="goal"
                  required
                  rows={2}
                  value={setupGoal}
                  onChange={(e) => setSetupGoal(e.target.value)}
                  className="w-full px-4 py-3 bg-white/30 border border-slate/30 rounded-xl text-dark text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-sage/40 transition-all resize-none"
                  placeholder="e.g. landing my first UX design internship, finding an entry-level software job, or figuring out my major"
                />
              </div>
            </div>

            {serverHealth && !serverHealth.hasApiKey && (
              <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl flex items-start gap-2 border border-amber-200 leading-relaxed">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block">Awaiting API Key</strong>
                  Please configure your <code className="bg-amber-100 px-1 rounded text-red-800">GEMINI_API_KEY</code> secret inside Google AI Studio's <strong>Settings &gt; Secrets</strong> menu before starting check-ins.
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-dark hover:bg-slate active:bg-dark-light shadow-lg hover:shadow-xl transition-all cursor-pointer focus:outline-none"
              >
                Enter App
                <ChevronRight className="ml-1 w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        <div className="relative z-10 text-center text-xs text-muted/60 font-mono mt-8">
          KelpAI Companion v1.1 · Secure Offline Local Storage
        </div>
      </div>
    );
  }

  // SCREEN 2: App Screen
  return (
    <div className="relative min-h-screen bg-cream flex flex-col font-sans selection:bg-sage/30 overflow-hidden">
      
      {/* Animated Mesh-style Background Decorations (Static blur blobs) */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#84B59F] opacity-30 rounded-full blur-[80px] pointer-events-none z-0"></div>
      <div className="absolute top-1/2 -right-24 w-[500px] h-[500px] bg-[#50808E] opacity-20 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-0 left-1/3 w-[600px] h-[400px] bg-[#69A297] opacity-25 rounded-full blur-[90px] pointer-events-none z-0"></div>

      {/* GLOBAL HEADER */}
      <header className="relative z-40 sticky top-0 bg-white/30 backdrop-blur-md border-b border-white/40 shadow-sm text-dark">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-dark text-white rounded-xl flex items-center justify-center shadow-lg">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-dark">KelpAI</h1>
              <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Career Clarity Companion</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick Profile Card Display */}
            <div className="hidden sm:flex flex-col text-right mr-2">
              <span className="text-xs font-semibold text-dark">Hi, {userData.name}</span>
              <span className="text-[10px] text-muted truncate max-w-[180px] font-mono italic">{userData.goal}</span>
            </div>

            <button
              onClick={() => {
                setEditName(userData.name);
                setEditGoal(userData.goal);
                setIsEditingProfile(true);
              }}
              title="Edit Profile & Goal"
              className="p-2 text-dark hover:text-sage rounded-xl hover:bg-white/40 transition-all cursor-pointer border border-transparent hover:border-white/50 shadow-xs"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleResetAllData}
              title="Reset All Data"
              className="p-2 text-muted hover:text-red-500 rounded-xl hover:bg-white/40 transition-all cursor-pointer border border-transparent hover:border-white/50 shadow-xs"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* SUB-HEADER TABS FOR NAVIGATION */}
      <div className="relative z-30 bg-white/30 backdrop-blur-md border-b border-white/40 shadow-sm sticky top-[73px]">
        <div className="max-w-6xl mx-auto px-4 flex space-x-1 py-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border ${
              activeTab === "dashboard"
                ? "bg-white/60 border-white/80 text-dark shadow-xs scale-[1.02]"
                : "border-transparent text-muted hover:bg-white/40 hover:text-dark"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Daily Check-in</span>
          </button>

          <button
            onClick={() => setActiveTab("breathing")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border ${
              activeTab === "breathing"
                ? "bg-white/60 border-white/80 text-dark shadow-xs scale-[1.02]"
                : "border-transparent text-muted hover:bg-white/40 hover:text-dark"
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Calm Breathing Guide</span>
          </button>

          <button
            onClick={() => setActiveTab("cognitive")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border ${
              activeTab === "cognitive"
                ? "bg-white/60 border-white/80 text-dark shadow-xs scale-[1.02]"
                : "border-transparent text-muted hover:bg-white/40 hover:text-dark"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>CBT Worry Deconstruction</span>
          </button>
        </div>
      </div>

      {/* CORE BODY WRAPPER */}
      <main className="flex-grow max-w-6xl w-full mx-auto px-4 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* TAB 1: DAILY CHECK-IN DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="lg:col-span-2 space-y-6">
            
            {/* TONIGHT'S CHECK-IN INPUT CARD */}
            <div className="bg-white/50 backdrop-blur-2xl border border-white/60 p-8 rounded-[32px] shadow-2xl shadow-slate-900/5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-dark">Tonight's check-in</h2>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Spend 30 seconds. Write whatever's on your mind regarding your career goal today — a triumph, a minor setback, peer comparison, or absolutely nothing at all.
                  </p>
                </div>
                <div className="bg-white/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/50 text-[10px] font-mono text-dark flex items-center space-x-1.5 flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>CBT Grounding Enabled</span>
                </div>
              </div>

              <form onSubmit={handleCheckinSubmit} className="mt-4 space-y-4">
                <div className="relative">
                  <textarea
                    rows={4}
                    required
                    value={checkinText}
                    onChange={(e) => setCheckinText(e.target.value)}
                    placeholder="e.g., Felt incredibly behind today when seeing other students post about their summer job offers on LinkedIn. Makes me feel like I won't even find an internship and my preparation is too late..."
                    className="w-full p-4 bg-white/30 border border-slate-300 rounded-2xl text-dark text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-sage/60 transition-all resize-y"
                  />
                  
                  {/* Word count or short suggestions */}
                  <div className="absolute right-3 bottom-3 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setCheckinText("Felt overwhelmed looking at job applications. There are too many requirements for an entry role...")}
                      className="text-[10px] text-muted hover:text-dark bg-white/60 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-300/40 cursor-pointer transition-all"
                    >
                      💡 Starter template
                    </button>
                  </div>
                </div>

                {apiError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{apiError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted/80 font-mono">
                    Target Goal: <span className="text-dark font-semibold underline decoration-sage decoration-2">{userData.goal}</span>
                  </span>

                  <button
                    type="submit"
                    disabled={isSubmitting || !checkinText.trim()}
                    className="flex items-center justify-center px-6 py-3 bg-dark hover:bg-slate text-white rounded-xl text-xs font-bold shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:bg-slate/30 disabled:text-white/60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="animate-spin mr-2 w-4 h-4" />
                        Reframing with Anchor...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 w-4 h-4 text-sage" />
                        Submit Check-in
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* AI REFLECTION FEEDBACK / RESPONSE CARD */}
            <AnimatePresence>
              {(latestResponse || (userData.entries.length > 0 && !latestResponse)) && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="bg-dark/95 backdrop-blur-2xl p-8 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden text-white"
                >
                  {/* Decorative background anchor icon */}
                  <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] text-white">
                    <Compass className="w-48 h-48" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-sage/10 text-sage flex items-center justify-center">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-sage">Anchor's Reframe Guidance</h3>
                          <p className="text-[10px] text-muted">
                            Generated on {new Date(latestResponse?.date || userData.entries[userData.entries.length - 1].date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Computed Calm Level:</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                          getMoodConfig(latestResponse?.mood || userData.entries[userData.entries.length - 1].mood).color
                        }`}>
                          {(latestResponse?.mood || userData.entries[userData.entries.length - 1].mood)}/10
                        </span>
                      </div>
                    </div>

                    <div className="text-sm text-cream/90 leading-relaxed font-sans space-y-4">
                      <p className="bg-white/5 p-4 rounded-2xl border border-white/10 italic text-xs text-sage">
                        "{(latestResponse?.text || userData.entries[userData.entries.length - 1].text)}"
                      </p>
                      
                      <div className="text-sm font-light tracking-wide leading-relaxed pl-3 border-l-2 border-sage text-cream/90">
                        {(latestResponse?.aiResponse || userData.entries[userData.entries.length - 1].aiResponse)}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-sage fill-sage" />
                        Values & progress compared only to yourself
                      </span>

                      <button
                        onClick={() => {
                          setCheckinText("");
                          setLatestResponse(null);
                        }}
                        className="text-sage hover:text-white transition-colors cursor-pointer text-[10px] font-mono uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/20"
                      >
                        Dismiss Card
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* PREVIOUS ENTRIES ACCORDION / LOGS */}
            <div className="bg-white/40 backdrop-blur-lg border border-white/50 p-8 rounded-[32px] shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-4 mb-4">
                <div>
                  <h2 className="text-base font-bold text-dark">Recent entries history</h2>
                  <p className="text-xs text-muted mt-0.5">Reframing log of your career thoughts</p>
                </div>
                <span className="text-[11px] font-mono bg-white/60 px-3 py-1 rounded-full text-dark border border-white/80 shadow-xs">
                  Total: {userData.entries.length}
                </span>
              </div>

              {userData.entries.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/50 text-muted/60 mb-3 border border-white/60">
                    <History className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-muted">No check-ins logged yet.</p>
                  <p className="text-[11px] text-muted/60 mt-1">Your daily entries and their mindful reframes will accumulate here.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200/50 max-h-[400px] overflow-y-auto pr-1">
                  {[...userData.entries].reverse().map((entry) => {
                    const moodConf = getMoodConfig(entry.mood);
                    const MoodIcon = moodConf.icon;
                    return (
                      <div
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        className="py-3.5 flex items-start justify-between gap-3 group hover:bg-white/40 px-3 rounded-xl cursor-pointer transition-all border border-transparent hover:border-white/50 hover:shadow-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-grow">
                          <div className="flex items-center space-x-2 text-[11px]">
                            <span className="text-muted/80 font-mono">
                              {new Date(entry.date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            <span className="text-muted/40">•</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${moodConf.color}`}>
                              <MoodIcon className="w-3 h-3 flex-shrink-0" />
                              Mood: {entry.mood}/10 ({moodConf.label})
                            </span>
                          </div>

                          <p className="text-xs font-medium text-dark line-clamp-2 pr-4 leading-relaxed">
                            {entry.text}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <button
                            onClick={(e) => handleDeleteEntry(entry.id, e)}
                            className="text-muted/40 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                            title="Delete entry"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-muted/60 group-hover:text-dark transition-colors" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: BOX BREATHING VISUALIZER GUIDE */}
        {activeTab === "breathing" && (
          <div className="lg:col-span-2 bg-white/50 backdrop-blur-2xl border border-white/60 p-8 rounded-[32px] shadow-2xl flex flex-col items-center justify-between min-h-[500px]">
            
            <div className="text-center max-w-md">
              <h2 className="text-xl font-bold text-dark">Mindful Box Breathing</h2>
              <p className="text-xs text-muted mt-2 leading-relaxed">
                A simple, science-backed 4-second cycle used by high-stress professionals and athletes to quickly lower autonomic anxiety, stabilize heart rate, and clear mental static.
              </p>
            </div>

            {/* Breathing Circle Visualization */}
            <div className="my-8 relative flex items-center justify-center w-64 h-64">
              
              {/* Pulsing ring animations */}
              <AnimatePresence>
                {isBreathing && (
                  <>
                    <motion.div
                      key={`ring-1-${breathingPhase}`}
                      className="absolute inset-0 rounded-full bg-sage/10"
                      initial={{ scale: 0.8, opacity: 0.8 }}
                      animate={{
                        scale: breathingPhase === "inhale" ? 1.3 : breathingPhase === "exhale" ? 0.8 : breathingPhase === "hold" ? 1.3 : 0.8,
                        opacity: [0.6, 0.1],
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      key={`ring-2-${breathingPhase}`}
                      className="absolute inset-4 rounded-full bg-eucalyptus/10"
                      initial={{ scale: 0.9, opacity: 0.6 }}
                      animate={{
                        scale: breathingPhase === "inhale" ? 1.25 : breathingPhase === "exhale" ? 0.9 : breathingPhase === "hold" ? 1.25 : 0.9,
                        opacity: [0.5, 0],
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Central Solid Circle */}
              <motion.div
                className={`w-44 h-44 rounded-full flex flex-col items-center justify-center text-center shadow-lg relative border-4 ${
                  isBreathing ? "border-sage bg-dark text-white" : "border-slate-300 bg-white/40 backdrop-blur-md text-dark"
                }`}
                animate={{
                  scale: isBreathing
                    ? breathingPhase === "inhale"
                      ? 1.2
                      : breathingPhase === "hold"
                      ? 1.2
                      : breathingPhase === "exhale"
                      ? 0.9
                      : 0.9 // hold out
                    : 1,
                }}
                transition={{ duration: 4, ease: "easeInOut" }}
              >
                {!isBreathing ? (
                  <div className="p-3">
                    <Compass className="w-8 h-8 mx-auto text-dark animate-pulse mb-2" />
                    <span className="text-xs font-bold tracking-wider uppercase text-muted">Ready</span>
                  </div>
                ) : (
                  <div className="p-4 select-none">
                    <motion.p
                      key={breathingPhase}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-lg font-bold uppercase tracking-widest text-sage"
                    >
                      {breathingPhase === "inhale" && "Inhale 💨"}
                      {breathingPhase === "hold" && "Hold 🧘"}
                      {breathingPhase === "exhale" && "Exhale 🌬️"}
                      {breathingPhase === "hold-out" && "Rest ✨"}
                    </motion.p>
                    <p className="text-3xl font-mono font-bold mt-1.5">{breathingSeconds}</p>
                    <p className="text-[9px] text-muted mt-1 uppercase tracking-wider">
                      {breathingPhase === "inhale" && "Fill your chest"}
                      {breathingPhase === "hold" && "Keep a calm frame"}
                      {breathingPhase === "exhale" && "Release the static"}
                      {breathingPhase === "hold-out" && "Relax and pause"}
                    </p>
                  </div>
                )}
              </motion.div>
            </div>

            <div className="space-y-4 w-full max-w-sm">
              <button
                onClick={() => setIsBreathing(!isBreathing)}
                className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                  isBreathing
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-dark hover:bg-slate text-white"
                }`}
              >
                {isBreathing ? (
                  <>
                    <Pause className="w-4 h-4 fill-white" />
                    Pause Exercise
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white animate-bounce" />
                    Start Breathing Loop
                  </>
                )}
              </button>

              <div className="bg-white/30 border border-slate-300/40 p-3 rounded-xl text-center">
                <span className="text-[10px] text-muted leading-normal block">
                  Tip: Rest your shoulders, put your feet flat on the floor, and match the expansion of the green ring with your breath.
                </span>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: COGNITIVE WORRY DECONSTRUCTION WORKSPACE */}
        {activeTab === "cognitive" && (
          <div className="lg:col-span-2 bg-white/50 backdrop-blur-2xl border border-white/60 p-8 rounded-[32px] shadow-2xl space-y-6">
            
            <div className="border-b border-slate-200/50 pb-4">
              <h2 className="text-lg font-bold text-dark flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-slate" />
                CBT Worry Deconstruction Workspace
              </h2>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                When you're stuck catastrophizing about your career (e.g., "I will never get hired"), write down the worry and systematically challenge it using objective facts. This separates nervous stories from physical reality.
              </p>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center justify-between px-2">
              {[
                { step: 1, label: "1. The Worry" },
                { step: 2, label: "2. The Facts" },
                { step: 3, label: "3. The Reframe" },
              ].map((s) => (
                <div key={s.step} className="flex items-center space-x-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all border ${
                    cbtStep === s.step
                      ? "bg-dark text-white border-dark scale-110 shadow-sm"
                      : cbtStep > s.step
                      ? "bg-sage text-dark border-sage"
                      : "bg-white/40 text-muted border-slate-300"
                  }`}>
                    {s.step}
                  </div>
                  <span className={`text-[11px] font-bold hidden md:inline transition-colors ${
                    cbtStep === s.step ? "text-dark" : "text-muted"
                  }`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Step Content */}
            <div className="bg-white/30 backdrop-blur-md p-6 rounded-2xl border border-white/60 min-h-[220px] flex flex-col justify-between shadow-xs">
              
              {cbtStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">
                      Write down your automatic anxious thought:
                    </label>
                    <textarea
                      rows={3}
                      value={cbtThought}
                      onChange={(e) => setCbtThought(e.target.value)}
                      placeholder="e.g. My classmate has 2 internships and I have none. I'm already too late and will never get hired."
                      className="w-full p-3.5 bg-white/60 border border-slate-300 rounded-xl text-xs placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">
                      Identify the Career Anxiety Trap:
                    </label>
                    <select
                      value={cbtDistortion}
                      onChange={(e) => setCbtDistortion(e.target.value)}
                      className="w-full p-3 bg-white/60 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent transition-all cursor-pointer"
                    >
                      <option value="Comparison Trap">The Comparison Trap (Measuring your inside struggle against their clean outside show)</option>
                      <option value="Catastrophizing">Catastrophizing (Assuming the absolute worst-case scenario is a mathematical guarantee)</option>
                      <option value="All-or-Nothing Thinking">All-or-Nothing Thinking (Treating anything less than perfect as a complete failure)</option>
                      <option value="Imposter syndrome">Imposter Syndrome (Believing wins are luck and setbacks are proof of fraud)</option>
                    </select>
                  </div>
                </div>
              )}

              {cbtStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted leading-relaxed mb-3">
                      Your automatic thought was: <strong className="text-dark">"{cbtThought}"</strong>
                    </p>
                    <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">
                      What are the objective facts, evidence, and resources? (List them out objectively)
                    </label>
                    <textarea
                      rows={3}
                      value={cbtFacts}
                      onChange={(e) => setCbtFacts(e.target.value)}
                      placeholder="e.g. 1) I am still in college and have 2 semesters remaining. 2) I have completed 3 solid class projects. 3) People find jobs through many routes besides early internships. 4) I have not applied to many roles yet."
                      className="w-full p-3.5 bg-white/60 border border-slate-300 rounded-xl text-xs placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              )}

              {cbtStep === 3 && (
                <div className="space-y-4">
                  <div className="text-xs space-y-2 bg-white/50 p-4 rounded-xl border border-white/80">
                    <p className="text-muted"><strong className="text-dark">Worry:</strong> "{cbtThought}"</p>
                    <p className="text-muted"><strong className="text-dark">Facts:</strong> "{cbtFacts}"</p>
                    <p className="text-muted"><strong className="text-dark">Anxiety Trap:</strong> {cbtDistortion}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">
                      Write down a balanced, practical reframe + one micro next step:
                    </label>
                    <textarea
                      rows={3}
                      value={cbtReframe}
                      onChange={(e) => setCbtReframe(e.target.value)}
                      placeholder="e.g. Someone else's early offer does not shrink the global job pool. I am working at my own pace. Today, I'll spent 10 minutes cleaning my resume header, which is real progress."
                      className="w-full p-3.5 bg-white/60 border border-slate-300 rounded-xl text-xs placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Navigation controls */}
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-200/50">
                <button
                  type="button"
                  disabled={cbtStep === 1}
                  onClick={() => setCbtStep((prev) => prev - 1)}
                  className="px-4 py-2 bg-white/50 border border-slate-300/40 hover:bg-white/80 text-dark rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Back
                </button>

                {cbtStep < 3 ? (
                  <button
                    type="button"
                    disabled={(cbtStep === 1 && !cbtThought.trim()) || (cbtStep === 2 && !cbtFacts.trim())}
                    onClick={() => setCbtStep((prev) => prev + 1)}
                    className="px-5 py-2 bg-dark hover:bg-slate text-white rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!cbtReframe.trim()}
                    onClick={useCbtReframeAsCheckin}
                    className="px-5 py-2 bg-dark text-white hover:bg-slate font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 shadow-lg hover:shadow-xl"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sage" />
                    Use as Check-in
                  </button>
                )}
              </div>

            </div>

          </div>
        )}

        {/* SIDEBAR COLUMNS (FOR DESKTOP GRID LAYOUT) */}
        <div className="space-y-6">
          
          {/* USER PROGRESS STATS CARD (COMPARED ONLY TO YOU) */}
          <div className="bg-white/50 backdrop-blur-2xl border border-white/60 p-8 rounded-[32px] shadow-2xl">
            <div className="flex items-center space-x-2 border-b border-slate-200/50 pb-3 mb-4">
              <Target className="w-4 h-4 text-slate" />
              <h3 className="text-sm font-bold text-dark">Your Progress</h3>
            </div>

            <p className="text-[11px] text-muted/80 leading-normal mb-4">
              These stats compare your calm framework purely against yourself. There are no scoreboards, rankings, or peers.
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-1 gap-3">
              
              {/* Day Streak */}
              <div className="bg-white/40 backdrop-blur-lg border border-white/50 p-4 rounded-2xl shadow-xs text-center lg:text-left flex flex-col lg:flex-row lg:items-center lg:gap-3">
                <div className="w-8 h-8 rounded-lg bg-sage/20 text-dark flex items-center justify-center mx-auto lg:mx-0 flex-shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xl font-mono font-bold text-dark leading-tight">{currentStreak}</div>
                  <div className="text-[10px] text-muted tracking-wider uppercase font-semibold mt-0.5">Day Streak</div>
                </div>
              </div>

              {/* Check-ins Logged */}
              <div className="bg-white/40 backdrop-blur-lg border border-white/50 p-4 rounded-2xl shadow-xs text-center lg:text-left flex flex-col lg:flex-row lg:items-center lg:gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate/20 text-dark flex items-center justify-center mx-auto lg:mx-0 flex-shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xl font-mono font-bold text-dark leading-tight">{entriesCount}</div>
                  <div className="text-[10px] text-muted tracking-wider uppercase font-semibold mt-0.5">Logs Logged</div>
                </div>
              </div>

              {/* Latest Calm Score */}
              <div className="bg-white/40 backdrop-blur-lg border border-white/50 p-4 rounded-2xl shadow-xs text-center lg:text-left flex flex-col lg:flex-row lg:items-center lg:gap-3">
                <div className="w-8 h-8 rounded-lg bg-eucalyptus/20 text-dark flex items-center justify-center mx-auto lg:mx-0 flex-shrink-0">
                  <Smile className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xl font-mono font-bold text-dark leading-tight">
                    {latestMood !== null ? `${latestMood}/10` : "–"}
                  </div>
                  <div className="text-[10px] text-muted tracking-wider uppercase font-semibold mt-0.5">Latest Calm</div>
                </div>
              </div>

            </div>

            {/* Average Mood Trend Bar */}
            {averageMood !== null && (
              <div className="mt-4 pt-3 border-t border-slate-200/50 space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono text-muted uppercase">
                  <span>Average Calm Score</span>
                  <span className="font-bold text-dark">{averageMood}/10</span>
                </div>
                <div className="w-full bg-cream h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-eucalyptus h-full rounded-full transition-all"
                    style={{ width: `${averageMood * 10}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* QUICK MIND COHERENCE TIPS */}
          <div className="bg-dark text-white p-8 rounded-[32px] border border-white/10 shadow-2xl">
            <div className="flex items-center space-x-2 border-b border-white/10 pb-3 mb-4">
              <User className="w-4 h-4 text-sage" />
              <h3 className="text-sm font-bold text-white">Mindful Career Guide</h3>
            </div>
            
            <ul className="space-y-4 text-xs text-slate-200 pl-1 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-sage mt-1.5 flex-shrink-0" />
                <p>
                  <strong className="text-sage font-semibold">Filter Out the Noise:</strong> LinkedIn represents the top 5% highlight reels of people's lives. Never compare your raw draft to someone else's final edit.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-sage mt-1.5 flex-shrink-0" />
                <p>
                  <strong className="text-sage font-semibold">Break It Down:</strong> "Finding a job" is not a single task. It consists of 100 mini-tasks. You can only work on one mini-task at a time.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-sage mt-1.5 flex-shrink-0" />
                <p>
                  <strong className="text-sage font-semibold">CBT Reframing:</strong> Ask yourself: "Is this thought a mathematical certainty or just a story my nervous system is spinning to protect me?"
                </p>
              </li>
            </ul>
          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer className="relative z-10 px-10 py-6 flex flex-col md:flex-row items-center justify-between border-t border-white/30 bg-white/20 backdrop-blur-sm text-[11px] text-[#5C6D69] font-medium mt-12 gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6">
          <span>Privacy Enabled: Local Storage Only</span>
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            AI Engine Connected (Gemini 3.5 Flash)
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-4 text-xs">
          <button onClick={() => setActiveTab("breathing")} className="hover:text-dark transition-colors cursor-pointer">Guided Breathing</button>
          <button onClick={() => setActiveTab("cognitive")} className="hover:text-dark transition-colors cursor-pointer">CBT Worry Workshop</button>
          <button onClick={() => alert("All KelpAI check-ins and stats stay safely saved on your local device browser storage. Your inputs are only sent securely to Gemini to process CBT-style reframings.")} className="hover:text-dark transition-colors cursor-pointer">Privacy & Local Storage</button>
        </div>
        <div>
          KelpAI v1.1.0 • Student Resilience
        </div>
      </footer>

      {/* DETAILS DIALOG / MODAL */}
      <AnimatePresence>
        {selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate/10 flex flex-col"
            >
              {/* Header */}
              <div className="bg-dark text-white p-5 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Compass className="w-5 h-5 text-sage" />
                  <div>
                    <h3 className="font-bold text-sm">Mindful Log Details</h3>
                    <p className="text-[10px] text-muted">
                      {new Date(selectedEntry.date).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-dark2 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-dark uppercase tracking-wider">Your Entry:</h4>
                  <div className="bg-cream/50 p-4 rounded-xl border border-slate/10 text-xs text-dark leading-relaxed italic">
                    "{selectedEntry.text}"
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-dark uppercase tracking-wider">KelpAI Reframe & Advice:</h4>
                    <span className="text-[10px] font-mono font-bold bg-sage/20 text-dark px-2 py-0.5 rounded border border-sage/20">
                      Calm score: {selectedEntry.mood}/10
                    </span>
                  </div>
                  <div className="bg-dark text-cream/90 p-4 rounded-xl border border-dark2 text-xs leading-relaxed font-sans pl-3 border-l-4 border-sage">
                    {selectedEntry.aiResponse}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-cream p-4 flex justify-end gap-3 border-t border-slate/10">
                <button
                  onClick={() => {
                    setCheckinText(selectedEntry.text);
                    setSelectedEntry(null);
                    setActiveTab("dashboard");
                  }}
                  className="px-4 py-2 text-xs font-bold text-dark bg-white hover:bg-slate/10 border border-slate/20 rounded-xl cursor-pointer"
                >
                  Edit / Rewrite Checkin
                </button>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="px-5 py-2 text-xs font-bold text-white bg-dark hover:bg-slate rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROFILE / EDIT GOAL MODAL */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate/10"
            >
              <div className="bg-dark text-white p-5 flex justify-between items-center">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sage" />
                  Edit Profile & Milestone Goal
                </h3>
                <button
                  onClick={() => setIsEditingProfile(false)}
                  className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-dark2 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditProfile} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-cream/50 border border-slate/20 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-sage"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">
                    Career Milestone Goal
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={editGoal}
                    onChange={(e) => setEditGoal(e.target.value)}
                    className="w-full px-3 py-2.5 bg-cream/50 border border-slate/20 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-sage resize-none"
                    placeholder="e.g., land my first software internship, find an entry-level job"
                  />
                  <p className="text-[10px] text-muted mt-1 leading-normal">
                    This updates KelpAI's frame of reference for validating and reframing your daily thoughts.
                  </p>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate/10">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 text-xs font-bold text-dark bg-white hover:bg-slate/10 border border-slate/20 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-dark hover:bg-slate rounded-xl cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
