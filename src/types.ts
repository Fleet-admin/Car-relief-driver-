/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type InquiryStatus = 'New' | 'Contacted' | 'Confirmed' | 'Closed';

export type ServiceType =
  | 'Fleet Booking'
  | 'Driver Relief'
  | 'Outstation Trip'
  | 'Wedding Booking'
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

export interface DashboardMetrics {
  total: number;
  new: number;
  contacted: number;
  confirmed: number;
  closed: number;
}
