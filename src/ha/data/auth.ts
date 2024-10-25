import { HomeAssistant } from "../types";

export interface SignedPath {
  path: string;
}

export const getSignedPath = (
  hass: HomeAssistant,
  path: string
): Promise<SignedPath> => hass.callWS({ type: "auth/sign_path", path });

