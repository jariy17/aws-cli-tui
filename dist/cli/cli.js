import { Command } from "commander";
import { registerGet } from "./commands/get/index.js";
import { registerList } from "./commands/list/index.js";
import { addAwsOptions, awsContextFrom } from "./options.js";
export function createProgram() {
    const program = addAwsOptions(new Command()
        .name("awstui")
        .description("Search-first TUI for read-only AWS APIs")
        .version("0.1.1")
        .showHelpAfterError()
        .showSuggestionAfterError());
    registerList(program);
    registerGet(program);
    program.action(async function () {
        const { renderTui } = await import("../tui/render.js");
        await renderTui({ context: awsContextFrom(this) });
    });
    return program;
}
export async function main(argv) {
    const program = createProgram();
    await program.parseAsync(argv);
}
//# sourceMappingURL=cli.js.map