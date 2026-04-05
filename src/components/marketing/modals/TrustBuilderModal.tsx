"use client";

import { useState } from "react";
import { X, Star, Shield, CheckCircle2, Clock, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import Link from "next/link";

interface TrustBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCTAClick?: () => void;
}

const testimonials = [
  {
    name: "Sarah M.",
    location: "London",
    rating: 5,
    text: "Locked out at 11pm. LockSafe showed me exactly what I'd pay. Locksmith arrived in 18 mins!",
    highlight: "Transparent pricing",
  },
  {
    name: "James K.",
    location: "Manchester",
    rating: 5,
    text: "After a burglary, I needed all locks changed. The itemized quote gave me peace of mind.",
    highlight: "Clear quotes",
  },
  {
    name: "Emma T.",
    location: "Birmingham",
    rating: 5,
    text: "I'd been burned by cowboy locksmiths before. This time I could see ratings and fees upfront.",
    highlight: "Real choice",
  },
];

export function TrustBuilderModal({ isOpen, onClose, onCTAClick }: TrustBuilderModalProps) {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  if (!isOpen) return null;

  const nextTestimonial = () => setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  const prevTestimonial = () => setCurrentTestimonial((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  const testimonial = testimonials[currentTestimonial];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="bg-slate-900 px-4 py-4">
          <h2 className="text-base font-bold text-white text-center">Why 10,000+ Trust Us</h2>

          {/* Trust badges */}
          <div className="flex justify-center gap-3 mt-3">
            {[
              { label: "Verified", icon: CheckCircle2 },
              { label: "Insured", icon: Shield },
              { label: "15min Avg", icon: Clock },
            ].map((badge) => (
              <div key={badge.label} className="text-center">
                <badge.icon className="w-4 h-4 text-amber-400 mx-auto" />
                <div className="text-[10px] text-slate-400 mt-0.5">{badge.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="p-4 relative">
          <div className="bg-slate-50 rounded-lg p-3">
            {/* Rating */}
            <div className="flex items-center gap-0.5 mb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-3 h-3 ${i < testimonial.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
              ))}
            </div>

            <p className="text-sm text-slate-700 leading-relaxed mb-2">"{testimonial.text}"</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-medium">
                <CheckCircle2 className="w-3 h-3" />
                {testimonial.highlight}
              </div>
              <div className="text-xs text-slate-500">{testimonial.name}, {testimonial.location}</div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-2">
            <button onClick={prevTestimonial} className="p-1 hover:bg-slate-100 rounded">
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div className="flex gap-1">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentTestimonial(i)}
                  className={`w-1.5 h-1.5 rounded-full ${i === currentTestimonial ? "bg-slate-800" : "bg-slate-300"}`}
                />
              ))}
            </div>
            <button onClick={nextTestimonial} className="p-1 hover:bg-slate-100 rounded">
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200 text-center">
            <div>
              <div className="text-lg font-bold text-slate-900">4.9</div>
              <div className="text-[10px] text-slate-500">Avg Rating</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">10k+</div>
              <div className="text-[10px] text-slate-500">Jobs Done</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">98%</div>
              <div className="text-[10px] text-slate-500">Recommend</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <Link
            href="/request"
            onClick={() => { onCTAClick?.(); onClose(); }}
            className="block w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg text-sm text-center"
          >
            Get Free Quote <ArrowRight className="w-4 h-4 inline ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
