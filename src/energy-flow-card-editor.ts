import { customElement, property, state } from "lit/decorators";

import { LovelaceCardEditor } from "./ha/panels/lovelace/types";
import { EnergyElecFlowCardConfig, PowerFlowCardConfig } from "./types";
import { html, LitElement, nothing } from "lit";
import { HomeAssistant, LocalizeFunc } from "./ha/types";
import { HaFormSchema } from "./utils/form/ha-form";
import "./ha/panels/lovelace/editor/hui-entities-card-row-editor";
import { fireEvent } from "./ha/common/dom/fire_event";

import { ENERGY_CARD_EDITOR_NAME } from "./const";

const schema = [
  { name: "title", selector: { text: {} } },
];

@customElement(ENERGY_CARD_EDITOR_NAME)
export class EnergyFlowCardEditor extends LitElement implements LovelaceCardEditor {

  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config?: EnergyElecFlowCardConfig;

  public setConfig(config: EnergyElecFlowCardConfig): void {
    this._config = config;
  }

  private _computeLabel = (schema: HaFormSchema) => {
    switch (schema.name) {
      case "title": return "Title";
    }
    console.error("Error name key missing for '" + schema.name + "'")
    return ""
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
      <ha-alert
        alert-type="info"
        .title="Note"
      >
        Energy flow entities are configured in the
        <a href="/config/energy">Energy Dashboard Config</a>.
        They cannot be modified via the card configuration.
      </ha-alert>
      `;
  }

  private _valueChanged(ev: CustomEvent): void {
    const config = ev.detail.value;
    fireEvent(this, "config-changed", { config });
  }
}