export function addAwsOptions(command) {
    return command
        .option("--profile <name>", "AWS shared-config profile")
        .option("--region <region>", "AWS region")
        .option("--endpoint-url <url>", "Override the AWS service endpoint");
}
export function awsContextFrom(command) {
    const options = command.optsWithGlobals();
    return {
        ...(options.profile ? { profile: options.profile } : {}),
        ...(options.region ? { region: options.region } : {}),
        ...(options.endpointUrl ? { endpointUrl: options.endpointUrl } : {}),
    };
}
//# sourceMappingURL=options.js.map