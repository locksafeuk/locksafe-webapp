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
  }>;
  height?: string;
  className?: string;
  onLocksmithClick?: (id: string) => void;
}

export function AdminCoverageMap({
  locksmiths,
  height = "500px",
  className = "",
  onLocksmithClick,
}: AdminCoverageMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

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
    });

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add locksmiths to map
    const bounds = L.latLngBounds([]);

    locksmiths.forEach((locksmith) => {
      if (!locksmith.baseLat || !locksmith.baseLng) return;

      const color = locksmith.isVerified ? "#22c55e" : "#f59e0b";

      // Add coverage circle
      const circle = L.circle([locksmith.baseLat, locksmith.baseLng], {
        radius: milesToMeters(locksmith.coverageRadius),
        color: color,
        fillColor: color,
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);

      // Add marker
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

      const marker = L.marker([locksmith.baseLat, locksmith.baseLng], { icon: markerIcon }).addTo(map);

      marker.bindPopup(`
        <div style="min-width: 150px;">
          <strong>${locksmith.name}</strong><br/>
          <span style="color: ${color}; font-size: 12px;">
            ${locksmith.isVerified ? "Verified" : "Pending"}
          </span><br/>
          <span style="font-size: 12px;">Coverage: ${locksmith.coverageRadius} miles</span>
        </div>
      `);

      if (onLocksmithClick) {
        marker.on("click", () => onLocksmithClick(locksmith.id));
      }

      bounds.extend([locksmith.baseLat, locksmith.baseLng]);
    });

    // Fit bounds if we have locksmiths
    if (locksmiths.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    mapInstanceRef.current = map;
    setIsLoaded(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [locksmiths, onLocksmithClick]);

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
          <span>Verified</span>
        </div>
        <div className="flex items-center gap-2 text-xs mt-1">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Pending</span>
        </div>
      </div>
    </div>
  );
}
