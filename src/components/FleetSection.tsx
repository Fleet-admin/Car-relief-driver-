/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Users, Briefcase, Shovel, KeyRound, ShieldAlert } from 'lucide-react';

interface FleetVehicle {
  category: string;
  capacity: string;
  luggage: string;
  description: string;
  fuelType: string;
  bestFor: string;
  bgGradient: string;
}

export default function FleetSection() {
  const fleetCategories: FleetVehicle[] = [
    {
      category: 'Premium Sedan',
      capacity: '4 Passengers',
      luggage: '3 Standard Bags',
      description: 'Elegant, low-profile executive sedans featuring premium leather upholstery, spacious legroom, and whisper-quiet cabin insulation. Designed for seamless client transits.',
      fuelType: 'Hybrid / Petrol',
      bestFor: 'Executive airport transfers, clean city commutes, and individual premium trips.',
      bgGradient: 'from-neutral-700 to-neutral-900',
    },
    {
      category: 'Luxury SUV',
      capacity: '6 Passengers',
      luggage: '5 Medium Bags',
      description: 'Commanding high-clearance off-roaders with adaptive suspension, state-of-the-art navigation overlays, and robust luggage utility. Built to dominate highways with superb safety.',
      fuelType: 'Diesel / Petrol',
      bestFor: 'Multi-day outstation road trips, rugged long-distance driving, and VIP site appraisals.',
      bgGradient: 'from-[#111827] to-[#1F2937]',
    },
    {
      category: 'Innova / MPV Tier',
      capacity: '7 Passengers',
      luggage: '6 Large Packages',
      description: 'The industry-standard gold choice for corporate groups and family expeditions. Dual zone rapid auto-AC, split-row folding armrests, and exceptionally high travel reliability.',
      fuelType: 'Clean Diesel',
      bestFor: 'Family weekend stays, corporate employee shuttle rosters, and weeding event logistics.',
      bgGradient: 'from-blue-900 to-neutral-900',
    },
    {
      category: 'Tempo Traveller Cruiser',
      capacity: '12 - 20 Passengers',
      luggage: '12+ Heavy Bags',
      description: 'Commanding massive cabin volume with customizable individual high-back recliner seats, premium sound system, on-board charging docks, and dedicated overhead loading shelves.',
      fuelType: 'Turbocharged Diesel',
      bestFor: 'Industrial staff transits, foreign tourism tours, and complete wedding entourage coordination.',
      bgGradient: 'from-[#0F172A] to-[#1E293B]',
    },
  ];

  return (
    <section className="py-12" id="fleet-section">
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
          Static Showcase
        </span>
        <h2 className="text-3xl font-bold text-neutral-900 tracking-tight mt-3">
          Our Standard Fleet Class Categories
        </h2>
        <p className="text-sm text-neutral-500 mt-2 font-sans max-w-xl mx-auto">
          We maintain rigorous vehicle inspection guidelines. Every category undergoes comprehensive bi-weekly structural checks.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {fleetCategories.map((car, idx) => (
          <div
            key={idx}
            id={`fleet-card-${car.category.toLowerCase().replace(/\s+/g, '-')}`}
            className="border border-neutral-200 rounded-2xl overflow-hidden shadow-sm bg-white hover:shadow-md transition-all flex flex-col md:flex-row"
          >
            {/* Left Aesthetic Vehicle Visual Representation Block */}
            <div className={`md:w-2/5 bg-gradient-to-br ${car.bgGradient} p-6 flex flex-col justify-between text-white relative shrink-0 min-h-[180px]`}>
              <div>
                <span className="text-[9px] uppercase font-bold text-neutral-300 tracking-widest border border-neutral-700/60 px-2 py-0.5 rounded backdrop-blur-sm">
                  Active Operational Grade
                </span>
                <h4 className="text-xl font-bold text-white tracking-tight mt-3">{car.category}</h4>
              </div>

              <div className="space-y-2 mt-auto">
                <div className="flex items-center gap-1.5 text-xs text-neutral-200 font-sans">
                  <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{car.capacity}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-neutral-200 font-sans">
                  <Briefcase className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{car.luggage}</span>
                </div>
              </div>

              {/* Graphical Car Backdrop Element */}
              <div className="absolute right-0 bottom-0 translate-y-1/4 translate-x-1/4 opacity-15">
                <svg className="w-48 h-48 text-white fill-current" viewBox="0 0 24 24">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1-1.5 1zm11 0c-.83 0-1.5-.67-1.5-1s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1-1.5 1zM5 10l1.5-4.5h11L19 10H5z" />
                </svg>
              </div>
            </div>

            {/* Right Information Block */}
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <p className="text-xs text-neutral-500 font-sans leading-relaxed">
                  {car.description}
                </p>

                <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-2 gap-4 text-xs font-sans">
                  <div>
                    <span className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Engine Class</span>
                    <span className="font-semibold text-neutral-800">{car.fuelType}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Key Target</span>
                    <span className="font-semibold text-neutral-800">Regular Fleet</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 p-2 bg-neutral-50 border border-neutral-100 rounded-lg text-[11px] text-neutral-600 font-sans">
                <strong className="text-neutral-900 block font-semibold mb-0.5">Optimized Application:</strong>
                {car.bestFor}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
