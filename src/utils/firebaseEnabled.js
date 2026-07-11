export function isFirebaseEnabled() {
  const projectId = "devtubein";
  const apiKey = "AIzaSyAaojj5u32q2KfmzLJGmh8mog1jOLsbUXI";
  return projectId !== "demo-project" && apiKey !== "demo-api-key";
}

