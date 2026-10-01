import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
  },
};

export default preview;
