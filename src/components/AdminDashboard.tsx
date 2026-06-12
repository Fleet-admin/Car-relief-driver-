/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Inbox,
  Filter,
  Search,
  CheckCircle,
  Clock,
  Phone,
  Trash2,
  Database,
  Volume2,
  Calendar,
  MapPin,
  ExternalLink,
  Lock,
  MessageSquare,
  AlertTriangle,
  Grid,
  Check,
  User,
  LogOut,
  BellRing,
  RefreshCw,
  Coins,
  Sliders,
  ChevronDown
} from 'lucide-react';
import { Inquiry, InquiryStatus, DashboardMetrics, VehicleCategory } from '../types';
import { SupabaseService } from '../lib/supabase';

// Helper to extract estimated fare configuration badges
const parseEstimateDetails = (requirements: string | null) => {
  if (!requirements) return null;
  const match = requirements.match(/\[ESTIMATE DETAILS - ([^\]]+)\]/);
  if (!match) return null;

  const content = match[1];
  const parts = content.split('|').map((p) => p.trim());
  const parsedData: Record<string, string> = {};

  parts.forEach((part) => {
    const colonIdx = part.indexOf(':');
    if (colonIdx !== -1) {
      const key = part.slice(0, colonIdx).trim();
      const val = part.slice(colonIdx + 1).trim();
      parsedData[key] = val;
    }
  });

  const cleanReq = requirements.replace(/\[ESTIMATE DETAILS - [^\]]+\]/, '').trim();
  const cleanedText = cleanReq.replace(/^(Customer Notes:\s*|Customer Notes:\s*)/i, '').trim();

  return {
    distance: parsedData['Distance'] || 'N/A',
    base: parsedData['Base'] || 'N/A',
    rate: parsedData['Rate'] || 'N/A',
    fare: parsedData['Estimated Fare'] || 'N/A',
    notes: cleanedText,
  };
};

interface AdminDashboardProps {
  onNotifyTriggered: (message: string) => void;
  onLogout?: () => void;
}

