import * as vscode from "vscode";

import {
  parseHeader,
  parseHeaderFromArray,
  type SafetensorsHeader,
} from "./safetensors";

class SafetensorsHeaderDocument implements vscode.CustomDocument {
  metadata: SafetensorsHeader["metadata"];
  tensors: SafetensorsHeader["tensors"];

  constructor(
    public readonly uri: vscode.Uri,
    header: SafetensorsHeader
  ) {
    const { metadata, tensors } = header;
    this.metadata = metadata;
    this.tensors = tensors;
  }

  dispose(): void {}
}

class FsApiDocument implements vscode.CustomDocument {
  resolved?: SafetensorsHeaderDocument;

  constructor(public readonly uri: vscode.Uri) {}

  async resolve(): Promise<SafetensorsHeaderDocument> {
    if (this.resolved) {
      return this.resolved;
    }

    const buffer = await vscode.workspace.fs.readFile(this.uri);
    const header = parseHeaderFromArray(buffer);
    this.resolved = new SafetensorsHeaderDocument(this.uri, header);
    return this.resolved;
  }

  dispose(): void {}
}

type MaybeResolvedDocument = SafetensorsHeaderDocument | FsApiDocument;

async function openDocument(uri: vscode.Uri): Promise<MaybeResolvedDocument> {
  if (uri.scheme === "file") {
    const header = await parseHeader(uri.fsPath);
    return new SafetensorsHeaderDocument(uri, header);
  } else {
    return new FsApiDocument(uri);
  }
}

class SafetensorsViewerProvider
  implements vscode.CustomReadonlyEditorProvider<MaybeResolvedDocument>
{
  constructor(private readonly _context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<MaybeResolvedDocument> {
    if (typeof openContext.backupId !== "undefined") {
      console.error("Readonly editor should not be opened with a backup");
    }
    return openDocument(uri);
  }

  async resolveCustomEditor(
    document: MaybeResolvedDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    if (document instanceof FsApiDocument && document.resolved) {
      document = document.resolved;
    }
    const header =
      document instanceof SafetensorsHeaderDocument
        ? {
            metadata: document.metadata,
            tensors: document.tensors,
          }
        : null;

    let nonceCode = <number[]>[];
    for (let i = 0; i < 32; i++) {
      const chars =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      nonceCode.push(
        chars.charCodeAt(Math.floor(Math.random() * chars.length))
      );
    }
    const nonce = String.fromCharCode(...nonceCode);
    const webview = webviewPanel.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, "dist"),
      ],
    };
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "dist", "view.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "dist", "view.css")
    );

    // prettier-ignore
    webview.html = /* html */ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />

          <meta http-equiv="Content-Security-Policy" content="
            default-src 'none';
            script-src 'nonce-${nonce}';
            style-src 'unsafe-inline' ${webview.cspSource};
            font-src ${webview.cspSource};
          " />

          <meta name="viewport" content="width=device-width, initial-scale=1.0" />

          <link rel="stylesheet" href="${styleUri}" />

          <script nonce="${nonce}" module>
            const safetensorsHeader = ${JSON.stringify(header)};
          </script>
          <script nonce="${nonce}" src="${scriptUri}" defer></script>

          <title>Saftensors Viewer</title>
        </head>
        <body></body>
      </html>
    `;
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "safetensors.safetensorsView",
      new SafetensorsViewerProvider(context),
      {
        supportsMultipleEditorsPerDocument: true,
      }
    )
  );
}
