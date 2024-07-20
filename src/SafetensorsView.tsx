import React from "react";

import {
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";

import { type SafetensorsHeader, type TensorDescription } from "./safetensors";

declare global {
  const safetensorsHeader: SafetensorsHeader;
}

type TensorTree = Map<string, TensorTree | TensorDescription>;

function makeTree(
  flattenTensors: Record<string, TensorDescription>
): TensorTree | string {
  const tree = new Map();
  for (const [name, tensor] of Object.entries(flattenTensors)) {
    const parts = name.split(".");
    let current = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current.has(parts[i])) {
        current.set(parts[i], new Map());
      }
      const item = current.get(parts[i]);
      if (!(item instanceof Map)) {
        return `Failed to build tensor tree: ${name} conflicts with other tensor`;
      }
      current = item;
    }
    if (current.has(parts[parts.length - 1])) {
      return `Failed to build tensor tree: duplicate tensor name ${name}`;
    }
    current.set(parts[parts.length - 1], tensor);
  }
  return tree;
}

export function Root() {
  return (
    <VSCodeDataGrid>
      <VSCodeDataGridRow rowType="sticky-header">
        <VSCodeDataGridCell cell-type="columnheader" grid-column="1">
          Name
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cell-type="columnheader" grid-column="2">
          Shape
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cell-type="columnheader" grid-column="3">
          DType
        </VSCodeDataGridCell>
      </VSCodeDataGridRow>
      {Object.entries(safetensorsHeader.tensors).map(([name, tensor]) => (
        <VSCodeDataGridRow key={name}>
          <VSCodeDataGridCell grid-column="1">{name}</VSCodeDataGridCell>
          <VSCodeDataGridCell grid-column="2">
            {tensor.shape.join("x")}
          </VSCodeDataGridCell>
          <VSCodeDataGridCell grid-column="3">
            {tensor.dtype}
          </VSCodeDataGridCell>
        </VSCodeDataGridRow>
      ))}
    </VSCodeDataGrid>
  );
}
