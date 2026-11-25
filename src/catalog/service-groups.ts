/**
 * 服务代理组的声明式目录。
 *
 * 每个服务组都是一个自包含的对象，只需在此处新增/删除一条记录即可调整服务组，
 * 无需改动组装逻辑（`builders/proxy-groups.ts`）。
 */

import { COUNTRY_KEYS } from "./countries";
import { countryGroupName, PROXY_GROUPS, providerGroupName } from "./group-names";
import { ICONS } from "./icons";
import type { GroupBuildContext, ProxyGroupCandidate } from "../types/proxy";

export interface ServiceGroupDef {
    name: string;
    icon: string;
    includeAll?: boolean;
    proxies: (ctx: GroupBuildContext) => ProxyGroupCandidate[];
}

function prioritizeLowCost(ctx: GroupBuildContext): ProxyGroupCandidate[] {
    const { defaultProxies } = ctx.lists;
    if (!defaultProxies.includes(PROXY_GROUPS.LOW_COST)) return defaultProxies;

    return [
        PROXY_GROUPS.LOW_COST,
        ...defaultProxies.filter((candidate) => candidate !== PROXY_GROUPS.LOW_COST),
    ];
}

function withProvidersAndManual(ctx: GroupBuildContext, base: ProxyGroupCandidate[]): ProxyGroupCandidate[] {
    const providerNames = (ctx.nodes.providerInfo || []).map((p) => providerGroupName(p.provider));
    const extras: ProxyGroupCandidate[] = [];
    if (ctx.nodes.regionLayout.mode === "grouped" && !base.includes(PROXY_GROUPS.MANUAL)) {
        extras.push(PROXY_GROUPS.MANUAL);
    }
    for (const name of providerNames) {
        if (!base.includes(name)) extras.push(name);
    }
    return [...extras, ...base];
}

export const serviceGroups: ServiceGroupDef[] = [
    {
        name: PROXY_GROUPS.STATIC_RESOURCES,
        icon: ICONS.staticResources,
        proxies: (ctx) => withProvidersAndManual(ctx, prioritizeLowCost(ctx)),
    },
    {
        name: PROXY_GROUPS.AI_SERVICE,
        icon: ICONS.aiService,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.CRYPTO,
        icon: ICONS.crypto,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.FINANCE,
        icon: ICONS.finance,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxiesDirect),
    },
    {
        name: PROXY_GROUPS.APPLE,
        icon: ICONS.apple,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.GOOGLE,
        icon: ICONS.google,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.MICROSOFT,
        icon: ICONS.microsoft,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.XBOX,
        icon: ICONS.xbox,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.GITHUB,
        icon: ICONS.github,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.BILIBILI,
        icon: ICONS.bilibili,
        proxies: (ctx) => {
            const groupedCountries = ctx.nodes.regionLayout.groupedCountries;
            const base = groupedCountries.includes(COUNTRY_KEYS.taiwan) &&
                groupedCountries.includes(COUNTRY_KEYS.hongKong)
                ? [
                      "DIRECT",
                      countryGroupName(COUNTRY_KEYS.taiwan),
                      countryGroupName(COUNTRY_KEYS.hongKong),
                  ]
                : ctx.lists.defaultProxiesDirect;
            return withProvidersAndManual(ctx, base);
        },
    },
    {
        name: PROXY_GROUPS.BAHAMUT,
        icon: ICONS.bahamut,
        proxies: (ctx) =>
            withProvidersAndManual(
                ctx,
                ctx.nodes.regionLayout.groupedCountries.includes(COUNTRY_KEYS.taiwan)
                    ? [
                          countryGroupName(COUNTRY_KEYS.taiwan),
                          PROXY_GROUPS.SELECT,
                          PROXY_GROUPS.MANUAL,
                          "DIRECT",
                      ]
                    : ctx.lists.defaultProxies
            ),
    },
    {
        name: PROXY_GROUPS.YOUTUBE,
        icon: ICONS.youtube,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.TWITCH,
        icon: ICONS.twitch,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.NETFLIX,
        icon: ICONS.netflix,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.TIKTOK,
        icon: ICONS.tiktok,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.SPOTIFY,
        icon: ICONS.spotify,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.TELEGRAM,
        icon: ICONS.telegram,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.TWITTER,
        icon: ICONS.twitter,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.WEIBO,
        icon: ICONS.weibo,
        includeAll: true,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxiesDirect),
    },
    {
        name: PROXY_GROUPS.TRUTH_SOCIAL,
        icon: ICONS.truthSocial,
        proxies: (ctx) =>
            withProvidersAndManual(
                ctx,
                ctx.nodes.regionLayout.groupedCountries.includes(COUNTRY_KEYS.unitedStates)
                    ? [
                          countryGroupName(COUNTRY_KEYS.unitedStates),
                          PROXY_GROUPS.SELECT,
                          PROXY_GROUPS.MANUAL,
                      ]
                    : ctx.lists.defaultProxies
            ),
    },
    {
        name: PROXY_GROUPS.EHENTAI,
        icon: ICONS.ehentai,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.PIKPAK,
        icon: ICONS.pikpak,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.SOGOU_INPUT,
        icon: ICONS.sogouInput,
        proxies: (ctx) => withProvidersAndManual(ctx, ["DIRECT", "REJECT"]),
    },
    {
        name: PROXY_GROUPS.SSH,
        icon: ICONS.ssh,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
    {
        name: PROXY_GROUPS.BT_PT_TRACKER,
        icon: ICONS.ssh,
        includeAll: true,
        proxies: (ctx) => withProvidersAndManual(ctx, ctx.lists.defaultProxies),
    },
];
