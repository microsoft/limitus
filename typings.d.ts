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

    }
}
declare class Limitus {
    public extend(obj: Limitus.LimitusExtendOptions): this;
    public rule(name: string, rule: Limitus.Rule): this;
    public drop(name: string, ident: object, rule?: Limitus.Rule)
}
export = Limitus;
