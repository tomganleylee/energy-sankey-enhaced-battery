import { LovelaceCardConfig } from "./ha/data/lovelace/config/card";


export interface EnergyElecFlowCardConfig extends LovelaceCardConfig {
  title?: string;
  collection_key?: string;
  battery_charge_only_from_generation?: boolean;
}

export interface PowerFlowCardConfig extends LovelaceCardConfig {
  title?: string;
  power_from_grid_entity?: string;
  power_to_grid_entity?: string;
  generation_entity?: string;
  hide_small_consumers?: boolean;
  battery_charge_only_from_generation?: boolean;
  independent_grid_in_out?: boolean;
  consumer_entities: {
    entity: string;
    name?: string;
  }[];
}

