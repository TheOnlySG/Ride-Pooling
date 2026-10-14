import React, { useState, useRef, useEffect } from 'react';

/**
 * Uber PoolIQ Header - Clean, natural Uber header design
 */
export default function Header({
  title = "Uber PoolIQ",
  showBack = false,
  onBack = null,
  onTuneClick = null,
  userRole = 'passenger',
  setUserRole = null,
  backendStatus = 'Online'
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleSelect = (role) => {
    if (setUserRole) setUserRole(role);
    setShowProfileMenu(false);
  };

  return (
    <header className="fixed top-0 inset-x-0 z-[1100] bg-white/95 backdrop-blur-md border-b border-[#E2E2E2] shadow-xs pt-safe">
      <div className="h-14 px-4 flex items-center justify-between max-w-5xl mx-auto">
        {/* Brand & Left Navigation */}
        <div className="flex items-center gap-2.5">
          {showBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 -ml-1 flex items-center justify-center rounded-full text-black hover:bg-[#F3F3F3] transition-colors cursor-pointer"
              aria-label="Back"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-black text-white font-bold text-sm tracking-tight">
              Uber
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-sans font-extrabold text-lg tracking-tight text-black">
                PoolIQ
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase text-[#717171] hidden sm:inline font-semibold">
                {userRole === 'admin' ? 'Dispatch Console' : 'Ride Sharing'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls: Role Badge, Engine Status, Tune & Profile */}
        <div className="flex items-center gap-2">
          {/* Active Mode Pill */}
          <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
            userRole === 'admin'
              ? 'bg-black text-white'
              : 'bg-[#F3F3F3] text-black border border-[#E2E2E2]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${userRole === 'admin' ? 'bg-[#05A357]' : 'bg-[#05A357] animate-pulse'}`}></span>
            {userRole === 'admin' ? 'Admin Mode' : 'Passenger Mode'}
          </span>

          {/* Engine Controls button */}
          {onTuneClick && userRole === 'admin' && (
            <button
              onClick={onTuneClick}
              className="w-8 h-8 flex items-center justify-center rounded-full text-black hover:bg-[#F3F3F3] border border-[#E2E2E2] transition-colors cursor-pointer"
              title="Engine Telemetry & Controls"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </button>
          )}

          {/* User Profile Switcher */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-1.5 p-1 rounded-full hover:bg-[#F3F3F3] transition-all cursor-pointer"
              title="Account & Role Switcher"
              id="profile-role-switcher"
            >
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">
                NK
              </div>
              <span className="material-symbols-outlined text-[16px] text-[#545454]">expand_more</span>
            </button>

            {/* Profile Popover / Role Switcher Menu */}
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-[1101] bg-black/20 backdrop-blur-[1px] animate-fade-in"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl p-3 shadow-2xl border border-[#E2E2E2] z-[1102] animate-fade-in flex flex-col gap-3">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-[#E2E2E2]">
                    <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                      NK
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-black truncate">Nakul Karpe</span>
                      <span className="text-[11px] font-mono text-[#717171] truncate">karpenakul885</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#717171] font-semibold px-1">
                      Switch Role
                    </span>

                    <button
                      onClick={() => handleRoleSelect('passenger')}
                      className={`flex items-start gap-2.5 p-2 rounded-xl text-left transition-all cursor-pointer ${
                        userRole === 'passenger'
                          ? 'bg-[#F3F3F3] font-bold text-black border border-[#E2E2E2]'
                          : 'hover:bg-[#F8F8F8] text-[#545454]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] text-black mt-0.5">person</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-black">Passenger Mode</span>
                        <span className="text-[10.5px] text-[#717171]">Book rides & track live pooling</span>
                      </div>
                      {userRole === 'passenger' && (
                        <span className="material-symbols-outlined text-[16px] text-black ml-auto">check</span>
                      )}
                    </button>

                    <button
                      onClick={() => handleRoleSelect('admin')}
                      className={`flex items-start gap-2.5 p-2 rounded-xl text-left transition-all cursor-pointer ${
                        userRole === 'admin'
                          ? 'bg-black text-white'
                          : 'hover:bg-[#F8F8F8] text-[#545454]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#05A357] mt-0.5">admin_panel_settings</span>
                      <div className="flex flex-col">
                        <span className={`text-xs font-semibold ${userRole === 'admin' ? 'text-white' : 'text-black'}`}>
                          Admin & Dispatch
                        </span>
                        <span className={`text-[10.5px] ${userRole === 'admin' ? 'text-[#A0A0A0]' : 'text-[#717171]'}`}>
                          Fleet operations & algorithm controls
                        </span>
                      </div>
                      {userRole === 'admin' && (
                        <span className="material-symbols-outlined text-[16px] text-[#05A357] ml-auto">check</span>
                      )}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-[#E2E2E2] flex items-center justify-between text-[10px] font-mono text-[#717171]">
                    <span>Engine: {backendStatus}</span>
                    <span className="text-black font-semibold">v3.2</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
