import { Route, Routes } from "react-router-dom";
import MeetingPage from "./MeetingPage";
import Meetings from "./Meetings";

/** /meetings: the week (calendar or list), and /meetings/:id for one meeting. */
const MeetingsModule = () => (
  <Routes>
    <Route index element={<Meetings />} />
    <Route path=":id" element={<MeetingPage />} />
  </Routes>
);

export default MeetingsModule;