export default function AdminDashboard({ onNotifyTriggered, onLogout }: AdminDashboardProps) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | 'All'>('All');
  const [sortByDate, setSortByDate] = useState<'newest' | 'oldest'>('newest');

  // Selected Inquiry detail view modal
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  // Expanded inquiry card ID state for accordion view
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);

  // Authentication Lock state
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_authenticated') === 'true';
    }
    return false;
  });
  const [authError, setAuthError] = useState<string | null>(null);

  // Sound enablement state
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Robust Vehicle Category pricing configurations
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);

  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [isFareMappingExpanded, setIsFareMappingExpanded] = useState(false);

  const saveFareSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingError(null);
    try {
      console.log('[Admin Panel UI] Submitting vehicle pricing categories edit sync request...');
      const result = await SupabaseService.saveVehicleCategories(vehicleCategories);
      
      if (result.success) {
        setSaveSuccessMsg(true);
        onNotifyTriggered('Vehicle Category Settings updated and saved to Supabase successfully!');
        
        // Refresh local UI state from the latest database values
        const freshCats = await SupabaseService.getVehicleCategories();
        console.log('Data received from Supabase', freshCats);
        setVehicleCategories(freshCats);
        console.log('Data displayed in the Admin Portal', freshCats);

        setTimeout(() => setSaveSuccessMsg(false), 3000);
      } else {
        const errorText = result.error || 'Failed to save to database.';
        setPricingError(errorText);
        onNotifyTriggered('Database Sync Error: ' + errorText);
      }
    } catch (err: any) {
      const exceptionText = err.message || 'An unexpected exception occurred';
      setPricingError(exceptionText);
      onNotifyTriggered('Failed to save settings: ' + exceptionText);
    }
  };

  const resetFareToDefaults = async () => {
    if (window.confirm('Do you want to reset all vehicle pricing categories back to system standard plans? This will overwrite live database settings.')) {
      setPricingError(null);
      const defaultConfigs: VehicleCategory[] = [
        { id: 'hatchback', name: 'Hatchback', base_fare: 100.00, per_km_rate: 10.00, minimum_fare: 100.00, active: true, passenger_capacity: 4, luggage_capacity: 2 },
        { id: 'sedan', name: 'Sedan', base_fare: 150.00, per_km_rate: 12.00, minimum_fare: 150.00, active: true, passenger_capacity: 4, luggage_capacity: 3 },
        { id: 'premium-sedan', name: 'Premium Sedan', base_fare: 250.00, per_km_rate: 15.00, minimum_fare: 250.00, active: true, passenger_capacity: 4, luggage_capacity: 3 },
        { id: 'suv', name: 'SUV', base_fare: 200.00, per_km_rate: 15.00, minimum_fare: 200.00, active: true, passenger_capacity: 6, luggage_capacity: 5 },
        { id: 'premium-suv', name: 'Premium SUV', base_fare: 350.00, per_km_rate: 20.00, minimum_fare: 350.00, active: true, passenger_capacity: 6, luggage_capacity: 5 },
        { id: 'innova-mpv', name: 'Innova / MPV Tier', base_fare: 250.00, per_km_rate: 16.00, minimum_fare: 250.00, active: true, passenger_capacity: 7, luggage_capacity: 6 },
        { id: 'tempo-traveller', name: 'Tempo Traveller Cruiser', base_fare: 500.00, per_km_rate: 25.00, minimum_fare: 500.00, active: true, passenger_capacity: 16, luggage_capacity: 12 },
      ];
      try {
        console.log('[Admin Panel UI] Initiating system reset defaults requests in database...');
        const result = await SupabaseService.saveVehicleCategories(defaultConfigs);
        
        if (result.success) {
          // Refresh from live database to update UI 
          const freshCats = await SupabaseService.getVehicleCategories();
          console.log('Data received from Supabase', freshCats);
          setVehicleCategories(freshCats);
          console.log('Data displayed in the Admin Portal', freshCats);

          setSaveSuccessMsg(true);
          onNotifyTriggered('Vehicle pricing categories reset to defaults in Supabase!');
          setTimeout(() => setSaveSuccessMsg(false), 3000);
        } else {
          const errorText = result.error || 'Failed to sync defaults to database.';
          setPricingError(errorText);
          onNotifyTriggered('Database Sync Error: ' + errorText);
        }
      } catch (err: any) {
        const exceptionText = err.message || 'An unexpected exception occurred';
        setPricingError(exceptionText);
        onNotifyTriggered('Failed to save settings: ' + exceptionText);
      }
    }
  };

  const handleAddNewCategory = () => {
    const name = window.prompt("Enter the name of the new Vehicle Category (e.g. Luxury Minivan):");
    if (!name || !name.trim()) return;
    
    // Check if duplicate name
    if (vehicleCategories.some(cat => cat.name.toLowerCase() === name.trim().toLowerCase())) {
      alert("A category with this name already exists.");
      return;
    }

    const baseFareStr = window.prompt("Enter Base Fare (₹):", "150");
    if (baseFareStr === null) return;
    const base_fare = Math.max(0, parseFloat(baseFareStr) || 150.00);

    const perKmRateStr = window.prompt("Enter Rate Per Kilometer (₹):", "12");
    if (perKmRateStr === null) return;
    const per_km_rate = Math.max(0, parseFloat(perKmRateStr) || 12.00);

    const minFareStr = window.prompt("Enter Minimum Fare (₹):", "150");
    if (minFareStr === null) return;
    const minimum_fare = Math.max(0, parseFloat(minFareStr) || 150.00);

    const passengersStr = window.prompt("Enter Passenger Capacity:", "4");
    if (passengersStr === null) return;
    const passenger_capacity = Math.max(1, parseInt(passengersStr, 10) || 4);

    const luggageStr = window.prompt("Enter Carry-on Luggage Capacity:", "2");
    if (luggageStr === null) return;
    const luggage_capacity = Math.max(0, parseInt(luggageStr, 10) || 2);

    const newCat: VehicleCategory = {
      id: crypto.randomUUID(),
      name: name.trim(),
      base_fare,
      per_km_rate,
      minimum_fare,
      passenger_capacity,
      luggage_capacity,
      active: true
    };

    setVehicleCategories(prev => [...prev, newCat]);
    onNotifyTriggered(`New vehicle category "${newCat.name}" added locally! Click Apply to save.`);
  };

  const handleDeleteCategory = (catIdOrName: string) => {
    if (window.confirm("Are you sure you want to remove this vehicle category? This cannot be undone.")) {
      setVehicleCategories(prev => prev.filter(c => c.id !== catIdOrName && c.name !== catIdOrName));
      onNotifyTriggered("Vehicle category deleted! Click Apply to save Changes.");
    }
  };

  // Load passcode state or keep lock simple
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'admin' || passcode === '1234') {
      setIsAuthenticated(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_authenticated', 'true');
      }
      setAuthError(null);
    } else {
      setAuthError('Incorrect passcode credentials. (Try "admin" or "1234" to unlock)');
    }
  };

  // Synthesize modern high-pitched bell chime on new lead arrivals
  const triggerAudioChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // High crisp chimes (D5 and A5)
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      osc1.stop(ctx.currentTime + 0.45);
      osc2.stop(ctx.currentTime + 0.45);
    } catch (err) {
      console.warn('Browser custom synth chime blocked:', err);
    }
  };

  const getMetrics = (): DashboardMetrics => {
    const metrics: DashboardMetrics = { total: 0, new: 0, contacted: 0, confirmed: 0, closed: 0 };
    inquiries.forEach((item) => {
      metrics.total++;
      if (item.status === 'New') metrics.new++;
      if (item.status === 'Contacted') metrics.contacted++;
      if (item.status === 'Confirmed') metrics.confirmed++;
      if (item.status === 'Closed') metrics.closed++;
    });
    return metrics;
  };

  const loadData = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const data = await SupabaseService.queryInquiries();
      setInquiries(data);
      
      const cats = await SupabaseService.getVehicleCategories();
      console.log('Data received from Supabase', cats);
      setVehicleCategories(cats);
      console.log('Data displayed in the Admin Portal', cats);
    } catch (err: any) {
      setErrorText(err?.message || 'Database lookup query failed. Check SQL tables schema.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();

    // Subscribe to realtime updates
    const unsubscribe = SupabaseService.subscribeToInquiries((payload, eventType) => {
      // Trigger notification feedback
      if (eventType === 'INSERT') {
        onNotifyTriggered(`New inquiry submitted by: ${payload.name || 'Anonymous'}`);
        triggerAudioChime();
        // Request visual layout shake or system notifications
        if (Notification.permission === 'granted') {
          new Notification('🔔 New Inquiry Alert!', {
            body: `${payload.name} (${payload.service_type}) requests service on ${payload.travel_date}.`,
            icon: '/icon-192x192.png',
          });
        }
      } else if (eventType === 'UPDATE') {
        onNotifyTriggered(`Inquiry status updated: ${payload.name || 'Inquiry'} is now ${payload.status}`);
      }

      // Refresh list to pull live PostgreSQL attributes
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated]);

  const handleUpdateStatus = async (id: string, nextStatus: InquiryStatus) => {
    const success = await SupabaseService.updateStatus(id, nextStatus);
    if (success) {
      // Update local state directly so interface updates immediately before refresh
      setInquiries((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
      );
      if (selectedInquiry && selectedInquiry.id === id) {
        setSelectedInquiry((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
      onNotifyTriggered(`Status changed successfully to: ${nextStatus}.`);
    } else {
      alert('Failed to modify status. Check database constraints.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to permanently delete this inquiry record?')) return;
    const success = await SupabaseService.deleteInquiry(id);
    if (success) {
      setInquiries((prev) => prev.filter((item) => item.id !== id));
      if (selectedInquiry && selectedInquiry.id === id) {
        setSelectedInquiry(null);
      }
      onNotifyTriggered('Inquiry record deleted successfully.');
    }
  };



  // Request browser Notification permissions
  const requestNotificationPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then((perm) => {
        alert(perm === 'granted' ? 'Notification permissions approved successfully!' : 'Permission denied.');
      });
    } else {
      alert('Notifications are not supported in this browser engine.');
    }
  };

  // Compute stats metrics
  const stats = getMetrics();

  // Search filter evaluation
  const filteredInquiries = inquiries
    .filter((item) => {
      const matchStatus = statusFilter === 'All' || item.status === statusFilter;
      const term = searchQuery.toLowerCase().trim();
      const matchSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.phone.toLowerCase().includes(term) ||
        item.service_type.toLowerCase().includes(term) ||
        (item.pickup_location && item.pickup_location.toLowerCase().includes(term)) ||
        (item.drop_location && item.drop_location.toLowerCase().includes(term));
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortByDate === 'newest' ? dateB - dateA : dateA - dateB;
    });

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white border border-neutral-200 rounded-2xl p-8 shadow-xl text-center" id="admin-passcode-gate">
        <div className="w-16 h-16 bg-neutral-950 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md overflow-hidden p-1.5">
          <img src="/icon.svg" alt="Car & Driver Relief" className="w-full h-full object-contain" />
        </div>
        <h3 className="text-xl font-bold text-neutral-950 tracking-tight">Admin Portal Authorization</h3>
        <p className="text-xs text-neutral-500 mt-2 font-sans">
          Accessing this portal requires authorization to verify booking leads and statistics.
        </p>

        <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-left block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 font-sans">
              Enter Administrator Passcode
            </label>
            <input
              type="password"
              id="admin-passcode-field"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="e.g. Type admin or 1234 to unlock"
              className="w-full text-center tracking-widest px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all font-sans"
            />
          </div>

          {authError && <p className="text-[11px] text-red-600 font-medium font-sans">{authError}</p>}

          <button
            type="submit"
            id="btn-admin-auth-submit"
            className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all"
          >
            Authorize Session
          </button>
        </form>

        <p className="text-[10px] text-neutral-400 mt-6 font-mono">
          Hint: Use PASSCODE "admin" or "1234" to instantly view administrative tools.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300" id="admin-dashboard-panel">
      {/* Top Controls Admin Row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <span className="text-[10px] font-bold bg-neutral-950 text-amber-400 uppercase tracking-widest px-2.5 py-1 rounded-md mb-2 inline-block">
            Administrative Desk
          </span>
          <h2 className="text-3xl font-extrabold text-neutral-950 tracking-tight">Lead Console & Realtime Dispatch</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Audio Chime State Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            id="btn-toggle-audio-alerts"
            title="Toggle synthesized bell chime alerts on new inquiries"
            className={`p-2 rounded-xl border transition-all ${
              soundEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-neutral-50 border-neutral-200 text-neutral-400'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Volume2 className="w-4 h-4" />
              <span>{soundEnabled ? 'Unmuted' : 'Muted'}</span>
            </div>
          </button>

          {/* Browser notification toggle */}
          <button
            onClick={requestNotificationPermission}
            id="btn-request-browser-notifs"
            className="px-3 py-2 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-xl text-xs font-medium text-neutral-700 transition"
          >
            <span className="flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-blue-500" />
              Enable notification
            </span>
          </button>

          {/* Core DB key configuration indicator */}
          <div
            id="db-config-status"
            className={`px-3 py-2 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              SupabaseService.isUsingFallback()
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            {SupabaseService.isUsingFallback() ? 'Database: Env Keys Missing (Fallback Memory Active)' : 'Database: Connected'}
          </div>

          <button
            onClick={() => {
              setIsAuthenticated(false);
              localStorage.removeItem('admin_authenticated');
              if (onLogout) {
                onLogout();
              }
            }}
            id="btn-admin-logout"
            className="p-2 border border-neutral-200 bg-white hover:bg-red-50 hover:text-red-600 rounded-xl transition text-neutral-500"
            title="Log out from Admin session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Database Setup Action Alert Banner */}
      {SupabaseService.isUsingFallback() && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs text-amber-900 uppercase tracking-wide">
                Configured with Fallback Sandboxed Memory
              </h4>
              <p className="text-xs text-amber-700 mt-1 max-w-2xl">
                The application is running in local sandboxed memory fallback because your environment
                variable keys are empty or not loaded yet. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment environment variables to activate PostgreSQL storage.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid of Real-time Computed Metrics Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" id="metrics-grid">
        {/* Total stats Card */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Total inquiries</span>
            <span className="p-1 px-2 text-[10px] font-bold bg-neutral-100 text-neutral-700 rounded-md">All</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span id="metric-total-active" className="text-3xl font-extrabold text-neutral-950 font-sans">{stats.total}</span>
            <span className="text-[10px] text-neutral-400">leads</span>
          </div>
        </div>

        {/* New stats Card */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">New alerts</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="flex items-baseline gap-2">
            <span id="metric-new-active" className="text-3xl font-extrabold text-emerald-950 font-sans">{stats.new}</span>
            <span className="text-[10px] text-emerald-500 font-bold">Awaiting Contact</span>
          </div>
        </div>

        {/* Contacted stats Card */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-sans">Contacted</span>
            <span className="p-1 text-[9px] font-bold text-amber-600">Manual Check</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span id="metric-contacted-active" className="text-3xl font-extrabold text-neutral-950 font-sans">{stats.contacted}</span>
            <span className="text-[10px] text-amber-700">Called</span>
          </div>
        </div>

        {/* Confirmed stats Card */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 shadow-sm text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider font-sans">Confirmed</span>
            <span className="p-1 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold">Planned</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span id="metric-confirmed-active" className="text-3xl font-extrabold text-neutral-950 font-sans">{stats.confirmed}</span>
            <span className="text-[10px] text-indigo-700">Dispatched</span>
          </div>
        </div>

        {/* Completed stats Card */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 shadow-sm text-left col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-neutral-450 tracking-wider">Completed</span>
            <span className="p-1 text-[9px] text-neutral-400 font-sans">Completed</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span id="metric-closed-active" className="text-3xl font-extrabold text-neutral-450 font-sans">{stats.closed}</span>
            <span className="text-[10px] text-neutral-450">Completed</span>
          </div>
        </div>
      </div>

      {/* Main Filter + Inquiries List Section Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Search / Filter Filters Module Card */}
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="pb-3 border-b border-neutral-150 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-neutral-400" />
              <h4 className="font-bold text-xs text-neutral-950 uppercase tracking-widest leading-none">Filter & Search Desk</h4>
            </div>

            {/* Keyword search input */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-sans">
                Search Customer Details
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  id="admin-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type name, phone, service type..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-all font-sans animate-pulse-once"
                />
              </div>
            </div>

            {/* Status Pills Choice */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 font-sans">
                Inquiry Status State
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(['All', 'New', 'Contacted', 'Confirmed', 'Closed'] as const).map((stat) => (
                  <button
                    key={stat}
                    type="button"
                    id={`btn-filter-status-${stat.toLowerCase()}`}
                    onClick={() => setStatusFilter(stat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      statusFilter === stat
                        ? 'bg-neutral-950 text-white shadow-sm'
                        : 'bg-neutral-100 hover:bg-neutral-150 text-neutral-600'
                    }`}
                  >
                    {stat === 'Closed' ? 'Completed' : stat}
                  </button>
                ))}
              </div>
            </div>

            {/* Sorting choices parameters */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 font-sans">
                Sort Chronology
              </label>
              <div className="grid grid-cols-2 bg-neutral-100 p-1 rounded-lg">
                <button
                  type="button"
                  id="btn-sort-newest"
                  onClick={() => setSortByDate('newest')}
                  className={`py-1 text-center font-bold text-[10px] uppercase rounded-md transition-all ${
                    sortByDate === 'newest' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  Newest First
                </button>
                <button
                  type="button"
                  id="btn-sort-oldest"
                  onClick={() => setSortByDate('oldest')}
                  className={`py-1 text-center font-bold text-[10px] uppercase rounded-md transition-all ${
                    sortByDate === 'oldest' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  Oldest First
                </button>
              </div>
            </div>

            {/* Subscriptions alert status widget */}
            <div className="pt-2">
              <div className="p-3 bg-neutral-50 rounded-xl flex items-center justify-between border border-neutral-120">
                <span className="text-[10px] text-neutral-500 font-sans flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  Realtime Pub/Sub Channel
                </span>
                <span className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-100/50 px-1.5 py-0.5 rounded uppercase">
                  Connected
                </span>
              </div>
            </div>
          </div>

          {/* Admin Rate Mapping & Estimation Formula Configuration Panel */}
          <div className={`bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm transition-all duration-300 ${isFareMappingExpanded ? 'space-y-4' : 'space-y-0.5'}`} id="admin-vehicle-fare-pricing-panel">
            <button
              type="button"
              onClick={() => setIsFareMappingExpanded(!isFareMappingExpanded)}
              className="w-full flex items-center justify-between pb-2.5 border-b border-neutral-150 cursor-pointer focus:outline-none focus:ring-0 text-left"
              style={{ background: 'transparent' }}
            >
              <div className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-neutral-400" />
                <h4 className="font-bold text-xs text-neutral-950 uppercase tracking-widest leading-none select-none">
                  Vehicle Category Settings {isFareMappingExpanded ? '▲' : '▼'}
                </h4>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-950 text-white font-bold uppercase tracking-wide shrink-0 font-sans">
                Master Settings Panel
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isFareMappingExpanded && (
                <motion.div
                  key="vehicle-category-pricing-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden space-y-4 pt-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-neutral-500 font-sans leading-normal">
                      Directly map pricing formulas (Base Fare, rate per KM, and Minimum Fare), passenger capacities, luggage capacities, and status for every active vehicle category.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddNewCategory}
                      className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg whitespace-nowrap transition"
                    >
                      + Add Category
                    </button>
                  </div>

                  <form onSubmit={saveFareSettings} className="space-y-4">
                    <div className="space-y-3.5">
                      {vehicleCategories.map((cat, idx) => {
                        return (
                          <div key={cat.id || cat.name} className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3">
                            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-neutral-150">
                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={cat.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setVehicleCategories(prev => prev.map((c, i) => i === idx ? { ...c, name: val } : c));
                                  }}
                                  className="text-xs font-bold text-neutral-800 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-neutral-950 focus:outline-none py-0.5 px-0.5 max-w-[180px]"
                                  title="Click to rename category name"
                                  required
                                />
                              </div>
                              <div className="flex items-center gap-3">
                                {/* Toggle Active/Inactive */}
                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={cat.active}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setVehicleCategories(prev => prev.map((c, i) => i === idx ? { ...c, active: checked } : c));
                                    }}
                                    className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-950 w-3.5 h-3.5"
                                  />
                                  <span className={`text-[10px] font-bold uppercase font-sans ${cat.active ? 'text-emerald-700' : 'text-neutral-400'}`}>
                                    {cat.active ? 'Active' : 'Inactive'}
                                  </span>
                                </label>
                                {/* Delete action button */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat.id || cat.name)}
                                  className="text-neutral-400 hover:text-red-600 transition p-0.5"
                                  title="Delete Vehicle Category"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              <div>
                                <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-1 font-sans">
                                  Base Fee (₹)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-1.5 top-1 text-xs text-neutral-400 font-mono font-bold">₹</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    required
                                    value={cat.base_fare}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      setVehicleCategories(prev => prev.map((c, i) => i === idx ? { ...c, base_fare: val } : c));
                                    }}
                                    className="w-full pl-4 pr-1 py-0.5 bg-white border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-1 font-sans">
                                  Rate / KM (₹)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-1.5 top-1 text-xs text-neutral-400 font-mono font-bold">₹</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    required
                                    value={cat.per_km_rate}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      setVehicleCategories(prev => prev.map((c, i) => i === idx ? { ...c, per_km_rate: val } : c));
                                    }}
                                    className="w-full pl-4 pr-1 py-0.5 bg-white border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-1 font-sans">
                                  Min Fare (₹)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-1.5 top-1 text-xs text-neutral-400 font-mono font-bold">₹</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    required
                                    value={cat.minimum_fare || 0}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      setVehicleCategories(prev => prev.map((c, i) => i === idx ? { ...c, minimum_fare: val } : c));
                                    }}
                                    className="w-full pl-4 pr-1 py-0.5 bg-white border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-1 font-sans">
                                  Passengers
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  required
                                  value={cat.passenger_capacity ?? 4}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value, 10) || 4);
                                    setVehicleCategories(prev => prev.map((c, i) => i === idx ? { ...c, passenger_capacity: val } : c));
                                  }}
                                  className="w-full px-1.5 py-0.5 bg-white border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                                />
                              </div>

                              <div>
                                <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-1 font-sans">
                                  Luggage
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  required
                                  value={cat.luggage_capacity ?? 2}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                    setVehicleCategories(prev => prev.map((c, i) => i === idx ? { ...c, luggage_capacity: val } : c));
                                  }}
                                  className="w-full px-1.5 py-0.5 bg-white border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {saveSuccessMsg && (
                      <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold text-center rounded-lg font-sans">
                        ✓ Configurations Sync Success!
                      </div>
                    )}

                    {pricingError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 text-[11px] font-semibold text-left rounded-lg font-sans flex flex-col gap-1">
                        <span className="font-bold">⚠️ Database Sync Failed:</span>
                        <span className="font-mono text-[10px] whitespace-pre-wrap">{pricingError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        type="button"
                        id="btn-admin-fare-reset"
                        onClick={resetFareToDefaults}
                        className="py-2 text-center text-neutral-500 hover:text-neutral-800 border border-neutral-250 bg-white rounded-xl text-[10px] font-bold uppercase transition hover:bg-neutral-50"
                      >
                        Reset Defaults
                      </button>
                      <button
                        type="submit"
                        id="btn-admin-fare-save"
                        className="py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition shadow-sm"
                      >
                        Apply & Sync
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Inquiry list Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden" id="inquiry-list-wrapper">
            <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-150 flex items-center justify-between">
              <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-neutral-400" />
                Inquiry Dispatch Queue
                <span className="px-2 py-0.5 text-[10px] font-bold bg-neutral-200 text-neutral-700 rounded-full font-mono">
                  {filteredInquiries.length}
                </span>
              </h3>
              <button
                onClick={loadData}
                id="btn-manual-refresh-inquiries"
                disabled={loading}
                className="p-1 hover:bg-neutral-200 rounded-lg text-neutral-500 transition-colors"
                title="Manual Database Re-sync"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Empty States Handling */}
            {loading ? (
              <div className="py-24 text-center flex flex-col justify-center items-center gap-3">
                <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin" />
                <p className="text-xs text-neutral-500 font-sans">Connecting to database and compiling records...</p>
              </div>
            ) : filteredInquiries.length === 0 ? (
              <div className="py-24 text-center flex flex-col justify-center items-center px-6">
                <div className="w-14 h-14 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center mb-4">
                  <Inbox className="w-7 h-7" />
                </div>
                <h4 className="text-md font-bold text-neutral-900 tracking-tight">
                  {inquiries.length === 0 ? 'No inquiries found' : 'No queries matched your search requirements'}
                </h4>
                <p className="text-xs text-neutral-500 max-w-sm mt-1 mx-auto font-sans">
                  {inquiries.length === 0
                    ? 'Submit a quote request using the customer layout form to populate this table.'
                    : 'Try clearing your text filters or choosing another status category pill above.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredInquiries.map((inq) => {
                  const isExpanded = expandedInquiryId === inq.id;
                  return (
                    <div
                      key={inq.id}
                      id={`inquiry-row-${inq.id}`}
                      onClick={() => setExpandedInquiryId(isExpanded ? null : inq.id)}
                      className={`block bg-white border rounded-xl p-5 hover:border-neutral-300 transition-all duration-200 cursor-pointer text-left select-none ${
                        isExpanded
                          ? 'border-neutral-400 shadow-md ring-1 ring-neutral-400/10'
                          : selectedInquiry?.id === inq.id
                          ? 'border-neutral-300 bg-neutral-100/50 shadow-sm'
                          : 'border-neutral-200 shadow-sm'
                      }`}
                    >
                      {/* Compact Header Area - Always visible */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Service type & details row */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-neutral-900 text-white font-sans tracking-wide">
                              {inq.service_type}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono font-bold uppercase">
                              Ref: {inq.id.substring(0, 8)}...
                            </span>
                          </div>

                          {/* Customer Name */}
                          <h4 className="text-md font-bold text-neutral-950 tracking-tight">
                            {inq.name}
                          </h4>

                          {/* Secondary Compact Metadata */}
                          <div className="text-xs text-neutral-500 mt-1 font-medium font-sans flex flex-wrap items-center gap-y-1 gap-x-2.5">
                            <span>
                              Category:{' '}
                              <strong className="text-neutral-800 font-bold">
                                {inq.vehicle_category || 'Not Specified'}
                              </strong>
                            </span>
                            <span className="text-neutral-300">•</span>
                            <span className="flex items-center gap-1 font-sans">
                              <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              Booked: <strong>{inq.travel_date}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Status badge and rotating chevron toggle */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold font-sans px-2.5 py-1 rounded-full ${
                              inq.status === 'New'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                : inq.status === 'Contacted'
                                ? 'bg-amber-50 text-amber-800 border border-amber-100'
                                : inq.status === 'Confirmed'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-100'
                                : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                inq.status === 'New'
                                  ? 'bg-emerald-500'
                                  : inq.status === 'Contacted'
                                  ? 'bg-amber-500'
                                  : inq.status === 'Confirmed'
                                  ? 'bg-indigo-500'
                                  : 'bg-neutral-400'
                              }`}
                            />
                            {inq.status === 'Closed' ? 'Completed' : inq.status}
                          </span>
                          <ChevronDown
                            className={`w-5 h-5 text-neutral-400 transition-transform duration-300 shrink-0 ${
                              isExpanded ? 'rotate-180 text-neutral-700' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Smooth Expanded Information & Administration actions block */}
                      <motion.div
                        initial={false}
                        animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 mt-4 border-t border-neutral-150 space-y-4">
                          {/* Contact Info & Age metadata split grids */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="space-y-1">
                              <span className="block text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
                                Customer Contact
                              </span>
                              <div className="flex items-center gap-2 text-xs text-neutral-800 font-mono bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-150">
                                <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
                                <strong>{inq.phone}</strong>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="block text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
                                Filed Timestamp
                              </span>
                              <div className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-150 font-sans">
                                <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span>{new Date(inq.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Route location mapping segment */}
                          {inq.pickup_location && (
                            <div className="space-y-1.5">
                              <span className="block text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
                                Logistical Route Details
                              </span>
                              <div className="p-3.5 border border-neutral-150 bg-neutral-50 rounded-xl text-xs text-neutral-700 font-sans leading-relaxed space-y-3">
                                <div className="flex items-start gap-2.5">
                                  <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[10px] text-neutral-450 font-bold uppercase leading-none mb-1">
                                      Pickup Point
                                    </div>
                                    <div className="font-semibold text-neutral-900">
                                      {inq.pickup_location}
                                    </div>
                                  </div>
                                </div>
                                {inq.drop_location && (
                                  <div className="border-t border-neutral-200 pt-3 flex items-start gap-2.5">
                                    <MapPin className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[10px] text-neutral-450 font-bold uppercase leading-none mb-1">
                                        Dropoff Destination
                                      </div>
                                      <div className="font-semibold text-neutral-900">
                                        {inq.drop_location}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Dynamic calculated cost breakdown cards */}
                          {(() => {
                            const est = parseEstimateDetails(inq.additional_requirements);
                            if (est) {
                              return (
                                <div className="space-y-2 font-sans">
                                  <span className="block text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
                                    Calculated Fare Breakdown
                                  </span>
                                  {/* Visual Estimation Card */}
                                  <div className="p-4 bg-neutral-900 text-white rounded-xl border border-neutral-800 text-xs space-y-2.5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                                    <div className="flex items-center justify-between pb-2 border-b border-neutral-800 text-[10px] uppercase font-bold text-amber-400 font-mono">
                                      <span className="flex items-center gap-1">
                                        <span>🚗</span> Dynamic Estimation Segment
                                      </span>
                                      <span className="bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded tracking-wide">
                                        Estimate Only
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-neutral-300">
                                      <div>
                                        <span className="block text-neutral-500 text-[9px] font-bold uppercase tracking-wider">
                                          Distance
                                        </span>
                                        <span className="font-mono font-bold text-white">
                                          {est.distance}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-neutral-500 text-[9px] font-bold uppercase tracking-wider">
                                          Base + Rate
                                        </span>
                                        <span className="font-mono">
                                          {est.base} + {est.rate}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-neutral-450 text-[9px] font-bold uppercase tracking-wider">
                                          Estimated Fare
                                        </span>
                                        <span className="font-mono text-amber-400 font-extrabold text-xs">
                                          {est.fare}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Special specs description */}
                                  {est.notes && (
                                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-150 text-xs text-neutral-600 font-sans leading-relaxed">
                                      <strong className="text-neutral-900 block font-semibold mb-0.5 uppercase text-[9px] tracking-wider text-neutral-400 font-sans">
                                        Additional Custom Requirements:
                                      </strong>
                                      {est.notes}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            if (inq.additional_requirements) {
                              return (
                                <div className="space-y-1.5">
                                  <span className="block text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
                                    Customer Requirements
                                  </span>
                                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-150 text-xs text-neutral-600 font-sans leading-relaxed">
                                    <strong className="text-neutral-900 block font-semibold mb-0.5 uppercase text-[9px] tracking-wider text-neutral-400">
                                      Customer specifications:
                                    </strong>
                                    {inq.additional_requirements}
                                  </div>
                                </div>
                              );
                            }

                            return null;
                          })()}

                          {/* Control Action Tools - Row inside expansion details */}
                          <div className="pt-4 border-t border-neutral-150 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            {/* Active status update box */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2"
                            >
                              <label
                                htmlFor={`status-dropdown-${inq.id}`}
                                className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-sans"
                              >
                                Modify Status:
                              </label>
                              <select
                                id={`status-dropdown-${inq.id}`}
                                value={inq.status}
                                onChange={(e) =>
                                  handleUpdateStatus(inq.id, e.target.value as InquiryStatus)
                                }
                                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border focus:outline-none cursor-pointer ${
                                  inq.status === 'New'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : inq.status === 'Contacted'
                                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                                    : inq.status === 'Confirmed'
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                                    : 'bg-neutral-100 border-neutral-300 text-neutral-600'
                                }`}
                              >
                                <option value="New">🟢 New Alert</option>
                                <option value="Contacted">🟡 Contacted Customer</option>
                                <option value="Confirmed">🔵 Confirmed Booking</option>
                                <option value="Closed">⚪ Completed</option>
                              </select>
                            </div>

                            {/* Push contact communications actions */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2"
                            >
                              <a
                                href={`tel:${inq.phone}`}
                                id={`btn-call-customer-${inq.id}`}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-[#111827] hover:bg-[#1F2937] text-white rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                Call Now
                              </a>

                              <a
                                href={`https://wa.me/${inq.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                                  inq.name
                                )},%20this%20is%20Admin%20from%20Car%20%26%20Driver%20Relief%20Services%20regarding%20booking%20reference%20${inq.id.substring(
                                  0,
                                  8
                                )}.`}
                                target="_blank"
                                rel="noreferrer"
                                id={`btn-wa-customer-${inq.id}`}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-[#10B981] hover:bg-emerald-600 text-white rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <MessageSquare className="w-3.5 h-3.5 fill-white" />
                                WhatsApp
                              </a>

                              <button
                                onClick={() => handleDelete(inq.id)}
                                id={`btn-delete-inquiry-${inq.id}`}
                                className="p-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                title="Delete Lead Permanent"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
