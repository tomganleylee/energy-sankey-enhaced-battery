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
  EditDetailElementEvent,
  SubElementEditorConfig,
} from "./ha/panels/lovelace/editor/types";

import { POWER_CARD_EDITOR_NAME } from "./const";
import { EntityConfig, LovelaceRowConfig } from "./ha/panels/lovelace/entity-rows/types";

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
  { name: "group_small", selector: { boolean: {} } },
  // {
  //   type: "grid",
  //   name: "",
  //   schema: [
  //     {
  //       name: "icon",
  //       selector: { icon: {} },
  //       context: { icon_entity: "entity" },
  //     },
  //     { name: "icon_color", selector: { mush_color: {} } },
  //   ],
  // },
  // ...APPEARANCE_FORM_SCHEMA,
  // {
  //   name: "display_mode",
  //   selector: {
  //     select: {
  //       options: ["default", ...DISPLAY_MODES].map((control) => ({
  //         value: control,
  //         label: localize(`editor.card.number.display_mode_list.${control}`),
  //       })),
  //       mode: "dropdown",
  //     },
  //   },
  // },
  // ...computeActionsFormSchema(),
];

@customElement(POWER_CARD_EDITOR_NAME)
export class PowerFlowCardEditor extends LitElement implements LovelaceCardEditor {

  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config?: PowerFlowCardConfig;

  @state() private _configConsumerEntities: EntityConfig[] = []

  @state() private _subElementEditorConfig?: SubElementEditorConfig;

  public setConfig(config: PowerFlowCardConfig): void {
    this._config = config;
    config.consumer_entities?.forEach(element => {
      const entityConfig: EntityConfig = {
        entity: element,
        name: "placeholder name1"
      }
      this._configConsumerEntities.push(entityConfig);
      console.log("element: ", element);
    });
  }

  private _computeLabel = (schema: HaFormSchema) => {
    return `${schema.name} - placeholder label`;
  };

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
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
      <hui-entities-card-row-editor
        .hass=${this.hass}
        .entities=${this._configConsumerEntities}
        @entities-changed=${this._valueChanged}
        @edit-detail-element=${this._editDetailElement}
      ></hui-entities-card-row-editor>
    `;
  }

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value };

    if (config.display_mode === "default") {
      delete config.display_mode;
    }

    fireEvent(this, "config-changed", { config });
  }

  private _editDetailElement(ev: HASSDomEvent<EditDetailElementEvent>): void {
    this._subElementEditorConfig = ev.detail.subElementConfig;
  }
}