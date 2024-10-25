// rollup.config.mjs
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const plugins = [
  typescript({
    declaration: false,
  }),
  nodeResolve(),
  json(),
];

export default {
  input: "src/energy-sankey.ts",
  output: {
    dir: "dist",
    format: "es",
  },
  plugins,
  moduleContext: (id) => {
    const thisAsWindowForModules = [
      "node_modules/@formatjs/intl-utils/lib/src/diff.js",
      "node_modules/@formatjs/intl-utils/lib/src/resolve-locale.js",
    ];
    if (thisAsWindowForModules.some((id_) => id.trimRight().endsWith(id_))) {
      return "window";
    }
  },
};
