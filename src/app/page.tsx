import Tracker from "@/components/Tracker";
import { loadState } from "@/lib/store";
import { getFrames, getHeroes, getOffers } from "@/lib/roster";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [state, { heroes }, frames, offers] = await Promise.all([loadState(), getHeroes(), getFrames(), getOffers()]);
  return <Tracker initial={state} heroes={heroes} frames={frames} offers={offers} />;
}
