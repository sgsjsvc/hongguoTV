import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

if (!new URLSearchParams(window.location.search).has("__legacy_migration")) ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
