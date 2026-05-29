export type DemoApi = {
  id: string;
  name: string;
  owning_mda_id: string;
  sector: string;
  description: string;
  lifecycle_status: string;
  sensitivity_level: string;
  required_approval_level: string;
  contact_office: string;
  technical_owner: string;
  personal_data_categories: string;
  purpose_limitation: string;
  data_minimization_note: string;
  retention_class: string;
  statutory_basis: string;
  security_classification: string;
  sla_target: string;
  compliance_status: string;
  docs_visibility: 'public' | 'authenticated' | 'restricted';
  spec: Record<string, unknown>;
};

export type LegacyIdMapping = {
  legacyId: string;
  currentId: string;
};

export type SyncProductionDemoCatalogOptions = {
  log?: boolean;
};
