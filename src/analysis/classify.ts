/**
 * 节点多维度分类。
 *
 * 将上游订阅的原始节点列表一次性归类为：落地/非落地、国家/地区、低倍率、Tailscale、供应商，
 * 作为配置构建阶段唯一的数据来源。
 */

import { countryExcludeRegexMap, countryRegexMap } from "../catalog/countries";
import { PROXY_GROUPS } from "../catalog/group-names";
import { LOW_COST_NODE_MATCHER } from "../catalog/low-cost";
import { getActiveCountryNames } from "./active-countries";
import type { NodeAnalysis, ProxyNode, RegionLayout } from "../types/proxy";

/** 生成地区组所需的最少达标地区数；不足时展平到上层代理组。 */
const MIN_REGION_GROUPS = 2;

/** 供应商标签正则：匹配 [Supplier] 或 【Supplier】 */
const PROVIDER_REGEX = /\[([^\]]+)\]|【([^】]+)】/g;

/**
 * 按 `dialer-proxy` 字段将节点分为落地节点与非落地节点。
 */
function splitByLanding(nodes: ProxyNode[]): {
    landingNodes: ProxyNode[];
    nonLandingNodes: ProxyNode[];
} {
    const landingNodes: ProxyNode[] = [];
    const nonLandingNodes: ProxyNode[] = [];

    for (const node of nodes) {
        if (node["dialer-proxy"] === PROXY_GROUPS.FRONT_PROXY) {
            landingNodes.push(node);
        } else {
            nonLandingNodes.push(node);
        }
    }

    return { landingNodes, nonLandingNodes };
}

/**
 * 从节点名称中提取供应商信息。
 * 返回 { provider: string; nodes: ProxyNode[] }[]
 */
export function collectProviders(nodes: ProxyNode[]): { provider: string; nodes: ProxyNode[] }[] {
    const providerMap = new Map<string, ProxyNode[]>();

    for (const node of nodes) {
        const matches = [...node.name.matchAll(PROVIDER_REGEX)];
        for (const match of matches) {
            const provider = match[1] || match[2];
            if (provider && !/^\d+(\.\d+)?[xX]?$/.test(provider)) {
                if (!providerMap.has(provider)) {
                    providerMap.set(provider, []);
                }
                providerMap.get(provider)!.push(node);
                break;
            }
        }
    }

    return Array.from(providerMap.entries()).map(([provider, nodes]) => ({ provider, nodes }));
}

/**
 * 根据 excludeProviders 过滤掉指定供应商的节点。
 */
function excludeProviders(nodes: ProxyNode[], excludeList: string[]): ProxyNode[] {
    if (excludeList.length === 0) return nodes;
    const excludeSet = new Set(excludeList);
    return nodes.filter((node) => {
        const matches = [...node.name.matchAll(PROVIDER_REGEX)];
        for (const match of matches) {
            const provider = match[1] || match[2];
            if (provider && excludeSet.has(provider)) return false;
        }
        return true;
    });
}

/**
 * 按 `countriesMeta` 中定义的地区归类节点，命中首个地区即停止，并排除误匹配。
 */
function collectCountries(nodes: ProxyNode[]): Record<string, ProxyNode[]> {
    const countryNodes = new Map<string, ProxyNode[]>();

    for (const node of nodes) {
        for (const [country, regex] of Object.entries(countryRegexMap)) {
            if (!regex.test(node.name)) continue;
            if (countryExcludeRegexMap[country]?.test(node.name)) continue;

            const bucket = countryNodes.get(country);
            if (bucket) {
                bucket.push(node);
            } else {
                countryNodes.set(country, [node]);
            }
            break;
        }
    }

    return Object.fromEntries(countryNodes);
}

/** 筛选出所有匹配低倍率正则的节点。 */
function collectLowCost(nodes: ProxyNode[]): ProxyNode[] {
    return nodes.filter((node) => LOW_COST_NODE_MATCHER.regex.test(node.name));
}

/** 筛选出所有 Tailscale 节点。 */
function isTailscaleNode(node: ProxyNode): boolean {
    return node.type === "tailscale";
}

function collectTailscale(nodes: ProxyNode[]): ProxyNode[] {
    return nodes.filter(isTailscaleNode);
}

/** 过滤掉 Tailscale 节点，得到可进入常规代理选择列表的节点。 */
function excludeTailscale(nodes: ProxyNode[]): ProxyNode[] {
    return nodes.filter((node) => !isTailscaleNode(node));
}

/**
 * 对节点列表执行全部分类。
 * @param nodes - 上游订阅的节点列表（`config.proxies`）
 * @param threshold - 地区节点数量的最小阈值
 * @param excludeProviderList - 要排除出地区分组的供应商列表
 */
export function analyzeNodes(
    nodes: ProxyNode[],
    threshold: number,
    excludeProviderList: string[] = []
): NodeAnalysis {
    const validNodes = nodes.filter(
        (node) => typeof node.name === "string" && node.name.length > 0
    );
    const { landingNodes, nonLandingNodes } = splitByLanding(validNodes);
    const landing = landingNodes.length > 0;
    const tailscaleNodes = collectTailscale(validNodes);
    const providerInfo = collectProviders(validNodes);

    let scopedNodes = excludeTailscale(landing ? nonLandingNodes : validNodes);
    scopedNodes = excludeProviders(scopedNodes, excludeProviderList);

    const countryNodes = collectCountries(scopedNodes);
    const countryNames = getActiveCountryNames(countryNodes, threshold);
    const lowCostNodes = collectLowCost(scopedNodes);

    const regionLayout: RegionLayout =
        countryNames.length >= MIN_REGION_GROUPS
            ? { mode: "grouped", groupedCountries: countryNames, flattenedNodes: [] }
            : {
                  mode: "flattened",
                  groupedCountries: [],
                  flattenedNodes: excludeProviders(
                      excludeTailscale(nonLandingNodes),
                      excludeProviderList
                  ),
              };

    return {
        allNodes: validNodes,
        manualNames: excludeTailscale(validNodes).map((node) => node.name),
        landingNodes,
        nonLandingNodes,
        landing,
        countryNodes,
        countryNames,
        regionLayout,
        lowCostNodes,
        tailscaleNodes,
        hasTailscale: tailscaleNodes.length > 0,
        providerInfo,
    };
}
