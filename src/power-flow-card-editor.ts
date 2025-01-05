import { customElement, property, state } from "lit/decorators";

import { LovelaceCardEditor } from "./ha/panels/lovelace/types";
import { PowerFlowCardConfig } from "./types";
import { html, LitElement, nothing } from "lit";
import { HomeAssistant, LocalizeFunc } from "./ha/types";
import { HaFormSchema } from "./utils/form/ha-form";
import "./ha/panels/lovelace/editor/hui-entities-card-row-editor";
import memoizeOne from "memoize-one";
import { fireEvent, HASSDomEvent } from "./ha/common/dom/fire_event";
import type {
  EditorTarget,
  EditDetailElementEvent,
  SubElementEditorConfig,
} from "./ha/panels/lovelace/editor/types";

import { POWER_CARD_EDITOR_NAME } from "./const";
import { EntityConfig, LovelaceRowConfig } from "./ha/panels/lovelace/entity-rows/types";
import { processEditorEntities } from "./ha/panels/lovelace/editor/process-editor-entities";

const schema = [
  { name: "title", selector: { text: {} } },
  {
    name: "power_from_grid_entity", selector: {
      entity: {
        domain: "sensor",
        device_class: "power",
      }
    }
  },
  {
    name: "generation_entity", selector: {
      entity: {
        domain: "sensor",
        device_class: "power",
      }
    }
  },
  // { name: "group_small", selector: { boolean: {} } },
];

@customElement(POWER_CARD_EDITOR_NAME)
export class PowerFlowCardEditor extends LitElement implements LovelaceCardEditor {

  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config?: PowerFlowCardConfig;

  @state() private _configConsumerEntities: EntityConfig[] = []

  @state() private _subElementEditorConfig?: SubElementEditorConfig;

  public setConfig(config: PowerFlowCardConfig): void {
    this._config = config;
    this._configConsumerEntities = processEditorEntities(config.consumer_entities);
  }

  private _computeLabel = (schema: HaFormSchema) => {
    switch (schema.name) {
      case "title": return "Title";
      case "power_from_grid_entity": return "Power from grid";
      case "group_small": return "Group low values together";
      case "generation_entity": return "Power from generation (optional)";
    }
    console.error("Error name key missing for '" + schema.name + "'")
    return ""
  };

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    if (this._subElementEditorConfig) {
      return html`
        <hui-sub-element-editor
          .hass=${this.hass}
          .config=${this._subElementEditorConfig}
          @go-back=${this._goBack}
          @config-changed=${this._handleSubElementChanged}
        >
        </hui-sub-element-editor>
      `;
    }

    const data = { ...this._config } as any;
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${schema}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
      <elec-sankey-hui-entities-card-row-editor
        .hass=${this.hass}
        label="Consumer Entities (required)"
        .entities=${this._configConsumerEntities}
        includeDeviceClasses=${["power"]}
        @entities-changed=${this._valueChanged}
        @edit-detail-element=${this._editDetailElement}
      ></elec-sankey-hui-entities-card-row-editor>
    `;
  }

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    if (!this._config || !this.hass) {
      return;
    }

    const target = ev.target! as EditorTarget;
    let configValue =
      target.configValue || this._subElementEditorConfig?.type;
    let value =
      target.checked !== undefined
        ? target.checked
        : target.value || ev.detail.config || ev.detail.value;

    if (!configValue && value) {
      // A form value changed. We don't know which one.
      // Could be title or anything else in the schema.
      if (value.title !== this._config.title) {
        configValue = "title";
        value = value.title;
      }
      // else if (value.theme !== this._config.theme) {
      //   configValue = "theme";
      //   value = value.theme;
      // }
      else if (value.power_from_grid_entity
        !== this._config.power_from_grid_entity) {
        configValue = "power_from_grid_entity";
        value = value.power_from_grid_entity;
      }
      else if (value.generation_entity
        !== this._config.generation_entity) {
        configValue = "generation_entity";
        value = value.generation_entity;
      }
      else {
        console.warn("unhandled change in <ha-form>");
      }
    }

    if (configValue === "row" || (ev.detail && ev.detail.entities)) {
      const newConfigEntities =
        ev.detail.entities || this._configConsumerEntities!.concat();
      if (configValue === "row") {
        if (!value) {
          newConfigEntities.splice(this._subElementEditorConfig!.index!, 1);
          this._goBack();
        } else {
          newConfigEntities[this._subElementEditorConfig!.index!] = value;
        }

        this._subElementEditorConfig!.elementConfig = value;
      }

      this._config = { ...this._config!, consumer_entities: newConfigEntities };
      this._configConsumerEntities = processEditorEntities(this._config!.consumer_entities);
    } else if (configValue) {
      if (value === "") {
        this._config = { ...this._config };
        delete this._config[configValue!];
      } else {
        this._config = {
          ...this._config,
          [configValue]: value,
        };
      }
    }
    fireEvent(this, "config-changed", { config: this._config });
  }

  private _handleSubElementChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    if (!this._config || !this.hass) {
      return;
    }

    const configValue = this._subElementEditorConfig?.type;
    const value = ev.detail.config;

    if (configValue === "row") {
      const newConfigEntities = this._configConsumerEntities!.concat();
      if (!value) {
        newConfigEntities.splice(this._subElementEditorConfig!.index!, 1);
        this._goBack();
      } else {
        newConfigEntities[this._subElementEditorConfig!.index!] = value;
      }

      this._config = { ...this._config!, entities: newConfigEntities };
      this._configConsumerEntities = processEditorEntities(this._config!.entities);
    } else if (configValue) {
      if (value === "") {
        this._config = { ...this._config };
        delete this._config[configValue!];
      } else {
        this._config = {
          ...this._config,
          [configValue]: value,
        };
      }
    }

    this._subElementEditorConfig = {
      ...this._subElementEditorConfig!,
      elementConfig: value,
    };

    fireEvent(this, "config-changed", { config: this._config });
  }

  private _editDetailElement(ev: HASSDomEvent<EditDetailElementEvent>): void {
    this._subElementEditorConfig = ev.detail.subElementConfig;
  }

  private _goBack(): void {
    this._subElementEditorConfig = undefined;
  }

}