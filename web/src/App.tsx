import { BrowserRouter, Routes, Route } from "react-router-dom";

function Placeholder({ name }: { name: string }) {
  return <div className="p-8 text-white text-2xl">{name} - coming soon</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder name="Home" />} />
        <Route path="/playground" element={<Placeholder name="Playground" />} />
        <Route path="/arena" element={<Placeholder name="Arena" />} />
      </Routes>
    </BrowserRouter>
  );
}
