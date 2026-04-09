import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { Playground } from "./pages/Playground";
import { Arena } from "./pages/Arena";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/arena" element={<Arena />} />
      </Routes>
    </BrowserRouter>
  );
}
