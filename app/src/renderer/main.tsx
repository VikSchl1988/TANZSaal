import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const el = document.getElementById("root");
if (!el) throw new Error("Wurzelelement fehlt");
createRoot(el).render(<App />);
