import { createRoot } from "react-dom/client";
import "@fontsource/heebo/400.css";
import "@fontsource/heebo/500.css";
import "@fontsource/heebo/600.css";
import "@fontsource/heebo/700.css";
import App from "./App";
import { installReceiver } from "./bridge/cyan-bridge";
import "./index.css";

// window.cyanBridge.receive must exist before game_ready is posted.
installReceiver();

createRoot(document.getElementById("root")!).render(<App />);
