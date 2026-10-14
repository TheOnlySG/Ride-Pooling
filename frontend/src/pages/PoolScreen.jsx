import React, { useState, useEffect, useMemo } from 'react';
import LeafletMap from '../components/LeafletMap';
import { fetchRoadRoute, getAccurateDistance } from '../utils/routing';
import { NASHIK_HUBS, getSharedRideOrigin } from '../data/nashikLocations';

export default function PoolScreen({
  poolStage,
  setPoolStage,
  onRequestRide,
  onCancelRide,
  _backendWindow = null,
  _assignedVehicle = null,
  preselectedHubs = null
}) {
  // Hubs selection
  const [originIndex, setOriginIndex] = useState(() => {
    const saved = localStorage.getItem('pooliq_preferred_hub');
    if (saved) {
      const idx = NASHIK_HUBS.findIndex((h) => h.id === saved);
      if (idx !== -1) return idx;
    }
    const pvgIdx = NASHIK_HUBS.findIndex((h) => h.id === 'pvg_coe');
    return pvgIdx !== -1 ? pvgIdx : 0;
  });
  const [destIndex, setDestIndex] = useState(2); // Gangapur Road

  // Selected Ride Product ('pool', 'express', 'solo')
  const [selectedRideType, setSelectedRideType] = useState('pool');

  // User Live Geolocation State
  const [useLiveLocation, setUseLiveLocation] = useState(false);
  const [liveLocation, setLiveLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [outsideNashikAlert, setOutsideNashikAlert] = useState(null);

  // Search Modal / Popover State for Hubs
  const [searchModalType, setSearchModalType] = useState(null); // 'pickup' | 'drop' | null
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered hubs for quick location search
  const filteredHubs = useMemo(() => {
    if (!searchQuery.trim()) return NASHIK_HUBS;
    const q = searchQuery.toLowerCase().trim();
    return NASHIK_HUBS.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.shortName.toLowerCase().includes(q) ||
        (h.tag && h.tag.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // 1-Click Set to PVG's College of Engineering
  const selectPvgAsPickup = () => {
    const pvgIdx = NASHIK_HUBS.findIndex((h) => h.id === 'pvg_coe');
    if (pvgIdx !== -1) {
      const pvg = NASHIK_HUBS[pvgIdx];
      setOriginIndex(pvgIdx);
      setLiveLocation({
        id: 'pvg_coe',
        name: pvg.name,
        shortName: pvg.shortName,
        lat: pvg.lat,
        lon: pvg.lon,
        accuracy: 5,
        isLiveGps: true,
        isWithinService: true
      });
      setUseLiveLocation(true);
      setOutsideNashikAlert(null);
      localStorage.setItem('pooliq_preferred_hub', 'pvg_coe');
      setLocationStatus("📍 Pickup set to PVG's College of Engineering");
      setTimeout(() => setLocationStatus(''), 4000);
    }
  };

  // Handle map click to set custom pinpoint pickup anywhere in Nashik
  const handleMapClick = (latlng) => {
    if (!latlng) return;
    const clickLat = Number(latlng.lat.toFixed(6));
    const clickLon = Number(latlng.lng.toFixed(6));

    let nearestHub = NASHIK_HUBS[0];
    let minDis = 999999;
    for (const h of NASHIK_HUBS) {
      const d = Math.hypot((h.lat - clickLat) * 111, (h.lon - clickLon) * 104);
      if (d < minDis) {
        minDis = d;
        nearestHub = h;
      }
    }
    const distM = Math.round(minDis * 1000);
    const distToPvg = Math.hypot((20.0369 - clickLat) * 111, (73.8007 - clickLon) * 104) * 1000;
    const shortDesc = distToPvg < 400
      ? 'PVG Campus'
      : distM < 250
        ? nearestHub.shortName
        : `${distM}m from ${nearestHub.shortName}`;

    const customPinHub = {
      id: 'user_map_pin',
      name: `Pinned Pickup (${shortDesc})`,
      shortName: `Pin · ${shortDesc}`,
      lat: clickLat,
      lon: clickLon,
      accuracy: 5,
      isLiveGps: true
    };

    setLiveLocation(customPinHub);
    setUseLiveLocation(true);
    setOutsideNashikAlert(null);
    setLocationStatus(`📍 Pickup pinned to map near ${nearestHub.shortName}`);
    setTimeout(() => setLocationStatus(''), 4000);
  };

  const handleFetchLiveLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setLocationStatus('Acquiring high-accuracy GPS fix...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const rawLat = Number(pos.coords.latitude.toFixed(6));
        const rawLon = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy || 15);

        const dLat = (rawLat - 19.9977) * 111.0;
        const dLon = (rawLon - 73.7803) * 104.0;
        const distFromNashikKm = Math.round(Math.hypot(dLat, dLon));

        const isWithinNashik = distFromNashikKm <= 35;

        if (isWithinNashik) {
          let nearestHub = NASHIK_HUBS[0];
          let minDis = 999999;
          for (const h of NASHIK_HUBS) {
            const d = Math.hypot((h.lat - rawLat) * 111, (h.lon - rawLon) * 104);
            if (d < minDis) {
              minDis = d;
              nearestHub = h;
            }
          }
          const distM = Math.round(minDis * 1000);
          const distToPvg = Math.hypot((20.0369 - rawLat) * 111, (73.8007 - rawLon) * 104) * 1000;
          const shortDesc = distToPvg < 500
            ? 'PVG COE'
            : distM < 250
              ? nearestHub.shortName
              : `${distM}m from ${nearestHub.shortName}`;

          const userGpsHub = {
            id: 'user_live_gps',
            name: `Live Location (${shortDesc})`,
            shortName: `Live GPS · ${shortDesc}`,
            lat: rawLat,
            lon: rawLon,
            accuracy,
            isLiveGps: true,
            isWithinService: true
          };

          setLiveLocation(userGpsHub);
          setUseLiveLocation(true);
          setIsLocating(false);
          setOutsideNashikAlert(null);
          setLocationStatus(`📍 GPS locked: ${shortDesc}`);
          setTimeout(() => setLocationStatus(''), 4000);
        } else {
          setIsLocating(false);
          setOutsideNashikAlert({ distanceKm: distFromNashikKm });
          setLocationStatus('');
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
        setLocationStatus('Could not determine live location.');
        setTimeout(() => setLocationStatus(''), 4000);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (preselectedHubs) {
      if (typeof preselectedHubs.originIdx === 'number') {
        setOriginIndex(preselectedHubs.originIdx);
        setUseLiveLocation(false);
      }
      if (typeof preselectedHubs.destIdx === 'number') setDestIndex(preselectedHubs.destIdx);
    }
  }, [preselectedHubs]);

  const originHub = useMemo(() => {
    if (useLiveLocation && liveLocation) {
      return liveLocation;
    }
    return NASHIK_HUBS[originIndex] || NASHIK_HUBS[0];
  }, [useLiveLocation, liveLocation, originIndex]);

  const destHub = NASHIK_HUBS[destIndex] || NASHIK_HUBS[2];

  const [sharedOriginSeed, setSharedOriginSeed] = useState(() => Math.floor(Math.random() * 10000));
  const sharedOriginHub = useMemo(() => {
    return getSharedRideOrigin(originHub, destHub, sharedOriginSeed);
  }, [originHub, destHub, sharedOriginSeed]);

  const [approachRoadRoute, setApproachRoadRoute] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadApproachPath() {
      if (!sharedOriginHub || !originHub) return;
      const res = await fetchRoadRoute(sharedOriginHub, originHub);
      if (mounted && res && res.polyline) {
        setApproachRoadRoute(res);
      }
    }
    loadApproachPath();
    return () => {
      mounted = false;
    };
  }, [sharedOriginHub, originHub]);

  const approachRouteCoords = useMemo(() => {
    if (approachRoadRoute && approachRoadRoute.polyline && approachRoadRoute.polyline.length > 1) {
      return approachRoadRoute.polyline;
    }
    if (!sharedOriginHub || !originHub) return [];
    const coords = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const curveOffset = Math.sin(frac * Math.PI) * 0.005 * (i % 2 === 0 ? 1 : -0.6);
      coords.push([
        sharedOriginHub.lat + (originHub.lat - sharedOriginHub.lat) * frac + curveOffset,
        sharedOriginHub.lon + (originHub.lon - sharedOriginHub.lon) * frac - curveOffset
      ]);
    }
    return coords;
  }, [approachRoadRoute, sharedOriginHub, originHub]);

  const [roadRoute, setRoadRoute] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadRoadPath() {
      const res = await fetchRoadRoute(originHub, destHub);
      if (mounted && res && res.polyline) {
        setRoadRoute(res);
      }
    }
    loadRoadPath();
    return () => {
      mounted = false;
    };
  }, [originHub, destHub]);

  const accurateMetrics = useMemo(() => {
    return getAccurateDistance(originHub, destHub);
  }, [originHub, destHub]);

  const tripDistance = useMemo(() => {
    if (roadRoute && roadRoute.distanceKm && roadRoute.distanceKm > 0.5) {
      return roadRoute.distanceKm;
    }
    return accurateMetrics.km;
  }, [roadRoute, accurateMetrics]);

  const soloFare = Math.round(25 + tripDistance * 10);
  const dynamicPoolPrice = Math.round(soloFare * 0.65);
  const expressPoolPrice = Math.round(soloFare * 0.78);
  const pooledSavings = soloFare - dynamicPoolPrice;

  const activeRouteCoords = useMemo(() => {
    if (roadRoute && roadRoute.polyline && roadRoute.polyline.length > 1) {
      return roadRoute.polyline;
    }
    const coords = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const curveOffset = Math.sin(frac * Math.PI) * 0.006 * (i % 2 === 0 ? 1 : -0.6);
      coords.push([
        originHub.lat + (destHub.lat - originHub.lat) * frac + curveOffset,
        originHub.lon + (destHub.lon - originHub.lon) * frac - curveOffset
      ]);
    }
    return coords;
  }, [originHub, destHub, roadRoute]);

  // Matching window simulation
  const [batchProgress, setBatchProgress] = useState(0.2);
  const [queueCount, setQueueCount] = useState(2);

  useEffect(() => {
    if (poolStage !== 'matching') {
      setBatchProgress(0.2);
      return;
    }
    const timer = setInterval(() => {
      setBatchProgress((prev) => {
        const next = Math.round((prev + 0.3) * 10) / 10;
        if (next >= 2.0) {
          clearInterval(timer);
          setPoolStage('active');
          return 2.0;
        }
        return next;
      });
      if (Math.random() > 0.5) {
        setQueueCount((q) => (q === 2 ? 3 : 2));
      }
    }, 250);
    return () => clearInterval(timer);
  }, [poolStage, setPoolStage]);

  // Active ride vehicle movement
  const [vehicleIdx, setVehicleIdx] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(120);
  const [hasArrivedAtPickup, setHasArrivedAtPickup] = useState(false);

  useEffect(() => {
    if (poolStage !== 'active') {
      setVehicleIdx(0);
      setEtaSeconds(120);
      setHasArrivedAtPickup(false);
      return;
    }
    const timer = setInterval(() => {
      const totalSteps = approachRouteCoords.length > 0 ? approachRouteCoords.length : 12;
      const step = Math.max(1, Math.floor(totalSteps / 10));

      setVehicleIdx((prev) => {
        const next = prev + step;
        if (next >= totalSteps - 1) {
          setHasArrivedAtPickup(true);
          setEtaSeconds(0);
          clearInterval(timer);
          return totalSteps - 1;
        }
        return next;
      });

      setEtaSeconds((prev) => (prev > 12 ? prev - 12 : 0));
    }, 1500);

    return () => clearInterval(timer);
  }, [poolStage, approachRouteCoords.length]);

  const currentVehicleCoord = useMemo(() => {
    if (approachRouteCoords && approachRouteCoords.length > 0) {
      const safeIdx = Math.min(vehicleIdx, approachRouteCoords.length - 1);
      return {
        lat: approachRouteCoords[safeIdx][0],
        lon: approachRouteCoords[safeIdx][1],
        isApproaching: !hasArrivedAtPickup,
        label: hasArrivedAtPickup
          ? `Vehicle V1 · Arrived at ${originHub.shortName}`
          : `Vehicle V1 · En Route from ${sharedOriginHub.shortName}`
      };
    }
    return {
      lat: hasArrivedAtPickup ? originHub.lat : (sharedOriginHub ? sharedOriginHub.lat : originHub.lat),
      lon: hasArrivedAtPickup ? originHub.lon : (sharedOriginHub ? sharedOriginHub.lon : originHub.lon),
      isApproaching: !hasArrivedAtPickup,
      label: hasArrivedAtPickup ? `Vehicle V1 · Arrived` : 'Vehicle V1 · Approaching'
    };
  }, [approachRouteCoords, vehicleIdx, hasArrivedAtPickup, sharedOriginHub, originHub]);

  const formatEta = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s} min`;
  };

  const [cancelText, setCancelText] = useState('Cancel Ride');
  const [cancelIsConfirm, setCancelIsConfirm] = useState(false);

  const handleActiveCancel = () => {
    if (!cancelIsConfirm) {
      setCancelText('Confirm Cancellation?');
      setCancelIsConfirm(true);
      setTimeout(() => {
        setCancelText('Cancel Ride');
        setCancelIsConfirm(false);
      }, 4000);
    } else {
      setCancelText('Ride Aborted');
      setTimeout(() => {
        setCancelText('Cancel Ride');
        setCancelIsConfirm(false);
        setPoolStage('request');
        if (onCancelRide) onCancelRide();
      }, 1200);
    }
  };

  return (
    <div className="flex flex-col w-full text-black select-none pb-4">
      {/* STAGE 1: REQUEST A RIDE (Uber style search & selection sheet) */}
      {poolStage === 'request' && (
        <div className="flex flex-col w-full">
          {/* Map Viewport Area */}
          <div className="w-full relative h-[300px] sm:h-[340px] bg-[#121212] overflow-hidden border-b border-[#E2E2E2]">
            <LeafletMap
              center={[originHub.lat, originHub.lon]}
              pickup={originHub}
              drop={destHub}
              routeCoords={activeRouteCoords}
              height="100%"
              onMapClick={handleMapClick}
            />
            {/* Uber map pin instruction badge */}
            <div className="absolute bottom-3 left-4 bg-black/85 text-white px-3 py-1.5 rounded-full backdrop-blur-md shadow-md z-[400] flex items-center gap-2 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-[#05A357] animate-pulse"></span>
              <span className="font-sans text-[11px] font-semibold">
                Tap map to set exact pickup point
              </span>
            </div>
          </div>

          {/* Floating Uber Bottom Sheet for Location & Product Selection */}
          <div className="px-3 sm:px-4 -mt-4 z-10">
            <div className="bg-white rounded-2xl p-4 shadow-xl border border-[#E2E2E2] flex flex-col gap-4">

              {/* ISP / Location Alert */}
              {outsideNashikAlert && (
                <div className="bg-[#F8F8F8] border border-[#E2E2E2] p-3 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-black flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#545454]">near_me_disabled</span>
                      Outside Nashik Service Area ({outsideNashikAlert.distanceKm} km away)
                    </span>
                    <button onClick={() => setOutsideNashikAlert(null)} className="text-[#8F8F8F] text-xs font-bold">✕</button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={selectPvgAsPickup}
                      className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <span>📍 Set to PVG Campus</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Pickup & Dropoff Inputs */}
              <div className="relative flex flex-col gap-2 bg-[#F8F8F8] p-3 rounded-xl border border-[#E2E2E2]">
                {/* Visual Connector Dot/Line/Square */}
                <div className="absolute left-[23px] top-[26px] bottom-[26px] w-[2px] bg-black z-10"></div>

                {/* Pickup Row */}
                <div className="flex items-center gap-3 pl-1">
                  <div className="w-3 h-3 rounded-full bg-[#05A357] z-20 shrink-0"></div>
                  <div className="flex-1 flex items-center justify-between min-w-0 bg-white border border-[#E2E2E2] rounded-lg px-3 py-2 shadow-2xs">
                    {useLiveLocation && liveLocation ? (
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-black truncate">{liveLocation.shortName}</span>
                          <span className="text-[10px] text-[#717171] truncate">GPS Location</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUseLiveLocation(false)}
                          className="text-[11px] text-black font-semibold underline cursor-pointer ml-2"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <select
                        value={originIndex}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setOriginIndex(val);
                          localStorage.setItem('pooliq_preferred_hub', NASHIK_HUBS[val]?.id || 'cbs');
                        }}
                        className="w-full bg-transparent text-xs font-bold text-black focus:outline-none cursor-pointer truncate"
                      >
                        {NASHIK_HUBS.map((hub, idx) => (
                          <option key={hub.id} value={idx}>
                            Pickup: {hub.name}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchModalType('pickup');
                          setSearchQuery('');
                        }}
                        className="p-1 hover:bg-[#F3F3F3] rounded text-[#545454]"
                        title="Search location"
                      >
                        <span className="material-symbols-outlined text-[16px]">search</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFetchLiveLocation}
                        disabled={isLocating}
                        className="p-1 hover:bg-[#F3F3F3] rounded text-black"
                        title="Use GPS"
                      >
                        <span className={`material-symbols-outlined text-[16px] ${isLocating ? 'animate-spin' : ''}`}>
                          {isLocating ? 'progress_activity' : 'my_location'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dropoff Row */}
                <div className="flex items-center gap-3 pl-1">
                  <div className="w-3 h-3 bg-black z-20 shrink-0"></div>
                  <div className="flex-1 flex items-center justify-between min-w-0 bg-white border border-[#E2E2E2] rounded-lg px-3 py-2 shadow-2xs">
                    <select
                      value={destIndex}
                      onChange={(e) => setDestIndex(Number(e.target.value))}
                      className="w-full bg-transparent text-xs font-bold text-black focus:outline-none cursor-pointer truncate"
                    >
                      {NASHIK_HUBS.map((hub, idx) => (
                        <option key={hub.id} value={idx}>
                          Drop: {hub.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setSearchModalType('drop');
                        setSearchQuery('');
                      }}
                      className="p-1 hover:bg-[#F3F3F3] rounded text-[#545454] shrink-0 ml-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">search</span>
                    </button>
                  </div>
                </div>
              </div>

              {locationStatus && (
                <div className="text-[11px] font-medium text-black bg-[#F3F3F3] px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  <span>{locationStatus}</span>
                </div>
              )}

              {/* Ride Options Cards (Uber-like Product List) */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#717171]">
                  Choose a ride option
                </span>

                {/* Option 1: PoolIQ Saver */}
                <div
                  onClick={() => setSelectedRideType('pool')}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    selectedRideType === 'pool'
                      ? 'bg-[#F8F8F8] border-black ring-1 ring-black'
                      : 'bg-white border-[#E2E2E2] hover:bg-[#F8F8F8]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">groups</span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-black">PoolIQ Saver</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#E6F6EE] text-[#025C31] text-[9.5px] font-bold">
                          SAVE {Math.round((pooledSavings / soloFare) * 100)}%
                        </span>
                      </div>
                      <span className="text-xs text-[#545454]">Shared with up to 2 riders • 2 min ETA</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-base font-extrabold text-black">₹{dynamicPoolPrice}</span>
                    <span className="text-[11px] text-[#8F8F8F] line-through">₹{soloFare}</span>
                  </div>
                </div>

                {/* Option 2: PoolIQ Express */}
                <div
                  onClick={() => setSelectedRideType('express')}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    selectedRideType === 'express'
                      ? 'bg-[#F8F8F8] border-black ring-1 ring-black'
                      : 'bg-white border-[#E2E2E2] hover:bg-[#F8F8F8]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#276EF1] text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">bolt</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-extrabold text-black">PoolIQ Express</span>
                      <span className="text-xs text-[#545454]">Direct corridor pick • 1 min ETA</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-base font-extrabold text-black">₹{expressPoolPrice}</span>
                    <span className="text-[11px] text-[#8F8F8F] line-through">₹{soloFare}</span>
                  </div>
                </div>

                {/* Option 3: Solo Cab */}
                <div
                  onClick={() => setSelectedRideType('solo')}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    selectedRideType === 'solo'
                      ? 'bg-[#F8F8F8] border-black ring-1 ring-black'
                      : 'bg-white border-[#E2E2E2] hover:bg-[#F8F8F8]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#E2E2E2] text-black flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">person</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-extrabold text-black">Solo Ride</span>
                      <span className="text-xs text-[#545454]">Private vehicle • Direct travel</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-base font-extrabold text-black">₹{soloFare}</span>
                  </div>
                </div>
              </div>

              {/* Request Button */}
              <button
                id="request-pool-btn"
                onClick={() => {
                  const freshSeed = Math.floor(Math.random() * 10000);
                  setSharedOriginSeed(freshSeed);
                  const freshSharedOrigin = getSharedRideOrigin(originHub, destHub, freshSeed);
                  setPoolStage('matching');
                  if (onRequestRide) {
                    onRequestRide({
                      origin: originHub,
                      dest: destHub,
                      sharedOrigin: freshSharedOrigin,
                      soloFare,
                      pooledFare: selectedRideType === 'solo' ? soloFare : selectedRideType === 'express' ? expressPoolPrice : dynamicPoolPrice
                    });
                  }
                }}
                className="w-full py-3.5 bg-black hover:bg-[#1A1A1A] active:scale-[0.99] text-white font-bold text-base rounded-xl transition-all cursor-pointer shadow-lg mt-1 flex items-center justify-center gap-2"
              >
                <span>Choose {selectedRideType === 'solo' ? 'Solo Ride' : selectedRideType === 'express' ? 'PoolIQ Express' : 'PoolIQ Saver'}</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: MATCHING QUEUE */}
      {poolStage === 'matching' && (
        <div className="flex flex-col w-full">
          <div className="relative w-full h-[320px] bg-[#121212] overflow-hidden border-b border-[#E2E2E2]">
            <LeafletMap
              center={[originHub.lat, originHub.lon]}
              sharedOrigin={sharedOriginHub}
              approachRouteCoords={approachRouteCoords}
              pickup={originHub}
              drop={destHub}
              showRadar={true}
              radarCoords={[originHub.lat, originHub.lon]}
              searchRadiusMeters={1500}
              height="100%"
            />
            <div className="absolute top-3 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/85 text-white backdrop-blur-md shadow-md z-20">
              <span className="w-2 h-2 rounded-full bg-[#05A357] animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider">
                Matching nearby riders along route
              </span>
            </div>
          </div>

          <div className="relative z-10 -mt-5 px-4 pb-4 flex flex-col gap-3">
            <div className="w-full bg-white p-4 rounded-2xl shadow-xl flex flex-col gap-3 border border-[#E2E2E2]">
              {/* Batch progress */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-[#717171]">
                    Batch Window Allocation
                  </span>
                  <span className="text-xs font-bold font-mono text-black">
                    {batchProgress.toFixed(1)}s / 2.0s
                  </span>
                </div>
                <div className="w-full h-2 bg-[#E2E2E2] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black transition-all duration-200 ease-out"
                    style={{ width: `${Math.min(100, (batchProgress / 2.0) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-black">Connecting shared ride</h2>
                  <p className="text-xs text-[#545454]">{queueCount} co-riders merged along corridor</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#E6F6EE] text-[#025C31] text-xs font-bold">
                  Matched
                </span>
              </div>

              <div className="w-full h-px bg-[#E2E2E2]"></div>

              {/* Waypoints */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#276EF1]"></div>
                  <span className="text-xs text-black flex-1 truncate font-medium">1. Pick Co-Rider at {sharedOriginHub.shortName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#05A357]"></div>
                  <span className="text-xs font-bold text-black flex-1 truncate">2. Your Pickup at {originHub.shortName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-black"></div>
                  <span className="text-xs text-black flex-1 truncate font-medium">3. Dropoff at {destHub.shortName} ({tripDistance} km)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setPoolStage('active')}
                  className="flex-1 py-3 rounded-xl bg-black text-white font-bold text-sm shadow-md cursor-pointer hover:bg-[#1A1A1A]"
                >
                  Confirm Match
                </button>
                <button
                  onClick={() => {
                    setPoolStage('request');
                    if (onCancelRide) onCancelRide();
                  }}
                  className="px-4 py-3 rounded-xl bg-[#F3F3F3] text-black font-bold text-sm border border-[#E2E2E2] cursor-pointer hover:bg-[#E2E2E2]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 3: ACTIVE RIDE TRACKING */}
      {poolStage === 'active' && (
        <div className="flex flex-col w-full">
          <div className="relative w-full h-[330px] bg-[#121212] overflow-hidden border-b border-[#E2E2E2]">
            <LeafletMap
              center={[currentVehicleCoord.lat, currentVehicleCoord.lon]}
              sharedOrigin={sharedOriginHub}
              approachRouteCoords={approachRouteCoords}
              pickup={originHub}
              drop={destHub}
              routeCoords={activeRouteCoords}
              vehicleCoord={currentVehicleCoord}
              height="100%"
            />
            <div className="absolute top-3 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/85 text-white backdrop-blur-md shadow-md z-20">
              <span className="w-2 h-2 rounded-full bg-[#05A357] animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider">
                {hasArrivedAtPickup ? 'DRIVER ARRIVED' : `DRIVER ARRIVING · ${formatEta(etaSeconds)}`}
              </span>
            </div>
          </div>

          <div className="relative z-30 px-4 -mt-4">
            <div className="w-full bg-white rounded-2xl p-4 shadow-xl flex flex-col gap-3.5 border border-[#E2E2E2]">
              {/* Driver & Vehicle Details */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8F8F8] border border-[#E2E2E2]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">
                    PD
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-black">Pooja Deshmukh</span>
                      <span className="px-1.5 py-0.2 rounded bg-[#E6F6EE] text-[#025C31] text-[10px] font-bold">★ 4.95</span>
                    </div>
                    <span className="text-xs text-[#545454]">Tata Tiago EV • MH15-4109</span>
                  </div>
                </div>
                <button
                  onClick={() => alert('Calling driver...')}
                  className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">call</span>
                </button>
              </div>

              {/* Ride Summary Grid */}
              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-[#F8F8F8] border border-[#E2E2E2]">
                <div>
                  <span className="text-xs text-[#717171] uppercase font-bold block">Fare</span>
                  <span className="text-lg font-extrabold text-black">₹{dynamicPoolPrice}</span>
                </div>
                <div className="border-x border-[#E2E2E2]">
                  <span className="text-xs text-[#717171] uppercase font-bold block">Savings</span>
                  <span className="text-lg font-extrabold text-[#05A357]">₹{pooledSavings}</span>
                </div>
                <div>
                  <span className="text-xs text-[#717171] uppercase font-bold block">Co-riders</span>
                  <span className="text-lg font-extrabold text-black">2</span>
                </div>
              </div>

              {/* Action Cancel Button */}
              <button
                id="cancel-active-btn"
                onClick={handleActiveCancel}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  cancelIsConfirm
                    ? 'bg-[#E11900] text-white'
                    : 'bg-[#F3F3F3] text-black hover:bg-[#E2E2E2]'
                }`}
              >
                {cancelText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Search Modal */}
      {searchModalType && (
        <div
          className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSearchModalType(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl border border-[#E2E2E2] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-[#E2E2E2] flex items-center justify-between bg-[#F8F8F8]">
              <span className="text-xs font-bold uppercase tracking-wider text-black">
                Select {searchModalType === 'pickup' ? 'Pickup Location' : 'Dropoff Location'}
              </span>
              <button onClick={() => setSearchModalType(null)} className="text-black text-sm font-bold p-1 cursor-pointer">✕</button>
            </div>

            <div className="p-3 border-b border-[#E2E2E2]">
              <input
                type="text"
                autoFocus
                placeholder="Search PVG, College Rd, Dindori, Gangapur, CBS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8F8F8] rounded-lg text-sm text-black border border-[#E2E2E2] focus:outline-none focus:border-black"
              />
            </div>

            <div className="overflow-y-auto p-2 flex flex-col gap-1 max-h-[350px]">
              {filteredHubs.map((hub) => (
                <button
                  key={hub.id}
                  onClick={() => {
                    const hubIdx = NASHIK_HUBS.findIndex(h => h.id === hub.id);
                    if (searchModalType === 'pickup') {
                      if (hubIdx !== -1) setOriginIndex(hubIdx);
                      setUseLiveLocation(false);
                      localStorage.setItem('pooliq_preferred_hub', hub.id);
                    } else {
                      if (hubIdx !== -1) setDestIndex(hubIdx);
                    }
                    setSearchModalType(null);
                  }}
                  className="w-full p-2.5 rounded-lg flex items-center justify-between text-left hover:bg-[#F8F8F8] cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-black">{hub.name}</span>
                    <span className="text-[10px] text-[#717171]">{hub.tag || 'Transit Hub'}</span>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-[#545454]">chevron_right</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
