import { App } from "../render/index";
import { render } from "ink";

if (process.stdout.isTTY && process.stdin.isTTY) {
  delete process.env.CI;
  delete process.env.CONTINUOUS_INTEGRATION;
  delete process.env.BUILD_NUMBER;
  delete process.env.RUN_ID;
}

render(<App />, { exitOnCtrlC: true });
