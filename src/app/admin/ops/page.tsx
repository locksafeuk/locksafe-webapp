"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  RefreshCw,
  Loader2,
  MapPin,
  Clock,
  AlertCircle,
  TruckIcon,
  Wrench,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// ── Types ──────────────────────────────────────────────────────────────────
interface JobEntry {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  propertyType: string;
  postcode: string;
  address: string;
  jobLat: number | null;
  jobLng: number | null;
  createdAt: string;
  acceptedAt: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  acceptedEta: number | null;
  locksmith: {
    id: string;
    name: string;
    phone: string;
    rating: number;
    lat: number | null;
    lng: number | null;
  } | null;
  customer: { name: string; phone: string };
}

interface Stats {
  total: number;
  pending: number;
  enRoute: number;
  onSite: number;
  accepted: number;
}

interface LocksmithEntry {
  id: string;
  name: string;
  baseLat: number;
  baseLng: number;
  coverageRadius: number;
  isActive: boolean;
  isAvailable: boolean;
}

// ── Status colour helpers ──────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  PENDING: "#ef4444",           // red
  ACCEPTED: "#f97316",          // orange
  EN_ROUTE: "#f59e0b",          // amber
  ARRIVED: "#10b981",           // emerald
  DIAGNOSING: "#10b981",
  QUOTED: "#3b82f6",            // blue
  QUOTE_ACCEPTED: "#8b5cf6",    // violet
  IN_PROGRESS: "#14b8a6",       // teal
  PENDING_CUSTOMER_CONFIRMATION: "#6366f1", // indigo
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  EN_ROUTE: "En Route",
  ARRIVED: "Arrived",
  DIAGNOSING: "Diagnosing",
  QUOTED: "Quoted",
  QUOTE_ACCEPTED: "Quote Accepted",
  IN_PROGRESS: "In Progress",
  PENDING_CUSTOMER_CONFIRMATION: "Awaiting Sign-off",
};

function getLocksmithStatus(locksmith: LocksmithEntry): { label: string; color: string } {
  if (!locksmith.isActive) return { label: "Offline", color: "#ef4444" };
  if (!locksmith.isAvailable) return { label: "Unavailable", color: "#f59e0b" };
  return { label: "Available", color: "#22c55e" };
}

