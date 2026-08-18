/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Car,
  Phone,
  MessageSquare,
  Mail,
  ShieldCheck,
  Calendar,
  Layers,
  Sliders,
  Settings,
  X,
  Plus,
  Compass,
  ArrowDownCircle,
  Clock,
  HeartHandshake,
  UserCheck,
  BellRing,
  Award,
  CircleHelp,
  Home,
  Truck,
  Info,
  ChevronRight,
  Lock,
  MapPin,
  Sparkles,
  Send,
  HelpCircle,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ServiceType, VehicleCategory, GeneralSettings } from './types';
import MapPicker from './components/MapPicker';
import InquiryForm from './components/InquiryForm';
import AdminDashboard from './components/AdminDashboard';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import { InstallPrompt } from './components/InstallPrompt';
import DriverPage from './components/DriverPage';
import CustomerTrackingPage from './components/CustomerTrackingPage';
import { SupabaseService } from './lib/supabase';

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

// Dynamically resolves metadata for custom & standard vehicle categories from name keywords
function resolveCategoryDetails(name: string) {
  const lower = name.toLowerCase();
  
  // 1. Dynamic passenger capacity detector
  let capacity = '4 Passengers';
  const paxRegexes = [
    /(\d+)\s*(?:pax|passengers|seater|seats|persons|people|person|seat)/i,
    /(\d+)\s*-seater/i,
    /(\d+)\s*s/i
  ];
  for (const regex of paxRegexes) {
    const match = name.match(regex);
    if (match) {
      capacity = `${match[1]} Passengers`;
      break;
    }
  }
  
  // Keyword fallback if regex doesn't match
  if (!name.match(/(?:pax|passengers|seater|seats|persons|people|person|seat|-seater)/i)) {
    if (lower.includes('tempo') || lower.includes('traveller') || lower.includes('bus') || lower.includes('coach')) {
      capacity = '12 - 20 Passengers';
    } else if (lower.includes('suv') && (lower.includes('7') || lower.includes('seven'))) {
      capacity = '7 Passengers';
    } else if (lower.includes('suv')) {
      capacity = '6 Passengers';
    } else if (lower.includes('innova') || lower.includes('mpv') || lower.includes('ertiga') || lower.includes('luxury')) {
      capacity = '7 Passengers';
    } else if (lower.includes('hatchback') || lower.includes('economy') || lower.includes('mini')) {
      capacity = '4 Passengers';
    } else if (lower.includes('sedan')) {
      capacity = '4 Passengers';
    }
  }

  // 2. Dynamic luggage capacity detector
  let luggage = '3 Standard Bags';
  const bagRegexes = [
    /(\d+)\s*(?:bags|luggage|suitcases|packages|bag|suitcase|cargo)/i
  ];
  for (const regex of bagRegexes) {
    const match = name.match(regex);
    if (match) {
      luggage = `${match[1]} Bags`;
      break;
    }
  }
  
  if (!name.match(/(?:bags|luggage|suitcases|packages|bag|suitcase|cargo)/i)) {
    if (lower.includes('tempo') || lower.includes('traveller') || lower.includes('bus') || lower.includes('coach')) {
      luggage = '12+ Heavy Bags';
    } else if (lower.includes('suv')) {
      luggage = '5 Medium Bags';
    } else if (lower.includes('innova') || lower.includes('mpv') || lower.includes('luxury') || lower.includes('ertiga')) {
      luggage = '6 Large Packages';
    } else if (lower.includes('hatchback') || lower.includes('economy') || lower.includes('mini')) {
      luggage = '2 Carry-ons';
    } else if (lower.includes('sedan')) {
      luggage = '3 Medium Suitcases';
    }
  }

  // 3. Esthetic design visual gradient
  let gradient = 'from-neutral-800 to-neutral-950'; // Deep Slate Luxury default
  if (lower.includes('hatchback') || lower.includes('economy') || lower.includes('mini')) {
    gradient = 'from-zinc-700 to-zinc-900'; // Cool light-medium gray
  } else if (lower.includes('sedan') && (lower.includes('premium') || lower.includes('luxury') || lower.includes('elite'))) {
    gradient = 'from-slate-800 to-neutral-950'; // High executive dark
  } else if (lower.includes('sedan')) {
    gradient = 'from-neutral-800 to-neutral-950'; // standard premium dark
  } else if (lower.includes('suv') && (lower.includes('premium') || lower.includes('luxury'))) {
    gradient = 'from-cyan-950 to-neutral-900'; // Deep emerald teal
  } else if (lower.includes('suv')) {
    gradient = 'from-cyan-900 to-neutral-950'; // standard SUV
  } else if (lower.includes('innova') || lower.includes('mpv') || lower.includes('premium') || lower.includes('luxury') || lower.includes('ertiga')) {
    gradient = 'from-indigo-950 to-neutral-950'; // Royal indigo/blue
  } else if (lower.includes('tempo') || lower.includes('traveller') || lower.includes('bus') || lower.includes('coach')) {
    gradient = 'from-neutral-900 to-neutral-950'; // Heavy industrial charcoal
  }

  // 4. Engine/Fuel class
  let fuelType = 'petrol / diesel';

  // 5. Short description fallbacks
  let description = `Premium standard ${name} class vehicle from our vetted fleet. Extensively detailed and optimized for elite passenger safety, climate control, and unmatched travel reliability.`;
  if (lower.includes('hatchback') || lower.includes('economy') || lower.includes('mini')) {
    description = 'Highly efficient compact city hatchbacks. Pristine condition, optimized for cost-sensitive city runs and agile daily transits.';
  } else if (lower.includes('sedan')) {
    description = 'Elegant business sedans offering perfect cabin legroom, silent travel acoustics, dual-zone climate blowers, and clean layout.';
  } else if (lower.includes('suv')) {
    description = 'Commanding high-clearance sports utility vehicles. Features robust luggage capacity, offroad utility safety parameters.';
  } else if (lower.includes('innova') || lower.includes('mpv') || lower.includes('ertiga')) {
    description = 'Unmatched executive MPV cruisers (Premium Innova class) featuring leather captain chairs, personal charge ports, and grand VIP privacy.';
  } else if (lower.includes('tempo') || lower.includes('traveller') || lower.includes('bus') || lower.includes('coach')) {
    description = 'Large volume transport liners (Tempo Traveller standard) customizable with individual luxury highback recliners and robust cargo spaces.';
  }

  return {
    capacity,
    luggage,
    gradient,
    fuelType,
    description
  };
}

