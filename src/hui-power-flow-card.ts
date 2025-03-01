import { HassEntity } from "home-assistant-js-websocket/dist/types";
import {
  css,
  html,
  LitElement,
  PropertyValues,
  nothing,
  CSSResultArray,
} from "lit";
import { mdiSolarPower } from "@mdi/js";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { ElecRoute, ElecRoutePair } from "./elec-sankey";
import { applyThemesOnElement } from "./ha/common/dom/apply_themes_on_element";
import { computeStateName } from "./ha/common/entity/compute_state_name";
import { isValidEntityId } from "./ha/common/entity/valid_entity_id";
import type { HomeAssistant } from "./ha/types";
import { createEntityNotFoundWarning } from "./ha/panels/lovelace/components/hui-warning";
import type { LovelaceCard, LovelaceCardEditor } from "./ha/panels/lovelace/types";
import type { PowerFlowCardConfig } from "./types";
import { hasConfigChanged } from "./ha/panels/lovelace/common/has-changed";
import { registerCustomCard } from "./utils/custom-cards";
import { getEnergyPreferences } from "./ha/data/energy";
import { ExtEntityRegistryEntry, getExtendedEntityRegistryEntry } from "./ha/data/entity_registry";
//import "./power-flow-card-editor"


import {
  POWER_CARD_NAME,
  POWER_CARD_EDITOR_NAME,
  HIDE_CONSUMERS_BELOW_THRESHOLD_W,
} from "./const";

registerCustomCard({
  type: "hui-power-flow-card",
  name: "Sankey Power Flow Card",
  description: "Card for showing the instantaneous flow of electrical power",
});


function computePower(stateObj: HassEntity): number {
  /**
   * Returns the power of an entity, scaled to W.
   */
  let uom: string | undefined;
  let state: number = Number(stateObj.state)
  if (uom = stateObj.attributes.unit_of_measurement) {
    switch (uom) {
      case "kW":  {
        return 1000 * state;
      }
      default: {
        return state;
      }
    }
  }
  else {
    return state;
  }

}

