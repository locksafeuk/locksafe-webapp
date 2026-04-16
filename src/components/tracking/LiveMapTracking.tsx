"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Navigation, Phone, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveTracking, type LocksmithLocation } from "@/hooks/useLiveTracking";

// Set your Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface LiveMapTrackingProps {
  customerLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  locksmithId: string;
  locksmithName: string;
  locksmithAvatar?: string;
  locksmithPhone?: string;
  eta?: number; // minutes
  jobId?: string;
  onCallLocksmith?: () => void;
}

export default function LiveMapTracking({
  customerLocation,
  locksmithId,
  locksmithName,
  locksmithAvatar,
  locksmithPhone,
  eta,
  jobId,
  onCallLocksmith,
}: LiveMapTrackingProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const locksmithMarker = useRef<mapboxgl.Marker | null>(null);
  const customerMarker = useRef<mapboxgl.Marker | null>(null);
  const routeLayerId = "locksmith-route";

  const [distance, setDistance] = useState<string | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(eta || null);
  const [useSimulation, setUseSimulation] = useState(false);
  const [simulatedLocation, setSimulatedLocation] = useState<LocksmithLocation | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Use real-time tracking hook
  const {
    location: realLocation,
    isConnected: realIsConnected,
    lastUpdate,
    reconnect,
    error: trackingError,
  } = useLiveTracking({
    jobId: jobId || `job-${locksmithId}`,
    enabled: !useSimulation,
    onLocationUpdate: (loc) => {
      updateDistanceAndETA(loc.lat, loc.lng);
    },
  });

  // Use either real location or simulated
  const locksmithLocation = useSimulation ? simulatedLocation : realLocation;
  const isConnected = useSimulation ? true : realIsConnected;

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Calculate distance and ETA
  const updateDistanceAndETA = useCallback((lat: number, lng: number) => {
    const distanceKm = calculateDistance(lat, lng, customerLocation.lat, customerLocation.lng);
    setDistance(distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`);
    const timeMinutes = Math.ceil((distanceKm / 30) * 60);
    setEstimatedTime(Math.max(1, timeMinutes));
  }, [customerLocation, calculateDistance]);

  // Fallback simulation when no real tracking data
  const simulateLocksmithMovement = useCallback(() => {
    const startLat = customerLocation.lat + (Math.random() * 0.02 - 0.01);
    const startLng = customerLocation.lng + (Math.random() * 0.02 - 0.01);

    let currentLat = startLat;
    let currentLng = startLng;

    const moveTowardsCustomer = () => {
      const latDiff = customerLocation.lat - currentLat;
      const lngDiff = customerLocation.lng - currentLng;

      const movePercent = 0.05 + Math.random() * 0.05;
      currentLat += latDiff * movePercent;
      currentLng += lngDiff * movePercent;
      currentLat += (Math.random() - 0.5) * 0.0005;
      currentLng += (Math.random() - 0.5) * 0.0005;

      const heading = Math.atan2(latDiff, lngDiff) * (180 / Math.PI);

      setSimulatedLocation({
        lat: currentLat,
        lng: currentLng,
        heading,
        speed: 20 + Math.random() * 20,
        accuracy: 5,
        timestamp: new Date().toISOString(),
        locksmithId,
        jobId: jobId || `job-${locksmithId}`,
      });

      updateDistanceAndETA(currentLat, currentLng);
    };

    moveTowardsCustomer();
    const interval = setInterval(moveTowardsCustomer, 3000);
    return () => clearInterval(interval);
  }, [customerLocation, locksmithId, jobId, updateDistanceAndETA]);

  // Start simulation if no real data after 3 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!realLocation && !useSimulation) {
        console.log("No real tracking data, falling back to simulation");
        setUseSimulation(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [realLocation, useSimulation]);

  // Run simulation if enabled
  useEffect(() => {
    if (useSimulation) {
      return simulateLocksmithMovement();
    }
  }, [useSimulation, simulateLocksmithMovement]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [customerLocation.lng, customerLocation.lat],
      zoom: 13,
    });

    map.current.on("load", () => {
      setMapReady(true);
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Create customer marker
    const customerEl = document.createElement("div");
    customerEl.innerHTML = `
      <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `;

    customerMarker.current = new mapboxgl.Marker(customerEl)
      .setLngLat([customerLocation.lng, customerLocation.lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px;">
          <strong>Your Location</strong><br/>
          <span style="color: #64748b; font-size: 12px;">${customerLocation.address}</span>
        </div>
      `))
      .addTo(map.current);

    // Add pulse animation style
    const style = document.createElement("style");
    style.textContent = `@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }`;
    document.head.appendChild(style);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [customerLocation]);

  // Update locksmith marker position
  useEffect(() => {
    if (!map.current || !locksmithLocation || !mapReady) return;

    if (!locksmithMarker.current) {
      const locksmithEl = document.createElement("div");
      locksmithEl.innerHTML = `
        <div style="position: relative; width: 50px; height: 50px;">
          <div style="position: absolute; width: 50px; height: 50px; background: rgba(34, 197, 94, 0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
          <div style="position: absolute; top: 5px; left: 5px; width: 40px; height: 40px; background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">
            ${locksmithAvatar || locksmithName.split(" ").map(n => n[0]).join("")}
          </div>
        </div>
      `;

      locksmithMarker.current = new mapboxgl.Marker(locksmithEl)
        .setLngLat([locksmithLocation.lng, locksmithLocation.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px;">
            <strong>${locksmithName}</strong><br/>
            <span style="color: #22c55e; font-size: 12px;">● En Route</span>
          </div>
        `))
        .addTo(map.current);
    } else {
      locksmithMarker.current.setLngLat([locksmithLocation.lng, locksmithLocation.lat]);
    }

    // Update route
    updateRoute();

    // Fit bounds
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([customerLocation.lng, customerLocation.lat]);
    bounds.extend([locksmithLocation.lng, locksmithLocation.lat]);
    map.current.fitBounds(bounds, { padding: 80, maxZoom: 15 });
  }, [locksmithLocation, customerLocation, locksmithName, locksmithAvatar, mapReady]);

  // Draw route between locksmith and customer
  const updateRoute = async () => {
    if (!map.current || !locksmithLocation || !mapReady) return;

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${locksmithLocation.lng},${locksmithLocation.lat};${customerLocation.lng},${customerLocation.lat}?geometries=geojson&access_token=${mapboxgl.accessToken}`
      );
      const data = await response.json();

      if (data.routes && data.routes[0]) {
        const route = data.routes[0].geometry;

        if (map.current.getLayer(routeLayerId)) {
          map.current.removeLayer(routeLayerId);
        }
        if (map.current.getSource(routeLayerId)) {
          map.current.removeSource(routeLayerId);
        }

        map.current.addSource(routeLayerId, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route },
        });

        map.current.addLayer({
          id: routeLayerId,
          type: "line",
          source: routeLayerId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#22c55e", "line-width": 4, "line-opacity": 0.8 },
        });
      }
    } catch {
      // Fallback to straight line
    }
  };

  const handleCenterMap = () => {
    if (!map.current || !locksmithLocation) return;
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([customerLocation.lng, customerLocation.lat]);
    bounds.extend([locksmithLocation.lng, locksmithLocation.lat]);
    map.current.fitBounds(bounds, { padding: 80, maxZoom: 15 });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Map Header */}
      <div className="p-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
              {locksmithAvatar || locksmithName.split(" ").map(n => n[0]).join("")}
            </div>
            <div>
              <div className="font-bold text-slate-900">{locksmithName}</div>
              <div className="flex items-center gap-2 text-sm">
                {isConnected ? (
                  <>
                    <span className="flex items-center gap-1 text-green-600">
                      <Wifi className="w-3 h-3" />
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      {useSimulation ? "Demo Mode" : "Live Tracking"}
                    </span>
                    {lastUpdate && !useSimulation && (
                      <span className="text-slate-400">
                        • {Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago
                      </span>
                    )}
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-slate-500">
                    <WifiOff className="w-3 h-3" />
                    Connecting...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ETA Display */}
          <div className="text-right">
            <div className="text-sm text-slate-500">ETA</div>
            <div className="text-2xl font-bold text-green-600">
              {estimatedTime || eta || "—"} min
            </div>
            {distance && <div className="text-sm text-slate-500">{distance} away</div>}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainer} className="h-80 lg:h-96 w-full" style={{ minHeight: "320px" }} />

      {/* Map Controls */}
      <div className="p-4 border-t bg-slate-50">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleCenterMap} className="flex-1 sm:flex-none">
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-center
          </Button>

          {!useSimulation && !isConnected && (
            <Button variant="outline" onClick={reconnect} className="flex-1 sm:flex-none">
              <Wifi className="w-4 h-4 mr-2" />
              Reconnect
            </Button>
          )}

          {locksmithPhone && (
            <a href={`tel:${locksmithPhone}`} className="flex-1 sm:flex-none">
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                <Phone className="w-4 h-4 mr-2" />
                Call Locksmith
              </Button>
            </a>
          )}

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${customerLocation.lat},${customerLocation.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none"
          >
            <Button variant="outline" className="w-full">
              <Navigation className="w-4 h-4 mr-2" />
              Directions
            </Button>
          </a>
        </div>

        {/* Live Stats */}
        {locksmithLocation && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-white rounded-lg">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Distance</div>
              <div className="font-bold text-slate-900">{distance || "—"}</div>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Speed</div>
              <div className="font-bold text-slate-900">
                {locksmithLocation.speed ? `${Math.round(locksmithLocation.speed)} km/h` : "—"}
              </div>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <div className="text-xs text-slate-500 uppercase tracking-wide">ETA</div>
              <div className="font-bold text-green-600">{estimatedTime || eta || "—"} min</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
