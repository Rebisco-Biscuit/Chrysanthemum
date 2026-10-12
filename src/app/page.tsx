import Tracker from "@/components/Tracker";
import { loadState } from "@/lib/store";
import { getHeroes } from "@/lib/roster";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [state, { heroes }] = await Promise.all([loadState(), getHeroes()]);
  return <Tracker initial={state} heroes={heroes} />;
}
