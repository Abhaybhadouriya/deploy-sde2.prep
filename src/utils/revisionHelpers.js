export function cssId(id) {
  return id.replace(/\./g, "_");
}

export function todayStr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

function parseDDMMYY(s) {
  const [dd, mm, yy] = s.split("-").map(Number);
  return new Date(2000 + yy, mm - 1, dd);
}

export function daysSince(dateStr) {
  const then = parseDDMMYY(dateStr);
  const now = new Date();
  then.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function statusFor(days) {
  if (days === null) return "red";
  if (days >= 30) return "red";
  if (days > 15) return "orange";
  if (days > 7) return "yellow";
  return "green";
}

export function computeHealthCounts(revisionMap) {
  const counts = { red: 0, orange: 0, yellow: 0, green: 0 };
  Object.values(revisionMap).forEach((value) => {
    const days = value && value.lastRevised ? daysSince(value.lastRevised) : null;
    const status = statusFor(days);
    counts[status] += 1;
  });
  return counts;
}

export const REVISION_NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/lld", label: "LLD", key: "lld" },
  { to: "/hld", label: "HLD", key: "hld" },
  { to: "/devops", label: "DevOps", key: "devops" },
];
