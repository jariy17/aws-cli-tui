export type SupportedOperationMode = "list" | "get";
export type OperationMode = SupportedOperationMode | "unsupported";

export type InputField = {
  name: string;
  type: string;
  target?: string;
  resourceIdentifier?: string;
  defaultValue?: unknown;
  enumValues?: Array<string | number>;
  required: boolean;
  sensitive: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  documentation?: string;
};

export type Pagination = {
  inputToken: string;
  outputToken: string;
  items?: string;
};

export type ListItemField = {
  name: string;
  type: string;
  target?: string;
};

export type OperationEntry = {
  id: string;
  mode: OperationMode;
  action: string;
  supported: boolean;
  unsupportedReason?: string;
  operationName: string;
  displayName: string;
  resourceName: string;
  resourceNames?: string[];
  resourceIds?: string[];
  searchKeys: string[];
  serviceId: string;
  serviceTitle: string;
  serviceCliName: string;
  serviceVersion: string;
  modelFile?: string;
  documentation?: string;
  inputFields: InputField[];
  listItemFields?: ListItemField[];
  pagination?: Pagination;
};

export type ResourceIdentifier = {
  name: string;
  target: string;
};

export type ResourceEntry = {
  id: string;
  name: string;
  serviceCliName: string;
  identifiers: ResourceIdentifier[];
  operationIds: string[];
  childResourceIds: string[];
};

export type ServiceEntry = {
  id: string;
  name: string;
  cliName: string;
  modelDirectory?: string;
  title: string;
  version: string;
  modelFile: string;
  sdkId?: string;
  arnNamespace?: string;
  cloudFormationName?: string;
};

export type Catalog = {
  generatedAt: string;
  source: {
    repository: string;
    commit: string;
  };
  operationCount: number;
  operations: OperationEntry[];
  resources?: ResourceEntry[];
  services?: ServiceEntry[];
};