export default function App() {
  // Early check to identify a completely fresh session (fresh app launch) vs page reload/refresh
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const hasMagicToken = urlParams.has('driver_token') || urlParams.has('tracking_token');

    const isFreshSession = !sessionStorage.getItem('app_session_active');
    if (isFreshSession && !hasMagicToken) {
      // Clear persistence keys to ensure fresh launches always initialize on the Home page
      localStorage.removeItem('active_tab');
      localStorage.removeItem('active_nav');
      sessionStorage.setItem('app_session_active', 'true');
      
      // Remove any route/tab queries from active URL history so default fallbacks are used
      const url = new URL(window.location.href);
      if (url.searchParams.has('tab') || url.searchParams.has('nav')) {
        url.searchParams.delete('tab');
        url.searchParams.delete('nav');
        window.history.replaceState({}, '', url.toString());
      }
    } else if (hasMagicToken) {
      sessionStorage.setItem('app_session_active', 'true');
    }
  }

  // Navigation: 'client' or 'admin' (persisted across page refreshes)
  const [activeTab, setActiveTab] = useState<'client' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam === 'admin' || tabParam === 'client') {
        return tabParam;
      }
      const savedTab = localStorage.getItem('active_tab');
      if (savedTab === 'admin' || savedTab === 'client') {
        return savedTab;
      }
    }
    return 'client';
  });

  const setActiveTabPersisted = (tab: 'client' | 'admin') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_tab', tab);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({}, '', url.toString());
    }
  };

  // Live Tracking and Driver Workspace magic link routing
  const [driverToken, setDriverToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('driver_token');
    }
    return null;
  });

  const [trackingToken, setTrackingToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('tracking_token');
    }
    return null;
  });

  // Nav sub-views for Client mode (persisted as well!)
  const [activeNav, setActiveNav] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const navParam = urlParams.get('nav');
      if (navParam) return navParam;
      const savedNav = localStorage.getItem('active_nav');
      if (savedNav) return savedNav;
    }
    return 'home';
  });

  const setActiveNavPersisted = (nav: string) => {
    setActiveNav(nav);
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_nav', nav);
      const url = new URL(window.location.href);
      url.searchParams.set('nav', nav);
      window.history.pushState({}, '', url.toString());
    }
  };

  // Synchronize routing state changes from popstate
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handlePopState = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        const navParam = urlParams.get('nav');
        if (tabParam === 'admin' || tabParam === 'client') {
          setActiveTab(tabParam);
        }
        if (navParam) {
          setActiveNav(navParam);
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  // Simple viewport resize and orientation listener to enforce fresh layouts and re-renders
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Double trigger after a slight delay to ensure browser reported dimensions settle
    const handleOrientationTransition = () => {
      setTimeout(() => {
        setViewportWidth(window.innerWidth);
      }, 200);
    };
    window.addEventListener('orientationchange', handleOrientationTransition);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('orientationchange', handleOrientationTransition);
    };
  }, []);

  // Map state
  const [pickupLoc, setPickupLoc] = useState<LocationData | null>(null);
  const [dropLoc, setDropLoc] = useState<LocationData | null>(null);

  // Form referencing to scroll into view and trigger focus presets
  const formRef = useRef<HTMLDivElement>(null);
  const [formServiceSelector, setFormServiceSelector] = useState<ServiceType>('Fleet Booking');

  // General Brand and Contact Configurations
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    company_name: 'Car & Driver Relief Services',
    company_logo: '',
    contact_number: '9876543210',
    email_address: 'admin@reliefservices.demo',
    office_address: '123 Elite Transit Plaza, Sector V, Salt Lake, Kolkata, West Bengal 700091, India',
    timezone: 'Asia/Kolkata'
  });

  const contactPhone = generalSettings.contact_number;
  const contactWhatsapp = generalSettings.contact_number;
  const contactEmail = generalSettings.email_address;

  // System-wide notification toast state
  const [notifMessage, setNotifMessage] = useState<string | null>(null);
  const [showNotif, setShowNotif] = useState(false);

  // Success Submitted ID tracking
  const [submissionReference, setSubmissionReference] = useState<string | null>(null);

  // DB Vehicle Categories pricing local state for live render
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Fetch live vehicle categories and general settings on mount
  useEffect(() => {
    let active = true;
    const loadInitialData = async () => {
      try {
        const [liveCats, liveSettings] = await Promise.all([
          SupabaseService.getVehicleCategories(),
          SupabaseService.getSettings()
        ]);
        if (active) {
          if (liveCats && liveCats.length > 0) {
            setVehicleCategories(liveCats);
          }
          if (liveSettings) {
            setGeneralSettings(liveSettings);
          }
        }
      } catch (err) {
        console.warn('Could not load initial data in main App component:', err);
      } finally {
        if (active) setLoadingCategories(false);
      }
    };
    loadInitialData();
    return () => {
      active = false;
    };
  }, []);

  // Listen to live updates from general page events (e.g. admin saves)
  useEffect(() => {
    const handleCatsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<VehicleCategory[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setVehicleCategories(customEvent.detail);
      }
    };

    const handleSettingsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<GeneralSettings>;
      if (customEvent.detail) {
        setGeneralSettings(customEvent.detail);
      }
    };

    window.addEventListener('supabase-vehicle-categories-updated', handleCatsUpdate);
    window.addEventListener('supabase-settings-updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('supabase-vehicle-categories-updated', handleCatsUpdate);
      window.removeEventListener('supabase-settings-updated', handleSettingsUpdate);
    };
  }, []);

  const triggerGlobalToast = (msg: string) => {
    setNotifMessage(msg);
    setShowNotif(true);
  };

  useEffect(() => {
    if (showNotif) {
      const timer = setTimeout(() => {
        setShowNotif(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showNotif]);

  // Utility to find database configurations dynamically
  const findDbPricing = (nameKeyword: string, fallback: { base: number; perKm: number; min: number }) => {
    const found = vehicleCategories.find(
      (cat) => cat.name.toLowerCase().includes(nameKeyword.toLowerCase()) && cat.active
    );
    return {
      name: found ? found.name : nameKeyword,
      base_fare: found ? found.base_fare : fallback.base,
      per_km_rate: found ? found.per_km_rate : fallback.perKm,
      minimum_fare: found ? found.minimum_fare ?? found.base_fare : fallback.min
    };
  };

  // Handle service card click - scrolls to form and targets service
  const handleSelectServiceFromCard = (service: ServiceType) => {
    setFormServiceSelector(service);
    
    // Select default dropdown in form component if it exists
    const dropdown = document.getElementById('select-service-type') as HTMLSelectElement;
    if (dropdown) {
      dropdown.value = service;
    }

    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    triggerGlobalToast(`Assigned ${service} service option inside request form!`);
  };

  // Advanced flow: select category and instantly routing to Booking form with preset target
  const handleSelectCategoryAndRoute = (categoryDbName: string, serviceOption: ServiceType) => {
    setFormServiceSelector(serviceOption);
    setActiveNavPersisted('home');
    triggerGlobalToast(`Assigned ${categoryDbName} vehicle to live booking form!`);
    
    setTimeout(() => {
      const dropdown = document.getElementById('select-vehicle-category') as HTMLSelectElement;
      if (dropdown) {
        dropdown.value = categoryDbName;
        // Trigger synthetic drop change event to let form state capture selection
        const event = new Event('change', { bubbles: true });
        dropdown.dispatchEvent(event);
      }
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handleInquiryFormSuccess = (refId: string) => {
    setSubmissionReference(refId);
    triggerGlobalToast(`Success! Logged Inquiry Lead with Server ID: ${refId.substring(0, 8)}...`);
  };

  // Defining navigation items matching requested navigation menu
  const navigationItems = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'fleet', label: 'Fleet Categories', icon: Car },
    { key: 'drivers', label: 'Driver Relief Services', icon: ShieldCheck },
    { key: 'about', label: 'About', icon: Info },
    { key: 'contact', label: 'Contact', icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 font-sans flex flex-col justify-between selection:bg-neutral-900 selection:text-amber-450">
      {/* Dynamic PWA Interactive Install Promotion & Fallback Banner */}
      <InstallPrompt onNotifyTriggered={triggerGlobalToast} />

      {/* Upper Navigation Header (Completely hidden/unmounted when activeTab is set to 'admin' or on mobile layout) */}
      {activeTab === 'client' && (
        <header className="hidden md:block md:sticky top-0 bg-white/95 backdrop-blur-md border-b border-neutral-200 z-[9990] shadow-sm transition-all duration-350">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-0 md:gap-3">
            
            {/* Top Row: Logo + Branding and Mobile Admin Button */}
            <div className="flex items-center justify-between w-full md:w-auto">
              {/* Logo & Branding */}
              <button
                onClick={() => {
                  setActiveTabPersisted('client');
                  setActiveNavPersisted('home');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                id="brand-logo-button"
                className="flex items-center gap-2 text-left group animate-fade-in shrink-0"
              >
                <div className="p-0.5 md:p-1 bg-neutral-950 rounded-lg md:rounded-xl shadow-md group-hover:bg-[#10B981] transition-all overflow-hidden w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
                  {generalSettings.company_logo ? (
                    <img src={generalSettings.company_logo} alt={generalSettings.company_name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <img src="/icon.svg" alt={generalSettings.company_name} className="w-6 h-6 md:w-8 md:h-8 object-contain animate-pulse-slow" />
                  )}
                </div>
                <div>
                  <h1 className="text-[11px] md:text-sm font-extrabold tracking-tight text-neutral-950 uppercase leading-tight font-display max-w-[200px] md:max-w-xs break-words">
                    {generalSettings.company_name}
                  </h1>
                </div>
              </button>

              {/* Mobile Admin button (only visible on mobile, aligned right) */}
              <div className="flex md:hidden items-center">
                <button
                  onClick={() => setActiveTabPersisted('admin')}
                  id="header-nav-admin"
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold tracking-wide transition-all shrink-0 ${
                    activeTab === 'admin'
                      ? 'bg-amber-500 text-neutral-950 shadow-md border border-amber-400/50'
                      : 'bg-neutral-50 text-neutral-600 hover:text-neutral-915 hover:bg-neutral-100 border border-neutral-200'
                  }`}
                >
                  <Lock className="w-2.5 h-2.5 text-neutral-400" />
                  <span>Admin</span>
                </button>
              </div>
            </div>

            {/* Central/Main Navbar for standard navigation links (Desktop only) */}
            <nav className="hidden md:flex items-center gap-1 mx-auto" id="main-header-navbar">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === 'client' && activeNav === item.key;
                return (
                  <button
                    key={item.key}
                    id={`header-nav-item-${item.key}`}
                    onClick={() => {
                      setActiveTabPersisted('client');
                      setActiveNavPersisted(item.key);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'bg-neutral-900 text-white shadow-md font-bold'
                        : 'text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100 font-medium'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-neutral-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Mobile Navigation bar directly embedded under logo row within layout (No separate floating component!) */}
            <nav 
              className="flex md:hidden items-center gap-1 overflow-x-auto whitespace-nowrap no-scrollbar py-0.5 -mx-1 px-1 border-t border-neutral-100/35 mt-1"
              style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
              id="mobile-header-navbar"
            >
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === 'client' && activeNav === item.key;
                return (
                  <button
                    key={item.key}
                    id={`header-nav-item-mobile-${item.key}`}
                    onClick={() => {
                      setActiveTabPersisted('client');
                      setActiveNavPersisted(item.key);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide transition-all shrink-0 ${
                      isActive
                        ? 'bg-neutral-900 text-white shadow-sm font-bold'
                        : 'text-neutral-500 hover:text-neutral-950 font-medium'
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${isActive ? 'text-emerald-400' : 'text-neutral-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Admin Navigation Button (Desktop only) */}
            <div className="hidden md:flex items-center gap-2 justify-end">
              <button
                onClick={() => setActiveTabPersisted('admin')}
                id="header-nav-admin"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all shrink-0 ${
                  activeTab === 'admin'
                    ? 'bg-amber-500 text-neutral-950 shadow-md border border-amber-400/50'
                    : 'bg-neutral-50 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200'
                }`}
              >
                <Lock className={`w-3.5 h-3.5 ${activeTab === 'admin' ? 'text-neutral-900' : 'text-neutral-400'}`} />
                <span>Admin</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Global Interactive Notification Toaster Portal */}
      <AnimatePresence>
        {showNotif && (
          <div className="fixed top-20 right-6 z-[9999] pointer-events-none" id="global-toaster-alert">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="bg-neutral-900 text-white border border-neutral-800 shadow-2xl p-4 rounded-xl flex items-center gap-3 max-w-sm pointer-events-auto"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="flex-1">
                <span className="block text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
                  Live Dispatch Update
                </span>
                <p className="text-[11px] text-neutral-200 font-medium leading-relaxed mt-0.5">{notifMessage}</p>
              </div>
              <button
                onClick={() => setShowNotif(false)}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className={`flex-grow ${
        (activeTab === 'admin' || !!driverToken || !!trackingToken)
          ? 'w-full' 
          : 'max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 md:pb-8'
      }`}>
        <AnimatePresence mode="wait">
          {driverToken ? (
            <motion.div
              key="driver-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full"
            >
              <DriverPage driverToken={driverToken} />
            </motion.div>
          ) : trackingToken ? (
            <motion.div
              key="tracking-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full"
            >
              <CustomerTrackingPage trackingToken={trackingToken} />
            </motion.div>
          ) : activeTab === 'client' ? (
            <motion.div
              key="client-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Sub-view Content Switcher with animations */}
              <AnimatePresence mode="wait">
                {activeNav === 'home' && (
                  <motion.div
                    key="nav-home"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-12 lg:space-y-16"
                  >
                    {/* Hero Section */}
                    <section className="relative overflow-hidden rounded-2xl bg-neutral-950 text-white border border-neutral-900 shadow-xl" id="hero-section">
                      {/* Background ambient lighting blobs */}
                      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
                      <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

                      <div className="px-6 py-12 md:py-20 text-center max-w-4xl mx-auto space-y-6">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[#10B981] bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full inline-block">
                          ★ Live Geotracking & Vetted Fleet Relief
                        </span>

                        <h2 className="text-4xl sm:text-5.5xl font-extrabold text-white tracking-tight leading-tight uppercase font-display">
                          {generalSettings.company_name}
                        </h2>

                        <p className="text-base sm:text-lg text-neutral-300 font-sans leading-relaxed max-w-3xl mx-auto">
                          Premium logistics, on-demand temporary relief drivers, and professional outstation chauffeurs. Plot your trajectory instantly on the synchronized dispatch docket.
                        </p>

                        {/* Call-to-actions buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 w-full">
                          <button
                            onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            id="hero-btn-request-quote"
                            className="w-full sm:w-auto px-6 py-3 bg-white text-neutral-950 hover:bg-neutral-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md transform hover:-translate-y-0.5 font-sans flex items-center justify-center"
                          >
                            Request a Quote
                          </button>
 
                          <a
                            href={`tel:${contactPhone}`}
                            id="hero-btn-call-now"
                            className="w-full sm:w-auto px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-neutral-700 font-sans flex items-center justify-center"
                          >
                            Call Now
                          </a>
 
                          <a
                            href={`https://wa.me/${contactWhatsapp}?text=Hello,%20I'm%20inquiring%20about%20your%20Fleet%20and%20Driver%20Relief%20Services.`}
                            target="_blank"
                            rel="noreferrer"
                            id="hero-btn-whatsapp-now"
                            className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all font-sans flex items-center justify-center gap-1.5"
                          >
                            <svg className="w-4 h-4 fill-white text-white shrink-0" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.022-.015-.045-.03-.067-.045-.083-.053-.167-.105-.252-.158-.291-.18-.588-.363-.89-.533-.149-.084-.31-.13-.473-.134a1.03 1.03 0 0 0-.742.316c-.143.155-.286.31-.428.465l-.337.367c-.122.115-.284.168-.445.143a3.86 3.86 0 0 1-1.354-.51 5.92 5.92 0 0 1-1.468-1.107 5.8 5.8 0 0 1-.954-1.399c-.1-.19-.074-.424.062-.587l.383-.437c.123-.139.245-.278.368-.418.172-.194.24-.457.185-.716a5.7 5.7 0 0 0-.585-1.579c-.1-.2-.25-.37-.44-.49a.9.9 0 0 0-.73-.08c-.24.08-.47.21-.67.39l-.49.49c-.52.52-.77 1.25-.66 1.97.23 1.54.91 2.97 1.93 4.12a10.02 10.02 0 0 0 4.7 3.03l.36.11a3.02 3.02 0 0 0 1.95-.2c.28-.15.53-.35.73-.6l.44-.54c.26-.32.32-.76.15-1.12zM12 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.88 5.83l-1.25 4.54 4.67-1.22l.54.29C9.39 21.78 10.66 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.92 0-3.7-.56-5.21-1.51l-.37-.23-2.73.71.73-2.65-.25-.4A7.95 7.95 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
                            </svg>
                            WhatsApp Us
                          </a>
                        </div>
                      </div>
                    </section>

                    {/* Booking Form (Route Planner, Map & Inquiry Input) */}
                    <section
                      ref={formRef}
                      className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4 scroll-mt-20"
                      id="interactive-planner-pane"
                    >
                      <div className="lg:col-span-12">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                          Live Booking Canvas
                        </span>
                        <h3 className="text-2xl font-bold text-neutral-900 tracking-tight mt-2">
                          Plot Your Route & Submit Quote Specification
                        </h3>
                        <p className="text-sm text-neutral-500 mt-1 font-sans">
                          Use our interactive maps tools to pin geographic locations. The distance estimates automatically compute live reference fares from database rates.
                        </p>
                      </div>

                      {/* Left: Map Picker */}
                      <div className="lg:col-span-7 flex flex-col bg-white p-6 border border-neutral-200 rounded-2xl shadow-sm lg:h-[840px]">
                        <div className="flex items-center pb-4 border-b border-neutral-100 shrink-0 mb-4">
                          <div>
                            <h4 className="font-bold text-sm text-neutral-900">Map Pin Placement Tool</h4>
                            <p className="text-[11px] text-neutral-400 font-sans">Drag markers or choose locations</p>
                          </div>
                        </div>

                        <div className="flex-1 min-h-[400px] lg:min-h-0">
                          <MapPicker
                            pickupLoc={pickupLoc}
                            dropLoc={dropLoc}
                            onSelectPickup={(loc) => {
                              setPickupLoc(loc);
                              triggerGlobalToast(`Pickup address synced: "${loc.address.substring(0, 30)}..."`);
                            }}
                            onSelectDrop={(loc) => {
                              setDropLoc(loc);
                              triggerGlobalToast(`Destination address synced: "${loc.address.substring(0, 30)}..."`);
                            }}
                          />
                        </div>
                      </div>

                      {/* Right: Booking Form Component */}
                      <div className="lg:col-span-5 flex flex-col justify-between">
                        <InquiryForm
                          pickupLoc={pickupLoc}
                          dropLoc={dropLoc}
                          selectedServiceType={formServiceSelector}
                          onSuccessSubmitted={handleInquiryFormSuccess}
                          onClearLocations={() => {
                            setPickupLoc(null);
                            setDropLoc(null);
                          }}
                        />
                      </div>
                    </section>

                    {/* Brief About Us Preview Section */}
                    <section className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6" id="homepage-about-preview">
                      <div className="space-y-2 flex-grow max-w-3xl">
                        <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest block">
                          Corporate Profile Preview
                        </span>
                        <h3 className="text-xl font-bold text-neutral-950 tracking-tight">
                          Elegance, Security, & Absolute Accountability
                        </h3>
                        <p className="text-xs text-neutral-500 leading-relaxed font-sans mt-1">
                          At {generalSettings.company_name}, we provide industry-leading luxury transportation, on-demand temporary relief chauffeurs, and corporate logistics. With a 100% background-vetted driver network and real-time database pricing, we ensure seamless, safe, and transparent commutes.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setActiveNavPersisted('about');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-5 py-3 bg-neutral-900 hover:bg-neutral-800 text-blue-50 text-xs font-bold uppercase tracking-wide rounded-xl shrink-0 transition-colors flex items-center gap-2"
                      >
                        Learn More
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </section>
                  </motion.div>
                )}

                {/* Fleet Categories View */}
                {activeNav === 'fleet' && (
                  <motion.div
                    key="nav-fleet"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-8"
                  >
                    <div className="text-center max-w-3xl mx-auto py-4">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#10B981] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        Operational Fleet Range
                      </span>
                      <h3 className="text-3xl font-extrabold text-neutral-950 tracking-tight mt-3">
                        Our Precision Fleet Categories
                      </h3>
                      <p className="text-xs text-neutral-500 mt-2 font-sans max-w-xl mx-auto">
                        Rigorous safety and mechanical parameters govern every single dynamic ride tier. Rates are automatically calibrated from the live, central database schema.
                      </p>
                    </div>

                    {/* Category Cards Section */}
                    {loadingCategories ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4" id="fleet-category-skeleton">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row h-96 md:h-64 animate-pulse">
                            <div className="md:w-5/12 bg-neutral-100 h-40 md:h-full" />
                            <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                              <div className="space-y-3">
                                <div className="h-4 bg-neutral-200 rounded w-1/3" />
                                <div className="h-3 bg-neutral-200 rounded w-full" />
                                <div className="h-3 bg-neutral-200 rounded w-5/6" />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="h-10 bg-neutral-200 rounded" />
                                <div className="h-10 bg-neutral-200 rounded" />
                                <div className="h-10 bg-neutral-200 rounded" />
                              </div>
                              <div className="h-10 bg-neutral-200 rounded w-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : vehicleCategories.length === 0 ? (
                      <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm" id="fleet-empty-state">
                        <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neutral-100">
                          <Car className="w-8 h-8 text-neutral-400" />
                        </div>
                        <h4 className="text-base font-bold text-neutral-900 tracking-tight">No Fleet Classes Available</h4>
                        <p className="text-xs text-neutral-550 mt-1 max-w-sm mx-auto font-sans leading-relaxed">
                          All fleet category options are currently toggled offline or empty in the Admin Portal. Navigate to the Admin Portal (Top Right) to add vehicle categories.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-6" id="fleet-category-showcase">
                        {vehicleCategories
                          .filter((cat) => {
                            const statusVal = cat.status || (cat.active ? 'Available' : 'Under Maintenance');
                            return statusVal !== 'Archived';
                          })
                          .map((cat) => {
                            const details = resolveCategoryDetails(cat.name);
                            const statusVal = cat.status || (cat.active ? 'Available' : 'Under Maintenance');
                            const isAvailable = statusVal === 'Available';
                            const displayImage = cat.image_url ? cat.image_url.trim() : null;
                            const displayDescription = (cat.description && cat.description.trim()) ? cat.description.trim() : details.description;
                            
                            // Dynamically read from Supabase with safe resolved backups
                            const passengerCount = cat.passenger_capacity ?? 4;
                            const luggageCount = cat.luggage_capacity ?? 2;
                            
                            return (
                              <div
                                key={cat.id || cat.name}
                                id={`fleet-class-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                                className={`bg-white border rounded-3xl overflow-hidden shadow-sm flex flex-col h-full transition-all duration-300 ${
                                  isAvailable 
                                    ? 'border-neutral-200 hover:shadow-xl hover:border-neutral-300 transform hover:-translate-y-1.5 group' 
                                    : 'border-neutral-250 opacity-40 saturate-[0.45] bg-neutral-50/50 shadow-none'
                                }`}
                              >
                                {/* Header / Mini Vehicle Image Graphic Area */}
                                <div 
                                  className={`h-48 p-6 flex flex-col justify-between text-white relative overflow-hidden shrink-0 ${
                                    displayImage ? 'bg-neutral-900' : `bg-gradient-to-br ${details.gradient}`
                                  }`}
                                  style={displayImage ? { backgroundImage: `url(${displayImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                                >
                                  {/* Absolute dark screen overlay if custom image to preserve typography accessibility */}
                                  {displayImage && <div className="absolute inset-0 bg-neutral-950/45 backdrop-blur-[0.5px] z-0" />}

                                  <div className="relative z-10 flex justify-between items-start">
                                    <span className="text-[8px] tracking-widest font-extrabold uppercase bg-white/11 px-2 py-0.5 rounded backdrop-blur-sm text-neutral-100 font-sans">
                                      Fleet Tier
                                    </span>
                                    {isAvailable ? (
                                      <span className="text-[9px] font-bold text-emerald-400 font-sans tracking-wider uppercase flex items-center gap-1 shrink-0 bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Available
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-extrabold text-amber-300 font-sans tracking-wider uppercase flex items-center gap-1 shrink-0 bg-amber-950/92 px-2.5 py-0.5 rounded border border-amber-600/40">
                                        UNDER MAINTENANCE
                                      </span>
                                    )}
                                  </div>

                                  <div className="relative z-10">
                                    <h4 className={`text-xl font-extrabold tracking-tight mt-1 text-white uppercase font-display leading-tight ${isAvailable ? 'group-hover:text-emerald-300 transition-colors' : ''}`}>
                                      {cat.name}
                                    </h4>
                                    <span className="text-[10px] text-neutral-300 font-semibold font-mono tracking-wide mt-1 block">
                                      Engine: {details.fuelType}
                                    </span>
                                  </div>

                                  {/* Absolute minimalist vehicle background silhouette if no image is given */}
                                  {!displayImage && (
                                    <div className={`absolute right-0 bottom-0 translate-y-3 translate-x-3 opacity-[0.09] pointer-events-none transition-transform duration-500 ${isAvailable ? 'group-hover:scale-110' : ''}`}>
                                      <Car className="w-48 h-48 text-white fill-current" />
                                    </div>
                                  )}
                                </div>

                                {/* Body Content Area */}
                                <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                                  <div className="space-y-4">
                                    {/* Passenger and luggage badges */}
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-[11px] font-bold select-none font-sans">
                                        👥 {passengerCount} Passengers
                                      </span>
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-[11px] font-bold select-none font-sans">
                                        🧳 {luggageCount} Carry-ons
                                      </span>
                                    </div>

                                    {/* Description text */}
                                    <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                                      {displayDescription}
                                    </p>

                                    {/* Optional helper text for under maintenance */}
                                    {!isAvailable && (
                                      <div className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200/50 rounded-xl p-3 flex items-start gap-1.5 font-sans leading-relaxed">
                                        <span className="shrink-0 text-[11px]">⚠️</span>
                                        <span>This vehicle category is temporarily unavailable.</span>
                                      </div>
                                    )}

                                    {/* SaaS-style Pricing block */}
                                    <div className="p-3.5 bg-neutral-950 text-white rounded-2xl border border-neutral-850 gap-2 text-center font-mono text-[9px] grid grid-cols-3 shadow-md">
                                      <div className="border-r border-neutral-800 py-0.5 font-sans">
                                        <span className="block text-neutral-400 font-sans tracking-wide uppercase text-[7.5px] font-bold mb-0.5">
                                          Base Fare
                                        </span>
                                        <span className="font-extrabold text-sm text-emerald-400 font-mono">
                                          ₹{cat.base_fare.toFixed(0)}
                                        </span>
                                      </div>
                                      <div className="border-r border-neutral-800 py-0.5 font-sans">
                                        <span className="block text-neutral-400 font-sans tracking-wide uppercase text-[7.5px] font-bold mb-0.5">
                                          Per KM
                                        </span>
                                        <span className="font-extrabold text-sm text-emerald-400 font-mono">
                                          ₹{cat.per_km_rate.toFixed(0)}
                                        </span>
                                      </div>
                                      <div className="py-0.5 font-sans">
                                        <span className="block text-neutral-400 font-sans tracking-wide uppercase text-[7.5px] font-bold mb-0.5">
                                          Min Fare
                                        </span>
                                        <span className="font-extrabold text-sm text-emerald-400 font-mono">
                                          ₹{(cat.minimum_fare ?? cat.base_fare).toFixed(0)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Action Booking CTA Button */}
                                  <div className="pt-2 border-t border-neutral-100 font-sans">
                                    {isAvailable ? (
                                      <button
                                        onClick={() => handleSelectCategoryAndRoute(cat.name, 'Fleet Booking')}
                                        className="w-full py-2.5 bg-neutral-950 hover:bg-neutral-850 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer shadow-sm active:scale-95 border-0"
                                      >
                                        Book Now
                                        <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1.5 transition-transform" />
                                      </button>
                                    ) : (
                                      <button
                                        disabled
                                        className="w-full py-2.5 bg-neutral-100 text-neutral-400 text-[10px] font-bold uppercase tracking-widest rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 border-0"
                                      >
                                        Temporarily Unavailable
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Driver Relief Services View */}
                {activeNav === 'drivers' && (
                  <motion.div
                    key="nav-drivers"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-8"
                  >
                    <div className="text-center max-w-3xl mx-auto py-4">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        Chauffeur Retainers
                      </span>
                      <h3 className="text-3xl font-extrabold text-neutral-950 tracking-tight mt-3">
                        Professional Driver Relief Services
                      </h3>
                      <p className="text-xs text-neutral-500 mt-2 font-sans max-w-xl mx-auto">
                        Skip driver shortages with certified, background-screened professional relief captains deployed directly for corporate and individual requirements.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                      {/* Temporary Drivers Card */}
                      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between group" id="drivers-temp">
                        <div className="space-y-4">
                          <div className="p-3 bg-neutral-900 text-white rounded-xl w-fit group-hover:bg-emerald-600 transition-colors">
                            <ShieldCheck className="w-6 h-6" />
                          </div>
                          <h4 className="text-lg font-bold text-neutral-950 tracking-tight">Temporary Drivers</h4>
                          <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                            Need a driver for single shifts, personal road trips, medical recovery transits, or peak distribution rosters? Our temporary captains deploy instantly to drive your asset with complete care.
                          </p>
                          <ul className="space-y-2 border-t border-neutral-100 pt-4 text-xs text-neutral-600 font-sans">
                            <li className="flex items-center gap-1.5"><span className="w-1 bg-emerald-500 h-2" /> 4-hour, 8-hour, and weekly contracts</li>
                            <li className="flex items-center gap-1.5"><span className="w-1 bg-emerald-500 h-2" /> Outstation cross-state driver relief</li>
                            <li className="flex items-center gap-1.5"><span className="w-1 bg-emerald-500 h-2" /> Emergency replacement standby</li>
                          </ul>
                        </div>
                        <button
                          onClick={() => handleSelectServiceFromCard('Driver Relief Services')}
                          className="mt-6 w-full py-2 px-4 bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-800 rounded-xl text-xs font-semibold tracking-wide transition flex items-center justify-center gap-1.5"
                        >
                          Request Driver
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Chauffeur Services Card */}
                      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between group" id="drivers-chauffeur">
                        <div className="space-y-4">
                          <div className="p-3 bg-neutral-900 text-white rounded-xl w-fit group-hover:bg-emerald-600 transition-colors">
                            <UserCheck className="w-6 h-6" />
                          </div>
                          <h4 className="text-lg font-bold text-neutral-950 tracking-tight">Chauffeur Services</h4>
                          <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                            Impeccable uniforms, premium protocol knowledge, and absolute defensive transit training. Elite chauffeurs optimized for corporate retainers and VIP transfers.
                          </p>
                          <ul className="space-y-2 border-t border-neutral-100 pt-4 text-xs text-neutral-600 font-sans">
                            <li className="flex items-center gap-1.5"><span className="w-1 bg-emerald-500 h-2" /> Multilingual professional etiquette</li>
                            <li className="flex items-center gap-1.5"><span className="w-1 bg-emerald-500 h-2" /> Realtime flight coordinates tracking</li>
                            <li className="flex items-center gap-1.5"><span className="w-1 bg-emerald-500 h-2" /> Strict client confidentiality protocol</li>
                          </ul>
                        </div>
                        <button
                          onClick={() => handleSelectServiceFromCard('Driver Relief Services')}
                          className="mt-6 w-full py-2 px-4 bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-800 rounded-xl text-xs font-semibold tracking-wide transition flex items-center justify-center gap-1.5"
                        >
                          Book Chauffeur
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Related information Card */}
                      <div className="bg-neutral-900 text-white border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between" id="drivers-related">
                        <div className="space-y-4">
                          <div className="p-3 bg-emerald-600 text-white rounded-xl w-fit">
                            <Award className="w-6 h-6" />
                          </div>
                          <h4 className="text-lg font-bold text-emerald-400 tracking-tight">Vetting & Compliance Info</h4>
                          <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                            We enforce absolute screening standards so your personnel resource safety is 100% assured:
                          </p>
                          <div className="space-y-3 text-[11px] text-neutral-300 font-mono">
                            <div className="border-b border-neutral-800 pb-1.5">
                              <span className="block font-bold text-neutral-400">CRIMINAL VERIFICATION</span>
                              <span>Biometric checks filed across federal logs</span>
                            </div>
                            <div className="border-b border-neutral-800 pb-1.5">
                              <span className="block font-bold text-neutral-400">DRUG SCREENING</span>
                              <span>Regular 10-panel scheduled audits</span>
                            </div>
                            <div>
                              <span className="block font-bold text-neutral-400">DRIVING COMPLIANCE</span>
                              <span>Zero structural violations baseline required</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-6 text-[10px] text-center text-neutral-500 italic">
                          Compliance standard: CDRS Certified v4.2
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* About Us View */}
                {activeNav === 'about' && (
                  <motion.div
                    key="nav-about"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-8"
                  >
                    <div className="text-center max-w-3xl mx-auto py-4">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        Corporate Profile
                      </span>
                      <h3 className="text-3xl font-extrabold text-neutral-900 tracking-tight mt-3">
                        About {generalSettings.company_name}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-2 font-sans max-w-xl mx-auto">
                        A technology-first, safety-compliant driver logistics utility built for uncompromising reliability.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                      {/* Full company profile */}
                      <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 space-y-4" id="about-profile">
                        <h4 className="text-lg font-bold text-neutral-950 tracking-tight">Full Company Profile</h4>
                        <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                          Founded in 2021 upon principles of absolute punctuality, rigorous criminal background vetting, and complete pricing transparency, <strong>{generalSettings.company_name}</strong> has evolved into the region's premier dispatch network.
                        </p>
                        <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                          We operate physical fleets paired with an active vetted chauffeur registry. By utilizing secure geolocational data and automated fare computing, we remove negotiations and bring professional standards to transit logistics.
                        </p>
                        
                        <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-2 gap-4 text-center">
                          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-150">
                            <span className="block text-xl font-bold text-neutral-900">12,500+</span>
                            <span className="text-[9px] uppercase font-bold text-neutral-400 font-sans tracking-wide">COMPLETED RIDES</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-150">
                            <span className="block text-xl font-bold text-emerald-600">99.8%</span>
                            <span className="text-[9px] uppercase font-bold text-neutral-400 font-sans tracking-wide">PUNCTUALITY SPEC</span>
                          </div>
                        </div>
                      </div>

                      {/* Vision & Mission Bento Cards */}
                      <div className="space-y-6">
                        <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-2.5 shadow-sm" id="about-mission">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold text-sm text-neutral-950 uppercase tracking-widest">Our Mission</h4>
                          </div>
                          <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                            To deliver secure, reliable, and beautifully direct transit contracts, eliminating scheduling latency with vetted drivers and honest rates.
                          </p>
                        </div>

                        <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-2.5 shadow-sm" id="about-vision">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-neutral-50 text-neutral-900 rounded">
                              <Compass className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold text-sm text-neutral-950 uppercase tracking-widest">Our Vision</h4>
                          </div>
                          <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                            To build the region's most versatile, frictionless transit infrastructure, empowering corporate partners and individual passengers alike.
                          </p>
                        </div>

                        {/* Service Areas */}
                        <div className="bg-neutral-950 text-white rounded-2xl p-6 space-y-3 border border-neutral-850" id="about-areas">
                          <h4 className="font-bold text-sm text-amber-500 uppercase tracking-wider">Operational Service Areas (West Bengal)</h4>
                          <p className="text-[11px] text-neutral-300 font-sans leading-relaxed">
                            We provide on-demand driver relief, outstation trips, and logistical runs exclusively across West Bengal:
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-neutral-400">
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Kolkata & Salt Lake</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Howrah & Hooghly Belt</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> North & South 24 Parganas</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Durgapur, Asansol & Siliguri</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Contact View */}
                {activeNav === 'contact' && (
                  <motion.div
                    key="nav-contact"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-8"
                  >
                    <div className="text-center max-w-3xl mx-auto py-4">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#10B981] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        Get In Touch
                      </span>
                      <h3 className="text-3xl font-extrabold text-neutral-950 tracking-tight mt-3">
                        Contact Dynamic Dispatch Desk
                      </h3>
                      <p className="text-xs text-neutral-500 mt-2 font-sans max-w-xl mx-auto">
                        Connect with our 24/7 support operators or access our WhatsApp and physical hotline operations channels directly below.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                      {/* Left: Contact Channels Details */}
                      <div className="space-y-6">
                        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-6" id="contact-channels">
                          <h4 className="font-extrabold text-lg text-neutral-950 tracking-tight">Direct Connections</h4>
                          
                          <div className="space-y-4 font-sans text-xs text-neutral-600">
                            <div className="flex gap-3 items-start">
                              <div className="p-2 bg-neutral-100 rounded-lg text-neutral-900 mt-0.5">
                                <Phone className="w-4 h-4 text-neutral-700" />
                              </div>
                              <div>
                                <span className="block font-bold text-neutral-900">Phone Dispatch Hotline</span>
                                <a href={`tel:${contactPhone}`} className="text-emerald-600 hover:underline">{contactPhone}</a>
                              </div>
                            </div>

                            <div className="flex gap-3 items-start">
                              <div className="p-2 bg-neutral-100 rounded-lg text-neutral-950 mt-0.5">
                                <MessageSquare className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div>
                                <span className="block font-bold text-neutral-900">WhatsApp Dispatch</span>
                                <a href={`https://wa.me/${contactWhatsapp}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">{contactPhone}</a>
                              </div>
                            </div>

                            <div className="flex gap-3 items-start">
                              <div className="p-2 bg-neutral-100 rounded-lg text-neutral-950 mt-0.5">
                                <Mail className="w-4 h-4 text-neutral-700" />
                              </div>
                              <div>
                                <span className="block font-bold text-neutral-900">Corporate Dispatch Email</span>
                                <a href={`mailto:${contactEmail}`} className="text-emerald-600 hover:underline">{contactEmail}</a>
                              </div>
                            </div>

                            <div className="flex gap-3 items-start">
                              <div className="p-2 bg-neutral-100 rounded-lg text-neutral-900 mt-0.5">
                                <Clock className="w-4 h-4 text-neutral-700" />
                              </div>
                              <div>
                                <span className="block font-bold text-neutral-900">Operational Desk Hours</span>
                                <span className="text-neutral-500">24 Hours / 7 Days a Week (All Year Round)</span>
                              </div>
                            </div>
                          </div>

                          {/* Instant Social Channels Grid Buttons */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4 border-t border-neutral-100">
                            <a
                              href={`tel:${contactPhone}`}
                              className="flex items-center justify-center gap-1.5 py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 text-[10px] font-bold uppercase rounded-lg transition"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              Call Us
                            </a>
                            <a
                              href={`https://wa.me/${contactWhatsapp}?text=Inquiry%20from%20CDRS%20Contact%20Page.`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase rounded-lg transition"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              WhatsApp
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Right: HQ details & operational capabilities info */}
                      <div className="space-y-6">
                        {/* Location Note card */}
                        <div className="bg-neutral-900 text-white rounded-2xl p-6 border border-neutral-850 space-y-3 shadow-md" id="contact-hq-card">
                          <span className="text-[9px] uppercase font-bold text-amber-500 tracking-wider font-mono">Operations Base</span>
                          <h4 className="font-extrabold text-base tracking-tight">Corporate Headquarters</h4>
                          <p className="text-xs text-neutral-300 font-sans leading-relaxed whitespace-pre-wrap">
                            <strong>{generalSettings.company_name}</strong><br />
                            {generalSettings.office_address}
                          </p>
                          <div className="pt-3 border-t border-neutral-850 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] text-neutral-400 font-mono">Central Dispatch Server Synced Ready</span>
                          </div>
                        </div>

                        {/* Additional dynamic Support Info */}
                        <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-sm" id="contact-support-card">
                          <h4 className="font-extrabold text-sm text-neutral-950 uppercase tracking-widest">Rapid Driver Deployments</h4>
                          <p className="text-xs text-neutral-500 font-sans leading-relaxed">
                            Need a dynamic fare quote or route mapping? Switch over to our <strong>Home</strong> menu screen at the top of the Customer Desk portal to use the geolocational route planner and instantly calculate pricing estimates automatically.
                          </p>
                          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-150 flex items-center justify-between">
                            <span className="text-[11px] font-sans font-semibold text-neutral-700">Go to Route Planner:</span>
                            <button
                              onClick={() => {
                                setActiveNavPersisted('home');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="px-3 py-1.5 bg-neutral-950 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-neutral-800 transition-colors"
                            >
                              Open Planner
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="admin-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AdminDashboard 
                onNotifyTriggered={triggerGlobalToast} 
                onLogout={() => {
                  setActiveTabPersisted('client');
                  triggerGlobalToast('Successfully logged out of the dynamic admin session.');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>



      {/* Embedded support operator drawer bubble - only visible in frontend client screens */}
      {activeTab === 'client' && !driverToken && !trackingToken && (
        <FloatingWhatsApp
          phoneNumber={contactPhone}
          whatsappNumber={contactPhone}
          email={contactEmail}
          companyName={generalSettings.company_name}
        />
      )}

      {/* Mobile-Only Fixed Bottom Navigation Bar */}
      {activeTab === 'client' && !driverToken && !trackingToken && (
        <nav 
          className="fixed bottom-0 left-0 right-0 md:hidden bg-white/95 backdrop-blur-md border-t border-neutral-200 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] rounded-t-2xl z-[9990] pb-6 pt-1.5 px-1"
          id="mobile-bottom-navigation-bar"
        >
          <div className="flex items-center justify-around max-w-md mx-auto">
            {/* Home Tab */}
            <button
              onClick={() => {
                setActiveTabPersisted('client');
                setActiveNavPersisted('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              id="mobile-bottom-nav-home"
              className={`flex flex-col items-center justify-center py-1 flex-1 relative transition duration-200 ${
                activeTab === 'client' && activeNav === 'home'
                  ? 'text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <div className={`p-1 rounded-full transition-all ${activeTab === 'client' && activeNav === 'home' ? 'bg-neutral-100 text-[#10B981]' : ''}`}>
                <Home className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium tracking-wide mt-0.5">Home</span>
              {activeTab === 'client' && activeNav === 'home' && (
                <span className="absolute -top-1 w-6 h-0.5 bg-neutral-950 rounded-full" />
              )}
            </button>

            {/* Fleet Categories Tab */}
            <button
              onClick={() => {
                setActiveTabPersisted('client');
                setActiveNavPersisted('fleet');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              id="mobile-bottom-nav-fleet"
              className={`flex flex-col items-center justify-center py-1 flex-1 relative transition duration-200 ${
                activeTab === 'client' && activeNav === 'fleet'
                  ? 'text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <div className={`p-1 rounded-full transition-all ${activeTab === 'client' && activeNav === 'fleet' ? 'bg-neutral-100 text-[#10B981]' : ''}`}>
                <Car className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium tracking-wide mt-0.5">Fleet</span>
              {activeTab === 'client' && activeNav === 'fleet' && (
                <span className="absolute -top-1 w-6 h-0.5 bg-neutral-950 rounded-full" />
              )}
            </button>

            {/* Driver Relief Services Tab */}
            <button
              onClick={() => {
                setActiveTabPersisted('client');
                setActiveNavPersisted('drivers');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              id="mobile-bottom-nav-drivers"
              className={`flex flex-col items-center justify-center py-1 flex-1 relative transition duration-200 ${
                activeTab === 'client' && activeNav === 'drivers'
                  ? 'text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <div className={`p-1 rounded-full transition-all ${activeTab === 'client' && activeNav === 'drivers' ? 'bg-neutral-100 text-[#10B981]' : ''}`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium tracking-wide mt-0.5">Relief</span>
              {activeTab === 'client' && activeNav === 'drivers' && (
                <span className="absolute -top-1 w-6 h-0.5 bg-neutral-950 rounded-full" />
              )}
            </button>

            {/* About Tab */}
            <button
              onClick={() => {
                setActiveTabPersisted('client');
                setActiveNavPersisted('about');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              id="mobile-bottom-nav-about"
              className={`flex flex-col items-center justify-center py-1 flex-1 relative transition duration-200 ${
                activeTab === 'client' && activeNav === 'about'
                  ? 'text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <div className={`p-1 rounded-full transition-all ${activeTab === 'client' && activeNav === 'about' ? 'bg-neutral-100 text-[#10B981]' : ''}`}>
                <Info className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium tracking-wide mt-0.5">About</span>
              {activeTab === 'client' && activeNav === 'about' && (
                <span className="absolute -top-1 w-6 h-0.5 bg-neutral-950 rounded-full" />
              )}
            </button>

            {/* Contact Tab */}
            <button
              onClick={() => {
                setActiveTabPersisted('client');
                setActiveNavPersisted('contact');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              id="mobile-bottom-nav-contact"
              className={`flex flex-col items-center justify-center py-1 flex-1 relative transition duration-200 ${
                activeTab === 'client' && activeNav === 'contact'
                  ? 'text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <div className={`p-1 rounded-full transition-all ${activeTab === 'client' && activeNav === 'contact' ? 'bg-neutral-100 text-[#10B981]' : ''}`}>
                <Mail className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium tracking-wide mt-0.5">Contact</span>
              {activeTab === 'client' && activeNav === 'contact' && (
                <span className="absolute -top-1 w-6 h-0.5 bg-neutral-950 rounded-full" />
              )}
            </button>

            {/* Admin Tab (Required layout order moves Admin to the very end of list) */}
            <button
              onClick={() => {
                setActiveTabPersisted('admin');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              id="mobile-bottom-nav-admin"
              className={`flex flex-col items-center justify-center py-1 flex-1 relative transition duration-200 ${
                activeTab === 'admin'
                  ? 'text-amber-500 font-bold'
                  : 'text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <div className={`p-1 rounded-full transition-all ${activeTab === 'admin' ? 'bg-neutral-100 text-amber-500' : ''}`}>
                <Lock className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium tracking-wide mt-0.5">Admin</span>
              {activeTab === 'admin' && (
                <span className="absolute -top-1 w-6 h-0.5 bg-amber-500 rounded-full" />
              )}
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

// Minimal Users icon definition for React when lucide-react lacks it
function Users({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m16-10V7a4 4 0 00-8 0v4M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75" />
    </svg>
  );
}

// Minimal Briefcase icon definition for React
function Briefcase({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
