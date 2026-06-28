import React, { useState, useEffect } from 'react';
import { Vehicle, VehicleCategory } from '../types';
import { SupabaseService } from '../lib/supabase';
import { 
  Car, Tag, Layers, Search, Plus, Edit2, Trash2, 
  Check, X, Loader2, Image as ImageIcon, Upload 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VehicleManagementProps {
  onNotify: (msg: string) => void;
}

export default function VehicleManagement({ onNotify }: VehicleManagementProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal / Form state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [photo, setPhoto] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  
  // Validation / Error state
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vehiclesData, categoriesData] = await Promise.all([
        SupabaseService.getVehicles(),
        SupabaseService.getVehicleCategories()
      ]);
      setVehicles(vehiclesData);
      setCategories(categoriesData);
      
      if (categoriesData.length > 0) {
        setCategoryId(categoriesData[0].name || categoriesData[0].id);
      }
    } catch (err) {
      console.error('Failed to load vehicles data:', err);
      onNotify('Failed to retrieve vehicle inventory records. Using fallback.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingVehicle(null);
    setVehicleNumber('');
    if (categories.length > 0) {
      setCategoryId(categories[0].name || categories[0].id);
    } else {
      setCategoryId('');
    }
    setVehicleModel('');
    setPhoto('');
    setStatus('Active');
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleNumber(vehicle.vehicle_number);
    setCategoryId(vehicle.category_id);
    setVehicleModel(vehicle.vehicle_model || '');
    setPhoto(vehicle.photo || '');
    setStatus(vehicle.status);
    setFormError(null);
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!vehicleNumber.trim()) {
      setFormError('Vehicle registration number is required.');
      return;
    }
    if (!categoryId) {
      setFormError('Please select a valid vehicle category.');
      return;
    }

    // Prevent duplicate vehicle registration number
    const isDuplicate = vehicles.some(v => 
      v.vehicle_number.trim().toUpperCase() === vehicleNumber.trim().toUpperCase() && 
      (!editingVehicle || v.id !== editingVehicle.id)
    );
    if (isDuplicate) {
      setFormError('A vehicle with this registration number already exists.');
      return;
    }

    setSaving(true);
    try {
      let updatedVehiclesList: Vehicle[];
      if (editingVehicle) {
        const updated: Vehicle = {
          ...editingVehicle,
          vehicle_number: vehicleNumber.trim().toUpperCase(),
          category_id: categoryId,
          vehicle_model: vehicleModel.trim() || null,
          photo: photo.trim() || null,
          status,
          updated_at: new Date().toISOString()
        };
        updatedVehiclesList = vehicles.map(v => v.id === editingVehicle.id ? updated : v);
        onNotify(`Successfully updated vehicle: ${vehicleNumber.trim().toUpperCase()}`);
      } else {
        const newVehicle: Vehicle = {
          id: 'veh_' + Math.random().toString(36).substring(2, 11),
          vehicle_number: vehicleNumber.trim().toUpperCase(),
          category_id: categoryId,
          vehicle_model: vehicleModel.trim() || null,
          photo: photo.trim() || null,
          status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        updatedVehiclesList = [...vehicles, newVehicle];
        onNotify(`Successfully added vehicle: ${vehicleNumber.trim().toUpperCase()}`);
      }

      await SupabaseService.saveVehicles(updatedVehiclesList);
      setVehicles(updatedVehiclesList);
      setShowFormModal(false);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string, vehicleNo: string) => {
    if (!window.confirm(`Are you absolutely sure you want to permanently delete vehicle ${vehicleNo}?`)) {
      return;
    }
    try {
      const updatedList = vehicles.filter(v => v.id !== vehicleId);
      await SupabaseService.saveVehicles(updatedList);
      setVehicles(updatedList);
      onNotify(`Vehicle ${vehicleNo} has been deleted.`);
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
      onNotify('Failed to delete vehicle.');
    }
  };

  const toggleVehicleStatus = async (vehicle: Vehicle) => {
    const nextStatus = vehicle.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const updatedList = vehicles.map(v => v.id === vehicle.id ? {
        ...v,
        status: nextStatus as 'Active' | 'Inactive',
        updated_at: new Date().toISOString()
      } : v);
      await SupabaseService.saveVehicles(updatedList);
      setVehicles(updatedList);
      onNotify(`Vehicle ${vehicle.vehicle_number} is now ${nextStatus}.`);
    } catch (err) {
      console.error('Failed to toggle status:', err);
      onNotify('Failed to update vehicle status.');
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.vehicle_model && v.vehicle_model.toLowerCase().includes(searchQuery.toLowerCase())) ||
    v.category_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="vehicles-management-page" className="space-y-6">
      {/* Action Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-neutral-950">Vehicles Fleet</h2>
          <p className="text-xs text-neutral-500 font-sans mt-0.5">Register, manage, and audit fleet vehicles across service categories.</p>
        </div>
        <button
          onClick={openAddModal}
          id="btn-add-vehicle"
          disabled={categories.length === 0}
          className="bg-neutral-950 hover:bg-neutral-800 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md shrink-0"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          Add Vehicle
        </button>
      </div>

      {categories.length === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-sans text-amber-800 flex items-center gap-3">
          <span>⚠️ <strong>Notice:</strong> Please add at least one vehicle category inside the "Vehicle Categories" manager before registering new active fleet vehicles.</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3 shadow-sm">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by license plate, category, or model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-medium pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition"
          />
        </div>
      </div>

      {/* Vehicles Fleet List */}
      {loading ? (
        <div className="py-24 text-center flex flex-col justify-center items-center gap-3 bg-white border border-neutral-200 rounded-3xl shadow-sm">
          <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
          <p className="text-xs text-neutral-500 font-sans">Compiling registered fleet specifications...</p>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="py-20 text-center flex flex-col justify-center items-center px-6 bg-white border border-neutral-200 rounded-3xl shadow-sm">
          <div className="w-14 h-14 bg-neutral-50 text-neutral-400 rounded-full flex items-center justify-center mb-4 border border-neutral-150">
            <Car className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-neutral-900 tracking-tight">No Fleet Vehicles found</h4>
          <p className="text-xs text-neutral-500 max-w-xs mt-1 mx-auto font-sans leading-relaxed">
            {searchQuery ? 'No registered vehicles matched your query.' : 'Register active fleet vehicles to enable easy driver and dispatch allocations.'}
          </p>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden" id="vehicles-desktop-table-wrapper">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-150 text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                  <th className="px-6 py-4">Vehicle Details</th>
                  <th className="px-6 py-4">Model Specs</th>
                  <th className="px-6 py-4">Service Category</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
                {filteredVehicles.map(v => (
                  <tr key={v.id} className="hover:bg-neutral-50/50 transition duration-150">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                          {v.photo ? (
                            <img src={v.photo} alt={v.vehicle_number} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            <Car className="w-4 h-4 text-neutral-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-mono font-extrabold text-neutral-950 uppercase tracking-wide text-xs">{v.vehicle_number}</div>
                          <div className="text-[10px] text-neutral-400 font-mono font-semibold uppercase mt-0.5">Ref: {v.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-neutral-800">
                      {v.vehicle_model || <span className="text-neutral-400 font-sans italic font-normal">Not Specified</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-800 text-[10px] font-bold px-2.5 py-1 rounded-md border border-neutral-200 uppercase tracking-wider font-sans">
                        <Layers className="w-3 h-3 text-neutral-400" />
                        {v.category_id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleVehicleStatus(v)}
                        className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                          v.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-850 border-emerald-200/60 hover:bg-emerald-100'
                            : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                        {v.status}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(v)}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors"
                          title="Edit Vehicle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(v.id, v.vehicle_number)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-600 transition-colors"
                          title="Delete Vehicle"
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
          <div className="grid grid-cols-1 gap-3.5 md:hidden" id="vehicles-mobile-stacked-cards">
            {filteredVehicles.map(v => (
              <div key={v.id} className="bg-white border border-neutral-250 rounded-2xl p-4 space-y-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                      {v.photo ? (
                        <img src={v.photo} alt={v.vehicle_number} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <Car className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-mono font-extrabold text-neutral-950 uppercase text-xs tracking-wide">{v.vehicle_number}</h4>
                      <p className="text-[9px] text-neutral-400 font-mono mt-0.5 font-bold uppercase">Ref: {v.id}</p>
                    </div>
                  </div>
                  
                  {/* Status toggle badge */}
                  <button
                    onClick={() => toggleVehicleStatus(v)}
                    className={`inline-flex items-center gap-1.5 text-[9px] font-extrabold px-2 py-0.5 rounded-full border transition-colors ${
                      v.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-neutral-50 text-neutral-500 border-neutral-200'
                    }`}
                  >
                    <span className={`w-1 h-1 rounded-full ${v.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                    {v.status}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-150 space-y-0.5">
                    <span className="block text-[9px] text-neutral-400 uppercase font-bold tracking-wider leading-none">Model / Name</span>
                    <strong className="text-neutral-900 block font-semibold truncate">
                      {v.vehicle_model || 'Not Specified'}
                    </strong>
                  </div>
                  <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-150 space-y-0.5">
                    <span className="block text-[9px] text-neutral-400 uppercase font-bold tracking-wider leading-none">Service Category</span>
                    <strong className="text-neutral-900 block font-semibold uppercase truncate">
                      {v.category_id}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
                  <button
                    onClick={() => openEditModal(v)}
                    className="px-3 py-1.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteVehicle(v.id, v.vehicle_number)}
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

      {/* ADD / EDIT VEHICLE DIALOG MODAL */}
      <AnimatePresence>
        {showFormModal && (
          <div id="vehicle-form-overlay" className="fixed inset-0 bg-neutral-900/85 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
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
                    {editingVehicle ? 'Edit Vehicle Specs' : 'Register Fleet Vehicle'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1 hover:bg-neutral-800 rounded-full transition text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-5 space-y-4 font-sans">
                {/* Vehicle number plate input */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Registration Plate Number*</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                      <Tag className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. KA-03-ME-2983"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      className="w-full text-xs font-bold pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition font-mono uppercase"
                    />
                  </div>
                </div>

                {/* Category dropdown Selection */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1 font-sans">Service Category ID*</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                      <Layers className="w-4 h-4" />
                    </div>
                    <select
                      required
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full text-xs font-bold pl-10 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition uppercase appearance-none"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.name || c.id}>
                          {c.name || c.id}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-neutral-400">
                      <span className="text-[10px]">▼</span>
                    </div>
                  </div>
                </div>

                {/* Model Input */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Vehicle Model / Name (Optional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                      <Car className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Toyota Innova Hycross"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition"
                    />
                  </div>
                </div>

                {/* Photo link input */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Vehicle Image (URL or Local Upload)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="Paste image URL or upload..."
                        value={photo}
                        onChange={(e) => setPhoto(e.target.value)}
                        className="w-full text-xs font-medium pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 outline-none transition"
                      />
                    </div>
                    <label className="px-3 py-2.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xl text-neutral-700 text-xs font-extrabold font-sans cursor-pointer transition shrink-0 flex items-center gap-1.5 select-none">
                      <Upload className="w-4 h-4" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              setPhoto(base64);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {photo && (
                    <div className="mt-2.5 flex items-center gap-3 bg-neutral-50 border border-neutral-150 p-2.5 rounded-xl max-w-xs">
                      <span className="text-[9px] text-neutral-400 uppercase font-bold shrink-0">Preview:</span>
                      <img src={photo} alt="Vehicle preview" referrerPolicy="no-referrer" className="h-8 object-contain rounded" />
                      <button 
                        type="button" 
                        onClick={() => setPhoto('')} 
                        className="text-red-500 hover:text-red-700 text-[10px] font-bold ml-auto"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Status selection buttons */}
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
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('Inactive')}
                      className={`py-2 text-xs font-bold rounded-xl transition border flex items-center justify-center gap-1.5 ${
                        status === 'Inactive'
                          ? 'bg-neutral-50 text-neutral-650 border-neutral-300'
                          : 'bg-neutral-50 text-neutral-500 border-neutral-250'
                      }`}
                    >
                      <X className="w-3.5 h-3.5 text-red-500" />
                      Inactive
                    </button>
                  </div>
                </div>

                {formError && (
                  <p className="text-[11px] text-red-600 font-bold tracking-wide" id="vehicle-form-error">
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
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Specs'}
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
