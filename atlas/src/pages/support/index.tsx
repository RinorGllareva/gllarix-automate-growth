import { Route, Routes } from "react-router-dom";
import Support from "./Support";
import TicketPage from "./TicketPage";

/** /support: every ticket; /support/:id: one ticket. */
const SupportModule = () => (
  <Routes>
    <Route index element={<Support />} />
    <Route path=":id" element={<TicketPage />} />
  </Routes>
);

export default SupportModule;
