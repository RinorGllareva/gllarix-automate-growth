import { Route, Routes } from "react-router-dom";
import Import from "./Import";
import LeadDetail from "./LeadDetail";
import LeadsList from "./LeadsList";

/** /leads, /leads/import, /leads/:id */
const LeadsModule = () => (
  <Routes>
    <Route index element={<LeadsList />} />
    <Route path="import" element={<Import />} />
    <Route path=":id" element={<LeadDetail />} />
  </Routes>
);

export default LeadsModule;
