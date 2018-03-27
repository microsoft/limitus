declare namespace Limitus {
    export interface LimitusExtendOptions {
        get(key: string, callback: (err: Error, value?: string) => void): void;
        set(key: string, value: string, expiration?: number, callback?: (err?: Error) => void): void;
    }

    export interface DropInfo {
        count: number;
        bucket: number;
    }

    export interface ModeResult {
        limited: boolean;
        next: string;
        expiration: number;
        info?: DropInfo;
    }

    export type ModeFn = (rule: Rule, value: string) => ModeResult;

    export interface Rule {
        max: number;
        interval: number;
        mode?: 'continuous' | 'interval' | ModeFn;
    }

    export class Rejected extends Error {
        public readonly info?: DropInfo;
        public readonly bucketName: string;
    }

    export type Ident = object | string | number;
}
declare class Limitus {
    public extend(obj: Limitus.LimitusExtendOptions): this;
    public rule(name: string, rule: Limitus.Rule): this;


    public drop(name: string, ident: Limitus.Ident, rule?: Limitus.Rule): Promise<Limitus.DropInfo>;
    public drop(name: string, ident: Limitus.Ident, rule?: Limitus.Rule, callback?: (err: Error | null, res?: Limitus.DropInfo) => void): void;
    public checkLimited(name: string, ident: Limitus.Ident, rule?: Limitus.Rule): Promise<Limitus.DropInfo>;
    public checkLimited(name: string, ident: Limitus.Ident, rule?: Limitus.Rule, callback?: (err: Error | null, res?: Limitus.DropInfo) => void): void;
}
export = Limitus;
