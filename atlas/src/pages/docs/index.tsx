import { Route, Routes } from "react-router-dom";
import Docs from "./Docs";

/** /docs and /docs/:id. */
const DocsModule = () => (
  <Routes>
    <Route index element={<Docs />} />
    <Route path=":id" element={<Docs />} />
  </Routes>
);

export default DocsModule;
