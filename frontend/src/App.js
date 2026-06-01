import { Toaster } from "sonner";
import Dashboard from "@/pages/Dashboard";

function App() {
  return (
    <div className="App">
      <Dashboard />
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#12151A",
            border: "1px solid #222731",
            color: "#fff",
            fontFamily: "'IBM Plex Sans', sans-serif",
          },
        }}
      />
    </div>
  );
}

export default App;
