/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Inquiry, InquiryStatus, ServiceType, VehicleCategory } from '../types';

// Read configuration from environment variables
const getSupabaseConfig = () => {
  const metaEnv = (import.meta as any).env || {};
  
  // Safely get process.env if available, with fallbacks
  let processEnv: Record<string, string> = {};
  try {
    if (typeof process !== 'undefined' && process.env) {
      processEnv = process.env as any;
    }
  } catch (e) {
    // ignore
  }

  // Support VITE_, NEXT_PUBLIC_, and other standard Supabase env variable conventions
  const finalUrl = (
    metaEnv.VITE_SUPABASE_URL ||
    metaEnv.VITE_NEXT_PUBLIC_SUPABASE_URL ||
    metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
    processEnv.VITE_SUPABASE_URL ||
    processEnv.NEXT_PUBLIC_SUPABASE_URL ||
    processEnv.VITE_NEXT_PUBLIC_SUPABASE_URL ||
    processEnv.SUPABASE_URL ||
    ''
  ).trim();

  const finalKey = (
    metaEnv.VITE_SUPABASE_ANON_KEY ||
    metaEnv.VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    processEnv.VITE_SUPABASE_ANON_KEY ||
    processEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    processEnv.VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    processEnv.SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const isConfigured = finalUrl.length > 0 && finalKey.length > 0;

  // Mask sensitive database URL and Key details for secure production console verification
  const maskedUrl = finalUrl ? `${finalUrl.substring(0, 15)}...${finalUrl.substring(finalUrl.length - 4 || 0)}` : 'NOT_FOUND';
  const maskedKey = finalKey ? `${finalKey.substring(0, 8)}...${finalKey.substring(finalKey.length - 4 || 0)}` : 'NOT_FOUND';

  console.log('[Supabase Client Initialization Debug]:', {
    urlAvailable: !!finalUrl,
    urlMasked: maskedUrl,
    keyAvailable: !!finalKey,
    keyMasked: maskedKey,
    isConfigured
  });

  return {
    url: finalUrl,
    anonKey: finalKey,
    isConfigured,
  };
};

export const config = getSupabaseConfig();

let supabaseClient: SupabaseClient | null = null;
if (config.isConfigured) {
  try {
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    });
    console.log('[Supabase Service Success] Client initialized successfully.');
  } catch (error) {
    console.error('[Supabase Service Error] Failed to initialize Supabase client:', error);
  }
} else {
  console.warn('[Supabase Service Warning] Client not initialized. Missing environment configurations.');
}

// Memory/LocalStorage cache for local sandbox testing if Supabase is not connected yet
const LOCAL_STORAGE_KEY = 'car_driver_inquiries_v1';

const getLocalInquiries = (): Inquiry[] => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

const saveLocalInquiries = (inquiries: Inquiry[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(inquiries));
  // Dispatch a global event for immediate reactivity inside the browser tab
  window.dispatchEvent(new CustomEvent('supabase-realtime-inquiry', { detail: inquiries }));
};

