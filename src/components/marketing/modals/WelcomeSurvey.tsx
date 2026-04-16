"use client";

import { useState } from "react";
import { X, AlertCircle, Clock, Search, Shield, Building2, Wrench } from "lucide-react";

interface WelcomeSurveyProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (segment: string) => void;
}

const surveyOptions = [
  {
    id: "emergency",
    label: "Locked out NOW",
    sublabel: "Immediate help",
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-50 hover:bg-red-100 border-red-200",
    urgent: true,
  },
  {
    id: "soon",
    label: "Need locksmith soon",
    sublabel: "Today or tomorrow",
    icon: Clock,
    color: "text-amber-500",
    bgColor: "bg-amber-50 hover:bg-amber-100 border-amber-200",
  },
  {
    id: "price_shopper",
    label: "Comparing prices",
    sublabel: "Looking at options",
    icon: Search,
    color: "text-blue-500",
    bgColor: "bg-blue-50 hover:bg-blue-100 border-blue-200",
  },
  {
    id: "security",
    label: "Upgrade security",
    sublabel: "Locks & keys",
    icon: Shield,
    color: "text-emerald-500",
    bgColor: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
  },
  {
    id: "landlord",
    label: "Landlord / Property manager",
    sublabel: "Multiple properties",
    icon: Building2,
    color: "text-purple-500",
    bgColor: "bg-purple-50 hover:bg-purple-100 border-purple-200",
  },
  {
    id: "locksmith_prospect",
    label: "I'm a locksmith",
    sublabel: "Looking to join",
    icon: Wrench,
    color: "text-slate-500",
    bgColor: "bg-slate-50 hover:bg-slate-100 border-slate-200",
  },
];

export function WelcomeSurvey({ isOpen, onClose, onComplete }: WelcomeSurveyProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelect = async (optionId: string) => {
    setSelectedOption(optionId);
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    onComplete(optionId);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="bg-slate-900 px-4 py-3 text-center">
          <h2 className="text-base font-semibold text-white">
            What brings you here?
          </h2>
        </div>

        {/* Options */}
        <div className="p-3 space-y-2">
          {surveyOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                disabled={isSubmitting}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border ${option.bgColor} transition-all duration-150 ${
                  selectedOption === option.id ? "ring-2 ring-offset-1 ring-orange-500" : ""
                } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${option.color.replace("text-", "bg-").replace("-500", "-100")}`}>
                  <Icon className={`w-4 h-4 ${option.color}`} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium text-gray-800 ${option.urgent ? "text-red-700" : ""}`}>
                      {option.label}
                    </span>
                    {option.urgent && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white uppercase">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className={`text-xs ${option.urgent ? "text-red-600" : "text-gray-500"}`}>
                    {option.sublabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 pb-3 pt-1">
          <button
            onClick={onClose}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1.5"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
