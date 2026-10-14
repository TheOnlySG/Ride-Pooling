import React from 'react';

/**
 * Uber PoolIQ Bottom Navigation - Authentic Uber bottom sheet style tabs
 */
export default function BottomNav({ activeTab, setActiveTab, userRole = 'passenger' }) {
  const passengerTabs = [
    { id: 'pool', label: 'Ride', icon: 'directions_car' },
    { id: 'journey', label: 'Activity', icon: 'near_me' },
    { id: 'fairness', label: 'Vault', icon: 'verified_user' },
    { id: 'routes', label: 'Corridors', icon: 'alt_route' }
  ];

  const adminTabs = [
    { id: 'fleet', label: 'Fleet', icon: 'hub' },
    { id: 'stats', label: 'Analytics', icon: 'insights' },
    { id: 'routes', label: 'Corridors', icon: 'alt_route' },
    { id: 'dispatch', label: 'Dispatch', icon: 'map' }
  ];

  const currentTabs = userRole === 'admin' ? adminTabs : passengerTabs;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-[#E2E2E2] shadow-lg pb-safe">
      <div className="grid grid-cols-4 max-w-md mx-auto h-16 px-2 py-1 items-center">
        {currentTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center h-full w-full rounded-xl transition-all cursor-pointer select-none py-1 ${
                isActive
                  ? 'text-black font-bold bg-[#F3F3F3]'
                  : 'text-[#8F8F8F] hover:text-black hover:bg-[#F8F8F8]'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] transition-transform ${
                  isActive ? 'scale-105 text-black' : 'text-[#8F8F8F]'
                }`}
              >
                {tab.icon}
              </span>
              <span className="font-sans text-[11px] tracking-tight mt-1 whitespace-nowrap leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
