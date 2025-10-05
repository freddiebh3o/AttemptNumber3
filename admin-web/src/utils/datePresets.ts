// admin-web/src/utils/datePresets.ts
import dayjs from "dayjs";

export type DatePreset = { label: string; value: string };

/**
 * Build common single-date presets relative to "now".
 * Use valueFormat="YYYY-MM-DD" on your <DatePickerInput /> to match the value strings.
 */
export function buildCommonDatePresets(
  opts?: { base?: dayjs.Dayjs; format?: string }
): DatePreset[] {
  const base = opts?.base ?? dayjs();
  const fmt = opts?.format ?? "YYYY-MM-DD";

  return [
    { label: "Yesterday",  value: base.subtract(1, "day").format(fmt) },
    { label: "Today",      value: base.format(fmt) },
    { label: "Tomorrow",   value: base.add(1, "day").format(fmt) },
    { label: "Next month", value: base.add(1, "month").format(fmt) },
    { label: "Next year",  value: base.add(1, "year").format(fmt) },
    { label: "Last month", value: base.subtract(1, "month").format(fmt) },
    { label: "Last year",  value: base.subtract(1, "year").format(fmt) },
  ];
}

/**
 * If you ever need Date objects instead of strings.
 */
export function buildCommonDatePresetsAsDates(
  opts?: { base?: dayjs.Dayjs }
): { label: string; value: Date }[] {
  const base = opts?.base ?? dayjs();
  return [
    { label: "Yesterday",  value: base.subtract(1, "day").toDate() },
    { label: "Today",      value: base.toDate() },
    { label: "Tomorrow",   value: base.add(1, "day").toDate() },
    { label: "Next month", value: base.add(1, "month").toDate() },
    { label: "Next year",  value: base.add(1, "year").toDate() },
    { label: "Last month", value: base.subtract(1, "month").toDate() },
    { label: "Last year",  value: base.subtract(1, "year").toDate() },
  ];
}
