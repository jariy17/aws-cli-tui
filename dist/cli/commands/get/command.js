import { runGet } from "./action.js";
import { collectInput } from "../../input.js";
import { awsContextFrom } from "../../options.js";
import { AmbiguousSearchError, formatMatches } from "../../resolve.js";
export function registerGet(program) {
    program
        .command("get")
        .description("Search and run an AWS Get or Describe API")
        .argument("[search]", "no-space API search token")
        .option("--input <key=value>", "API input; repeat for multiple values", collectInput, [])
        .action(async function (search, options) {
        if (!search) {
            const { renderTui } = await import("../../../tui/render.js");
            await renderTui({ context: awsContextFrom(this), mode: "get" });
            return;
        }
        try {
            console.log(JSON.stringify(await runGet(search, options.input, awsContextFrom(this)), null, 2));
        }
        catch (error) {
            if (error instanceof AmbiguousSearchError) {
                throw new Error(`Search is ambiguous:\n${formatMatches(error.matches)}`);
            }
            throw error;
        }
    });
}
//# sourceMappingURL=command.js.map