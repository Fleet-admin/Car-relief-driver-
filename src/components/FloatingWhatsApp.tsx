/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Phone, MessageCircle, X, ShieldAlert } from 'lucide-react';

interface FloatingWhatsAppProps {
  phoneNumber: string;
  whatsappNumber: string;
  email: string;
}

export default function FloatingWhatsApp({
  phoneNumber,
  whatsappNumber,
  email,
}: FloatingWhatsAppProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Clean WhatsApp formatter
  const formattedWhatsapp = whatsappNumber.replace(/[^0-9]/g, '');

  return (
    <div className="fixed bottom-6 right-6 z-[9999]" id="floating-support-container">
      {/* Expanded Support Dialog Card */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-white border border-neutral-200 rounded-2xl shadow-2xl p-5 mb-2 overflow-hidden animate-in fade-in slide-in-from-bottom-[10px] duration-200">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-50 rounded-full -z-10" />

          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[9px] uppercase font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full inline-block">
                Operators Online
              </span>
              <h4 className="text-sm font-bold text-neutral-900 mt-1">Car & Driver Support Hotline</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              id="btn-close-support-dialog"
              className="p-1 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-900 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-neutral-500 font-sans leading-relaxed mb-4">
            Need urgent assistance, emergency replacement driver relief, or want to update a submitted quote reference immediately? Connect with our 24/7 central desk.
          </p>

          {/* Hotline Channels */}
          <div className="space-y-2">
            <a
              href={`tel:${phoneNumber}`}
              id="btn-support-call-now"
              className="flex items-center gap-3 p-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl transition shadow-sm text-xs font-semibold"
            >
              <div className="p-2 bg-neutral-800 rounded-lg">
                <Phone className="w-4 h-4 text-amber-400 fill-amber-400" />
              </div>
              <div className="text-left">
                <span className="block text-[10px] font-medium text-neutral-400">Direct Service Call</span>
                <span className="font-bold">{phoneNumber}</span>
              </div>
            </a>

            <a
              href={`https://wa.me/${formattedWhatsapp}?text=Hello,%20I'm%20inquiring%20about%20your%20Car%20and%20Driver%20Relief%20Services.`}
              target="_blank"
              rel="noreferrer"
              id="btn-support-whatsapp-now"
              className="flex items-center gap-3 p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition shadow-sm text-xs font-semibold"
            >
              <div className="p-2 bg-emerald-700 rounded-lg">
                <svg className="w-4 h-4 fill-white text-white" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.022-.015-.045-.03-.067-.045-.083-.053-.167-.105-.252-.158-.291-.18-.588-.363-.89-.533-.149-.084-.31-.13-.473-.134a1.03 1.03 0 0 0-.742.316c-.143.155-.286.31-.428.465l-.337.367c-.122.115-.284.168-.445.143a3.86 3.86 0 0 1-1.354-.51 5.92 5.92 0 0 1-1.468-1.107 5.8 5.8 0 0 1-.954-1.399c-.1-.19-.074-.424.062-.587l.383-.437c.123-.139.245-.278.368-.418.172-.194.24-.457.185-.716a5.7 5.7 0 0 0-.585-1.579c-.1-.2-.25-.37-.44-.49a.9.9 0 0 0-.73-.08c-.24.08-.47.21-.67.39l-.49.49c-.52.52-.77 1.25-.66 1.97.23 1.54.91 2.97 1.93 4.12a10.02 10.02 0 0 0 4.7 3.03l.36.11a3.02 3.02 0 0 0 1.95-.2c.28-.15.53-.35.73-.6l.44-.54c.26-.32.32-.76.15-1.12zM12 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.88 5.83l-1.25 4.54 4.67-1.22l.54.29C9.39 21.78 10.66 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.92 0-3.7-.56-5.21-1.51l-.37-.23-2.73.71.73-2.65-.25-.4A7.95 7.95 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
                </svg>
              </div>
              <div className="text-left">
                <span className="block text-[10px] font-medium text-emerald-250">WhatsApp Active Chat</span>
                <span className="font-bold">{whatsappNumber}</span>
              </div>
            </a>
          </div>

          {/* Email Footer Channel */}
          <div className="mt-4 pt-3 border-t border-neutral-100 text-center">
            <span className="text-[10px] text-neutral-400 font-sans">
              Email inquiries: <span className="font-semibold text-neutral-700">{email}</span>
            </span>
          </div>
        </div>
      )}

      {/* Main Bottom Floating Bubble Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        id="btn-toggle-floating-support"
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition duration-300 transform hover:scale-105 active:scale-95 ${
          isOpen ? 'bg-neutral-900 border border-neutral-850' : 'bg-emerald-500 hover:bg-emerald-600'
        }`}
        title="Contact Carriage & Driver Dispatch"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white animate-spin-once" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-7 h-7 text-white fill-white" />
            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white animate-pulse" />
          </div>
        )}
      </button>
    </div>
  );
}
