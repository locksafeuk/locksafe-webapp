"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface CoverageMapProps {
  lat: number;
  lng: number;
  radiusMiles: number;
  height?: string;
  showControls?: boolean;
  className?: string;
}

// Convert miles to meters for Leaflet circle
const milesToMeters = (miles: number) => miles * 1609.34;

export function CoverageMap({
  lat,
  lng,
  radiusMiles,
  height = "300px",
  showControls = true,
  className = "",
}: CoverageMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create custom marker icon
    const customIcon = L.divIcon({
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background: white;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      `,
      className: "custom-marker",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: calculateZoom(radiusMiles),
      zoomControl: showControls,
      attributionControl: true,
      scrollWheelZoom: showControls,
      dragging: showControls,
    });

    // Add tile layer (OpenStreetMap)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add coverage circle
    const circle = L.circle([lat, lng], {
      radius: milesToMeters(radiusMiles),
      color: "#f97316",
      fillColor: "#f97316",
      fillOpacity: 0.15,
      weight: 2,
    }).addTo(map);

    // Add marker
    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    marker.bindPopup(`<strong>Your Base Location</strong><br/>Coverage: ${radiusMiles} miles`);

    // Fit bounds to circle
    map.fitBounds(circle.getBounds(), { padding: [20, 20] });

    mapInstanceRef.current = map;
    circleRef.current = circle;
    markerRef.current = marker;
    setIsLoaded(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update circle when radius changes
  useEffect(() => {
    if (circleRef.current && mapInstanceRef.current) {
      circleRef.current.setRadius(milesToMeters(radiusMiles));
      mapInstanceRef.current.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
    }
  }, [radiusMiles]);

  // Update position when lat/lng changes
  useEffect(() => {
    if (circleRef.current && markerRef.current && mapInstanceRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
    }
  }, [lat, lng]);

  return (
    <div className={`relative rounded-xl overflow-hidden ${className}`} style={{ height }}>
      <div ref={mapRef} className="w-full h-full" />
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          <div className="text-slate-500">Loading map...</div>
        </div>
      )}
    </div>
  );
}

// Calculate appropriate zoom level based on radius
function calculateZoom(radiusMiles: number): number {
  if (radiusMiles <= 5) return 12;
  if (radiusMiles <= 10) return 11;
  if (radiusMiles <= 20) return 10;
  if (radiusMiles <= 30) return 9;
  return 8;
}

// Admin map showing multiple locksmiths
interface AdminCoverageMapProps {
  locksmiths: Array<{
    id: string;
    name: string;
    baseLat: number;
    baseLng: number;
    coverageRadius: number;
    isVerified: boolean;
    isActive?: boolean;
    isAvailable?: boolean;
    distanceMiles?: number;
  }>;
  height?: string;
  className?: string;
  onLocksmithClick?: (id: string) => void;
  targetLocation?: {
    lat: number;
    lng: number;
    label?: string;
  } | null;
}

export function AdminCoverageMap({
  locksmiths,
  height = "500px",
  className = "",
  onLocksmithClick,
  targetLocation = null,
}: AdminCoverageMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const onLocksmithClickRef = useRef<typeof onLocksmithClick>(onLocksmithClick);
  const hasInitialFitRef = useRef(false);
  const previousTargetKeyRef = useRef<string | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    onLocksmithClickRef.current = onLocksmithClick;
  }, [onLocksmithClick]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Default center to London
    const defaultCenter: [number, number] = [51.5074, -0.1278];

    // Initialize map
    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 10,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      dragging: true,
      boxZoom: true,
      keyboard: true,
    });

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    overlayGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    setIsLoaded(true);

    // Leaflet renders blank/grey tiles when its container's size is not final at
    // init (the map lives inside a grid/tab that lays out after mount). Recompute
    // size on the next frame and whenever the container resizes.
    const invalidate = () => mapInstanceRef.current?.invalidateSize();
    const raf = requestAnimationFrame(invalidate);
    const timeout = setTimeout(invalidate, 300);

    if (typeof ResizeObserver !== "undefined" && mapRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => invalidate());
      resizeObserverRef.current.observe(mapRef.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      overlayGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const overlays = overlayGroupRef.current;
    if (!map || !overlays) return;

    overlays.clearLayers();
    const bounds = L.latLngBounds([]);

    locksmiths.forEach((locksmith) => {
      if (!locksmith.baseLat || !locksmith.baseLng) return;

      const isOffline = locksmith.isActive === false;
      const isUnavailable = locksmith.isActive !== false && locksmith.isAvailable === false;
      const statusLabel = isOffline ? "Offline" : isUnavailable ? "Unavailable" : "Available";
      const color = isOffline ? "#ef4444" : isUnavailable ? "#f59e0b" : "#22c55e";

      L.circle([locksmith.baseLat, locksmith.baseLng], {
        radius: milesToMeters(locksmith.coverageRadius),
        color,
        fillColor: color,
        fillOpacity: 0.08,
        weight: 1.5,
      }).addTo(overlays);

      const markerIcon = L.divIcon({
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background: ${color};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            font-weight: bold;
          ">
            ${locksmith.name.charAt(0).toUpperCase()}
          </div>
        `,
        className: "custom-marker",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([locksmith.baseLat, locksmith.baseLng], { icon: markerIcon }).addTo(overlays);
      marker.bindPopup(`
        <div style="min-width: 190px;">
          <strong>${locksmith.name}</strong><br/>
          <span style="color: ${color}; font-size: 12px; font-weight: 600;">${statusLabel}</span><br/>
          <span style="font-size: 12px;">Coverage: ${locksmith.coverageRadius} miles</span>
          ${typeof locksmith.distanceMiles === "number" ? `<br/><span style="font-size: 12px;">Distance: ${locksmith.distanceMiles.toFixed(1)} miles</span>` : ""}
        </div>
      `);

      if (onLocksmithClickRef.current) {
        marker.on("click", () => onLocksmithClickRef.current?.(locksmith.id));
      }

      bounds.extend([locksmith.baseLat, locksmith.baseLng]);
    });

    if (targetLocation) {
      const targetIcon = L.divIcon({
        html: `
          <div style="
            position: relative;
            width: 36px;
            height: 52px;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            filter: drop-shadow(0 8px 12px rgba(30, 64, 175, 0.45));
          ">
            <div style="
              width: 28px;
              height: 28px;
              background: linear-gradient(160deg, #60a5fa, #1d4ed8);
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 3px solid white;
              box-shadow: 0 0 0 6px rgba(59,130,246,0.28);
            "></div>
            <div style="
              position: absolute;
              top: 9px;
              width: 10px;
              height: 10px;
              background: white;
              border-radius: 50%;
              box-shadow: 0 0 0 2px rgba(147,197,253,0.65);
            "></div>
          </div>
        `,
        className: "custom-target-marker",
        iconSize: [36, 52],
        iconAnchor: [18, 52],
      });

      const targetMarker = L.marker([targetLocation.lat, targetLocation.lng], { icon: targetIcon, zIndexOffset: 2000 }).addTo(overlays);
      targetMarker.bindPopup(`<strong>${targetLocation.label || "Searched address"}</strong>`);
      bounds.extend([targetLocation.lat, targetLocation.lng]);
    }

    if (bounds.isValid()) {
      const targetKey = targetLocation
        ? `${targetLocation.lat.toFixed(5)},${targetLocation.lng.toFixed(5)}`
        : null;
      const targetChanged = targetKey !== previousTargetKeyRef.current;

      // Only recenter the map on the very first load of valid data, or when the
      // user runs a new address search (target changes). Routine data refreshes
      // (availability/status updates, postcode lookups, re-renders) rebuild the
      // markers but must NOT touch the viewport — otherwise the user's manual
      // zoom/pan is wiped out. This matches the UI hint: "The map only recenters
      // when you press Find Closest or clear the search."
      if (!hasInitialFitRef.current || targetChanged) {
        map.fitBounds(bounds, { padding: [50, 50] });
        hasInitialFitRef.current = true;
      }

      previousTargetKeyRef.current = targetKey;
    }
  }, [locksmiths, targetLocation]);

  return (
    <div className={`relative rounded-xl overflow-hidden ${className}`} style={{ height }}>
      <div ref={mapRef} className="w-full h-full" />
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          <div className="text-slate-500">Loading map...</div>
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <div className="text-xs font-semibold text-slate-700 mb-2">Legend</div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2 text-xs mt-1">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Unavailable</span>
        </div>
        <div className="flex items-center gap-2 text-xs mt-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Offline</span>
        </div>
        <div className="flex items-center gap-2 text-xs mt-1">
          <div className="w-3 h-3 rounded-full bg-blue-600" />
          <span>Searched address</span>
        </div>
      </div>
    </div>
  );
}
