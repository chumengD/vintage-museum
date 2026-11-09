// IndexedDB keeps image uploads out of localStorage's small string quota.
const name = "vintage-museum-demo-v2";
let database;
function openDatabase() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("archive");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  return database;
}
export async function readArchive() {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("archive").objectStore("archive").get("data");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function writeArchive(data) {
  if (typeof indexedDB === "undefined") return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("archive", "readwrite");
    tx.objectStore("archive").put(data, "data");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
