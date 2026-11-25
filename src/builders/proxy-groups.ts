/**
 * 代理组组装：将前置组、服务组、尾部固定组、地区组、供应商组、多WAN组按既定顺序拼接为完整的代理组列表。
 */

import { countriesMeta } from "../catalog/countries";
import { countryGroupName, providerGroupName, PROXY_GROUPS } from "../catalog/group-names";
import { ICONS } from "../catalog/icons";
import { LOW_COST_NODE_MATCHER } from "../catalog/low-cost";
import { serviceGroups } from "../catalog/service-groups";
import {
    buildGroupByType,
    fallbackGroup,
    selectAllGroup,
    selectGroup,
    urlTestGroup,
} from "../domain/proxy-group";
import { isNotNull } from "../utils/primitives";
import { buildNodeExcludeFilter, combineExcludeFilters } from "../utils/regex";
import type { GroupBuildContext, ProxyGroup } from "../types/proxy";

function buildManualGroup(ctx: GroupBuildContext): ProxyGroup | null {
    if (ctx.nodes.regionLayout.mode !== "grouped") return null;

    if (ctx.flags.regexFilter) {
        return selectAllGroup(
            PROXY_GROUPS.MANUAL,
            ICONS.manual,
            buildNodeExcludeFilter(ctx.nodes.tailscaleNodes)
        );
    }
    return selectGroup(PROXY_GROUPS.MANUAL, ICONS.manual, ctx.nodes.manualNames);
}

function buildProviderGroups(ctx: GroupBuildContext): ProxyGroup[] {
    return (ctx.nodes.providerInfo || []).map(({ provider, nodes }) => {
        if (ctx.flags.regexFilter) {
            const filter = `\\[${provider}\\]|【${provider}】`;
            return selectGroup(providerGroupName(provider), ICONS.select, [
                { "include-all": true, filter },
            ]);
        }
        return selectGroup(
            providerGroupName(provider),
            ICONS.select,
            nodes.map((n) => n.name)
        );
    });
}

function buildMultiWanGroup(ctx: GroupBuildContext): ProxyGroup | null {
    if (!ctx.flags.multiWanEnabled || ctx.flags.interfaces.length === 0) return null;
    const wanNames = ctx.flags.interfaces.map((iface) => `WAN-${iface}`);
    return {
        name: PROXY_GROUPS.MULTI_WAN,
        type: "load-balance",
        icon: ICONS.select,
        url: "https://www.gstatic.com/generate_204",
        interval: 300,
        tolerance: 50,
        strategy: "round-robin",
        proxies: wanNames,
    };
}

function buildFrontGroups(ctx: GroupBuildContext): Array<ProxyGroup | null> {
    return [
        selectGroup(PROXY_GROUPS.SELECT, ICONS.select, ctx.lists.defaultSelector),
        buildManualGroup(ctx),
        ...buildProviderGroups(ctx),
        buildMultiWanGroup(ctx),
        ctx.nodes.landing
            ? selectGroup(PROXY_GROUPS.FRONT_PROXY, ICONS.frontProxy, ctx.lists.frontProxySelector)
            : null,
        ctx.nodes.landing
            ? selectGroup(
                  PROXY_GROUPS.LANDING,
                  ICONS.landing,
                  ctx.nodes.landingNodes.map((node) => node.name)
              )
            : null,
    ];
}

function buildServiceGroups(ctx: GroupBuildContext): ProxyGroup[] {
    return serviceGroups.map((def) =>
        selectGroup(def.name, def.icon, def.proxies(ctx), def.includeAll && ctx.flags.regexFilter)
    );
}

function buildTailGroups(ctx: GroupBuildContext): Array<ProxyGroup | null> {
    return [
        ctx.nodes.hasTailscale
            ? selectGroup(
                  PROXY_GROUPS.TAILSCALE,
                  ICONS.tailscale,
                  ctx.nodes.tailscaleNodes.map((node) => node.name),
                  false,
                  true
              )
            : null,
        selectGroup(
            PROXY_GROUPS.AD_BLOCK,
            ICONS.adBlock,
            ["REJECT", "REJECT-DROP", "DIRECT"],
            false,
            ctx.flags.adblockSource === 0
        ),
        selectGroup(PROXY_GROUPS.FINAL, ICONS.final, [PROXY_GROUPS.SELECT, "DIRECT"]),
        urlTestGroup(PROXY_GROUPS.AUTO, ICONS.auto, ctx.lists.defaultFallback),
        fallbackGroup(PROXY_GROUPS.FALLBACK, ICONS.fallback, ctx.lists.defaultFallback),
    ];
}

function buildRegionGroups(ctx: GroupBuildContext): Array<ProxyGroup | null> {
    const { flags, nodes } = ctx;
    const hasLowCost = nodes.lowCostNodes.length > 0 || flags.regexFilter;
    const tailscaleExcludeFilter = buildNodeExcludeFilter(nodes.tailscaleNodes);

    const lowCostGroup = hasLowCost
        ? buildGroupByType({
              name: PROXY_GROUPS.LOW_COST,
              icon: ICONS.lowCost,
              groupType: flags.groupType,
              nodeSource: !flags.regexFilter
                  ? { proxies: nodes.lowCostNodes.map((node) => node.name) }
                  : {
                        "include-all": true as const,
                        filter: LOW_COST_NODE_MATCHER.pattern,
                        ...(tailscaleExcludeFilter
                            ? { "exclude-filter": tailscaleExcludeFilter }
                            : {}),
                    },
          })
        : null;

    const countryGroups = nodes.regionLayout.groupedCountries.map((country) => {
        const meta = countriesMeta[country];

        const excludeFilter = combineExcludeFilters(meta.excludePattern, tailscaleExcludeFilter);
        const nodeSource = flags.regexFilter
            ? {
                  "include-all": true as const,
                  filter: meta.pattern,
                  ...(excludeFilter ? { "exclude-filter": excludeFilter } : {}),
              }
            : { proxies: nodes.countryNodes[country].map((node) => node.name) };

        return buildGroupByType({
            name: countryGroupName(country),
            icon: meta.icon,
            groupType: flags.groupType,
            nodeSource,
        });
    });

    return [lowCostGroup, ...countryGroups];
}

export function buildProxyGroups(ctx: GroupBuildContext): ProxyGroup[] {
    const groups: Array<ProxyGroup | null> = [
        ...buildFrontGroups(ctx),
        ...buildServiceGroups(ctx),
        ...buildTailGroups(ctx),
        ...buildRegionGroups(ctx),
    ];

    return groups.filter(isNotNull);
}
