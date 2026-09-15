export function operationToCliName(operationName) {
    return operationName
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
}
export function buildAwsCliArgs(entry, input, context) {
    const args = [entry.serviceCliName, operationToCliName(entry.operationName)];
    if (Object.keys(input).length > 0) {
        args.push("--cli-input-json", JSON.stringify(input));
    }
    if (context.profile)
        args.push("--profile", context.profile);
    if (context.region)
        args.push("--region", context.region);
    if (context.endpointUrl)
        args.push("--endpoint-url", context.endpointUrl);
    args.push("--output", "json", "--no-paginate", "--no-cli-pager");
    return args;
}
function quoteArgument(argument) {
    if (/^[a-zA-Z0-9_./:=@+-]+$/.test(argument))
        return argument;
    return `'${argument.replaceAll("'", "'\\''")}'`;
}
export function formatCommand(args, sensitiveValues = []) {
    const redacted = args.map((argument) => {
        let value = argument;
        for (const sensitive of sensitiveValues) {
            if (sensitive)
                value = value.replaceAll(sensitive, "***");
        }
        return quoteArgument(value);
    });
    return ["aws", ...redacted].join(" ");
}
//# sourceMappingURL=command-builder.js.map