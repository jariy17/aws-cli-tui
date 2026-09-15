export function normalizeFuzzyText(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function maximumEditDistance(length) {
    if (length < 4)
        return 0;
    if (length <= 6)
        return 1;
    if (length <= 12)
        return 2;
    return 3;
}
function editDistance(left, right, maximum) {
    if (Math.abs(left.length - right.length) > maximum)
        return undefined;
    let previousPrevious = Array.from({ length: right.length + 1 }, (_, index) => index);
    let previous = previousPrevious;
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex];
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
            let distance = Math.min(previous[rightIndex] + 1, current[rightIndex - 1] + 1, previous[rightIndex - 1] + substitutionCost);
            if (leftIndex > 1 &&
                rightIndex > 1 &&
                left[leftIndex - 1] === right[rightIndex - 2] &&
                left[leftIndex - 2] === right[rightIndex - 1]) {
                distance = Math.min(distance, previousPrevious[rightIndex - 2] + 1);
            }
            current[rightIndex] = distance;
        }
        previousPrevious = previous;
        previous = current;
    }
    const distance = previous[right.length];
    return distance <= maximum ? distance : undefined;
}
function subsequenceScore(key, query) {
    let queryIndex = 0;
    let firstMatch = -1;
    let previousMatch = -1;
    let gaps = 0;
    for (let keyIndex = 0; keyIndex < key.length && queryIndex < query.length; keyIndex += 1) {
        if (key[keyIndex] !== query[queryIndex])
            continue;
        if (firstMatch < 0)
            firstMatch = keyIndex;
        if (previousMatch >= 0)
            gaps += keyIndex - previousMatch - 1;
        previousMatch = keyIndex;
        queryIndex += 1;
    }
    if (queryIndex !== query.length)
        return undefined;
    return 3_000 + firstMatch * 20 + gaps * 5 + key.length - query.length;
}
export function scoreNormalizedFuzzyText(key, query) {
    if (!key || !query)
        return undefined;
    if (key === query)
        return 0;
    if (key.startsWith(query))
        return 100 + key.length - query.length;
    const index = key.indexOf(query);
    if (index >= 0) {
        return 1_000 + index * 10 + key.length - query.length;
    }
    const maximum = maximumEditDistance(query.length);
    if (maximum > 0) {
        const distance = editDistance(key, query, maximum);
        if (distance !== undefined) {
            return 2_000 + distance * 100 + Math.abs(key.length - query.length);
        }
    }
    if (query.length >= 3)
        return subsequenceScore(key, query);
    return undefined;
}
export function scoreFuzzyText(candidate, query) {
    return scoreNormalizedFuzzyText(normalizeFuzzyText(candidate), normalizeFuzzyText(query));
}
//# sourceMappingURL=fuzzy.js.map