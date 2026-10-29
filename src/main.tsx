import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AvisosProvider } from "./components/Avisos";
import { DialogoProvider } from "./components/Dialogo";
import { AuthProvider } from "./lib/auth";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AvisosProvider>
        <DialogoProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </DialogoProvider>
      </AvisosProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
