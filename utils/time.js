const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateString(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function kstIsoLocal(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().replace("Z", "");
}

function previousDateString(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString))) {
    return null;
  }

  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function kstDateDaysAgo(days) {
  return kstDateString(new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000));
}

module.exports = {
  KST_OFFSET_MS,
  kstDateString,
  kstIsoLocal,
  previousDateString,
  kstDateDaysAgo
};
