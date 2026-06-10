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
  CircleHelp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ServiceType } from './types';
import MapPicker from './components/MapPicker';
import InquiryForm from './components/InquiryForm';
import ServicesSection from './components/ServicesSection';
import FleetSection from './components/FleetSection';
import AdminDashboard from './components/AdminDashboard';
import FloatingWhatsApp from './components/FloatingWhatsApp';

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

export default function App() {
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handlePopState = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam === 'admin' || tabParam === 'client') {
          setActiveTab(tabParam);
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  // Map state
  const [pickupLoc, setPickupLoc] = useState<LocationData | null>(null);
  const [dropLoc, setDropLoc] = useState<LocationData | null>(null);

  // Form referencing to scroll into view and trigger focus presets
  const formRef = useRef<HTMLDivElement>(null);
  const [formServiceSelector, setFormServiceSelector] = useState<ServiceType>('Fleet Booking');

  // Contact configurations
  const contactPhone = '+1 (555) 019-2834';
  const contactWhatsapp = '+15550192834';
  const contactEmail = 'dispatch@caranddriverrelief.com';

  // System-wide notification toast state
  const [notifMessage, setNotifMessage] = useState<string | null>(null);
  const [showNotif, setShowNotif] = useState(false);

  // Success Submitted ID tracking
  const [submissionReference, setSubmissionReference] = useState<string | null>(null);

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

  const handleInquiryFormSuccess = (refId: string) => {
    setSubmissionReference(refId);
    triggerGlobalToast(`Success! Logged Inquiry Lead with Server ID: ${refId.substring(0, 8)}...`);
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans flex flex-col justify-between selection:bg-neutral-900 selection:text-amber-450">
      {/* Upper Navigation Header */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-neutral-200 z-[9990] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => setActiveTabPersisted('client')}
            className="flex items-center gap-2 text-left group"
          >
            <div className="p-2.5 bg-neutral-900 text-white rounded-xl shadow-md group-hover:bg-[#10B981] transition-all">
              <Car className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-neutral-950 uppercase leading-none font-display">
                Car & Driver
              </h1>
              <span className="text-[10px] text-neutral-400 font-mono tracking-widest block mt-0.5 font-bold uppercase">
                Relief Services
              </span>
            </div>
          </button>

          {/* Nav Tab Buttons switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTabPersisted('client');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              id="header-nav-client"
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'client'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              Customer Desk
            </button>

            <button
              onClick={() => setActiveTabPersisted('admin')}
              id="header-nav-admin"
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'admin'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm border border-amber-400/50'
                  : 'text-neutral-500 hover:text-neutral-900 override-nav-style hover:bg-neutral-100'
              }`}
            >
              Admin Dashboard
            </button>
          </div>
        </div>
      </header>

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

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'client' ? (
            <motion.div
              key="client-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-16 lg:space-y-24"
            >
              {/* Homepage HERO SECTION */}
              <section className="relative overflow-hidden rounded-2xl bg-neutral-950 text-white border border-neutral-900 shadow-xl" id="hero-section">
                {/* Background ambient lighting blobs */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

                <div className="px-6 py-16 md:p-16 text-center max-w-4xl mx-auto space-y-6">
                  {/* Decorative badge */}
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#10B981] bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full inline-block">
                    ★ Premium Logistics & Temporary Drivers
                  </span>

                  <h2 className="text-4xl sm:text-5.5xl font-extrabold text-white tracking-tight leading-tight uppercase font-display">
                    Fleet & Driver Relief Services
                  </h2>

                  <p className="text-base sm:text-lg text-neutral-300 font-sans leading-relaxed max-w-3xl mx-auto">
                    Reliable transportation solutions for fleet bookings, driver relief services, outstation travel,
                    wedding transportation, and custom transportation requirements.
                  </p>

                  {/* Call-to-actions buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                    <button
                      onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      id="hero-btn-request-quote"
                      className="px-6 py-3 bg-white text-neutral-950 hover:bg-neutral-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md transform hover:-translate-y-0.5 font-sans"
                    >
                      Request a Quote
                    </button>

                    <a
                      href={`tel:${contactPhone}`}
                      id="hero-btn-call-now"
                      className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-neutral-700 font-sans"
                    >
                      Call Now
                    </a>

                    <a
                      href={`https://wa.me/${contactWhatsapp}?text=Hello,%20I'm%20inquiring%20about%20your%20Fleet%20and%20Driver%20Relief%20Services.`}
                      target="_blank"
                      rel="noreferrer"
                      id="hero-btn-whatsapp-now"
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all font-sans flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4 fill-white text-white" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.022-.015-.045-.03-.067-.045-.083-.053-.167-.105-.252-.158-.291-.18-.588-.363-.89-.533-.149-.084-.31-.13-.473-.134a1.03 1.03 0 0 0-.742.316c-.143.155-.286.31-.428.465l-.337.367c-.122.115-.284.168-.445.143a3.86 3.86 0 0 1-1.354-.51 5.92 5.92 0 0 1-1.468-1.107 5.8 5.8 0 0 1-.954-1.399c-.1-.19-.074-.424.062-.587l.383-.437c.123-.139.245-.278.368-.418.172-.194.24-.457.185-.716a5.7 5.7 0 0 0-.585-1.579c-.1-.2-.25-.37-.44-.49a.9.9 0 0 0-.73-.08c-.24.08-.47.21-.67.39l-.49.49c-.52.52-.77 1.25-.66 1.97.23 1.54.91 2.97 1.93 4.12a10.02 10.02 0 0 0 4.7 3.03l.36.11a3.02 3.02 0 0 0 1.95-.2c.28-.15.53-.35.73-.6l.44-.54c.26-.32.32-.76.15-1.12zM12 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.88 5.83l-1.25 4.54 4.67-1.22l.54.29C9.39 21.78 10.66 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.92 0-3.7-.56-5.21-1.51l-.37-.23-2.73.71.73-2.65-.25-.4A7.95 7.95 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
                      </svg>
                      Telegram / WhatsApp
                    </a>
                  </div>

                  {/* Highlights row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 border-t border-neutral-850 mt-4 text-center">
                    <div>
                      <span className="block text-xl font-bold text-emerald-400">100% Vetted</span>
                      <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-sans">Certified Chauffeurs</span>
                    </div>
                    <div>
                      <span className="block text-xl font-bold text-emerald-400">24/7 Hotline</span>
                      <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-sans">Always Active</span>
                    </div>
                    <div>
                      <span className="block text-xl font-bold text-emerald-400">Flat Rates</span>
                      <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-sans">No hidden fees</span>
                    </div>
                    <div>
                      <span className="block text-xl font-bold text-emerald-400">Realtime Sync</span>
                      <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-sans">Enterprise Cloud DB</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* DETAILED INTERACTIVE Planner containing MAP and FORM */}
              <section
                ref={formRef}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 border-t border-neutral-200 scroll-mt-20"
                id="interactive-planner-pane"
              >
                {/* Visual side instructions info */}
                <div className="lg:col-span-12">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                    Live Booking Canvas
                  </span>
                  <h3 className="text-2xl font-bold text-neutral-900 tracking-tight mt-2">
                    Plot Your Route & Submit Quote Specification
                  </h3>
                  <p className="text-sm text-neutral-500 mt-1 font-sans">
                    Use our interactive geographical tool to pin exact transit locations. Your coordinates and addresses will synchronize instantly on the dispatcher docket.
                  </p>
                </div>

                {/* Left: OpenStreetMap Map component */}
                <div className="lg:col-span-7 flex flex-col bg-white p-6 border border-neutral-200 rounded-2xl shadow-sm lg:h-[880px]">
                  <div className="flex items-center justify-between pb-4 border-b border-neutral-100 shrink-0 mb-4">
                    <div>
                      <h4 className="font-bold text-sm text-neutral-900">Map Pin Placement Tool</h4>
                      <p className="text-[11px] text-neutral-400 font-sans">Drag markers or search coordinates</p>
                    </div>
                    <span className="text-[11px] font-bold text-neutral-500 uppercase bg-neutral-100 px-2 py-0.5 rounded">
                      OpenStreetMap Data
                    </span>
                  </div>

                  <div className="flex-1 min-h-0">
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

                {/* Right: Submission Form */}
                <div className="lg:col-span-5 flex flex-col justify-between">
                  <InquiryForm
                    pickupLoc={pickupLoc}
                    dropLoc={dropLoc}
                    onSuccessSubmitted={handleInquiryFormSuccess}
                    onClearLocations={() => {
                      setPickupLoc(null);
                      setDropLoc(null);
                    }}
                  />
                </div>
              </section>

              {/* SERVICES CARDS SECTION */}
              <div className="pt-8 border-t border-neutral-200">
                <ServicesSection onSelectService={handleSelectServiceFromCard} />
              </div>

              {/* STATIC FLEET SHOWCASE */}
              <div className="pt-8 border-t border-neutral-200">
                <FleetSection />
              </div>

              {/* CORE CONTACT / FOOTER CHANNELS SECTION */}
              <section className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8" id="contacts-pane">
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-bold bg-neutral-150 text-neutral-700 px-2.5 py-1 rounded">
                    Central Dispatch Desk
                  </span>
                  <h3 className="text-2xl font-bold text-neutral-950 tracking-tight">Prefer Direct Call or Custom Contract?</h3>
                  <p className="text-xs text-neutral-500 max-w-lg leading-relaxed font-sans">
                    For corporate accounts, enterprise logistical retainer setups, custom monthly contract pricing structures, or urgent on-demand placements, talk to an advisor.
                  </p>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2 text-xs text-neutral-700">
                      <Phone className="w-4 h-4 text-emerald-500" />
                      <strong>Phone Dispatch:</strong> <span>{contactPhone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-700">
                      <MessageSquare className="w-4 h-4 text-emerald-500" />
                      <strong>WhatsApp Support:</strong> <span>{contactPhone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-700">
                      <Mail className="w-4 h-4 text-emerald-500" />
                      <strong>Logistical Email:</strong> <span>{contactEmail}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
                  <a
                    href={`tel:${contactPhone}`}
                    id="contact-btn-tel"
                    className="flex items-center justify-center gap-2 py-3 px-6 bg-neutral-900 text-white rounded-xl text-xs font-bold uppercase transition hover:bg-neutral-800 shadow"
                  >
                    <Phone className="w-4 h-4" />
                    Call Hotline Dispatch
                  </a>

                  <a
                    href={`https://wa.me/${contactWhatsapp}?text=Hello,%20I'd%20like%20to%20arrange%20special%20fleet%20logistics.`}
                    target="_blank"
                    rel="noreferrer"
                    id="contact-btn-wa"
                    className="flex items-center justify-center gap-2 py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase transition shadow"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Chat on WhatsApp
                  </a>
                </div>
              </section>
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

      {/* Global Brand Footer informational credentials */}
      <footer className="bg-neutral-900 text-neutral-400 mt-16 border-t border-neutral-800 text-center py-8 px-4 font-mono text-[11px]" id="app-footer">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="leading-relaxed">
            &copy; 2026 Car & Driver Relief Services. Developed with full type-safety and durable secure cloud integrations.
          </p>

          <div className="flex items-center gap-4">
            <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-bold uppercase">
              Build Version 1.0.5 PWA
            </span>
            <span className="text-[10px] text-[#10B981] font-bold">
              ● All Systems Live
            </span>
          </div>
        </div>
      </footer>

      {/* Embedded support operator drawer bubble */}
      <FloatingWhatsApp
        phoneNumber={contactPhone}
        whatsappNumber={contactPhone}
        email={contactEmail}
      />
    </div>
  );
}
