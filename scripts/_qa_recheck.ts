/** TEMP: re-run QA on the previously-rejected tools image to confirm the item-15 fix. */
import "dotenv/config";
import { runPosterQa } from "@/lib/poster-qa";

(async () => {
  const url = "https://utw6qxegmmsk2aex.public.blob.vercel-storage.com/poster-library/tools_flatlay-1781551344576-474059419.png";
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const qa = await runPosterQa(buf);
  console.log("VERDICT: " + qa.verdict);
  console.log(qa.report);
  process.exit(0);
})();
