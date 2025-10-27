import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const mount = document.getElementById("root")!;
createRoot(mount).render(<App />);
