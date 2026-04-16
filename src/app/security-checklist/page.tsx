"use client";

import { useState, useEffect } from "react";
import {
  Home, Key, Shield, AlertTriangle, CheckCircle2,
  ChevronRight, ChevronLeft, Lock, ArrowRight,
  Phone, X, Download, Mail, Share2
} from "lucide-react";
import Link from "next/link";

interface ChecklistItem {
  id: string;
  question: string;
  description: string;
  riskLevel: "high" | "medium" | "low";
  recommendation: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  items: ChecklistItem[];
}

const checklistSections: Section[] = [
  {
    id: "doors",
    title: "Doors",
    icon: Home,
    description: "Check all entry points to your home",
    items: [
      {
        id: "front-door-frame",
        question: "Is your front door frame solid with no visible gaps?",
        description: "A weak or damaged frame can be easily kicked in by intruders",
        riskLevel: "high",
        recommendation: "Consider reinforcing your door frame with a steel strike plate and 3-inch screws"
      },
      {
        id: "door-hinges",
        question: "Are your door hinges on the inside of the door?",
        description: "External hinges can be removed to gain entry",
        riskLevel: "high",
        recommendation: "If hinges are external, install security hinge pins or replace the door"
      },
      {
        id: "door-viewer",
        question: "Do you have a door viewer (peephole) or video doorbell?",
        description: "Allows you to see who's at the door before opening",
        riskLevel: "medium",
        recommendation: "Install a wide-angle door viewer or smart video doorbell"
      },
      {
        id: "door-chain",
        question: "Do you have a door chain or door limiter installed?",
        description: "Allows partial opening to verify visitors",
        riskLevel: "medium",
        recommendation: "Install a door chain or London bar for added security when answering"
      },
      {
        id: "back-door",
        question: "Is your back door as secure as your front door?",
        description: "Back doors are often targeted as they're less visible to neighbours",
        riskLevel: "high",
        recommendation: "Ensure back doors have the same level of security as front doors"
      },
      {
        id: "patio-doors",
        question: "If you have patio/sliding doors, do they have anti-lift devices?",
        description: "Sliding doors can often be lifted off their tracks",
        riskLevel: "high",
        recommendation: "Install anti-lift blocks and a track lock on sliding doors"
      },
      {
        id: "letter-box",
        question: "Is your letterbox protected against lock manipulation?",
        description: "Thieves can use tools through letterboxes to reach locks or keys",
        riskLevel: "medium",
        recommendation: "Install a letterbox guard or cage on the inside"
      },
    ]
  },
  {
    id: "locks",
    title: "Locks",
    icon: Key,
    description: "Assess the quality of your locks",
    items: [
      {
        id: "lock-type",
        question: "Do you have a British Standard (BS3621) mortice deadlock?",
        description: "This is the minimum standard required by most insurance policies",
        riskLevel: "high",
        recommendation: "Upgrade to a BS3621 certified 5-lever mortice deadlock"
      },
      {
        id: "cylinder-lock",
        question: "If you have a cylinder lock, is it anti-snap/anti-bump/anti-pick?",
        description: "Standard euro cylinders can be snapped in under 30 seconds",
        riskLevel: "high",
        recommendation: "Replace with a 3-star rated anti-snap cylinder lock"
      },
      {
        id: "window-locks",
        question: "Do all your windows have key-operated locks?",
        description: "Windows are common entry points for burglars",
        riskLevel: "high",
        recommendation: "Install key-operated window locks on all accessible windows"
      },
      {
        id: "spare-keys",
        question: "Do you keep spare keys hidden outside your home?",
        description: "Burglars know all the common hiding spots",
        riskLevel: "high",
        recommendation: "Never hide keys outside. Give spares to trusted neighbours or use a key safe"
      },
      {
        id: "lock-age",
        question: "Are your locks less than 10 years old?",
        description: "Older locks may be worn and easier to bypass",
        riskLevel: "medium",
        recommendation: "Consider replacing locks that are over 10 years old"
      },
      {
        id: "garage-lock",
        question: "Does your garage have adequate security locks?",
        description: "Garages often contain valuable tools and provide access to homes",
        riskLevel: "medium",
        recommendation: "Fit a garage defender or additional padlock to garage doors"
      },
      {
        id: "night-latch",
        question: "If you have a night latch, is it deadlocking?",
        description: "Standard night latches can be opened with a credit card",
        riskLevel: "medium",
        recommendation: "Upgrade to an automatic deadlocking night latch"
      },
    ]
  },
  {
    id: "risks",
    title: "Risk Assessment",
    icon: Shield,
    description: "Identify potential security vulnerabilities",
    items: [
      {
        id: "external-lighting",
        question: "Do you have motion-sensor security lighting outside?",
        description: "Lighting deters intruders and alerts neighbours",
        riskLevel: "medium",
        recommendation: "Install PIR sensor lights covering all entry points"
      },
      {
        id: "visibility",
        question: "Are your entry points visible from the street or neighbours?",
        description: "Secluded entrances are more appealing to burglars",
        riskLevel: "medium",
        recommendation: "Trim hedges and consider adding CCTV for hidden areas"
      },
      {
        id: "alarm-system",
        question: "Do you have a working burglar alarm system?",
        description: "Alarms deter burglars and alert you to intrusions",
        riskLevel: "medium",
        recommendation: "Install a monitored alarm system with visible external bell box"
      },
      {
        id: "key-visibility",
        question: "Are your keys kept out of sight from windows and letterboxes?",
        description: "Thieves use hooks and magnets to fish for visible keys",
        riskLevel: "high",
        recommendation: "Store keys in a secure location away from doors and windows"
      },
      {
        id: "holiday-security",
        question: "Do you have measures in place when away (timers, mail collection)?",
        description: "Empty-looking homes are targets for opportunistic burglars",
        riskLevel: "medium",
        recommendation: "Use timer switches for lights and ask neighbours to collect mail"
      },
      {
        id: "cctv",
        question: "Do you have CCTV or smart cameras installed?",
        description: "Visual deterrent and evidence collection",
        riskLevel: "low",
        recommendation: "Consider visible CCTV or smart doorbell cameras"
      },
      {
        id: "insurance",
        question: "Does your home insurance cover you for theft?",
        description: "Many policies require specific security measures",
        riskLevel: "medium",
        recommendation: "Check your policy requirements and ensure compliance"
      },
    ]
  }
];

