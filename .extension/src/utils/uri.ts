/**
 * URI Utility Functions
 *
 * Shared utility functions for resolving VS Code URIs from various sources
 * (command arguments, tree items, editor contexts, etc.)
 */

import * as vscode from "vscode";

/**
 * Type guard to check if a value is a vscode.Uri instance.
 *
 * @param value - The value to check
 * @returns True if the value is a vscode.Uri
 */
export function isUri(value: unknown): value is vscode.Uri {
  return value instanceof vscode.Uri;
}

/**
 * Resolve a URI from various input sources.
 *
 * This function handles the many ways VS Code can pass file references:
 * - Direct Uri objects
 * - String paths
 * - Arrays containing URIs
 * - Objects with uri, resourceUri, fsPath, or path properties
 *
 * @param resource - The resource to resolve (can be Uri, string, array, or object)
 * @returns The resolved vscode.Uri, or undefined if resolution fails
 *
 * @example
 * // From command argument
 * const uri = resolveUri(resource);
 *
 * @example
 * // From tree item
 * const uri = resolveUri(treeItem);
 */
export function resolveUri(resource: unknown): vscode.Uri | undefined {
  if (!resource) {
    return undefined;
  }

  // Handle arrays (e.g., multi-select in explorer)
  if (Array.isArray(resource)) {
    return resolveUri(resource[0]);
  }

  // Handle string paths
  if (typeof resource === "string") {
    return vscode.Uri.file(resource);
  }

  // Handle direct Uri objects
  if (isUri(resource)) {
    return resource;
  }

  // Handle objects with uri-like properties
  if (typeof resource === "object") {
    const candidate = resource as {
      uri?: unknown;
      resourceUri?: unknown;
      path?: unknown;
      fsPath?: unknown;
    };

    if (candidate.uri && isUri(candidate.uri)) {
      return candidate.uri;
    }
    if (candidate.resourceUri && isUri(candidate.resourceUri)) {
      return candidate.resourceUri;
    }
    if (typeof candidate.fsPath === "string") {
      return vscode.Uri.file(candidate.fsPath);
    }
    if (typeof candidate.path === "string") {
      return vscode.Uri.file(candidate.path);
    }
  }

  return undefined;
}
