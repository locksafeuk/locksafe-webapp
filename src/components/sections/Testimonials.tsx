"use client";

import { Star, Shield } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const testimonials = [
  {
    name: "Sarah Mitchell",
    location: "London",
    rating: 5,
    date: "2 weeks ago",
    text: "I was terrified of getting scammed after reading horror stories online. With LockSafe, I could see each locksmith's fee BEFORE booking, and got a full quote before any work started. The PDF report at the end was the cherry on top. Finally, a service I can trust!",
    initials: "SM",
    color: "bg-rose-500",
    highlight: "See fees before booking",
  },
  {
    name: "James Wilson",
    location: "Manchester",
    rating: 5,
    date: "1 month ago",
    text: "Chose my locksmith based on reviews and his assessment fee was reasonable. When he gave me the work quote, I could see exactly what I was paying for - parts, labour, everything itemised. No surprises, no pressure. This is how it should always be.",
    initials: "JW",
    color: "bg-blue-500",
    highlight: "Full quote breakdown",
  },
  {
    name: "Emma Thompson",
    location: "Birmingham",
    rating: 5,
    date: "3 weeks ago",
    text: "The best part? I had THREE locksmiths apply to my job, each with different fees and ETAs. I picked the one that suited me best. Being able to choose and then accept or decline the work quote put ME in control. Game changer!",
    initials: "ET",
    color: "bg-emerald-500",
    highlight: "Choose your locksmith",
  },
  {
    name: "David Brown",
    location: "Leeds",
    rating: 5,
    date: "2 months ago",
    text: "Had a nightmare with a cowboy locksmith before - £50 turned into £350, no receipt, nothing. LockSafe is the complete opposite. GPS tracking, photos, digital signature, instant PDF. My insurance company loved it. Never going back to the old way.",
    initials: "DB",
    color: "bg-purple-500",
    highlight: "Complete documentation",
  },
];

export function Testimonials() {
  return (
    <section className="py-16 md:py-24 bg-slate-50">
      <div className="section-container">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 rounded-full px-4 py-2 text-sm font-medium mb-4">
            <Shield className="w-4 h-4" />
            REAL EXPERIENCES
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            People Who Chose Control
          </h2>
          <p className="text-lg text-slate-600">
            Hear from customers who were tired of locksmith scams and found a better way.
          </p>
        </div>

        {/* Google Reviews badge */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex flex-col items-center gap-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="text-5xl font-bold text-slate-900">4.9</div>
            <div className="text-slate-600 font-medium">Google Reviews</div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className="w-5 h-5 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 card-hover relative"
            >
              {/* Highlight badge */}
              <div className="absolute -top-3 right-6 bg-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                {testimonial.highlight}
              </div>

              <div className="flex items-start gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className={`${testimonial.color} text-white font-semibold`}>
                    {testimonial.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {testimonial.name}
                      </div>
                      <div className="text-sm text-slate-500">
                        {testimonial.location} • {testimonial.date}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star
                          key={`star-${testimonial.name}-${i}`}
                          className="w-4 h-4 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-600 mt-3 leading-relaxed">
                    "{testimonial.text}"
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