type AnswerType = "yes" | "no" | "not-sure" | null;

export default function SecurityChecklistPage() {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerType>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [email, setEmail] = useState("");
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const currentSection = checklistSections[currentSectionIndex];
  const totalItems = checklistSections.reduce((sum, s) => sum + s.items.length, 0);
  const answeredItems = Object.keys(answers).length;
  const progress = (answeredItems / totalItems) * 100;

  // Calculate scores
  const calculateScores = () => {
    let totalRisk = 0;
    let maxRisk = 0;
    const sectionScores: Record<string, { score: number; max: number; issues: string[] }> = {};

    checklistSections.forEach(section => {
      let sectionRisk = 0;
      let sectionMax = 0;
      const issues: string[] = [];

      section.items.forEach(item => {
        const riskValue = item.riskLevel === "high" ? 3 : item.riskLevel === "medium" ? 2 : 1;
        sectionMax += riskValue;
        maxRisk += riskValue;

        const answer = answers[item.id];
        if (answer === "yes") {
          sectionRisk += riskValue;
          totalRisk += riskValue;
        } else if (answer === "no" || answer === "not-sure") {
          issues.push(item.recommendation);
        }
      });

      sectionScores[section.id] = {
        score: Math.round((sectionRisk / sectionMax) * 100),
        max: sectionMax,
        issues
      };
    });

    const overallScore = Math.round((totalRisk / maxRisk) * 100);
    return { overallScore, sectionScores };
  };

  const handleAnswer = (itemId: string, answer: AnswerType) => {
    setAnswers(prev => ({ ...prev, [itemId]: answer }));
  };

  const goToNextSection = () => {
    if (currentSectionIndex < checklistSections.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setIsComplete(true);
    }
  };

  const goToPreviousSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const { overallScore, sectionScores } = calculateScores();

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Needs Improvement";
    return "At Risk";
  };

  const handleEmailResults = async () => {
    if (!email) return;

    try {
      await fetch("/api/marketing/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "security-checklist",
          data: {
            score: overallScore,
            sectionScores,
            answers
          }
        })
      });
      setEmailSent(true);
    } catch (error) {
      console.error("Failed to send email:", error);
    }
  };

  // Results view
  if (isComplete) {
    const allIssues = Object.values(sectionScores).flatMap(s => s.issues);
    const topIssues = allIssues.slice(0, 5);

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Header */}
        <div className="bg-emerald-600 text-white py-6 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-emerald-100 hover:text-white mb-4 text-sm">
              <ChevronLeft className="w-4 h-4" /> Back to LockSafe
            </Link>
            <h1 className="text-2xl font-bold">Your Security Report</h1>
            <p className="text-emerald-100 text-sm mt-1">Based on your answers</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Overall Score */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 text-center">
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={2 * Math.PI * 56}
                  strokeDashoffset={2 * Math.PI * 56 * (1 - overallScore / 100)}
                  strokeLinecap="round"
                  className={getScoreColor(overallScore)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}%</span>
                <span className="text-xs text-gray-500">Security Score</span>
              </div>
            </div>
            <h2 className={`text-xl font-bold ${getScoreColor(overallScore)}`}>
              {getScoreLabel(overallScore)}
            </h2>
            <p className="text-gray-600 text-sm mt-2">
              {overallScore >= 80
                ? "Your home security is in great shape! Keep it up."
                : overallScore >= 60
                ? "Good foundation, but there's room for improvement."
                : overallScore >= 40
                ? "Your home has several security vulnerabilities that need attention."
                : "Your home is at significant risk. We recommend immediate action."}
            </p>
          </div>

          {/* Section Breakdown */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {checklistSections.map(section => {
              const score = sectionScores[section.id]?.score || 0;
              return (
                <div key={section.id} className="bg-white rounded-xl shadow-md p-4 text-center">
                  <section.icon className={`w-6 h-6 mx-auto mb-2 ${getScoreColor(score)}`} />
                  <div className={`text-xl font-bold ${getScoreColor(score)}`}>{score}%</div>
                  <div className="text-xs text-gray-500">{section.title}</div>
                </div>
              );
            })}
          </div>

          {/* Issues Found */}
          {topIssues.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Priority Actions ({allIssues.length} found)
              </h3>
              <div className="space-y-3">
                {topIssues.map((issue, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <p className="text-sm text-gray-700">{issue}</p>
                  </div>
                ))}
              </div>
              {allIssues.length > 5 && (
                <p className="text-xs text-gray-500 mt-3 text-center">
                  + {allIssues.length - 5} more recommendations
                </p>
              )}
            </div>
          )}

          {/* Email Results */}
          {!emailSent ? (
            <div className="bg-emerald-50 rounded-2xl p-6 mb-6">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-600" />
                Save Your Report
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Get a detailed PDF report with all recommendations sent to your email.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={handleEmailResults}
                  disabled={!email}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Send Report
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-100 rounded-2xl p-6 mb-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <h3 className="font-bold text-gray-900">Report Sent!</h3>
              <p className="text-sm text-gray-600">Check your inbox for the full security report.</p>
            </div>
          )}

          {/* CTA */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white text-center">
            <Lock className="w-10 h-10 mx-auto mb-3 opacity-90" />
            <h3 className="text-xl font-bold mb-2">Need Help Improving Your Security?</h3>
            <p className="text-orange-100 text-sm mb-4">
              Our verified locksmiths can assess and upgrade your home security today.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/request"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                Get a Free Quote <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="tel:07818333989"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-colors"
              >
                <Phone className="w-4 h-4" /> 07818 333 989
              </a>
            </div>
          </div>

          {/* Retake */}
          <div className="text-center mt-6">
            <button
              onClick={() => {
                setIsComplete(false);
                setCurrentSectionIndex(0);
                setAnswers({});
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Retake the checklist
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Checklist view
  const sectionProgress = currentSection.items.filter(item => answers[item.id]).length;
  const sectionComplete = sectionProgress === currentSection.items.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-emerald-600 text-white py-4 px-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Link href="/" className="text-emerald-100 hover:text-white text-sm">
              <X className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-bold">Security Checklist</h1>
            <span className="text-sm text-emerald-100">{answeredItems}/{totalItems}</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-emerald-700/50 rounded-full h-1.5">
            <div
              className="bg-white rounded-full h-1.5 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="bg-white border-b sticky top-[72px] z-10">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex">
            {checklistSections.map((section, index) => {
              const Icon = section.icon;
              const isActive = index === currentSectionIndex;
              const isCompleted = section.items.every(item => answers[item.id]);

              return (
                <button
                  key={section.id}
                  onClick={() => setCurrentSectionIndex(index)}
                  className={`flex-1 py-3 flex flex-col items-center gap-1 border-b-2 transition-colors ${
                    isActive
                      ? "border-emerald-600 text-emerald-600"
                      : isCompleted
                      ? "border-transparent text-emerald-500"
                      : "border-transparent text-gray-400"
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {isCompleted && (
                      <CheckCircle2 className="w-3 h-3 absolute -top-1 -right-1 text-emerald-500 bg-white rounded-full" />
                    )}
                  </div>
                  <span className="text-xs font-medium">{section.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <currentSection.icon className="w-6 h-6 text-emerald-600" />
            {currentSection.title}
          </h2>
          <p className="text-gray-600 text-sm mt-1">{currentSection.description}</p>
        </div>

        <div className="space-y-4">
          {currentSection.items.map((item, index) => {
            const answer = answers[item.id];
            const showWarning = answer === "no" || answer === "not-sure";

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl shadow-md p-4 transition-all ${
                  showWarning ? "ring-2 ring-orange-300" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                    answer === "yes"
                      ? "bg-emerald-100 text-emerald-600"
                      : showWarning
                      ? "bg-orange-100 text-orange-600"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {answer === "yes" ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 text-sm leading-snug">
                      {item.question}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{item.description}</p>

                    {/* Risk indicator */}
                    <div className="flex items-center gap-1 mt-2">
                      <div className={`w-2 h-2 rounded-full ${
                        item.riskLevel === "high" ? "bg-red-500" :
                        item.riskLevel === "medium" ? "bg-yellow-500" : "bg-green-500"
                      }`} />
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">
                        {item.riskLevel} priority
                      </span>
                    </div>

                    {/* Answer buttons */}
                    <div className="flex gap-2 mt-3">
                      {(["yes", "no", "not-sure"] as AnswerType[]).map(opt => (
                        <button
                          key={opt}
                          onClick={() => handleAnswer(item.id, opt)}
                          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                            answer === opt
                              ? opt === "yes"
                                ? "bg-emerald-600 text-white"
                                : "bg-orange-500 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {opt === "yes" ? "Yes" : opt === "no" ? "No" : "Not Sure"}
                        </button>
                      ))}
                    </div>

                    {/* Show recommendation for issues */}
                    {showWarning && (
                      <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-orange-800">{item.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t">
          <button
            onClick={goToPreviousSection}
            disabled={currentSectionIndex === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentSectionIndex === 0
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <div className="text-xs text-gray-400">
            Section {currentSectionIndex + 1} of {checklistSections.length}
          </div>

          <button
            onClick={goToNextSection}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              sectionComplete
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            {currentSectionIndex === checklistSections.length - 1 ? (
              <>See Results <ArrowRight className="w-4 h-4" /></>
            ) : (
              <>Next <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>

        {/* Completion hint */}
        {!sectionComplete && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Answer all {currentSection.items.length} questions to continue
          </p>
        )}
      </div>
    </div>
  );
}
