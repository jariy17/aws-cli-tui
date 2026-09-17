import type { RelatedResource } from "../../model/catalog.js";
import { type ResourcePath } from "../resource-route.js";
export declare function RelatedResourcesScreen({ parentName, relations, resourcePath, context, onSelect, onBack, }: {
    parentName: string;
    relations: RelatedResource[];
    resourcePath?: ResourcePath;
    context?: string;
    onSelect: (relation: RelatedResource) => void;
    onBack: () => void;
}): import("react").JSX.Element;
