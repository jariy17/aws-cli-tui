export type OperationMode = "list" | "get";

export type InputField = {
  name: string;
  type: string;
  target?: string;
  resourceIdentifier?: string;
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

export type OperationEntry = {
  id: string;
  mode: OperationMode;
  operationName: string;
  displayName: string;
  resourceName: string;
  resourceNames?: string[];
  searchKeys: string[];
  serviceId: string;
  serviceTitle: string;
  serviceCliName: string;
  serviceVersion: string;
  modelFile?: string;
  documentation?: string;
  inputFields: InputField[];
  pagination?: Pagination;
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
  services?: ServiceEntry[];
};
