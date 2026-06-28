import React, { useState, useEffect } from 'react';
import { Driver } from '../types';
import { SupabaseService } from '../lib/supabase';
import { 
  User, Phone, Shield, Search, Plus, Edit2, Trash2, 
  UserCheck, UserX, Image as ImageIcon, Check, X, Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DriverManagementProps {
  onNotify: (msg: string) => void;
}

export default function DriverManagement({ onNotify }: DriverManagementProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal / Form state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  
  // Validation / Error state
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const data = await SupabaseService.getDrivers();
      setDrivers(data);
    } catch (err) {
      console.error('Failed to load drivers:', err);
      onNotify('Failed to retrieve drivers. Using offline fallback.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingDriver(null);
    setName('');
    setPhone('');
    setPhoto('');
    setStatus('Active');
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    setName(driver.name);
    setPhone(driver.phone);
    setPhoto(driver.photo || '');
    setStatus(driver.status);
    setFormError(null);
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!name.trim()) {
      setFormError('Driver name is required.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Driver phone number is required.');
      return;
    }

    // Phone pattern validation
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 8) {
      setFormError('Please enter a valid phone number (minimum 8 digits).');
      return;
    }

    // Prevent duplicate phone number
    const isDuplicate = drivers.some(d => 
      d.phone.replace(/[^0-9]/g, '') === cleanPhone && 
      (!editingDriver || d.id !== editingDriver.id)
    );
    if (isDuplicate) {
      setFormError('A driver with this phone number already exists.');
      return;
    }

    setSaving(true);
    try {
      let updatedDriversList: Driver[];
      if (editingDriver) {
        const updatedDriver: Driver = {
          ...editingDriver,
          name: name.trim(),
          phone: phone.trim(),
          photo: photo.trim() || null,
          status,
          updated_at: new Date().toISOString()
        };
        updatedDriversList = drivers.map(d => d.id === editingDriver.id ? updatedDriver : d);
        onNotify(`Successfully updated driver: ${name}`);
      } else {
        const newDriver: Driver = {
          id: 'drv_' + Math.random().toString(36).substring(2, 11),
          name: name.trim(),
          phone: phone.trim(),
          photo: photo.trim() || null,
          status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        updatedDriversList = [...drivers, newDriver];
        onNotify(`Successfully added driver: ${name}`);
      }

      await SupabaseService.saveDrivers(updatedDriversList);
      setDrivers(updatedDriversList);
      setShowFormModal(false);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDriver = async (driverId: string, driverName: string) => {
    if (!window.confirm(`Are you absolutely sure you want to permanently delete driver ${driverName}?`)) {
      return;
    }
    try {
      const updatedList = drivers.filter(d => d.id !== driverId);
      await SupabaseService.saveDrivers(updatedList);
      setDrivers(updatedList);
      onNotify(`Driver ${driverName} has been deleted.`);
    } catch (err) {
      console.error('Failed to delete driver:', err);
      onNotify('Failed to delete driver. Please try again.');
    }
  };

  const toggleDriverStatus = async (driver: Driver) => {
    const nextStatus = driver.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const updatedList = drivers.map(d => d.id === driver.id ? {
        ...d,
        status: nextStatus as 'Active' | 'Inactive',
        updated_at: new Date().toISOString()
      } : d);
      await SupabaseService.saveDrivers(updatedList);
      setDrivers(updatedList);
      onNotify(`Driver ${driver.name} is now ${nextStatus}.`);
    } catch (err) {
      console.error('Failed to toggle status:', err);
      onNotify('Failed to update status.');
    }
  };

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.phone.includes(searchQuery)
  );

  return (
    <div id="drivers-management-page" className="space-y-6">
      {/* Action Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-neutral-950">Drivers Directory</h2>
          <p className="text-xs text-neutral-500 font-sans mt-0.5">Register, manage, and dispatch active drivers within your network.</p>
        </div>
        <button
          onClick={openAddModal}
          id="btn-add-driver"
          className="bg-neutral-950 hover:bg-neutral-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md shrink-0"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          Add Driver
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3 shadow-sm">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by driver name or mobile number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-medium pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition"
          />
        </div>
      </div>

      {/* Drivers List View */}
      {loading ? (
        <div className="py-24 text-center flex flex-col justify-center items-center gap-3 bg-white border border-neutral-200 rounded-3xl shadow-sm">
          <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
          <p className="text-xs text-neutral-500 font-sans">Syncing driver registry database...</p>
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="py-20 text-center flex flex-col justify-center items-center px-6 bg-white border border-neutral-200 rounded-3xl shadow-sm">
          <div className="w-14 h-14 bg-neutral-50 text-neutral-400 rounded-full flex items-center justify-center mb-4 border border-neutral-150">
            <User className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-neutral-900 tracking-tight">No Drivers Registered</h4>
          <p className="text-xs text-neutral-500 max-w-xs mt-1 mx-auto font-sans leading-relaxed">
            {searchQuery ? 'No registered drivers matched your query.' : 'Get started by clicking the "Add Driver" button above to add your first driver.'}
          </p>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden" id="drivers-desktop-table-wrapper">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-150 text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                  <th className="px-6 py-4">Driver Details</th>
                  <th className="px-6 py-4">Phone Number</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
                {filteredDrivers.map(d => (
                  <tr key={d.id} className="hover:bg-neutral-50/50 transition duration-150">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                          {d.photo ? (
                            <img src={d.photo} alt={d.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-neutral-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-neutral-950">{d.name}</div>
                          <div className="text-[10px] text-neutral-400 font-mono font-bold uppercase mt-0.5">ID: {d.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-neutral-800">
                      {d.phone}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleDriverStatus(d)}
                        className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                          d.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-850 border-emerald-200/60 hover:bg-emerald-100'
                            : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                        {d.status}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(d)}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors"
                          title="Edit Driver"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDriver(d.id, d.name)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-600 transition-colors"
                          title="Delete Driver"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS VIEW */}
          <div className="grid grid-cols-1 gap-3.5 md:hidden" id="drivers-mobile-stacked-cards">
            {filteredDrivers.map(d => (
              <div key={d.id} className="bg-white border border-neutral-250 rounded-2xl p-4 space-y-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                      {d.photo ? (
                        <img src={d.photo} alt={d.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-neutral-950 text-sm leading-tight">{d.name}</h4>
                      <p className="text-[9px] text-neutral-400 font-mono mt-0.5 font-bold uppercase">ID: {d.id}</p>
                    </div>
                  </div>
                  
                  {/* Status Toggle Badge */}
                  <button
                    onClick={() => toggleDriverStatus(d)}
                    className={`inline-flex items-center gap-1.5 text-[9px] font-extrabold px-2 py-0.5 rounded-full border transition-colors ${
                      d.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-neutral-50 text-neutral-500 border-neutral-200'
                    }`}
                  >
                    <span className={`w-1 h-1 rounded-full ${d.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                    {d.status}
                  </button>
                </div>

                <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-150 space-y-1">
                  <div className="text-[9px] text-neutral-400 uppercase font-bold tracking-wider leading-none">Phone Contact</div>
                  <div className="font-mono font-bold text-xs text-neutral-900">{d.phone}</div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
                  <button
                    onClick={() => openEditModal(d)}
                    className="px-3 py-1.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteDriver(d.id, d.name)}
                    className="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ADD / EDIT DRIVER DIALOG MODAL */}
      <AnimatePresence>
        {showFormModal && (
          <div id="driver-form-overlay" className="fixed inset-0 bg-neutral-900/85 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-neutral-100 max-w-sm w-full overflow-hidden text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-neutral-950 text-white px-5 py-4 flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-amber-400 block mb-0.5">Registry Panel</span>
                  <h3 className="text-sm font-extrabold tracking-tight">
                    {editingDriver ? 'Edit Driver Details' : 'Register New Driver'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1 hover:bg-neutral-800 rounded-full transition text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
                {/* Driver Name input */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Driver Name*</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Anand Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full text-xs font-medium pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition"
                    />
                  </div>
                </div>

                {/* Driver Phone input */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Mobile Phone Number*</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 919876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full text-xs font-medium pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Driver Photo Link */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Driver Image (URL or Base64 - Optional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="Paste public image URL..."
                      value={photo}
                      onChange={(e) => setPhoto(e.target.value)}
                      className="w-full text-xs font-medium pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition"
                    />
                  </div>
                </div>

                {/* Status selection */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Service Status*</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus('Active')}
                      className={`py-2 text-xs font-bold rounded-xl transition border flex items-center justify-center gap-1.5 ${
                        status === 'Active'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-neutral-50 text-neutral-500 border-neutral-250'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('Inactive')}
                      className={`py-2 text-xs font-bold rounded-xl transition border flex items-center justify-center gap-1.5 ${
                        status === 'Inactive'
                          ? 'bg-neutral-50 text-neutral-600 border-neutral-300'
                          : 'bg-neutral-50 text-neutral-500 border-neutral-250'
                      }`}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Inactive
                    </button>
                  </div>
                </div>

                {formError && (
                  <p className="text-[11px] text-red-600 font-bold tracking-wide" id="driver-form-error">
                    ⚠️ {formError}
                  </p>
                )}

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="flex-1 py-2.5 border border-neutral-250 text-neutral-700 hover:bg-neutral-50 text-xs font-bold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Details'}
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