export const SupabaseService = {
  isUsingFallback(): boolean {
    return !config.isConfigured || supabaseClient === null;
  },

  getCredentials(): { url: string; anonKey: string } {
    return {
      url: config.url,
      anonKey: config.anonKey,
    };
  },

  async queryInquiries(): Promise<Inquiry[]> {
    console.log('[Supabase Service] queryInquiries called.');
    if (supabaseClient) {
      try {
        console.log('[Supabase Service] Performing SELECT on public.inquiries...');
        const { data, error } = await supabaseClient
          .from('inquiries')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Supabase Service error] queryInquiries database error details:', error);
          throw error;
        }

        console.log(`[Supabase Service success] Fetch completed successfully. Received ${data?.length || 0} inquiry records.`);
        return (data || []) as Inquiry[];
      } catch (err: any) {
        console.error('[Supabase Service fetch failure] queryInquiries failed. Falling back to local state:', err);
        return getLocalInquiries();
      }
    }
    console.warn('[Supabase Service warning] Supabase client is not initialized. Using local memory storage fallback.');
    return getLocalInquiries();
  },

  async insertInquiry(inquiryData: Omit<Inquiry, 'id' | 'created_at' | 'status'>): Promise<Inquiry> {
    const newInquiry: Inquiry = {
      ...inquiryData,
      id: crypto.randomUUID(),
      status: 'New',
      created_at: new Date().toISOString(),
    };

    console.log('[Supabase Service] insertInquiry called with payload:', newInquiry);

    if (supabaseClient) {
      try {
        console.log('[Supabase Service] Performing INSERT into public.inquiries...');
        const { data, error } = await supabaseClient
          .from('inquiries')
          .insert([
            {
              id: newInquiry.id,
              name: newInquiry.name,
              phone: newInquiry.phone,
              service_type: newInquiry.service_type,
              pickup_location: newInquiry.pickup_location,
              pickup_latitude: newInquiry.pickup_latitude,
              pickup_longitude: newInquiry.pickup_longitude,
              drop_location: newInquiry.drop_location,
              drop_latitude: newInquiry.drop_latitude,
              drop_longitude: newInquiry.drop_longitude,
              travel_date: newInquiry.travel_date,
              additional_requirements: newInquiry.additional_requirements,
              status: newInquiry.status,
              vehicle_category: newInquiry.vehicle_category,
            }
          ])
          .select();

        if (error) {
          console.error('[Supabase Service error] insertInquiry database error details:', error);
          throw error;
        }

        if (data && data[0]) {
          console.log('[Supabase Service success] Record inserted successfully:', data[0]);
          return data[0] as Inquiry;
        }
      } catch (err: any) {
        console.error('[Supabase Service write failure] insertInquiry failed. Falling back to local state simulation:', err);
      }
    }

    // fallback simulation
    console.warn('[Supabase Service warning] Supabase client is not initialized or write failed. Falling back to local state.');
    const currentList = getLocalInquiries();
    const updated = [newInquiry, ...currentList];
    saveLocalInquiries(updated);
    return newInquiry;
  },

  async updateStatus(id: string, status: InquiryStatus): Promise<boolean> {
    console.log(`[Supabase Service] updateStatus called for ID: ${id}, status: ${status}`);
    if (supabaseClient) {
      try {
        console.log('[Supabase Service] Performing UPDATE on public.inquiries...');
        const { error } = await supabaseClient
          .from('inquiries')
          .update({ status })
          .eq('id', id);

        if (error) {
          console.error('[Supabase Service error] updateStatus database error details:', error);
          throw error;
        }

        console.log(`[Supabase Service success] Update status complete for ID: ${id}`);
        return true;
      } catch (err: any) {
        console.error('[Supabase Service failure] updateStatus failed:', err);
      }
    }

    console.warn('[Supabase Service warning] Supabase client not initialized or update failed. Updating local mock state.');
    const currentList = getLocalInquiries();
    const index = currentList.findIndex((item) => item.id === id);
    if (index !== -1) {
      currentList[index].status = status;
      saveLocalInquiries([...currentList]);
      return true;
    }
    return false;
  },

  async deleteInquiry(id: string): Promise<boolean> {
    console.log(`[Supabase Service] deleteInquiry called for ID: ${id}`);
    if (supabaseClient) {
      try {
        console.log('[Supabase Service] Performing DELETE on public.inquiries...');
        const { error } = await supabaseClient
          .from('inquiries')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('[Supabase Service error] deleteInquiry database error details:', error);
          throw error;
        }

        console.log(`[Supabase Service success] Deleted ID: ${id} successfully from database.`);
        return true;
      } catch (err: any) {
        console.error('[Supabase Service failure] deleteInquiry failed:', err);
      }
    }

    console.warn('[Supabase Service warning] Supabase client not initialized or delete failed. Updating local mock state.');
    const currentList = getLocalInquiries();
    const filtered = currentList.filter((item) => item.id !== id);
    saveLocalInquiries(filtered);
    return true;
  },

  /**
   * Listens to realtime events.
   * Leverages real Supabase realtime channels or falls back to our atomic window event router.
   */
  subscribeToInquiries(onEvent: (inquiry: Inquiry, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void): () => void {
    let activeChannel: any = null;

    if (supabaseClient) {
      try {
        activeChannel = supabaseClient
          .channel('inquiries-realtime-channel')
          .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'inquiries' },
              (payload) => {
                const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
                const nextRecord = (payload.new || payload.old) as Inquiry;
                if (nextRecord) {
                  onEvent(nextRecord, eventType);
                }
              }
          )
          .subscribe();
      } catch (err) {
        console.error('Supabase Realtime subscription error:', err);
      }
    }

    // fallback simulation event handler
    const localChangeHandler = (e: Event) => {
      const customEvent = e as CustomEvent<Inquiry[]>;
      // For fallback simulation, when a change is detected, we reload all or detect added
      // To simulate individual events, we trigger the callback.
      // We'll just trigger an INSERT event with the first element or direct reload
      const nextList = customEvent.detail;
      const prevListVal = localStorage.getItem('prev_car_driver_inquiries_ref');
      const prevList: Inquiry[] = prevListVal ? JSON.parse(prevListVal) : [];

      localStorage.setItem('prev_car_driver_inquiries_ref', JSON.stringify(nextList));

      if (nextList.length > prevList.length) {
        const added = nextList.find((item) => !prevList.some((p) => p.id === item.id));
        if (added) {
          onEvent(added, 'INSERT');
        }
      } else if (nextList.length < prevList.length) {
        // deleted
        onEvent({ id: 'any' } as Inquiry, 'DELETE');
      } else {
        // updated status
        const updated = nextList.find((item) => {
          const matched = prevList.find((p) => p.id === item.id);
          return matched && matched.status !== item.status;
        });
        if (updated) {
          onEvent(updated, 'UPDATE');
        }
      }
    };

    window.addEventListener('supabase-realtime-inquiry', localChangeHandler);

    return () => {
      if (activeChannel) {
        try {
          supabaseClient?.removeChannel(activeChannel);
        } catch (err) {
          console.error('Failed to cleanup Supabase channel', err);
        }
      }
      window.removeEventListener('supabase-realtime-inquiry', localChangeHandler);
    };
  },

  async getServiceFares(): Promise<Record<string, { base: number; rate: number }>> {
    const defaultConfigs: Record<string, { base: number; rate: number }> = {
      'Fleet Booking': { base: 50.00, rate: 15.00 },
      'Driver Relief': { base: 100.00, rate: 10.00 },
      'Outstation Trip': { base: 150.00, rate: 12.00 },
      'Wedding Booking': { base: 500.00, rate: 25.00 },
      'Custom Requirement': { base: 200.00, rate: 18.00 },
    };

    if (supabaseClient) {
      try {
        console.log('[Supabase Service] querySettings called for key: "service_fares" on settings table');
        const { data, error } = await supabaseClient
          .from('settings')
          .select('value')
          .eq('key', 'service_fares')
          .maybeSingle();

        if (error) {
          console.warn('[Supabase Service warning] Error fetching service_fares from settings table, trying system_settings fallback:', error);
          const { data: altData, error: altError } = await supabaseClient
            .from('system_settings')
            .select('value')
            .eq('key', 'service_fares')
            .maybeSingle();

          if (altError) {
            console.error('[Supabase Service error] Error fetching service_fares from system_settings fallback:', altError);
          } else if (altData && altData.value) {
            console.log('[Supabase Service success] Loaded service_fares from fallback system_settings table', altData.value);
            const parsed = typeof altData.value === 'string' ? JSON.parse(altData.value) : altData.value;
            return { ...defaultConfigs, ...parsed };
          }
        } else if (data && data.value) {
          console.log('[Supabase Service success] Loaded service_fares from settings table', data.value);
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          return { ...defaultConfigs, ...parsed };
        }
      } catch (err) {
        console.warn('[Supabase Service warn] Exception fetching service_fares:', err);
      }
    }

    // Fallback to localStorage or default
    try {
      const saved = localStorage.getItem('admin_service_fares');
      if (saved) {
        return { ...defaultConfigs, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return defaultConfigs;
  },

  async saveServiceFares(fares: Record<string, { base: number; rate: number }>): Promise<boolean> {
    // 1. Save to local storage for quick offline / single sandbox caching
    try {
      localStorage.setItem('admin_service_fares', JSON.stringify(fares));
      // Dispatch custom event for real-time reactivity in custom UI components
      window.dispatchEvent(new CustomEvent('supabase-settings-updated', { detail: fares }));
    } catch (e) {
      console.error('Failed to save service_fares locally:', e);
    }

    // 2. Save to Supabase settings table if configured
    if (supabaseClient) {
      try {
        console.log('[Supabase Service] upserting to settings table: key: "service_fares"');
        const { error } = await supabaseClient
          .from('settings')
          .upsert({
            key: 'service_fares',
            value: fares,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });

        if (error) {
          console.warn('[Supabase Service warning] Failed to upsert service_fares to settings table, trying system_settings fallback:', error);
          const { error: altError } = await supabaseClient
            .from('system_settings')
            .upsert({
              key: 'service_fares',
              value: fares,
              updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

          if (altError) {
            console.error('[Supabase Service error] Failed to upsert service_fares to system_settings table fallback either:', altError);
            throw altError;
          }
        }

        console.log('[Supabase Service success] Service fares saved successfully.');
        return true;
      } catch (err: any) {
        console.error('[Supabase Service fail] saveServiceFares exception:', err);
        return false;
      }
    }
    return true;
  },

  async getVehicleCategories(): Promise<VehicleCategory[]> {
    if (supabaseClient) {
      try {
        console.log('[Supabase Service] query fetch called for table "vehicle_categories"');
        const { data, error } = await supabaseClient
          .from('vehicle_categories')
          .select('*')
          .order('name', { ascending: true });

        if (error) {
          console.error('[Supabase Service error] Error querying vehicle_categories table:', error);
          throw error;
        }

        if (data) {
          console.log('[Supabase Service Debug] Data received from Supabase', data);
          return data as VehicleCategory[];
        }
      } catch (err: any) {
        console.error('[Supabase Service Warn] Exception querying vehicle_categories table:', err);
        throw err;
      }
    } else {
      console.warn('[Supabase Service warning] Supabase client is not initialized.');
    }

    // fallback when Supabase connection is offline/local mock context
    const defaultConfigs: VehicleCategory[] = [
      { id: 'hatchback', name: 'Hatchback', base_fare: 100.00, per_km_rate: 10.00, minimum_fare: 100.00, active: true },
      { id: 'sedan', name: 'Sedan', base_fare: 150.00, per_km_rate: 12.00, minimum_fare: 150.00, active: true },
      { id: 'premium-sedan', name: 'Premium Sedan', base_fare: 250.00, per_km_rate: 15.00, minimum_fare: 250.00, active: true },
      { id: 'suv', name: 'SUV', base_fare: 200.00, per_km_rate: 15.00, minimum_fare: 200.00, active: true },
      { id: 'premium-suv', name: 'Premium SUV', base_fare: 350.00, per_km_rate: 20.00, minimum_fare: 350.00, active: true },
      { id: 'innova-mpv', name: 'Innova / MPV Tier', base_fare: 250.00, per_km_rate: 16.00, minimum_fare: 250.00, active: true },
      { id: 'tempo-traveller', name: 'Tempo Traveller Cruiser', base_fare: 500.00, per_km_rate: 25.00, minimum_fare: 500.00, active: true },
    ];
    return defaultConfigs;
  },

  async saveVehicleCategories(categories: VehicleCategory[]): Promise<{ success: boolean; error?: string }> {
    if (supabaseClient) {
      try {
        console.log('[Supabase Service Debug] Saving vehicle categories to public.vehicle_categories table...');
        console.log('[Supabase Service Debug] Raw categories input:', categories);
        
        const payload = categories.map(cat => ({
          id: cat.id || crypto.randomUUID(),
          name: cat.name,
          base_fare: cat.base_fare,
          per_km_rate: cat.per_km_rate,
          minimum_fare: cat.minimum_fare,
          active: cat.active,
          updated_at: new Date().toISOString()
        }));

        console.log('[Supabase Service Debug] Formatted payload for upsert operation:', payload);

        // Core Fix: Use 'id' (the primary key with unique constraint) instead of 'name' as conflict target.
        // If 'name' doesn't have a unique constraint or unique index in the table, Postgres throws on ON CONFLICT.
        const { data, error } = await supabaseClient
          .from('vehicle_categories')
          .upsert(payload, { onConflict: 'id' });

        if (error) {
          console.error('[Supabase Service error] Failed to upsert vehicle categories in database:', error);
          return { success: false, error: `${error.message || 'Unknown database error'} (Code: ${error.code || 'N/A'})` };
        }

        console.log('[Supabase Service success] Saved vehicle categories to database successfully. Data response:', data);
      } catch (err: any) {
        console.error('[Supabase Service fail] saveVehicleCategories exception during database write:', err);
        return { success: false, error: err.message || 'Exception during database write' };
      }
    } else {
      console.warn('[Supabase Service warning] Supabase client is not initialized. Saving to localStorage fallback only.');
    }

    // Save to localStorage and dispatch update events after/if Supabase sync succeeds
    try {
      console.log('[Supabase Service Cache] Updating local storage cache with saved vehicle categories:', categories);
      localStorage.setItem('admin_vehicle_categories', JSON.stringify(categories));
      window.dispatchEvent(new CustomEvent('supabase-vehicle-categories-updated', { detail: categories }));
    } catch (e: any) {
      console.error('Failed to save vehicle categories locally after Supabase sync:', e);
      return { success: false, error: `Saved to database, but failed local storage cache update: ${e.message}` };
    }

    return { success: true };
  },
};
