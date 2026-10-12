import Tracker from "@/components/Tracker";
import { loadState } from "@/lib/store";
import { getFrames, getHeroes } from "@/lib/roster";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [state, { heroes }, frames] = await Promise.all([loadState(), getHeroes(), getFrames()]);
  return <Tracker initial={state} heroes={heroes} frames={frames} />;
}
