import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { createMockApi } from "./lib/mockApi";
import { createSupabaseApi } from "./lib/supabaseApi";
import "./styles.css";

const api = import.meta.env.VITE_DEMO ? createMockApi() : createSupabaseApi();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App api={api} />
  </React.StrictMode>,
);