@customElement("hui-power-flow-card")
class HuiPowerFlowCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config?: PowerFlowCardConfig;

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("./power-flow-card-editor");
    return document.createElement(
      POWER_CARD_EDITOR_NAME
    ) as LovelaceCardEditor;
  }

  public getCardSize(): number {
    return 3;
  }

  public setConfig(config: PowerFlowCardConfig): void {
    if (
      !config.power_from_grid_entity &&
      !config.power_to_grid_entity &&
      !config.generation_entity &&
      config.consumer_entities.length === 0
    ) {
      throw new Error("Must specify at least one entity");
    }

    let newConfig = { ...config };
    if (newConfig.battery_entities === undefined) {
      newConfig.battery_entities = [];
      newConfig.config_version = 1;
    }

    // @todo consider adding more config checks here.
    this._config = { ...newConfig };
  }

  private static async getExtendedEntityRegistryEntries(_hass: HomeAssistant): Promise<{ [id: string]: ExtEntityRegistryEntry }> {
    // Get the full list of all extended entity registry entries as a dict.

    // @todo: uses multiple WS lookups - there's scope for optimising this.
    let extEntities: { [id: string]: ExtEntityRegistryEntry; } = {};

    for (let key in _hass.entities) {
      const extEntity = await getExtendedEntityRegistryEntry(_hass, key);
      if (!extEntity) {
        continue;
      }
      extEntities[key] = extEntity;
    }
    return extEntities;
  }

  private static async getPowerEntityIdForEnergyEntityId(
    _hass: HomeAssistant,
    energyEntityId: string,
    extEntities: { [id: string]: ExtEntityRegistryEntry; },
  ): Promise<string> {
    /**
     * Given an energy entity ID, find the associated power entity ID.
     * Looks up the device ID for the energy entity, then finds the most
     * likely power entity associated with that device.
     */
    const energyEntity = _hass.entities[energyEntityId];
    if (!energyEntity) {
      return "";
    }
    const deviceEntityId = energyEntity.device_id;
    if (!deviceEntityId) {
      return "";
    }
    const deviceEntity = _hass.devices[deviceEntityId];
    if (!deviceEntity) {
      return "";
    }
    let powerEntityIds: Array<string> = [];

    for (let key in extEntities) {
      const extEntity = extEntities[key];
      if (extEntity.device_id === deviceEntityId && extEntity.original_device_class === "power") {
        powerEntityIds.push(extEntity.entity_id);
      }
    }

    if (powerEntityIds.length === 0) {
      return "";
    }
    else if (powerEntityIds.length === 1) {
      return powerEntityIds[0];
    }
    else {
      // We have multiple power entities for this device, pick the one
      // with the largest absolute power.
      let mostLikelyPowerEntityId: string = powerEntityIds[0];
      let maxPower: number = 0;
      for (let powerEntityId of powerEntityIds) {
        const power = Math.abs(+_hass.states[powerEntityId].state);
        if (power > maxPower) {
          mostLikelyPowerEntityId = powerEntityId;
        };
      }
      return mostLikelyPowerEntityId;
    }
  }

  private static async getPowerEntityIdForEnergyEntityIdWithFail(
    _hass: HomeAssistant,
    energyEntityId: string,
    extEntities: { [id: string]: ExtEntityRegistryEntry; },
  ): Promise<string> {
    /**
     * Given an energy entity ID, find the associated power entity ID.
     * If not found, return a string indicating the failure.
     */
    let powerEntityId = await this.getPowerEntityIdForEnergyEntityId(_hass, energyEntityId, extEntities);
    if (!powerEntityId) {
      powerEntityId = "please_manually_enter_power_entity_id_for " + energyEntityId;
    }
    return powerEntityId;
  }


  public static async getStubConfig(
    _hass: HomeAssistant
  ): Promise<PowerFlowCardConfig> {
    /**
     * We go on a bit of a hunt to get the stub config.
     * HA configures *energy* sources, not power sources, so we look for the
     * original devices associated with each energy source, and find an
     * associated power sensor for each.
     * It's not perfect, but even if a partially populated config is a huge
     * help to the user.
     */
    console.log("-----------getStubConfig()----------");

    const energyPrefs = await getEnergyPreferences(_hass);
    const extEntities: { [id: string]: ExtEntityRegistryEntry; }
      = await this.getExtendedEntityRegistryEntries(_hass);

    let returnConfig: PowerFlowCardConfig = {
      type: "custom:hui-power-flow-card",
      title: "Live power flow",
      consumer_entities: [],
      battery_entities: [],
      config_version: 1,
    }
    // Parse energy sources from HA's energy prefs
    for (const source of energyPrefs.energy_sources) {
      switch (source.type) {
        case "grid":
          let power_from_grid_entity = "";
          power_from_grid_entity = await this.getPowerEntityIdForEnergyEntityIdWithFail(_hass, source.flow_from[0].stat_energy_from, extEntities);
          console.log("adding power_from_grid_entity="+power_from_grid_entity);
          returnConfig.power_from_grid_entity = power_from_grid_entity;
          break;
        case "solar":
          let generation_entity = "";
          // In future we might support multiple generation entities
          generation_entity = await this.getPowerEntityIdForEnergyEntityId(
            _hass,
            source.stat_energy_from,
            extEntities
          )
          if (generation_entity) {
            returnConfig.generation_entity = generation_entity;
          }
          break;
        case "battery":
          console.log("searching for battery in power entity adjacent to '"+source.stat_energy_from+"'");
          let batteryEntity =""
          batteryEntity = await this.getPowerEntityIdForEnergyEntityId(
            _hass,
            source.stat_energy_from,
            extEntities
          )
          if (batteryEntity) {
            console.log("adding battery_entity="+batteryEntity);
            returnConfig.battery_entities.push({ entity: batteryEntity });
          }
          break;
      }
    };
    // Parse energy consumers from HA's energy prefs
    for (const consumer of energyPrefs.device_consumption) {
      if (!returnConfig.consumer_entities) {
        returnConfig.consumer_entities = [];
      }
      const entityId = await this.getPowerEntityIdForEnergyEntityId(
        _hass,
        consumer.stat_consumption,
        extEntities
      )
      if (entityId) {
        returnConfig.consumer_entities.push({ entity: entityId });
      }
    };
    return returnConfig;
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }
    let config = this._config;
    // The editor only supports a single generation entity, so we need to
    // convert the single entity to an array.
    if (config.generation_entity) {
      config.generation_entities = [config.generation_entity];
      delete (config.generation_entity)
    }

    const maxConsumerBranches = this._config.max_consumer_branches || 0;

    const hideConsumersBelow = this._config.hide_small_consumers
      ? HIDE_CONSUMERS_BELOW_THRESHOLD_W : 0;

    let gridInRoute: ElecRoute | null = null;
    if (config.power_from_grid_entity) {
      const stateObj = this.hass.states[config.power_from_grid_entity];
      if (!stateObj) {
        return html`
          <hui-warning>
            ${createEntityNotFoundWarning(
          this.hass,
          config.power_from_grid_entity
        )}
          </hui-warning>
        `;
      }
      const name = computeStateName(stateObj);
      gridInRoute = {
        id: config.power_from_grid_entity,
        text: name,
        rate: computePower(stateObj),
      };
    }

    let gridOutRoute: ElecRoute | null = null;
    if (config.power_to_grid_entity) {
      const stateObj = this.hass.states[config.power_to_grid_entity];
      if (!stateObj) {
        return html`
          <hui-warning>
            ${createEntityNotFoundWarning(
          this.hass,
          config.power_to_grid_entity
        )}
          </hui-warning>
        `;
      }
      gridOutRoute = {
        id: config.power_to_grid_entity,
        text: computeStateName(stateObj),
        rate: computePower(stateObj),
      };
    }

    const generationInRoutes: { [id: string]: ElecRoute } = {};
    if (config.generation_entities) {
      for (const entity of config.generation_entities) {
        const stateObj = this.hass.states[entity];
        if (!stateObj) {
          return html`
            <hui-warning>
              ${createEntityNotFoundWarning(this.hass, entity)}
            </hui-warning>
          `;
        }
        generationInRoutes[entity] = {
          id: entity,
          text: computeStateName(stateObj),
          rate: computePower(stateObj),
          icon: mdiSolarPower,
        };
      }
    }

    const consumerRoutes: { [id: string]: ElecRoute } = {};
    if (this._config.consumer_entities) {
      for (const entity of this._config.consumer_entities) {
        let stateObj: HassEntity;
        stateObj = this.hass.states[entity.entity];
        let name = entity.name;
        if (!stateObj) {
          return html`
            <hui-warning>
              ${createEntityNotFoundWarning(this.hass, entity.entity)}
            </hui-warning>
          `;
        }
        if (!name) {
          name = computeStateName(stateObj);
        }
        consumerRoutes[entity.entity] = {
          id: entity.entity,
          text: name,
          rate: computePower(stateObj),
        };
      }
    }
    const batteryRoutes: { [id: string]: ElecRoutePair } = {};
    if (this._config.battery_entities) {

      for (const entity of this._config.battery_entities) {
        let stateObj: HassEntity;
        stateObj = this.hass.states[entity.entity];
        let name = entity.name;
        if (!stateObj) {
          return html`
            <hui-warning>
              ${createEntityNotFoundWarning(this.hass, entity.entity)}
            </hui-warning>
          `;
        }
        if (!name) {
          name = computeStateName(stateObj);
        }
        // power in refers to power into the energy distribution system
        // (i.e. out of the battery)
        let powerIn = computePower(stateObj) 
        batteryRoutes[entity.entity] = {
          in: {
            id: entity.entity,
            text: name,
            rate: powerIn < 0 ? -powerIn : 0,
          },
          out: {
            id: "null",
            text: "null",
            rate: powerIn > 0 ? powerIn : 0,
          }
        };
      }
    }
    return html`
      <ha-card>
        ${config.title
        ? html`<h1 class="card-header">${config.title}</h1>`
        : ""}
        <div
          class="content ${classMap({
          "has-header": !!this._config.title,
        })}"
        >
          <ha-elec-sankey
            .hass=${this.hass}
            .unit=${"W"}
            .gridInRoute=${gridInRoute || undefined}
            .gridOutRoute=${gridOutRoute || undefined}
            .generationInRoutes=${generationInRoutes}
            .consumerRoutes=${consumerRoutes}
            .batteryRoutes=${batteryRoutes}
            .maxConsumerBranches=${maxConsumerBranches}
            .hideConsumersBelow=${hideConsumersBelow}
          ></ha-elec-sankey>
        </div>
      </ha-card>
    `;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (hasConfigChanged(this, changedProps)) {
      return true;
    }

    if (!changedProps.has("hass")) {
      return false;
    }
    const oldHass = changedProps.get("hass") as HomeAssistant;
    const newHass = this.hass as HomeAssistant;

    if (this._config) {
      for (const id of [
        this._config.power_from_grid_entity,
        this._config.power_to_grid_entity,
        ...(this._config.generation_entities || []),
        ...(this._config.consumer_entities.map(a => a.entity) || []),
        ...(this._config.battery_entities.map(a => a.entity) || []),
      ]) {
        if (id) {
          const oldState = oldHass.states[id] as HassEntity | undefined;
          const newState = newHass.states[id] as HassEntity | undefined;
          if (oldState !== newState) {
            return true;
          }
        }
      }
    }
    return false;
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (!this._config || !this.hass) {
      return;
    }

    const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
    const oldConfig = changedProps.get("_config") as
      | PowerFlowCardConfig
      | undefined;

    if (
      !oldHass ||
      !oldConfig ||
      oldHass.themes !== this.hass.themes ||
      oldConfig.theme !== this._config.theme
    ) {
      applyThemesOnElement(this, this.hass.themes, this._config.theme);
    }
  }

  static styles: CSSResultArray = [
    css`
      ha-card {
        height: 100%;
        padding: 16px;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        box-sizing: border-box;
      }
      ha-card:focus {
        outline: none;
      }
      ha-elec-sankey {
        --generation-color: var(--energy-solar-color);
        --grid-in-color: var(--energy-grid-consumption-color);
        --battery-in-color: var(--energy-battery-in-color);
      }
      .name {
        text-align: center;
        line-height: initial;
        color: var(--primary-text-color);
        width: 100%;
        font-size: 15px;
        margin-top: 8px;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-power-flow-card": HuiPowerFlowCard;
  }
}
