import { LovelaceCardConfig } from "./ha/data/lovelace/config/card";


export interface EnergyElecFlowCardConfig extends LovelaceCardConfig {
  type: "energy-elec-flow";
  title?: string;
  collection_key?: string;
}

export interface PowerFlowCardConfig extends LovelaceCardConfig {
  name?: string;
  power_from_grid_entity?: string;
  power_to_grid_entity?: string;
  generation_entities?: string[];
  consumer_entities?: string[];
}

