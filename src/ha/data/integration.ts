export type IntegrationType =
  | "device"
  | "helper"
  | "hub"
  | "service"
  | "hardware"
  | "entity"
  | "system";

export interface IntegrationManifest {
  is_built_in: boolean;
  domain: string;
  name: string;
  config_flow: boolean;
  documentation: string;
  issue_tracker?: string;
  dependencies?: string[];
  after_dependencies?: string[];
  codeowners?: string[];
  requirements?: string[];
  ssdp?: Array<{ manufacturer?: string; modelName?: string; st?: string }>;
  zeroconf?: string[];
  homekit?: { models: string[] };
  integration_type?: IntegrationType;
  loggers?: string[];
  quality_scale?: "gold" | "internal" | "platinum" | "silver";
  iot_class:
    | "assumed_state"
    | "cloud_polling"
    | "cloud_push"
    | "local_polling"
    | "local_push";
  single_config_entry?: boolean;
  version?: string;
}
