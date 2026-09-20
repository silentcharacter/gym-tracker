import { useEffect, useState } from "react";
import { postApi } from "./api";
import { OwnerMenu } from "./components/OwnerMenu";
import { TabBar, type Tab } from "./components/TabBar";
import { Exercise } from "./screens/Exercise";
import { GroupOrder } from "./screens/GroupOrder";
import { Weights } from "./screens/Weights";
import { Workouts } from "./screens/Workouts";
import { getWebApp, setTelegramColors } from "./telegram";

function App() {
  const [tab, setTab] = useState<Tab>("workouts");
  const [isOwner, setIsOwner] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);
  const [groupOrderOpen, setGroupOrderOpen] = useState(false);

  useEffect(() => {
    const webApp = getWebApp();
    webApp?.ready();
    webApp?.expand();
    setTelegramColors(); // тема — только CSS-переменные Telegram, без своего JS-объекта (решение 4)

    postApi<{ isOwner: boolean }>("whoami")
      .then((res) => setIsOwner(res.isOwner))
      .catch(() => setIsOwner(false));
  }, []);

  function changeTab(next: Tab) {
    setOpenExerciseId(null); // §8: «Упражнение» — вложенный экран поверх «Весов», не отдельный таб
    setGroupOrderOpen(false);
    setTab(next);
  }

  function openWeightsFor(groupId: string) {
    setSelectedGroupId(groupId);
    setOpenExerciseId(null);
    setTab("weights");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ flex: 1 }} />
        <strong>Gym tracker</strong>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          {tab === "workouts" && isOwner && !groupOrderOpen && (
            <OwnerMenu onOpenGroupOrder={() => setGroupOrderOpen(true)} />
          )}
        </div>
      </header>

      <main style={{ flex: 1, overflowY: "auto" }}>
        {tab === "workouts" &&
          (groupOrderOpen ? (
            <GroupOrder onBack={() => setGroupOrderOpen(false)} />
          ) : (
            <Workouts isOwner={isOwner} onOpenWeightsForGroup={openWeightsFor} />
          ))}
        {tab === "weights" &&
          (openExerciseId ? (
            <Exercise
              exerciseId={openExerciseId}
              isOwner={isOwner}
              onBack={() => setOpenExerciseId(null)}
            />
          ) : (
            <Weights
              isOwner={isOwner}
              selectedGroupId={selectedGroupId}
              onSelectGroup={setSelectedGroupId}
              onOpenExercise={setOpenExerciseId}
            />
          ))}
      </main>

      <div style={{ position: "sticky", bottom: 0 }}>
        <TabBar active={tab} onChange={changeTab} />
      </div>
    </div>
  );
}

export default App;
