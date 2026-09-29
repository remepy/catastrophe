import Game from "@/pages/game";
import { I18nProvider } from "@/i18n/translations";
import { useGameSession } from "@/session/use-game-session";

function App() {
  const { state, restartStandalone } = useGameSession();

  if (state.phase === "loading") {
    // No text before translations resolve (BR-13).
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background" data-testid="loading-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Unrecoverable error or aborted before the session started: render nothing.
  if (state.phase === "ended") return null;

  return (
    <I18nProvider translations={state.translations}>
      <Game key={state.runId} content={state.content} config={state.config} onRestart={restartStandalone} />
    </I18nProvider>
  );
}

export default App;
