import { Route, Routes } from "react-router-dom";
import CallWorkspace from "./CallWorkspace";

/** /call (next in today's queue) and /call/:leadId */
const CallModule = () => (
  <Routes>
    <Route index element={<CallWorkspace />} />
    <Route path=":leadId" element={<CallWorkspace />} />
  </Routes>
);

export default CallModule;
