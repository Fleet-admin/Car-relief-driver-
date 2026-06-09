/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Inquiry, InquiryStatus, ServiceType } from '../types';

// Read configuration from environment variables or local storage overrides
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
    (typeof window !== 'undefined' ? localStorage.getItem('override_supabase_url') : '') ||
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
    (typeof window !== 'undefined' ? localStorage.getItem('override_supabase_anon_key') : '') ||
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
    supabaseClient = createClient(config.url, config.anonKey);
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

  setOverrideCredentials(url: string, anonKey: string) {
    localStorage.setItem('override_supabase_url', url);
    localStorage.setItem('override_supabase_anon_key', anonKey);
    window.location.reload();
  },

  clearOverrideCredentials() {
    localStorage.removeItem('override_supabase_url');
    localStorage.removeItem('override_supabase_anon_key');
    window.location.reload();
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
};
