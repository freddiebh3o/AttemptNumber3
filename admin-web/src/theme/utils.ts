// admin-web/src/theme/utils.ts
export function deepMerge<T extends object>(...objs: Partial<T>[]): T {
  const isObj = (v: any) => v && typeof v === "object" && !Array.isArray(v);
  const out: any = {};
  for (const obj of objs) {
    for (const [k, v] of Object.entries(obj || {})) {
      if (isObj(v) && isObj(out[k])) out[k] = deepMerge(out[k], v as any);
      else out[k] = v;
    }
  }
  return out as T;
}
