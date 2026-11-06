// The browser version: the backup is offered to the share sheet when the browser can share files (Safari on iPhone
// can, so it can go to Files or iCloud Drive), and otherwise downloaded.

export async function handOverFile(name: string, bytes: Uint8Array): Promise<boolean> {
  const blob = new Blob([bytes as BlobPart], { type: "application/zip" });
  const file = new File([blob], name, { type: "application/zip" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      // The person closed the share sheet: nothing was saved, and that was their choice.
      if ((e as Error).name === "AbortError") throw new Error("The backup file was not saved.");
      // Otherwise (for example the browser wants a fresh tap), download it instead.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export async function readPickedFile(uri: string): Promise<Uint8Array> {
  return new Uint8Array(await (await fetch(uri)).arrayBuffer());
}
