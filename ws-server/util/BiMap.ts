export class BiMap<T1,T2> {
    private map = new Map<T1, T2>();
    private inverse = new Map<T2, T1>();

    public set(key: T1, value: T2): void {
        if (this.map.has(key)) this.inverse.delete(this.map.get(key));
        if (this.inverse.has(value)) this.map.delete(this.inverse.get(value));
        this.map.set(key, value);
        this.inverse.set(value, key);
    }

    public get(key: T1): T2 | undefined {
        return this.map.get(key);
    }

    public getKey(value: T2): T1 | undefined {
        return this.inverse.get(value);
    }

    public has(key: T1): boolean {
        return this.map.has(key);
    }

    public hasValue(value: T2): boolean {
        return this.inverse.has(value);
    }

    public clear(): void {
        this.map.clear();
        this.inverse.clear();
    }

    public delete(key: T1): T2 | undefined {
        if (!this.map.has(key)) return undefined;
        const res = this.map.get(key);
        this.map.delete(key);
        this.inverse.delete(res);
        return res;
    }

    public deleteValue(value: T2): T1 | undefined {
        if (!this.inverse.has(value)) return undefined;
        const res = this.inverse.get(value);
        this.inverse.delete(value);
        this.map.delete(res);
        return res;
    }

    public findValue(predicate: (T2) => boolean): T2 | undefined {
        for (const v of this.map.values()) {
            if (predicate(v)) return v;
        }
        return undefined;
    }

    public toString(): string {
        return JSON.stringify(this.map);
    }
}
