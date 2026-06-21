import React, { useState } from 'react';
import { Inquiry, Booking } from '../types';
import { SupabaseService, mapInquiryRowToBooking } from '../lib/supabase';
import { X, User, Phone, Car, MessageSquare, CheckCircle, Loader2, Link2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmBookingModalProps {
  inquiry: Inquiry;
  onClose: () => void;
  onConfirmComplete: (updatedInquiry: Inquiry, createdBooking: Booking) => void;
}

export default function ConfirmBookingModal({ inquiry, onClose, onConfirmComplete }: ConfirmBookingModalProps) {
  // Input fields state
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [bookingTime, setBookingTime] = useState('12:00 PM');
  
  // Logic states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [copiedLink, setCopiedLink] = useState<'driver' | 'customer' | null>(null);
  const [driverSent, setDriverSent] = useState(false);
  const [customerSent, setCustomerSent] = useState(false);

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic fields validation validation
    if (!driverName.trim() || !driverPhone.trim() || !vehicleNumber.trim() || !bookingTime.trim()) {
      setError('Please complete all driver and vehicle fields.');
      return;
    }

    setLoading(true);

    try {
      // 1. Generate unique random secure tokens
      const driverToken = 'drv_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
      const trackingToken = 'trk_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);

      console.log('[Confirm Booking] Saving details into the inquiry record:', inquiry.id);
      const updatedReq = `Scheduled Departure: ${bookingTime.trim()}${inquiry.additional_requirements ? '\n' + inquiry.additional_requirements : ''}`;
      
      const dbInquiry = await SupabaseService.confirmInquiry(
        inquiry.id,
        driverName.trim(),
        driverPhone.trim(),
        vehicleNumber.trim().toUpperCase(),
        driverToken,
        trackingToken,
        updatedReq
      );

      if (dbInquiry) {
        const dbBooking = mapInquiryRowToBooking(dbInquiry);
        if (dbBooking) {
          setCreatedBooking(dbBooking);
          setIsConfirmed(true);
          onConfirmComplete(dbInquiry, dbBooking);
        } else {
          setError('Mapping updated inquiry record failed.');
        }
      } else {
        setError('Failed to update inquiry record with driver/vehicle details. Please check network connection.');
      }
    } catch (err: any) {
      console.error('[Confirm Booking] Exception:', err);
      setError(err.message || 'An error occurred during booking confirmation.');
    } finally {
      setLoading(false);
    }
  };

  // Generate WhatsApp text message helper templates
  const makeDriverWhatsAppLink = () => {
    if (!createdBooking) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const driverLink = `${origin}?driver_token=${createdBooking.driver_token}`;

    const text = `New Trip Assigned

Customer: ${createdBooking.customer_name}
Phone: ${createdBooking.customer_phone}

Pickup:
${createdBooking.pickup_location}

Destination:
${createdBooking.destination_location}

Vehicle:
${createdBooking.vehicle_number}

Start Trip:
${driverLink}`;

    const sanitizedPhone = createdBooking.driver_phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(text)}`;
  };

  const makeCustomerWhatsAppLink = () => {
    if (!createdBooking) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const trackingLink = `${origin}?tracking_token=${createdBooking.tracking_token}`;

    const text = `Your booking has been confirmed.

Driver:
${createdBooking.driver_name}

Phone:
${createdBooking.driver_phone}

Vehicle:
${createdBooking.vehicle_number}

Track Vehicle:
${trackingLink}`;

    const sanitizedPhone = createdBooking.customer_phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(text)}`;
  };

  // Clipboard copy utilities for fallback or easy desktop management
  const copyToClipboard = (type: 'driver' | 'customer') => {
    if (!createdBooking) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = type === 'driver' 
      ? `${origin}?driver_token=${createdBooking.driver_token}` 
      : `${origin}?tracking_token=${createdBooking.tracking_token}`;

    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(type);
      setTimeout(() => setCopiedLink(null), 2000);
    });
  };

  return (
    <div id="booking-confirm-overlay" className="fixed inset-0 bg-neutral-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[9995] animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-3xl shadow-2xl border border-neutral-100 max-w-md w-full overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Title Banner */}
        <div className="bg-neutral-950 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block mb-0.5">
              Dispatch Workflow
            </span>
            <h3 className="text-base font-extrabold tracking-tight">
              {isConfirmed ? '✓ Booking Dispatched' : 'Confirm Passenger Run'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 rounded-full transition text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Inner Step Screens */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {!isConfirmed ? (
              // STEP 1: INPUT DRIVER DETAILS
              <motion.form
                key="step-input"
                onSubmit={handleConfirmSubmit}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                {/* General Customer Summary Details */}
                <div className="bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-200 text-xs text-neutral-600 space-y-1">
                  <p>Customer: <strong className="text-neutral-900">{inquiry.name}</strong> ({inquiry.phone})</p>
                  <p className="truncate">Route: <strong className="text-neutral-800">{(inquiry.pickup_location || 'Point A').substring(0, 30)}...</strong> → <strong className="text-neutral-800">{(inquiry.drop_location || 'Point B').substring(0, 30)}...</strong></p>
                </div>

                <div className="space-y-3.5">
                  <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Assign Service Personnel</h4>

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
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="w-full text-xs font-medium pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Driver Mobile Phone input */}
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Driver Mobile Number*</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 919876543210 (Country code first)"
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        className="w-full text-xs font-medium pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Vehicle License Plate input */}
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Vehicle Plate/Registration Number*</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                        <Car className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. KA-03-ME-2983"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        className="w-full text-xs font-medium pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Booking Departure Time Input */}
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Scheduled Departure Time*</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                        <span className="font-bold text-xs">⏰</span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 10:30 AM"
                        value={bookingTime}
                        onChange={(e) => setBookingTime(e.target.value)}
                        className="w-full text-xs font-medium pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-600 font-bold tracking-wide" id="modal-error-message">
                    ⚠️ {error}
                  </p>
                )}

                {/* Submissions Action Submit button */}
                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-bold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-grow py-3 bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Confirm Booking
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            ) : (
              // STEP 2: POST-CONFIRMATION ACTION HUB
              <motion.div
                key="step-complete"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5 text-center"
              >
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-[#10B981] border border-emerald-200">
                  <CheckCircle className="w-6 h-6 animate-pulse" />
                </div>
                
                <div>
                  <h4 className="text-sm font-bold text-neutral-950">Trip Registered Safely</h4>
                  <p className="text-xs text-neutral-500 font-sans mt-1">Please dispatch notifications to both Customer and Driver below.</p>
                </div>

                {/* Quick copy workspace */}
                <div className="space-y-2 border border-neutral-100 p-3 rounded-2xl bg-neutral-50 text-left">
                  {/* Driver link copy */}
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-neutral-200/60">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Driver Workspace Link</span>
                    <button 
                      onClick={() => copyToClipboard('driver')}
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      {copiedLink === 'driver' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedLink === 'driver' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Customer link copy */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider font-sans">Customer Tracking Link</span>
                    <button 
                      onClick={() => copyToClipboard('customer')}
                      className="flex items-center gap-1 text-[10px] font-bold text-[#10B981] hover:text-emerald-700 font-sans"
                    >
                      {copiedLink === 'customer' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedLink === 'customer' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* THE MANDATED WHATSAPP TRIGGERS */}
                <div className="space-y-3 pt-2">
                  <a
                    href={makeDriverWhatsAppLink()}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDriverSent(true);
                    }}
                    className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md active:scale-95"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-400 fill-amber-400 animate-bounce" />
                    Send Driver WhatsApp
                  </a>

                  <a
                    href={makeCustomerWhatsAppLink()}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomerSent(true);
                    }}
                    className="w-full py-3.5 bg-[#10B981] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md active:scale-95"
                  >
                    <MessageSquare className="w-4 h-4 fill-white shrink-0" />
                    Send Customer WhatsApp
                  </a>
                </div>

                {/* Live confirmation success tracking indicators */}
                {(driverSent || customerSent) && (
                  <div className="space-y-1.5 pt-1">
                    {customerSent && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 text-xs font-bold text-emerald-800 flex items-center justify-center gap-2 animate-fade-in">
                        <span>Customer Message Sent ✅</span>
                      </div>
                    )}
                    {driverSent && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 text-xs font-bold text-emerald-800 flex items-center justify-center gap-2 animate-fade-in">
                        <span>Driver Message Sent ✅</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition"
                  >
                    Done & Close
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
