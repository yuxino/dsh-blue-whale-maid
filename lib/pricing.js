/**
 * DeepSeek 官方价格引擎（纯函数，无依赖）。
 *
 * 移植自 bpc-oss/dsh-web-billing（MIT）：https://github.com/bpc-oss/dsh-web-billing
 * （lib/pricing.js）。保留官方政策时间表与峰谷判定，去掉用户覆盖配置（本插件
 * 不需要）。价格表策展自 DeepSeek 官方公告（https://api-docs.deepseek.com/zh-cn/quick_start/pricing/），
 * 如官方调整欢迎同步更新。
 *
 * 语义约定（与 DeepSeek 官方及 provider 适配器一致）：
 * - input      缓存未命中输入
 * - cacheRead  缓存命中输入
 * - output     输出
 * 单价单位：每 1M tokens，人民币（cny）与美元（usd）各一份。
 */

/** 峰谷判定的默认时区（北京时间）。 */
export const DEFAULT_TIMEZONE = "Asia/Shanghai";

/** 官方高峰时段（本地小时，[start, end) 闭开区间）。 */
export const DEFAULT_PEAK_WINDOWS = [[9, 12], [14, 18]];

/** 官方高峰仅适用于北京时间工作日（周一至周五）。 */
export const DEFAULT_PEAK_WEEKDAYS = [1, 2, 3, 4, 5];

const ZERO_UNIT = Object.freeze({ input: 0, cacheRead: 0, output: 0 });

/**
 * 官方政策时间表（`since` 为生效时刻，含时区偏移）。每条政策要么是固定单价表
 * （`prices`），要么是峰谷单价表（`peak`/`offPeak`）。每个模型条目的值为
 * `{ cny: {...}, usd: {...} }` 双币种单价。新政策通过追加条目生效——`since`
 * 最晚且不晚于消息时间的政策胜出。
 */
export const OFFICIAL_PRICING_POLICIES = [
  {
    since: "2025-02-09T00:00:00+08:00",
    label: "deepseek-chat / deepseek-reasoner 标准价（2025-02-09 优惠期结束）",
    prices: {
      "deepseek-chat": {
        cny: { input: 2, cacheRead: 0.5, output: 8 },
        usd: { input: 0.28, cacheRead: 0.028, output: 0.42 }
      },
      "deepseek-reasoner": {
        cny: { input: 4, cacheRead: 1, output: 16 },
        usd: { input: 0.55, cacheRead: 0.055, output: 1.68 }
      },
      "*": {
        cny: { input: 2, cacheRead: 0.5, output: 8 },
        usd: { input: 0.28, cacheRead: 0.028, output: 0.42 }
      }
    }
  },
  {
    since: "2026-05-22T00:00:00+08:00",
    label: "V4 系列 75% 降价转永久（deepseek-v4-flash / deepseek-v4-pro 上线）",
    prices: {
      "deepseek-v4-flash": {
        cny: { input: 1, cacheRead: 0.02, output: 2 },
        usd: { input: 0.14, cacheRead: 0.0028, output: 0.28 }
      },
      "deepseek-v4-pro": {
        cny: { input: 3, cacheRead: 0.025, output: 6 },
        usd: { input: 0.435, cacheRead: 0.003625, output: 0.87 }
      },
      "*": {
        cny: { input: 1, cacheRead: 0.02, output: 2 },
        usd: { input: 0.14, cacheRead: 0.0028, output: 0.28 }
      }
    }
  },
  {
    since: "2026-08-17T00:00:00+08:00",
    label: "峰谷定价：工作日高峰 09:00-12:00 / 14:00-18:00（北京时间），其余时段半价",
    peak: {
      "deepseek-v4-flash": {
        cny: { input: 3, cacheRead: 0.1, output: 9 },
        usd: { input: 0.44, cacheRead: 0.014, output: 1.32 }
      },
      "deepseek-v4-flash-vision-exp": {
        cny: { input: 3, cacheRead: 0.1, output: 9 },
        usd: { input: 0.44, cacheRead: 0.014, output: 1.32 }
      },
      "deepseek-v4-pro": {
        cny: { input: 9, cacheRead: 0.3, output: 27 },
        usd: { input: 1.32, cacheRead: 0.044, output: 3.96 }
      },
      "*": {
        cny: { input: 3, cacheRead: 0.1, output: 9 },
        usd: { input: 0.44, cacheRead: 0.014, output: 1.32 }
      }
    },
    offPeak: {
      "deepseek-v4-flash": {
        cny: { input: 1.5, cacheRead: 0.05, output: 4.5 },
        usd: { input: 0.22, cacheRead: 0.007, output: 0.66 }
      },
      "deepseek-v4-flash-vision-exp": {
        cny: { input: 1.5, cacheRead: 0.05, output: 4.5 },
        usd: { input: 0.22, cacheRead: 0.007, output: 0.66 }
      },
      "deepseek-v4-pro": {
        cny: { input: 4.5, cacheRead: 0.15, output: 13.5 },
        usd: { input: 0.66, cacheRead: 0.022, output: 1.98 }
      },
      "*": {
        cny: { input: 1.5, cacheRead: 0.05, output: 4.5 },
        usd: { input: 0.22, cacheRead: 0.007, output: 0.66 }
      }
    }
  }
];

