import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import GlobalAnalytics from "./pages/GlobalAnalytics";
import Pestel from "./pages/Pestel";
import Porter from "./pages/Porter";
import BusinessAnalytics from "./pages/BusinessAnalytics";
import Assistant from "./pages/Assistant";
import Sources from "./pages/Sources";
import CountryCompare from "./pages/CountryCompare";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="compare" element={<CountryCompare />} />
        <Route path="global" element={<GlobalAnalytics />} />
        <Route path="pestel" element={<Pestel />} />
        <Route path="porter" element={<Porter />} />
        <Route path="business" element={<BusinessAnalytics />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="sources" element={<Sources />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
