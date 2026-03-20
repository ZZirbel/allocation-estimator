export type ResourceLocation = 'onshore' | 'offshore';

export interface Role {
  id: string;
  title: string;
  hourlyRate: number;
  sellRate?: number;
  location: ResourceLocation;
}

export interface RoleLibraryEntry {
  id: string;
  title: string;
  defaultRate: number;
  defaultSellRate?: number;
  offshoreRate?: number;
  offshoreSellRate?: number;
}

export interface RateCard {
  id: string;
  name: string;
  rates: Record<string, { costRate: number; sellRate: number }>;
}

export interface RoleTemplate {
  id: string;
  name: string;
  roles: { title: string; hourlyRate: number; sellRate?: number; offshoreRate?: number; offshoreSellRate?: number }[];
}

export interface ExpenseLine {
  id: string;
  description: string;
  amount: number;
  month?: string;
}

export interface EstimatePhase {
  id: string;
  name: string;
  startMonth: string;
  monthCount: number;
  roles: Role[];
  allocations: Record<string, Record<string, number>>;
  notes: Record<string, string>;
  expenses: ExpenseLine[];
}

export interface EstimateVersion {
  id: string;
  name: string;
  createdAt: string;
  snapshot: string;
}

export type EstimateStatus = 'draft' | 'in_review' | 'approved' | 'won' | 'lost';

export interface Estimate {
  id: string;
  name: string;
  client: string;
  status: EstimateStatus;
  createdAt: string;
  updatedAt: string;
  phases: EstimatePhase[];
  showMargin: boolean;
  rateCardId?: string;
  versions: EstimateVersion[];
  parentId?: string;
  scenarioName?: string;
}
