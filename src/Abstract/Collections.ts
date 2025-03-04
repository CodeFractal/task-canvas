export class TwoKeyMap<TKey1, TKey2, TValue> {
    private readonly map = new Map<TKey1, Map<TKey2, TValue>>();
    constructor(
        entries?: Iterable<readonly [TKey1, TKey2, TValue]>
    ) {
        if (entries) {
            for (const [key1, key2, value] of entries) {
                this.set(key1, key2, value);
            }
        }
    }

    public set(key1: TKey1, key2: TKey2, value: TValue): void {
        let innerMap = this.map.get(key1);
        if (!innerMap) {
            innerMap = new Map<TKey2, TValue>();
            this.map.set(key1, innerMap);
        }
        innerMap.set(key2, value);
    }
    public get(key1: TKey1, key2: TKey2): TValue | undefined {
        const innerMap = this.map.get(key1);
        return innerMap ? innerMap.get(key2) : undefined;
    }
    public delete(key1: TKey1, key2: TKey2): boolean {
        const innerMap = this.map.get(key1);
        let result = false;
        if (innerMap) {
            result = innerMap.delete(key2);
            if (innerMap.size === 0) {
                this.map.delete(key1);
            }
        }
        return result;
    }
    public has(key1: TKey1, key2: TKey2): boolean {
        const innerMap = this.map.get(key1);
        return innerMap ? innerMap.has(key2) : false;
    }
    public clear(): void {
        this.map.clear();
    }
    public getKeys1(): IterableIterator<TKey1> {
        return this.map.keys();
    }
    public getKeys2(key1: TKey1): IterableIterator<TKey2> {
        const innerMap = this.map.get(key1);
        return innerMap ? innerMap.keys() : [].values();
    }
    public getValues(): IterableIterator<TValue> {
        const values: TValue[] = [];
        for (const innerMap of this.map.values()) {
            for (const value of innerMap.values()) {
                values.push(value);
            }
        }
        return values.values();
    }
    public getEntries(): IterableIterator<[TKey1, TKey2, TValue]> {
        const entries: [TKey1, TKey2, TValue][] = [];
        for (const [key1, innerMap] of this.map) {
            for (const [key2, value] of innerMap) {
                entries.push([key1, key2, value]);
            }
        }
        return entries.values();
    }
}