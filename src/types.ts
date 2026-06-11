/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type InquiryStatus = 'New' | 'Contacted' | 'Confirmed' | 'Closed';

export type ServiceType =
  | 'Fleet Booking'
  | 'Driver Relief'
  | 'Driver Relief Services'
  | 'Outstation Trip'
  | 'Wedding Booking'
  | 'Wedding Plan'
  | 'Premium Logistics Temporary'
  | 'Custom Requirement';

export interface Inquiry {
  id: string;
  name: string;
  phone: string;
  service_type: ServiceType;
  pickup_location: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  drop_location: string | null;
  drop_latitude: number | null;
  drop_longitude: number | null;
  travel_date: string;
  additional_requirements: string | null;
  status: InquiryStatus;
  created_at: string;
  vehicle_category?: string | null;
}

export interface VehicleCategory {
  id?: string;
  name: string;
  base_fare: number;
  per_km_rate: number;
  minimum_fare: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardMetrics {
  total: number;
  new: number;
  contacted: number;
  confirmed: number;
  closed: number;
}
