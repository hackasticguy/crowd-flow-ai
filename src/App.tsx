import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import VenueBuilder from "./pages/VenueBuilder";
import Simulation from "./pages/Simulation";
import Reports from "./pages/Reports";
import { useStore } from "./lib/store";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useStore();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<Layout />}>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/builder" element={<ProtectedRoute><VenueBuilder /></ProtectedRoute>} />
          <Route path="/simulation" element={<ProtectedRoute><Simulation /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