/** 某时刻生效的官方政策（第一个 `since` 之前取第一条）。 */
export function activePolicy(timeMs, policies = OFFICIAL_PRICING_POLICIES) {
  let active = policies[0];
  for (const policy of policies) {
    const since = Date.parse(policy.since);
    if (Number.isFinite(since) && timeMs >= since) active = policy;
  }
  return active;
}

/** 该时刻是否处于高峰时段（按指定时区、工作日与窗口判定；窗口为 [start, end) 小时）。 */
export function isPeak(timeMs, timezone = DEFAULT_TIMEZONE, windows = DEFAULT_PEAK_WINDOWS, weekdays = DEFAULT_PEAK_WEEKDAYS) {
  let hour;
  let weekday;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "numeric",
      minute: "numeric",
      weekday: "short"
    }).formatToParts(new Date(timeMs));
    hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
    const weekdayName = parts.find((part) => part.type === "weekday")?.value;
    weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
  } catch {
    // 非法时区等异常按非高峰处理，不阻断计价。
    hour = -1;
    weekday = -1;
  }
  return weekdays.includes(weekday) && windows.some(([start, end]) => hour >= start && hour < end);
}

/** 在单张价格表内取模型单价（含 `*` 兜底）。 */
function priceFor(model, table) {
  return table[model] ?? table["*"] ?? ZERO_UNIT;
}

/**
 * 计算某模型在某一时刻的单价（双币种）。
 *
 * 解析顺序（政策链继承）：
 * 1. 从新到旧遍历「不晚于消息时刻」的政策，取第一个点名该模型的政策单价
 *    （被新政策下架的模型自动沿用旧政策价格，历史账单才与平台一致）；
 * 2. 没有任何政策点名 → 明确返回零价且 `priced: false`，避免把兼容网关
 *    上的私有模型误套成 DeepSeek Flash 价格。
 *
 * @param model - 模型名。
 * @param timeMs - 消息时间（epoch ms）。
 * @param opts - { timezone, peakWindows, peakWeekdays, policies }。
 * @returns { cny, usd, mode, policy } — mode: 'flat' | 'peak' | 'offPeak'。
 */
export function priceAt(model, timeMs, opts) {
  const {
    timezone = DEFAULT_TIMEZONE,
    peakWindows = DEFAULT_PEAK_WINDOWS,
    peakWeekdays = DEFAULT_PEAK_WEEKDAYS,
    policies = OFFICIAL_PRICING_POLICIES
  } = opts ?? {};
  const peak = isPeak(timeMs, timezone, peakWindows, peakWeekdays);
  const applicable = policies.filter((policy) => timeMs >= Date.parse(policy.since));
  const scope = applicable.length > 0 ? applicable : [policies[0]];
  let winner;
  let named = false;
  let baseTable;
  for (let index = scope.length - 1; index >= 0; index--) {
    const policy = scope[index];
    const table = policy.peak !== void 0 && policy.offPeak !== void 0
      ? (peak ? policy.peak : policy.offPeak)
      : policy.prices;
    if (model !== "*" && table[model] !== void 0) {
      winner = policy;
      named = true;
      baseTable = table;
      break;
    }
  }
  if (winner === void 0) {
    winner = scope[scope.length - 1];
    baseTable = winner.peak !== void 0 && winner.offPeak !== void 0
      ? (peak ? winner.peak : winner.offPeak)
      : winner.prices;
  }
  const unit = named
    ? priceFor(model, baseTable)
    : { cny: ZERO_UNIT, usd: ZERO_UNIT };
  return {
    cny: unit.cny,
    usd: unit.usd,
    priced: named,
    mode: winner.peak !== void 0 && winner.offPeak !== void 0 ? (peak ? "peak" : "offPeak") : "flat",
    policy: { since: winner.since, label: winner.label }
  };
}

/**
 * 按 TokenUsage 与单价计算费用（双币种）与 token 拆分。
 * @param usage - `{ inputTokens, cacheReadTokens?, outputTokens }`（assistant/message 事件上报）。
 * @param unit - `priceAt` 返回的单价（`cny`/`usd`）。
 * @returns { inputTokens, cacheReadTokens, outputTokens, cost, costUsd }。
 */
export function costOf(usage, unit) {
  const inputTokens = usage.inputTokens ?? 0;
  const cacheReadTokens = usage.cacheReadTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const cost = (inputTokens * unit.cny.input + cacheReadTokens * unit.cny.cacheRead + outputTokens * unit.cny.output) / 1e6;
  const costUsd = (inputTokens * unit.usd.input + cacheReadTokens * unit.usd.cacheRead + outputTokens * unit.usd.output) / 1e6;
  return { inputTokens, cacheReadTokens, outputTokens, cost, costUsd };
}
