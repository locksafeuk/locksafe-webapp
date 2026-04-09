"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const contactMethods = [
  {
    icon: Phone,
    title: "Emergency Line",
    description: "24/7 emergency locksmith service",
    value: "07818 333 989",
    href: "tel:07818333989",
    color: "bg-red-500",
  },
  {
    icon: Mail,
    title: "Email Support",
    description: "General enquiries & support",
    value: "contact@locksafe.uk",
    href: "mailto:contact@locksafe.uk",
    color: "bg-orange-500",
  },
  {
    icon: Clock,
    title: "Response Time",
    description: "Email replies within 24 hours",
    value: "Mon-Fri, 8am-8pm",
    href: null,
    color: "bg-blue-500",
  },
  {
    icon: MapPin,
    title: "Coverage",
    description: "Serving customers nationwide",
    value: "United Kingdom",
    href: null,
    color: "bg-green-500",
  },
];

export function ContactPageContent() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setStatus("success");
    setFormState({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <main>
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="section-container">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 rounded-full px-4 py-2 text-sm font-medium mb-4">
              <MessageSquare className="w-4 h-4" />
              GET IN TOUCH
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Contact <span className="text-orange-500">LockSafe</span>
            </h1>
            <p className="text-lg text-slate-600">
              Have a question, need support, or want to give feedback? We're here
              to help. For emergencies, call our 24/7 line.
            </p>
          </div>

          {/* Contact Methods */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactMethods.map((method) => (
              <div
                key={method.title}
                className="bg-white rounded-2xl border border-slate-200 p-6 text-center hover:shadow-md transition-shadow"
              >
                <div
                  className={`w-12 h-12 ${method.color} rounded-xl flex items-center justify-center mx-auto mb-4`}
                >
                  <method.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">{method.title}</h3>
                <p className="text-sm text-slate-500 mb-2">{method.description}</p>
                {method.href ? (
                  <a
                    href={method.href}
                    className="text-orange-600 font-semibold hover:underline"
                  >
                    {method.value}
                  </a>
                ) : (
                  <span className="text-slate-700 font-medium">{method.value}</span>
                )}
              </div>
            ))}
          </div>

          {/* Contact Form */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                Send Us a Message
              </h2>

              {status === "success" ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    Message Sent!
                  </h3>
                  <p className="text-slate-600 mb-6">
                    We'll get back to you within 24 hours.
                  </p>
                  <Button
                    onClick={() => setStatus("idle")}
                    variant="outline"
                    className="border-slate-300"
                  >
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Your Name
                      </label>
                      <input
                        id="name"
                        type="text"
                        required
                        value={formState.name}
                        onChange={(e) =>
                          setFormState({ ...formState, name: e.target.value })
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Email Address
                      </label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={formState.email}
                        onChange={(e) =>
                          setFormState({ ...formState, email: e.target.value })
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="subject"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Subject
                    </label>
                    <input
                      id="subject"
                      type="text"
                      required
                      value={formState.subject}
                      onChange={(e) =>
                        setFormState({ ...formState, subject: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="How can we help?"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="message"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Message
                    </label>
                    <textarea
                      id="message"
                      required
                      rows={5}
                      value={formState.message}
                      onChange={(e) =>
                        setFormState({ ...formState, message: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all resize-none"
                      placeholder="Tell us more..."
                    />
                  </div>
                  <Button
                    type="submit"
                    className="btn-primary w-full"
                    disabled={status === "sending"}
                  >
                    {status === "sending" ? (
                      "Sending..."
                    ) : (
                      <>
                        Send Message
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>

            {/* Emergency Notice */}
            <div className="mt-8 bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-800 mb-1">
                  Locked Out Right Now?
                </h3>
                <p className="text-sm text-red-700 mb-3">
                  Don't use the contact form for emergencies. Get immediate help:
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/request">
                    <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white">
                      Request Emergency Help
                    </Button>
                  </Link>
                  <a href="tel:07818333989">
                    <Button size="sm" variant="outline" className="border-red-300 text-red-700">
                      <Phone className="w-4 h-4" />
                      07818 333 989
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
