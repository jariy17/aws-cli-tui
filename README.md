# aws-cli-tui

Search-first terminal UI for AWS APIs. List, Get, and Describe operations can
run today; every other Smithy operation remains searchable and is shown dimmed
as unsupported.

The complete operation catalog is generated from the public
[`aws/api-models-aws`](https://github.com/aws/api-models-aws) Smithy JSON AST. Users search across API and resource
names with one fuzzy, typo-tolerant no-space token. Exact normalized matches rank first. AWS service names are not a
navigation level; the resolved service appears on operation and resource detail views.

## Demo

<a href="docs/assets/awstui-demo.mp4">
  <img src="docs/assets/awstui-demo.gif" alt="Animated awstui walkthrough: ListAgentRuntimes search, GetAgentRuntime detail, and roleArn drill-through to IAM GetRole" width="1104">
</a>

Click the animation to open the MP4. The screenshots and recording were
captured with TUI Harness using synthetic AWS responses; they contain no
customer or account data.

### Fuzzy API search

![Fuzzy API search showing API, mode, service, and resource columns](docs/assets/search.png)

### Paginated List view

![DynamoDB ListTables page with selectable rows and pagination status](docs/assets/list-tables.png)

### Focusable JSON detail

![DescribeTable JSON with the TableArn entry focused and the IndexArn left unlinked](docs/assets/table-detail.png)

## Requirements

- Node.js 20 or later
- AWS CLI v2 on `PATH`
- Configured AWS credentials

## Install from GitHub

Install the packaged GitHub release:

```bash
npm install --global \
  https://github.com/jariy17/aws-cli-tui/releases/download/v0.1.1/aws-cli-tui-0.1.1.tgz
```

To install the latest `main` branch instead, force npm to materialize Git
dependencies rather than linking its temporary checkout:

```bash
npm install --global --install-links github:jariy17/aws-cli-tui
```

If the project was previously installed with `npm link`, unlink that
development installation once before switching:

```bash
npm unlink --global aws-cli-tui
npm install --global --install-links github:jariy17/aws-cli-tui
```

Then launch it with an AWS CLI profile and region:

```bash
awstui --profile my-profile --region us-west-2
```

The tool uses the AWS CLI's existing credential chain. Configure credentials
first with `aws configure`, `aws configure sso`, or your usual profile setup.

## Install from a clone

```bash
git clone https://github.com/jariy17/aws-cli-tui.git
cd aws-cli-tui
npm ci
npm link

awstui --profile my-profile --region us-west-2
```

To run without creating a global link:

```bash
npm start -- --profile my-profile --region us-west-2
```

Type a no-space search such as `agentruntime`, `listagentruntimes`, `tables`, or `buckets`. Typos and abbreviated
subsequences such as `agentruntmie` or `agntrntm` are supported.

The search view uses the same flat table layout as List pages. It reserves fixed
rows, shows API, action, and service in columns, and keeps the selected
operation's input/pagination summary beneath the table.

Unsupported actions such as Create, Update, Delete, and Invoke are generated
from the same Smithy models and shown dimmed. They can be searched and
inspected in the result table, but Enter only runs supported List, Get, and
Describe operations.

Search and List tables fill the available terminal height regardless of result
count. The bottom three rows are reserved for status, help, and the hidden
debug line.

Views use React Router's in-memory URL patterns. Routes identify API search,
operation inputs, List pages, selected entries, resource details, and related
resources. Back restores the previous route state, and stale asynchronous
responses cannot replace a newer view.

Prefix a no-space query with `service:` or `resource:` to scope it:

```text
service:sns
resource:topic
```

The Resource column uses formal Smithy resource-operation relationships when
available and falls back to the operation-derived resource name.

## Direct commands

```bash
# List API; returns the first API page as JSON
awstui list agentruntime --profile my-profile --region us-west-2

# List API with required Smithy inputs
awstui list memoryrecords \
  --input memoryId=my-memory-id \
  --input namespace=/users/example \
  --profile my-profile \
  --region us-west-2

# Get/Describe API; repeat --input for required identifiers
awstui get agentruntime \
  --input agentRuntimeId=my-runtime-id \
  --profile my-profile \
  --region us-west-2
```

List operations open an input view only for unresolved required Smithy inputs.
Optional inputs are omitted initially, pagination tokens are managed
internally, and modeled defaults are included automatically. Press `E` on a
List page to configure its optional Smithy inputs and rerun from page 1.
Booleans and enums render as filterable dropdowns. Left and Right move between
API pages. Press `/` on a List page to fuzzy search only the rows already
loaded for that page; this never makes another AWS request.

Pressing Enter on a List row opens a compatible Get/Describe detail API when
its Smithy-declared inputs can be filled exactly from the selected row and the
original List request. Selected-row values take precedence. For example, a
DynamoDB table name from `ListTables` is passed to `DescribeTable` as
`TableName`; `GetMemoryRecord` combines a selected `memoryRecordId` with the
`memoryId` entered for `ListMemoryRecords`.

## TUI controls

- Type letters or numbers: update the global fuzzy no-space search
- Up/Down: select a matching API, list row, or JSON entry
- Left/Right: move between result, API, or detail pages
- Enter: run an API or open/get the selected row
- `/` outside the main search: fuzzy filter the current view
- `E` on a List page: configure optional inputs and rerun from page 1
- `R` on a resource detail page: open its related resources
- Escape: clear search or go back

Resource views keep the navigation route and resolved Smithy keys in the
header. For example:

```text
>_ AWS TUI · Memory › Sessions       Amazon Bedrock AgentCore · Page 2/2
ListSessions · memoryId=mem-123 · actorId=actor-456 · maxResults=100
```

The detail page shows:

- Friendly AWS service title and Smithy operation in the header
- Syntax-colored, pretty-printed resource or Get response JSON
- Focusable JSON entries, with verified ARN values available to open
- Related child collections whose List inputs can inherit a parent identifier

Related resources prefer explicit Smithy `resources` relationships. When a
model does not declare a child resource, the catalog conservatively offers a
List operation only when it shares the modeled parent resource, belongs to the
same AWS service family, and can inherit a parent identifier exactly. For
example, `GetMemory` can open `ListMemoryRecords`, while
`GetPaymentManager` follows the explicit Smithy child relationship to
`ListPaymentConnectors`. Press `R`, or move to the related-resources entry and
press Enter, then select the child collection and enter any inputs that were
not inherited.

On a detail page, only ARNs that resolve to an unambiguous read operation are
highlighted and selectable. Other ARN strings, such as a DynamoDB `IndexArn`
without a direct index read API, remain ordinary JSON. The resolver checks the
current public Smithy model on GitHub for the source and target services,
follows `aws.api#arnReference` to a resource `read` operation when available,
and otherwise uses a conservative ARN/service/Get-or-Describe fallback. Models
are conditionally cached with GitHub ETags, so every drill-through checks for a
newer model without redownloading unchanged JSON.

Smithy model directory names and AWS CLI service commands are stored
separately. For example, the public model lives under `dynamodb-streams`, while
execution correctly uses `aws dynamodbstreams`.

## Refresh the Smithy catalog

Clone the public model repository, then regenerate:

```bash
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/aws/api-models-aws.git /tmp/api-models-aws
git -C /tmp/api-models-aws sparse-checkout set models
npm run models:generate -- /tmp/api-models-aws
```

The generated catalog records the source repository and commit SHA.

## Development

```bash
npm run typecheck
npm test
npm run build
```
