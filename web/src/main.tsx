import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import HomePage from "./pages/HomePage";
import PalletPage from "./pages/PalletPage";
import EvmContractPage from "./pages/EvmContractPage";
import PvmContractPage from "./pages/PvmContractPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="pallet" element={<PalletPage />} />
          <Route path="evm" element={<EvmContractPage />} />
          <Route path="pvm" element={<PvmContractPage />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
