import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { Playground } from "./pages/Playground";

function Placeholder({ name }: { name: string }) {
  return <div className="p-8 text-white text-2xl">{name} - coming soon</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/arena" element={<Placeholder name="Arena" />} />
      </Routes>
    </BrowserRouter>
  );
}
