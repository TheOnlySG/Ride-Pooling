import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import PoolScreen from './pages/PoolScreen';
import JourneyScreen from './pages/JourneyScreen';
import FairnessScreen from './pages/FairnessScreen';
import RoutesScreen from './pages/RoutesScreen';
import StatsScreen from './pages/StatsScreen';
import FleetScreen from './pages/FleetScreen';
import DispatchScreen from './pages/DispatchScreen';
import ZeroTrustGate from './components/ZeroTrustGate';
import RouteDiffView from './components/RouteDiffView';
import {
  fetchHealth,
  fetchState,
  submitRideRequest,
  runDispatch,
  loadScenario,
  controlSim,
  fetchDistanceConfig,
  updateDistanceConfig,
  fetchTrafficStatus,
  setTrafficScenario,
  fetchFraudAlerts,
  fetchArenaBenchmark
} from './utils/api';
import { NASHIK_HUBS } from './data/nashikLocations';

export default function App() {
  const [userRole, setUserRole] = useState('passenger'); // 'passenger' | 'admin'
  const [activeTab, setActiveTab] = useState('pool'); // 'pool' | 'journey' | 'fairness' | 'routes' | 'stats' | 'fleet'
  const [poolStage, setPoolStage] = useState('request'); // 'request' | 'matching' | 'active'
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('controls');
  const modalScrollRef = useRef(null);

  const [isEvaluatingGate, setIsEvaluatingGate] = useState(false);
  const [gateDecision, setGateDecision] = useState('COMMITTED');

  const handleReverifyGate = async () => {
    setIsEvaluatingGate(true);
    const res = await runDispatch(selectedStrategy);
    setTimeout(() => {
      setGateDecision('COMMITTED');
      setIsEvaluatingGate(false);
    }, 600);
  };

  useEffect(() => {
    if (modalScrollRef.current) {
      modalScrollRef.current.scrollTop = 0;
    }
  }, [activeModalTab, showSettingsModal]);

  const handleRoleChange = (newRole) => {
    setUserRole(newRole);
    if (newRole === 'passenger') {
      if (activeTab === 'stats' || activeTab === 'fleet' || activeTab === 'dispatch') {
        setActiveTab('pool');
      }
    } else if (newRole === 'admin') {
      if (activeTab === 'journey' || activeTab === 'fairness' || activeTab === 'pool') {
        setActiveTab('dispatch');
      }
    }
  };

  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [selectedScenario, setSelectedScenario] = useState('demo_5r_3v');
  const [selectedStrategy, setSelectedStrategy] = useState('hybrid');
  const [trafficMode, setTrafficMode] = useState('NORMAL');
  const [distanceConfig, setDistanceConfig] = useState(null);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [arenaResults, setArenaResults] = useState(null);

  // Backend state cache
  const [backendState, setBackendState] = useState(null);
  const [activeRideRequest, setActiveRideRequest] = useState(null);
  const [assignedVehicle, setAssignedVehicle] = useState(null);

  // Poll backend health and state
  useEffect(() => {
    let mounted = true;

    async function poll() {
      const health = await fetchHealth();
      if (!mounted) return;
      if (health && health.status === 'ok') {
        setBackendStatus(`Online (${health.road_data})`);
        const state = await fetchState();
        if (state && mounted) {
          setBackendState(state);

          if (activeRideRequest && state.vehicles) {
            const v = state.vehicles.find((veh) =>
              (veh.onboard || []).includes(activeRideRequest.id) ||
              (veh.route && veh.route.some((r) => r.request_id === activeRideRequest.id))
            );
            if (v) {
              setAssignedVehicle(v);
            }
          }
        }
      } else {
        setBackendStatus('Simulation Mode');
      }
    }

    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeRideRequest]);

  useEffect(() => {
    if (!showSettingsModal) return;
    fetchTrafficStatus().then((t) => t && setTrafficMode(t.mode));
    fetchDistanceConfig().then((d) => d && setDistanceConfig(d));
    fetchFraudAlerts().then((a) => a && setFraudAlerts(a));
  }, [showSettingsModal]);

  const getHeaderTitle = () => {
    if (activeTab === 'pool') {
      if (poolStage === 'request' || poolStage === 'matching') return 'Ride Booking';
      return 'Uber PoolIQ';
    }
    if (activeTab === 'journey') return 'Your Activity';
    if (activeTab === 'fairness') return 'Fairness Vault';
    if (activeTab === 'routes') return 'Busy Corridors';
    if (activeTab === 'stats') return 'Analytics';
    if (activeTab === 'fleet') return 'Fleet Telemetry';
    if (activeTab === 'dispatch') return 'Dispatch Operations';
    return 'Uber PoolIQ';
  };

  const handleHeaderBack = () => {
    if (activeTab === 'pool') {
      if (poolStage === 'matching' || poolStage === 'active') {
        setPoolStage('request');
        return;
      }
    }
    setActiveTab('pool');
    setPoolStage('request');
  };

  const [preselectedHubs, setPreselectedHubs] = useState(null);

  const handleSelectCorridor = (corridor) => {
    setActiveTab('pool');
    setPoolStage('request');
    if (corridor && corridor.stops && corridor.stops.length > 0) {
      const firstStop = corridor.stops[0].toLowerCase();
      const lastStop = corridor.stops[corridor.stops.length - 1].toLowerCase();
      const originIdx = NASHIK_HUBS.findIndex(
        (h) => h.name.toLowerCase().includes(firstStop) || h.shortName.toLowerCase().includes(firstStop)
      );
      const destIdx = NASHIK_HUBS.findIndex(
        (h) => h.name.toLowerCase().includes(lastStop) || h.shortName.toLowerCase().includes(lastStop)
      );
      setPreselectedHubs({
        originIdx: originIdx >= 0 ? originIdx : 0,
        destIdx: destIdx >= 0 ? destIdx : 2
      });
    }
  };

  const handleRequestRide = async ({ origin, dest, sharedOrigin, soloFare, pooledFare }) => {
    const res = await submitRideRequest({
      pickup: origin,
      drop: dest,
      seats: 1
    });
    if (res && res.id) {
      setActiveRideRequest({
        id: res.id,
        origin,
        dest,
        sharedOrigin,
        soloFare,
        pooledFare
      });
    }
  };

  const handleCancelRide = () => {
    setActiveRideRequest(null);
    setAssignedVehicle(null);
    setPoolStage('request');
  };

  const handleDispatchRun = async () => {
    const res = await runDispatch(selectedStrategy);
    if (res) {
      alert(`Batch dispatched via ${res.strategy || 'Hybrid'}! Status: ${res.assigned ? `${res.assigned.length} assigned` : 'Success'}`);
      const state = await fetchState();
      if (state) setBackendState(state);
    } else {
      alert('Batch flush simulation triggered.');
    }
  };

  const handleScenarioChange = async (scenarioId) => {
    setSelectedScenario(scenarioId);
    const res = await loadScenario(scenarioId);
    if (res) {
      const state = await fetchState();
      if (state) setBackendState(state);
    }
  };

  const handleSimClock = async (action, speed = null) => {
    await controlSim(action, speed);
    const state = await fetchState();
    if (state) setBackendState(state);
  };

  const handleTrafficChange = async (mode) => {
    setTrafficMode(mode);
    await setTrafficScenario(mode);
  };

  const handleRunArena = async () => {
    const arena = await fetchArenaBenchmark(selectedScenario);
    if (arena) {
      setArenaResults(arena);
    }
  };

  return (
    <div className="bg-[#F6F6F6] text-black min-h-screen flex flex-col antialiased selection:bg-black selection:text-white">
      {/* Top Header */}
      <Header
        title={getHeaderTitle()}
        showBack={activeTab === 'pool' && poolStage !== 'request'}
        onBack={handleHeaderBack}
        onTuneClick={() => setShowSettingsModal(true)}
        userRole={userRole}
        setUserRole={handleRoleChange}
        backendStatus={backendStatus}
      />

      {/* Main Screen Content */}
      <main className="flex-1 flex flex-col relative w-full pt-14 pb-20 max-w-xl mx-auto">
        {activeTab === 'pool' && (
          <PoolScreen
            poolStage={poolStage}
            setPoolStage={setPoolStage}
            onRequestRide={handleRequestRide}
            onCancelRide={handleCancelRide}
            backendWindow={backendState ? backendState.window : null}
            assignedVehicle={assignedVehicle}
            preselectedHubs={preselectedHubs}
          />
        )}

        {activeTab === 'journey' && (
          <JourneyScreen
            activeRide={activeRideRequest}
            assignedVehicle={assignedVehicle}
          />
        )}

        {activeTab === 'fairness' && (
          <FairnessScreen />
        )}

        {activeTab === 'routes' && (
          <RoutesScreen onSelectCorridor={handleSelectCorridor} userRole={userRole} />
        )}

        {activeTab === 'stats' && (
          <StatsScreen backendMetrics={backendState ? backendState.metrics : null} />
        )}

        {activeTab === 'fleet' && (
          <FleetScreen backendVehicles={backendState ? backendState.vehicles : null} />
        )}

        {activeTab === 'dispatch' && (
          <DispatchScreen
            backendState={backendState}
            onRunDispatch={handleDispatchRun}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
      />

      {/* Telemetry Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div
            ref={modalScrollRef}
            className="w-full max-w-2xl bg-white rounded-2xl p-4 md:p-5 border border-[#E2E2E2] shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#E2E2E2] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-black text-[22px]">tune</span>
                <h3 className="text-base font-bold text-black">
                  Engine Controls & Telemetry
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#545454] hover:bg-[#F3F3F3] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="w-full border-b border-[#E2E2E2] pb-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {[
                  { id: 'controls', label: 'Controls' },
                  { id: 'gate', label: 'Trust Gate' },
                  { id: 'diff', label: 'Route Diff' },
                  { id: 'traffic', label: 'Traffic' },
                  { id: 'distance', label: 'Distance' },
                  { id: 'alerts', label: 'Alerts' },
                  { id: 'arena', label: 'Arena' }
                ].map((tab) => {
                  const isActive = activeModalTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveModalTab(tab.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-all cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-black text-white'
                          : 'bg-[#F3F3F3] text-black hover:bg-[#E2E2E2]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CONTROLS */}
            {activeModalTab === 'controls' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8F8F8] border border-[#E2E2E2]">
                  <span className="text-xs font-bold uppercase text-[#717171]">Backend State</span>
                  <span className="text-xs font-bold font-mono text-black">
                    {backendStatus}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase text-[#717171]">
                    Simulation Clock
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSimClock('start')}
                      className="flex-1 py-2 rounded-lg bg-black text-white text-xs font-bold cursor-pointer hover:bg-[#1A1A1A]"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => handleSimClock('pause')}
                      className="flex-1 py-2 rounded-lg bg-[#F3F3F3] text-black border border-[#E2E2E2] text-xs font-bold cursor-pointer hover:bg-[#E2E2E2]"
                    >
                      Pause
                    </button>
                    <button
                      onClick={() => handleSimClock('reset')}
                      className="flex-1 py-2 rounded-lg bg-[#F3F3F3] text-black border border-[#E2E2E2] text-xs font-bold cursor-pointer hover:bg-[#E2E2E2]"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase text-[#717171]">
                    Load Scenario
                  </label>
                  <select
                    value={selectedScenario}
                    onChange={(e) => handleScenarioChange(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#F8F8F8] text-black border border-[#E2E2E2] text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="demo_5r_3v">demo_5r_3v (5 riders, 3 vehicles)</option>
                    <option value="edge_capacity">edge_capacity (Max load edge case)</option>
                    <option value="edge_tight_window">edge_tight_window (Tight time window)</option>
                    <option value="stress_25r_100v">stress_25r_100v (High volume batch)</option>
                  </select>
                </div>

                <button
                  onClick={handleDispatchRun}
                  className="w-full py-3 rounded-xl bg-black text-white font-bold text-sm hover:bg-[#1A1A1A] transition-all cursor-pointer shadow-md"
                >
                  Force Dispatch Run
                </button>
              </div>
            )}

            {/* TRUST GATE */}
            {activeModalTab === 'gate' && (
              <div className="flex flex-col gap-3">
                <ZeroTrustGate
                  decision={gateDecision}
                  isEvaluating={isEvaluatingGate}
                  onRunValidation={handleReverifyGate}
                />
              </div>
            )}

            {/* ROUTE DIFF */}
            {activeModalTab === 'diff' && (
              <div className="flex flex-col gap-3">
                <RouteDiffView />
              </div>
            )}

            {/* TRAFFIC */}
            {activeModalTab === 'traffic' && (
              <div className="flex flex-col gap-2">
                {[
                  { mode: 'NORMAL', label: 'Normal Traffic (1.0x)' },
                  { mode: 'MODERATE_CONGESTION', label: 'Moderate Congestion (1.25x)' },
                  { mode: 'SEVERE_CONGESTION', label: 'Severe Congestion (1.50x)' }
                ].map((item) => (
                  <button
                    key={item.mode}
                    onClick={() => handleTrafficChange(item.mode)}
                    className={`p-3 rounded-xl text-left border flex items-center justify-between cursor-pointer ${
                      trafficMode === item.mode
                        ? 'bg-black text-white border-black'
                        : 'bg-[#F8F8F8] text-black border-[#E2E2E2]'
                    }`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    {trafficMode === item.mode && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-[#E2E2E2] pt-3 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2 rounded-xl bg-black text-white text-xs font-bold uppercase cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