function elapsedMins(iso: string | null): string {
  if (!iso) return "–";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "PENDING") return <AlertCircle className="w-3.5 h-3.5" />;
  if (status === "EN_ROUTE" || status === "ACCEPTED") return <TruckIcon className="w-3.5 h-3.5" />;
  if (["ARRIVED", "DIAGNOSING", "IN_PROGRESS"].includes(status)) return <Wrench className="w-3.5 h-3.5" />;
  return <HelpCircle className="w-3.5 h-3.5" />;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AdminOpsPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [locksmiths, setLocksmiths] = useState<LocksmithEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, enRoute: 0, onSite: 0, accepted: 0 });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ── Fetch data ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/ops/live-data");
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs);
        setLocksmiths(Array.isArray(data.locksmiths) ? data.locksmiths : []);
        setStats(data.stats);
        setLastUpdated(new Date());
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load + fast polling for near-real-time map updates
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Init map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!mapboxgl.accessToken) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-0.1276, 51.5074], // London
      zoom: 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.on("load", () => setMapReady(true));

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // ── Sync markers ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !map.current) return;

    // Clear old markers
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    const filtered = statusFilter === "all"
      ? jobs
      : jobs.filter((j) => j.status === statusFilter);

    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    for (const job of filtered) {
      if (!job.jobLat || !job.jobLng) continue;

      const color = STATUS_COLOR[job.status] ?? "#94a3b8";

      // Job pin — teardrop SVG with job number
      const shortNum = job.jobNumber.slice(-4);
      const el = document.createElement("div");
      el.style.cssText = `
        width:34px; height:44px; cursor:pointer;
      `;
      const pulseStyle = job.status === "PENDING" ? `style="filter:drop-shadow(0 3px 5px rgba(0,0,0,0.55)); animation:pinPulse 1.6s ease-in-out infinite;"` : `style="filter:drop-shadow(0 3px 5px rgba(0,0,0,0.55));"`;
      el.innerHTML = `<svg ${pulseStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 44" width="34" height="44">
        <path d="M17 1C9.27 1 3 7.27 3 15c0 5.5 3.2 10.3 7.88 12.63L17 43l6.12-15.37C27.8 25.3 31 20.5 31 15 31 7.27 24.73 1 17 1z"
          fill="${color}" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
        <text x="17" y="18.5" text-anchor="middle" fill="white" font-size="9.5" font-weight="700"
          font-family="system-ui,sans-serif" letter-spacing="-0.5">${shortNum}</text>
      </svg>`;
      el.title = `#${job.jobNumber} — ${STATUS_LABEL[job.status] ?? job.status}`;

      const popup = new mapboxgl.Popup({ offset: 16, closeButton: false, maxWidth: "260px" })
        .setHTML(`
          <div style="font-family:system-ui; padding:4px">
            <div style="font-weight:700; margin-bottom:4px; color:#1e293b">#${job.jobNumber}</div>
            <div style="font-size:12px; color:#64748b; margin-bottom:6px">${job.address}</div>
            <div style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px;
              background:${color}22; color:${color}; font-weight:600; margin-bottom:6px">
              ${STATUS_LABEL[job.status] ?? job.status}
            </div>
            <div style="font-size:12px; color:#374151"><b>Customer:</b> ${job.customer.name}</div>
            <div style="font-size:12px; color:#374151"><b>Issue:</b> ${job.problemType}</div>
            ${job.locksmith ? `<div style="font-size:12px; color:#374151"><b>Locksmith:</b> ${job.locksmith.name}</div>` : "<div style='font-size:12px;color:#ef4444'>⚠ No locksmith assigned</div>"}
            <div style="font-size:11px; color:#94a3b8; margin-top:4px">Open: ${elapsedMins(job.createdAt)}</div>
          </div>
        `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([job.jobLng, job.jobLat])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener("click", () => setSelectedJob(job.id));

      markers.current.push(marker);
      bounds.extend([job.jobLng, job.jobLat]);
      hasBounds = true;

      // Locksmith car marker — top-down SVG car with direction arrow
      if (job.locksmith?.lat && job.locksmith?.lng) {
        const isMoving = ["EN_ROUTE", "ACCEPTED"].includes(job.status);
        const lsEl = document.createElement("div");
        lsEl.style.cssText = `
          width:38px; height:38px; cursor:pointer;
        `;
        const carStyle = isMoving ? `style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.55)); animation:carBounce 0.7s ease-in-out infinite alternate;"` : `style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.55));"` ;
        lsEl.innerHTML = `<svg ${carStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 38" width="38" height="38">
          <polygon points="19,1 13,10 25,10" fill="${color}" stroke="white" stroke-width="1.2"/>
          <rect x="6" y="10" width="26" height="19" rx="4" fill="${color}" stroke="white" stroke-width="1.5"/>
          <rect x="9" y="13" width="20" height="6" rx="2" fill="rgba(255,255,255,0.45)"/>
          <rect x="9" y="23" width="20" height="4" rx="1.5" fill="rgba(255,255,255,0.3)"/>
          <rect x="2" y="12" width="5" height="8" rx="2.5" fill="#0f172a" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
          <rect x="31" y="12" width="5" height="8" rx="2.5" fill="#0f172a" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
          <rect x="2" y="22" width="5" height="8" rx="2.5" fill="#0f172a" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
          <rect x="31" y="22" width="5" height="8" rx="2.5" fill="#0f172a" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
        </svg>`;
        lsEl.title = `🚗 ${job.locksmith.name} — ${STATUS_LABEL[job.status] ?? job.status}`;

        const lsMarker = new mapboxgl.Marker(lsEl)
          .setLngLat([job.locksmith.lng, job.locksmith.lat])
          .addTo(map.current!);

        markers.current.push(lsMarker);
        bounds.extend([job.locksmith.lng, job.locksmith.lat]);
      }
    }

    for (const locksmith of locksmiths) {
      const { color, label } = getLocksmithStatus(locksmith);
      const lsPin = document.createElement("div");
      lsPin.style.cssText = "width:28px; height:28px; cursor:pointer;";
      lsPin.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="9.5" fill="${color}" stroke="white" stroke-width="2.5" />
        <circle cx="14" cy="14" r="12" fill="none" stroke="${color}" stroke-opacity="0.35" stroke-width="2" />
      </svg>`;
      lsPin.title = `${locksmith.name} — ${label}`;

      const coverageLabel = Number.isFinite(locksmith.coverageRadius)
        ? `${locksmith.coverageRadius} miles`
        : "N/A";

      const lsPopup = new mapboxgl.Popup({ offset: 14, closeButton: false, maxWidth: "240px" })
        .setHTML(`
          <div style="font-family:system-ui; padding:4px;">
            <div style="font-weight:700; margin-bottom:4px; color:#1e293b">${locksmith.name}</div>
            <div style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px; background:${color}22; color:${color}; font-weight:600; margin-bottom:6px;">
              ${label}
            </div>
            <div style="font-size:12px; color:#374151"><b>Coverage:</b> ${coverageLabel}</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px">Base location</div>
          </div>
        `);

      const lsBaseMarker = new mapboxgl.Marker(lsPin)
        .setLngLat([locksmith.baseLng, locksmith.baseLat])
        .setPopup(lsPopup)
        .addTo(map.current!);

      markers.current.push(lsBaseMarker);
      bounds.extend([locksmith.baseLng, locksmith.baseLat]);
      hasBounds = true;
    }

    if (hasBounds) {
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 13 });
    }
  }, [jobs, locksmiths, mapReady, statusFilter]);

  // Focus map on selected job
  const flyToJob = useCallback((job: JobEntry) => {
    if (!map.current || !job.jobLat || !job.jobLng) return;
    map.current.flyTo({ center: [job.jobLng, job.jobLat], zoom: 14, duration: 800 });
  }, []);

  const filtered = statusFilter === "all" ? jobs : jobs.filter((j) => j.status === statusFilter);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <div className="w-80 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" /> Live Ops
            </h1>
            <button
              onClick={() => fetchData()}
              className="text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Stat chips */}
          <div className="grid grid-cols-2 gap-2">
            <StatChip label="Total Active" value={stats.total} color="blue" />
            <StatChip label="Pending" value={stats.pending} color="red" />
            <StatChip label="En Route" value={stats.enRoute} color="amber" />
            <StatChip label="On Site" value={stats.onSite} color="green" />
          </div>

          {lastUpdated && (
            <p className="text-xs text-gray-600 mt-2 text-right">
              <Clock className="w-3 h-3 inline mr-1" />
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Filter pills */}
        <div className="px-3 py-2 border-b border-gray-800 flex flex-wrap gap-1.5 overflow-x-auto">
          {[
            { key: "all", label: "All" },
            { key: "PENDING", label: "Pending" },
            { key: "ACCEPTED", label: "Accepted" },
            { key: "EN_ROUTE", label: "En Route" },
            { key: "ARRIVED", label: "Arrived" },
            { key: "IN_PROGRESS", label: "In Progress" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap ${
                statusFilter === key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-y-auto">
          {loading && jobs.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No active jobs</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filtered.map((job) => {
                const color = STATUS_COLOR[job.status] ?? "#94a3b8";
                const isSelected = selectedJob === job.id;
                return (
                  <button
                    key={job.id}
                    onClick={() => {
                      setSelectedJob(job.id);
                      flyToJob(job);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors ${
                      isSelected ? "bg-gray-800 border-l-2 border-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span style={{ color }} className="text-xs font-bold">
                            #{job.jobNumber}
                          </span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"
                            style={{
                              background: `${color}22`,
                              color,
                            }}
                          >
                            <StatusIcon status={job.status} />
                            {STATUS_LABEL[job.status] ?? job.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 truncate">{job.postcode} — {job.problemType}</p>
                        {job.locksmith ? (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">🔧 {job.locksmith.name}</p>
                        ) : (
                          <p className="text-xs text-red-500 mt-0.5">⚠ Unassigned</p>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 shrink-0 text-right">
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {elapsedMins(job.createdAt)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="p-3 border-t border-gray-800">
          <p className="text-xs text-gray-600 mb-2 font-medium uppercase tracking-wider">Legend</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <svg viewBox="0 0 14 18" width="10" height="13" style={{flexShrink:0}}>
                  <path d="M7 0.5C3.96 0.5 1.5 2.96 1.5 6c0 2.3 1.35 4.3 3.31 5.28L7 17.5l2.19-6.22C11.15 10.3 12.5 8.3 12.5 6 12.5 2.96 10.04 0.5 7 0.5z"
                    fill={STATUS_COLOR[key] ?? "#94a3b8"} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/>
                </svg>
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800 flex items-center gap-2">
            <svg viewBox="0 0 24 24" width="22" height="22" style={{flexShrink:0}}>
              <polygon points="12,0 8,7 16,7" fill="#94a3b8" stroke="white" strokeWidth="0.8"/>
              <rect x="4" y="7" width="16" height="11" rx="3" fill="#94a3b8" stroke="white" strokeWidth="0.8"/>
              <rect x="6" y="9" width="12" height="4" rx="1.5" fill="rgba(255,255,255,0.4)"/>
              <rect x="1" y="8" width="4" height="5" rx="2" fill="#0f172a"/>
              <rect x="19" y="8" width="4" height="5" rx="2" fill="#0f172a"/>
              <rect x="1" y="14" width="4" height="5" rx="2" fill="#0f172a"/>
              <rect x="19" y="14" width="4" height="5" rx="2" fill="#0f172a"/>
            </svg>
            <span className="text-xs text-gray-500">Locksmith car (live GPS)</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-xs text-gray-500">Locksmith available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs text-gray-500">Locksmith unavailable</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-gray-500">Locksmith offline</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full" />

        {/* Map marker animations */}
        <style>{`
          @keyframes pinPulse {
            0%, 100% { transform: scale(1) translateY(0); filter: drop-shadow(0 3px 5px rgba(239,68,68,0.5)); }
            50% { transform: scale(1.18) translateY(-4px); filter: drop-shadow(0 8px 14px rgba(239,68,68,0.7)); }
          }
          @keyframes carBounce {
            0% { transform: translateY(0px) scale(1); }
            100% { transform: translateY(-3px) scale(1.06); }
          }
        `}</style>

        {/* No token warning */}
        {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="text-center text-white">
              <p className="font-bold mb-1">Mapbox token missing</p>
              <p className="text-sm text-gray-400">Set NEXT_PUBLIC_MAPBOX_TOKEN in your env</p>
            </div>
          </div>
        )}

        {/* Auto-refresh indicator */}
        <div className="absolute bottom-4 right-4 bg-gray-900/80 text-gray-400 text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Auto-refresh every 5s
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-900/40 text-blue-300",
    red: "bg-red-900/40 text-red-300",
    amber: "bg-amber-900/40 text-amber-300",
    green: "bg-green-900/40 text-green-300",
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${colors[color]}`}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-xs opacity-70 mt-0.5">{label}</p>
    </div>
  );
}
