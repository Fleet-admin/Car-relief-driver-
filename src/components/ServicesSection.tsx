/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Car, ShieldCheck, MapPin, Sparkles, Settings, ArrowRight, Truck } from 'lucide-react';
import { ServiceType } from '../types';

interface ServiceItem {
  key: ServiceType;
  title: string;
  icon: React.ComponentType<any>;
  description: string;
  examples: string[];
}

interface ServicesSectionProps {
  onSelectService: (service: ServiceType) => void;
}

export default function ServicesSection({ onSelectService }: ServicesSectionProps) {
  const services: ServiceItem[] = [
    {
      key: 'Fleet Booking',
      title: 'Car Booking Services',
      icon: Car,
      description: 'Premium on-demand corporate fleets and individual chauffeur vehicles for clean, timely, professional transits.',
      examples: ['Corporate employee commutes', 'Inter-office shuttles', 'Airport VIP transfers', 'Daily vehicle dispatches'],
    },
    {
      key: 'Driver Relief Services',
      title: 'Driver Relief Services',
      icon: ShieldCheck,
      description: 'Need a backup chauffeur or replacement driver? Elite, vetted relief drivers deployed instantly for your security.',
      examples: ['Temporary driver placements', 'Emergency replacement needs', 'Long-distance cross-state drivers'],
    },
    {
      key: 'Outstation Trip',
      title: 'Outstation Trips',
      icon: MapPin,
      description: 'Comfortable cross-city tours and highway runs with flat rates, experienced drivers, and safe returns.',
      examples: ['Weekend family travel plans', 'Inter-state meetings', 'Continuous multi-day tourism transits'],
    },
    {
      key: 'Wedding Plan',
      title: 'Wedding & Event Bookings',
      icon: Sparkles,
      description: 'Uncompromising grand transportation logs for special lifecycle moments, VIP guests, and grand entries.',
      examples: ['Luxury bridal cars', 'Group guest luxury coaches', 'Fast-tracked VIP service transport'],
    },
    {
      key: 'Premium Logistics Temporary',
      title: 'Premium Logistics Temporary',
      icon: Truck,
      description: 'Scale your temporal logistics and courier delivery solutions safely with secure, vetted courier escorts or high-value cargo drivers.',
      examples: ['Valuable cargo escort transits', 'Sensitive legal document couriers', 'Peak seasonal distribution help'],
    },
    {
      key: 'Custom Requirement',
      title: 'Custom Requirements',
      icon: Settings,
      description: 'Specific contract requirements, complex multi-vehicle routes, or enterprise-wide monthly fleets.',
      examples: ['Monthly corporate logistics', 'Dedicated contract support', 'Tailored courier and safety transits'],
    },
  ];

  return (
    <section className="py-12" id="services-section">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#10B981] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
          Tailored Offerings
        </span>
        <h2 className="text-3xl font-bold text-neutral-900 tracking-tight mt-3">
          Our Specializations & Capabilities
        </h2>
        <p className="text-sm text-neutral-500 mt-2 font-sans max-w-2xl mx-auto">
          We combine a vetted chauffeur roster with a modern multi-class vehicle fleet to engineer complete logistics solutions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((svc) => {
          const IconComponent = svc.icon;
          return (
            <div
              key={svc.key}
              id={`service-card-${svc.key.replace(/\s+/g, '-').toLowerCase()}`}
              className="bg-white border border-neutral-150 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group hover:-translate-y-1"
            >
              <div className="p-3 bg-neutral-900 text-white rounded-xl inline-block w-fit mb-5 group-hover:bg-emerald-600 transition-colors">
                <IconComponent className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-neutral-950 tracking-tight">{svc.title}</h3>
              <p className="text-xs text-neutral-500 mt-2 font-sans leading-relaxed flex-grow">
                {svc.description}
              </p>

              {/* Bullet Examples */}
              <div className="mt-4 pt-4 border-t border-neutral-100 space-y-2">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Typical Segments</p>
                <ul className="space-y-1.5">
                  {svc.examples.map((ex, idx) => (
                    <li key={idx} className="text-xs text-neutral-750 flex items-center gap-1.5 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <button
                type="button"
                id={`btn-service-action-${svc.key.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => onSelectService(svc.key)}
                className="mt-6 w-full py-2 px-4 bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-1.5 transition-all"
              >
                Request Quote
                <ArrowRight className="w-3.5 h-3.5 font-bold" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
