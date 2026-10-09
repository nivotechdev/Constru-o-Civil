// Photos and videos picked on the device (job photos, profile/company pictures, portfolio posts).
// Demo: the file is shown from a local blob URL that lives while the tab is open, exactly like the
// legacy app — nothing is uploaded. With a backend this is where the upload to storage happens.
export function mediaUrl(file: File): string {
  return URL.createObjectURL(file);
}
