import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "bin/cli": "src/bin/cli.ts"
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: "node18",
  shims: true,
  banner: {
    js: ""
  }
});
