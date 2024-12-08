import { customElement, property, state } from "lit/decorators.js";

import { LovelaceCardEditor } from "./ha/panels/lovelace/types";
import { PowerFlowCardConfig } from "./types";
import { html, LitElement, nothing } from "lit";
import { HomeAssistant, LocalizeFunc } from "./ha/types";
import { HaFormSchema } from "./utils/form/ha-form";
import memoizeOne from "memoize-one";
import { fireEvent } from "./ha/common/dom/fire_event";
// import "ha/panels/lovelace/editor/hui-element-editor"
import { POWER_CARD_EDITOR_NAME } from "./const";

const GRID_POWER_IN_ENTITY_DOMAINS = ["sensor"];

const schema = [
  { name: "grid-in", selector: { entity: { domain: GRID_POWER_IN_ENTITY_DOMAINS } } },
  { name: "name", selector: { text: {} } },
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

  public setConfig(config: PowerFlowCardConfig): void {
    this._config = config;
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
    `;    
  }

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value };

    if (config.display_mode === "default") {
      delete config.display_mode;
    }

    fireEvent(this, "config-changed", { config });
  }  
}