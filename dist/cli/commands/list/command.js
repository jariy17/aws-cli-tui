import { runList } from "./action.js";
import { awsContextFrom } from "../../options.js";
import { AmbiguousSearchError, formatMatches } from "../../resolve.js";
export function registerList(program) {
    program
        .command("list")
        .description("Search and run a parameterless AWS List API")
        .argument("[search]", "no-space API search token")
        .action(async function (search) {
        if (!search) {
            const { renderTui } = await import("../../../tui/render.js");
            await renderTui({ context: awsContextFrom(this), mode: "list" });
            return;
        }
        try {
            console.log(JSON.stringify(await runList(search, awsContextFrom(this)), null, 2));
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