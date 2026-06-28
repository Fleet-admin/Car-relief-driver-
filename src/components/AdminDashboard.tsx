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
  ChevronDown,
  Upload,
  Image,
  X,
  Car,
  Layers,
  Settings,
  Menu,
  Plus
} from 'lucide-react';
import { Inquiry, InquiryStatus, DashboardMetrics, VehicleCategory } from '../types';
import { SupabaseService } from '../lib/supabase';
import ConfirmBookingModal from './ConfirmBookingModal';
import DriverManagement from './DriverManagement';
import VehicleManagement from './VehicleManagement';
import SettingsManagement from './SettingsManagement';

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
  const [activeTab, setActiveTab] = useState<'bookings' | 'categories' | 'drivers' | 'vehicles' | 'settings'>('bookings');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | 'All'>('All');
  const [sortByDate, setSortByDate] = useState<'newest' | 'oldest'>('newest');

  // Selected Inquiry detail view modal
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  // Active inquiry being confirmed and dispatched
  const [confirmingInquiry, setConfirmingInquiry] = useState<Inquiry | null>(null);

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
  const [adminCatFilter, setAdminCatFilter] = useState<'All' | 'Active' | 'Inactive' | 'Archived'>('All');

  // Category creation modal states
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatBaseFare, setNewCatBaseFare] = useState('150');
  const [newCatPerKmRate, setNewCatPerKmRate] = useState('12');
  const [newCatMinFare, setNewCatMinFare] = useState('150');
  const [newCatPassengers, setNewCatPassengers] = useState('4');
  const [newCatLuggage, setNewCatLuggage] = useState('2');
  const [addCatError, setAddCatError] = useState<string | null>(null);

  // Performance loader management states
  const [isSavingCategories, setIsSavingCategories] = useState(false);
  const [isResettingCategories, setIsResettingCategories] = useState(false);

  const saveFareSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingError(null);
    setIsSavingCategories(true);
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
    } finally {
      setIsSavingCategories(false);
    }
  };

  const resetFareToDefaults = async () => {
    if (window.confirm('Do you want to reset all vehicle pricing categories back to system standard plans? This will overwrite live database settings.')) {
      setPricingError(null);
      setIsResettingCategories(true);
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
      } finally {
        setIsResettingCategories(false);
      }
    }
  };

  const handleAddNewCategory = () => {
    setNewCatName('');
    setNewCatBaseFare('150');
    setNewCatPerKmRate('12');
    setNewCatMinFare('150');
    setNewCatPassengers('4');
    setNewCatLuggage('2');
    setAddCatError(null);
    setShowAddCatModal(true);
  };

  const submitNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setAddCatError(null);

    const name = newCatName.trim();
    if (!name) {
      setAddCatError("Category name is required.");
      return;
    }

    if (vehicleCategories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
      setAddCatError("A category with this name already exists.");
      return;
    }

    const base_fare = Math.max(0, parseFloat(newCatBaseFare) || 150.00);
    const per_km_rate = Math.max(0, parseFloat(newCatPerKmRate) || 12.00);
    const minimum_fare = Math.max(0, parseFloat(newCatMinFare) || 150.00);
    const passenger_capacity = Math.max(1, parseInt(newCatPassengers, 10) || 4);
    const luggage_capacity = Math.max(0, parseInt(newCatLuggage, 10) || 2);

    const newCat: VehicleCategory = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name,
      base_fare,
      per_km_rate,
      minimum_fare,
      passenger_capacity,
      luggage_capacity,
      active: true,
      status: 'Available',
      image_url: '',
      description: ''
    };

    setVehicleCategories(prev => [...prev, newCat]);
    setShowAddCatModal(false);
    onNotifyTriggered(`New vehicle category "${newCat.name}" added locally! Click Apply & Sync to save.`);
  };

  const handleDeleteCategory = (catId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the vehicle category "${name}"? This could affect vehicles assigned to it.`)) {
      return;
    }
    setVehicleCategories(prev => prev.filter(c => c.id !== catId));
    onNotifyTriggered(`Category "${name}" removed locally! Click Apply & Sync to save.`);
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
    const metrics: DashboardMetrics = { total: 0, new: 0, confirmed: 0, active: 0, completed: 0, cancelled: 0 };
    inquiries.forEach((item) => {
      metrics.total++;
      if (item.status === 'New') metrics.new++;
      else if (item.status === 'Confirmed') metrics.confirmed++;
      else if (item.status === 'Active') metrics.active++;
      else if (item.status === 'Completed' || item.status === 'Closed') metrics.completed++;
      else if (item.status === 'Cancelled') metrics.cancelled++;
    });
    return metrics;
  };

  const refreshInquiries = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await SupabaseService.queryInquiries();
      setInquiries(data);
    } catch (err: any) {
      console.warn('Silent inquiry refresh failed:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      // High-speed parallel connection pooling queries
      const [data, cats] = await Promise.all([
        SupabaseService.queryInquiries(),
        SupabaseService.getVehicleCategories()
      ]);
      setInquiries(data);
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

      // Efficiently refresh inquiries list silently in the background
      refreshInquiries(true);
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
      const matchStatus =
        statusFilter === 'All' ||
        item.status === statusFilter ||
        (statusFilter === 'Completed' && item.status === 'Closed');
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
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row" id="admin-root-layout">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-neutral-950 text-white p-5 border-r border-neutral-800 shrink-0 select-none">
        <div className="flex items-center gap-3 pb-6 border-b border-neutral-800 mb-6">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center p-1 border border-white/15">
            <img src="/icon.svg" alt="Car & Driver Relief" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight leading-none text-white">RELIEF SERVICES</h1>
            <span className="text-[9px] font-bold text-amber-400 tracking-wider uppercase mt-1.5 block">Fleet Admin Portal</span>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="space-y-1.5 flex-1">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'bookings'
                ? 'bg-amber-400 text-neutral-950 font-black shadow-md'
                : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            Bookings
          </button>
          
          <button
            onClick={() => setActiveTab('categories')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'categories'
                ? 'bg-amber-400 text-neutral-950 font-black shadow-md'
                : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            Vehicle Categories
          </button>

          <button
            onClick={() => setActiveTab('drivers')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'drivers'
                ? 'bg-amber-400 text-neutral-950 font-black shadow-md'
                : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            Drivers
          </button>

          <button
            onClick={() => setActiveTab('vehicles')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'vehicles'
                ? 'bg-amber-400 text-neutral-950 font-black shadow-md'
                : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
            }`}
          >
            <Car className="w-4 h-4 shrink-0" />
            Vehicles
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'settings'
                ? 'bg-amber-400 text-neutral-950 font-black shadow-md'
                : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </button>
        </nav>

        {/* Sidebar Footer logout */}
        <div className="pt-6 border-t border-neutral-800">
          <button
            onClick={() => {
              setIsAuthenticated(false);
              localStorage.removeItem('admin_authenticated');
              if (onLogout) onLogout();
            }}
            className="w-full flex items-center justify-between text-left text-xs font-bold text-neutral-400 hover:text-red-400 transition"
          >
            <span>Logout Session</span>
            <LogOut className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
      </aside>

      {/* Mobile Header Top bar */}
      <header className="md:hidden bg-neutral-950 text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-[9991] select-none border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center p-0.5">
            <img src="/icon.svg" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider leading-none">Admin Area</span>
            <span className="text-xs font-extrabold text-white uppercase tracking-wider">
              {activeTab === 'bookings' && 'Bookings Queue'}
              {activeTab === 'categories' && 'Categories'}
              {activeTab === 'drivers' && 'Drivers'}
              {activeTab === 'vehicles' && 'Vehicles'}
              {activeTab === 'settings' && 'Settings Hub'}
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-white transition"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile Drawer Menu overlay Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-neutral-950 z-[9992] md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-neutral-950 text-white p-5 z-[9993] flex flex-col md:hidden border-r border-neutral-800"
            >
              <div className="flex items-center justify-between pb-5 border-b border-neutral-800 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white/10 rounded-lg p-0.5">
                    <img src="/icon.svg" alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h1 className="text-xs font-black text-white">RELIEF HUB</h1>
                    <span className="text-[8px] font-bold text-amber-400 uppercase mt-0.5 block tracking-wider">Fleet Panel</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Drawer Nav Items */}
              <nav className="space-y-1 flex-1">
                <button
                  onClick={() => {
                    setActiveTab('bookings');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    activeTab === 'bookings'
                      ? 'bg-amber-400 text-neutral-950 font-black rounded-xl shadow-sm'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-white rounded-xl'
                  }`}
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  Bookings
                </button>

                <button
                  onClick={() => {
                    setActiveTab('categories');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    activeTab === 'categories'
                      ? 'bg-amber-400 text-neutral-950 font-black rounded-xl shadow-sm'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-white rounded-xl'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  Vehicle Categories
                </button>

                <button
                  onClick={() => {
                    setActiveTab('drivers');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    activeTab === 'drivers'
                      ? 'bg-amber-400 text-neutral-950 font-black rounded-xl shadow-sm'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-white rounded-xl'
                  }`}
                >
                  <User className="w-4 h-4 shrink-0" />
                  Drivers
                </button>

                <button
                  onClick={() => {
                    setActiveTab('vehicles');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    activeTab === 'vehicles'
                      ? 'bg-amber-400 text-neutral-950 font-black rounded-xl shadow-sm'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-white rounded-xl'
                  }`}
                >
                  <Car className="w-4 h-4 shrink-0" />
                  Vehicles
                </button>

                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    activeTab === 'settings'
                      ? 'bg-amber-400 text-neutral-950 font-black rounded-xl shadow-sm'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-white rounded-xl'
                  }`}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  Settings
                </button>
              </nav>

              <div className="pt-5 border-t border-neutral-800">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAuthenticated(false);
                    localStorage.removeItem('admin_authenticated');
                    if (onLogout) onLogout();
                  }}
                  className="w-full flex items-center justify-between text-xs font-bold text-neutral-400 hover:text-red-400 transition"
                >
                  <span>Logout Session</span>
                  <LogOut className="w-4 h-4 text-neutral-500" />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Workspace viewport */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8" id="admin-workspace-viewport">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {/* Tab: Bookings (Contains the core metrics and dispatch queue list) */}
            {activeTab === 'bookings' && (
              <div className="space-y-8 animate-in fade-in duration-300" id="admin-bookings-tab-inner">
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" id="metrics-grid">
        {/* Total stats Card */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Total</span>
            <span className="p-1 px-1.5 text-[9px] font-bold bg-neutral-100 text-neutral-700 rounded">All Leads</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span id="metric-total-active" className="text-2xl font-extrabold text-neutral-950 font-sans">{stats.total}</span>
            <span className="text-[10px] text-neutral-400">leads</span>
          </div>
        </div>

        {/* New stats Card */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">New</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="flex items-baseline gap-1">
            <span id="metric-new-active" className="text-2xl font-extrabold text-emerald-950 font-sans">{stats.new}</span>
            <span className="text-[10px] text-emerald-500 font-bold">Unconfirmed</span>
          </div>
        </div>

        {/* Confirmed stats Card */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 shadow-sm text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider font-sans">Confirmed</span>
            <span className="p-0.5 px-1.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold">Planned</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span id="metric-confirmed-active" className="text-2xl font-extrabold text-indigo-950 font-sans">{stats.confirmed}</span>
            <span className="text-[10px] text-indigo-700">Dispatched</span>
          </div>
        </div>

        {/* Active stats Card */}
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 shadow-sm text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-bold text-sky-800 tracking-wider font-sans">Active</span>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-1">
            <span id="metric-active-trips" className="text-2xl font-extrabold text-sky-950 font-sans">{stats.active}</span>
            <span className="text-[10px] text-sky-700 font-bold">En Route</span>
          </div>
        </div>

        {/* Completed stats Card */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 shadow-sm text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-bold text-neutral-450 tracking-wider">Completed</span>
            <span className="p-0.5 px-1.5 bg-neutral-200 text-neutral-600 rounded text-[9px] font-bold">Done</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span id="metric-completed-active" className="text-2xl font-extrabold text-neutral-950 font-sans">{stats.completed}</span>
            <span className="text-[10px] text-neutral-450">Trips</span>
          </div>
        </div>

        {/* Cancelled stats Card */}
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-bold text-rose-800 tracking-wider font-sans">Cancelled</span>
            <span className="p-0.5 px-1.5 bg-rose-100 text-rose-700 rounded text-[9px] font-bold">Void</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span id="metric-cancelled-active" className="text-2xl font-extrabold text-rose-950 font-sans">{stats.cancelled}</span>
            <span className="text-[10px] text-rose-600">Rejects</span>
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
                  className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-all font-sans"
                />
              </div>
            </div>

            {/* Status Pills Choice */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 font-sans">
                Inquiry Status State
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(['All', 'New', 'Confirmed', 'Active', 'Completed', 'Cancelled'] as const).map((stat) => (
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
                    {stat}
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
                                : inq.status === 'Confirmed'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-100'
                                : inq.status === 'Active'
                                ? 'bg-sky-50 text-sky-850 border border-sky-100'
                                : inq.status === 'Completed' || inq.status === 'Closed'
                                ? 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-100'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                inq.status === 'New'
                                  ? 'bg-emerald-500'
                                  : inq.status === 'Confirmed'
                                  ? 'bg-indigo-500'
                                  : inq.status === 'Active'
                                  ? 'bg-sky-500 animate-ping'
                                  : inq.status === 'Completed' || inq.status === 'Closed'
                                  ? 'bg-neutral-400'
                                  : 'bg-rose-500'
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
                            {/* Current status display badge */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2"
                            >
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-sans">
                                Current Status:
                              </span>
                              <span
                                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold font-sans px-2.5 py-1 rounded-full ${
                                  inq.status === 'New'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-150'
                                    : inq.status === 'Confirmed'
                                    ? 'bg-indigo-50 text-indigo-800 border border-indigo-150'
                                    : inq.status === 'Active'
                                    ? 'bg-sky-50 text-sky-850 border border-sky-150'
                                    : inq.status === 'Completed' || inq.status === 'Closed'
                                    ? 'bg-neutral-50 text-neutral-650 border border-neutral-200'
                                    : 'bg-rose-50 text-rose-800 border border-rose-150'
                                }`}
                              >
                                {inq.status === 'Closed' ? 'Completed' : inq.status}
                              </span>
                            </div>

                            {/* Push contact communications actions */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 flex-wrap"
                            >
                              {inq.status === 'New' && (
                                <button
                                  onClick={() => setConfirmingInquiry(inq)}
                                  id={`btn-confirm-booking-${inq.id}`}
                                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-[#10B981] hover:bg-[#10B981]/90 text-white rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Confirm Booking
                                </button>
                              )}

                              {(inq.status === 'Confirmed' || inq.status === 'Active') && (
                                <button
                                  onClick={() => handleUpdateStatus(inq.id, 'Cancelled')}
                                  id={`btn-cancel-booking-${inq.id}`}
                                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Cancel Booking
                                </button>
                              )}

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
                                className="p-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg transition-colors animate-fade-in"
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
  )}

            {/* Tab: Vehicle Categories */}
            {activeTab === 'categories' && (
              <div className="space-y-6 max-w-4xl text-left" id="admin-vehicle-fare-pricing-panel">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold bg-neutral-950 text-amber-400 uppercase tracking-widest px-2.5 py-1 rounded-md mb-2 inline-block font-sans">
                      Pricing Plans
                    </span>
                    <h2 className="text-2xl font-extrabold text-neutral-950 tracking-tight">Vehicle Categories Pricing</h2>
                    <p className="text-xs text-neutral-500 font-sans mt-0.5">Configure passenger/luggage capacities, base rates, minimum fares, and per-kilometer tariffs.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddNewCategory}
                    className="bg-neutral-950 hover:bg-neutral-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-md self-start sm:self-auto font-sans flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    Add Category
                  </button>
                </div>

                <div className="bg-white border border-neutral-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
                  {/* Category Status Filters */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-5 border-b border-neutral-100 pb-4">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider font-sans mr-1">Show Status:</span>
                    {(['All', 'Active', 'Inactive', 'Archived'] as const).map(catFilter => (
                      <button
                        key={catFilter}
                        type="button"
                        onClick={() => setAdminCatFilter(catFilter)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition font-sans ${
                          adminCatFilter === catFilter
                            ? 'bg-neutral-950 text-white shadow-sm'
                            : 'bg-neutral-100 hover:bg-neutral-150 text-neutral-600'
                        }`}
                      >
                        {catFilter}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={saveFareSettings} className="space-y-4">
                    <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                      {vehicleCategories
                        .filter(cat => {
                          const s = cat.status || (cat.active ? 'Available' : 'Under Maintenance');
                          const mappedFilter = s === 'Available' ? 'Active' : s === 'Under Maintenance' ? 'Inactive' : 'Archived';
                          if (adminCatFilter === 'All') return true;
                          return mappedFilter === adminCatFilter;
                        })
                        .map((cat) => {
                          const statusVal = cat.status || (cat.active ? 'Available' : 'Under Maintenance');
                          const catId = cat.id || cat.name;

                          return (
                            <div key={catId} className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3.5 text-xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-neutral-200">
                                <div className="flex-1">
                                  <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">
                                    Category Name
                                  </label>
                                  <input
                                    type="text"
                                    value={cat.name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setVehicleCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: val } : c));
                                    }}
                                    className="text-xs font-bold text-neutral-800 bg-white border border-neutral-300 focus:border-neutral-950 rounded-lg py-1 px-2.5 w-full max-w-sm font-sans focus:outline-none"
                                    required
                                  />
                                </div>
                                <div className="flex items-center gap-2.5 min-w-[150px]">
                                  <div className="flex-1">
                                    <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5 font-sans">
                                      Status
                                    </label>
                                    <select
                                      value={statusVal === 'Available' ? 'Active' : statusVal === 'Under Maintenance' ? 'Inactive' : 'Archived'}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const dbVal = val === 'Active' ? 'Available' : val === 'Inactive' ? 'Under Maintenance' : 'Archived';
                                        setVehicleCategories(prev => prev.map(c => c.id === cat.id ? { ...c, status: dbVal, active: dbVal === 'Available' } : c));
                                      }}
                                      className={`text-xs font-bold uppercase rounded-lg border py-1 px-2.5 w-full focus:outline-none transition ${
                                        statusVal === 'Available'
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                          : statusVal === 'Under Maintenance'
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : 'bg-neutral-100 border-neutral-250 text-neutral-600'
                                      }`}
                                    >
                                      <option value="Active">Active</option>
                                      <option value="Inactive">Inactive</option>
                                      <option value="Archived">Archived</option>
                                    </select>
                                  </div>

                                  {/* Delete custom category */}
                                  {cat.id !== 'sedan' && cat.id !== 'suv' && cat.id !== 'innova' && cat.id !== 'tempo' && cat.id !== 'hatchback' && (
                                    <div className="pt-3">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCategory(cat.id || '', cat.name)}
                                        className="p-1.5 hover:bg-red-50 text-neutral-450 hover:text-red-600 rounded-lg transition"
                                        title="Delete Category"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                                <div>
                                  <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-1 font-sans">
                                    Base Fee (₹)
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-1.5 top-1 text-xs text-neutral-400 font-mono font-bold font-sans">₹</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      required
                                      value={cat.base_fare}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                                        setVehicleCategories(prev => prev.map(c => c.id === cat.id ? { ...c, base_fare: val } : c));
                                      }}
                                      className="w-full pl-4 pr-1.5 py-1 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-1 font-sans">
                                    Rate / KM (₹)
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-1.5 top-1 text-xs text-neutral-400 font-mono font-bold font-sans">₹</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.5}
                                      required
                                      value={cat.per_km_rate}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                                        setVehicleCategories(prev => prev.map(c => c.id === cat.id ? { ...c, per_km_rate: val } : c));
                                      }}
                                      className="w-full pl-4 pr-1.5 py-1 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-1 font-sans">
                                    Min Fare (₹)
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-1.5 top-1 text-xs text-neutral-400 font-mono font-bold font-sans">₹</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      required
                                      value={cat.minimum_fare || 0}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                                        setVehicleCategories(prev => prev.map(c => c.id === cat.id ? { ...c, minimum_fare: val } : c));
                                      }}
                                      className="w-full pl-4 pr-1.5 py-1 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-950"
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
                                      setVehicleCategories(prev => prev.map(c => c.id === cat.id ? { ...c, passenger_capacity: val } : c));
                                    }}
                                    className="w-full px-2 py-1 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-950"
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
                                      setVehicleCategories(prev => prev.map(c => c.id === cat.id ? { ...c, luggage_capacity: val } : c));
                                    }}
                                    className="w-full px-2 py-1 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5">
                                <div>
                                  <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-1 font-sans flex items-center justify-between">
                                    <span>Category Image</span>
                                    <span className="text-neutral-300 font-normal lowercase">(URL or direct upload)</span>
                                  </label>
                                  <div className="flex items-center gap-2">
                                    {cat.image_url ? (
                                      <div className="relative w-9 h-9 rounded-lg border border-neutral-200 overflow-hidden shrink-0 bg-neutral-50 group/thumb">
                                        <img 
                                          src={cat.image_url} 
                                          alt="Preview" 
                                          className="w-full h-full object-cover" 
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setVehicleCategories(prev => prev.map(c => c.id === cat.id ? { ...c, image_url: '' } : c));
                                          }}
                                          className="absolute inset-0 bg-neutral-900/60 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition duration-150"
                                          title="Remove Image"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-white" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="w-9 h-9 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center text-neutral-400 shrink-0">
                                        <Image className="w-4 h-4" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0 flex gap-1.5 items-center">
                                      <input
                                        type="text"
                                        value={cat.image_url || ''}
                                        placeholder="Paste image URL..."
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setVehicleCategories(prev => prev.map(c => c.id === cat.id ? { ...c, image_url: val } : c));
                                        }}
                                        className="flex-1 min-w-0 px-2.5 py-1 text-xs border border-neutral-350 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-950 text-neutral-700 bg-white"
                                      />
                                      <label className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-355 rounded-lg text-neutral-700 text-[10px] font-extrabold font-sans cursor-pointer transition shrink-0 flex items-center justify-center gap-1.5 h-[28px] uppercase select-none">
                                        <Upload className="w-3 h-3" />
                                        <span>File</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onload = (event) => {
                                                const base64 = event.target?.result as string;
                                                setVehicleCategories(prev => prev.map(c => c.id === cat.id ? { ...c, image_url: base64 } : c));
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }}
                                          className="hidden"
                                        />
                                      </label>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-1 font-sans flex items-center justify-between">
                                    <span>Custom Description</span>
                                    <span className="text-neutral-300 font-normal lowercase">(optional overview)</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={cat.description || ''}
                                    placeholder="Enter premium description to display on website..."
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setVehicleCategories(prev => prev.map(c => c.id === cat.id ? { ...c, description: val } : c));
                                    }}
                                    className="w-full px-2.5 py-1 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-950 text-neutral-700 bg-white"
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
                        disabled={isSavingCategories || isResettingCategories}
                        className="py-2.5 text-center text-neutral-500 hover:text-neutral-800 border border-neutral-250 bg-white rounded-xl text-[10px] font-bold uppercase transition hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-sans"
                      >
                        {isResettingCategories ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-neutral-500" />
                            <span>Resetting...</span>
                          </>
                        ) : (
                          <span>Reset Defaults</span>
                        )}
                      </button>
                      <button
                        type="submit"
                        id="btn-admin-fare-save"
                        disabled={isSavingCategories || isResettingCategories}
                        className="py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-sans"
                      >
                        {isSavingCategories ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
                            <span>Syncing...</span>
                          </>
                        ) : (
                          <span>Apply & Sync</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Tab: Drivers */}
            {activeTab === 'drivers' && (
              <DriverManagement onNotify={onNotifyTriggered} />
            )}

            {/* Tab: Vehicles */}
            {activeTab === 'vehicles' && (
              <VehicleManagement onNotify={onNotifyTriggered} />
            )}

            {/* Tab: Settings */}
            {activeTab === 'settings' && (
              <SettingsManagement onNotify={onNotifyTriggered} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Confirm & Dispatch Driver Assignment Modal overlay */}
      <AnimatePresence>
        {confirmingInquiry && (
          <ConfirmBookingModal
            inquiry={confirmingInquiry}
            onClose={() => setConfirmingInquiry(null)}
            onConfirmComplete={(updatedInquiry) => {
              setInquiries((prev) =>
                prev.map((item) => (item.id === updatedInquiry.id ? updatedInquiry : item))
              );
              onNotifyTriggered(`Inquiry for ${updatedInquiry.name} has been successfully confirmed and dispatched!`);
            }}
          />
        )}
      </AnimatePresence>

      {/* Custom Add Category Modal overlay */}
      <AnimatePresence>
        {showAddCatModal && (
          <div id="add-category-modal-overlay" className="fixed inset-0 bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in" onClick={() => setShowAddCatModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-neutral-100 max-w-sm w-full overflow-hidden text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-neutral-950 text-white p-5 flex items-center justify-between border-b border-neutral-850">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <div>
                    <h3 className="text-xs font-black tracking-widest uppercase leading-none text-white">New Category</h3>
                    <p className="text-[9px] text-neutral-400 font-sans mt-1">Register custom pricing configurations</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={submitNewCategory} className="p-5 space-y-4">
                {addCatError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-850 text-[10px] font-bold rounded-lg font-sans">
                    ⚠️ {addCatError}
                  </div>
                )}

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1 font-sans">Category Name*</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Luxury Minivan"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-950 font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1 font-sans">Seats Limit*</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={newCatPassengers}
                        onChange={(e) => setNewCatPassengers(e.target.value)}
                        className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-950 font-sans"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1 font-sans">Bags Limit*</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={newCatLuggage}
                        onChange={(e) => setNewCatLuggage(e.target.value)}
                        className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-950 font-sans"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1 font-sans">Base Fare (₹)*</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={newCatBaseFare}
                        onChange={(e) => setNewCatBaseFare(e.target.value)}
                        className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-950 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1 font-sans">Rate / KM (₹)*</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={newCatPerKmRate}
                        onChange={(e) => setNewCatPerKmRate(e.target.value)}
                        className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-950 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1 font-sans">Minimum Fare (₹)*</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={newCatMinFare}
                      onChange={(e) => setNewCatMinFare(e.target.value)}
                      className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-950 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCatModal(false)}
                    className="py-2.5 text-center text-neutral-500 hover:text-neutral-800 border border-neutral-200 bg-white rounded-xl text-[10px] font-bold uppercase transition hover:bg-neutral-50 font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition shadow-sm font-sans"
                  >
                    Add Category
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
