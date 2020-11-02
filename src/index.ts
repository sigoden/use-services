import { EventEmitter } from "events";

export const NAME = "service";
export const STOP_KEY = Symbol("stop");

export interface Config {
  ns: string;
  emitter?: EventEmitter;
}

export interface Ctor<S> {
  new(...args): S;
}

export interface InitFn<A, S> {
  (config: Config, args: A, ctor?: Ctor<S>): Promise<S>;
}

export interface ServiceOption<A, S> {
  init: InitFn<A, S>;
  args: A;
  ctor?: Ctor<S>;
}

type ExtractService<Type> = Type extends ServiceOption<infer A, infer S> ? S : never;

export type Services<T> = {[K in keyof T]: ExtractService<T[K]>};

export async function initAllServices<
  O extends {[k: string]: ServiceOption<any, any>}
>(config: Config, options: O): Promise<Services<O>> {
  const { emitter } = config;
  emitter.emit(`${NAME}.init`);
  const srvs = {};
  await Promise.all(Object.keys(options).map(async srvName => {
    try {
      const option = options[srvName];
      const srv = await option.init(config, option.args, option.ctor);
      emitter.emit(`${NAME}.init.${srvName}`);
      srvs[srvName] = srv;
    } catch (error) {
      emitter.emit(`${NAME}.error`, { srvName, error });
      throw error;
    }
  }));
  emitter.emit(`${NAME}.initAll`);
  return srvs as Services<O>;
}

export async function stopAllServices(config, srvs: any) {
  const { emitter } = config;
  emitter.emit(`${NAME}.stop`);
  await Promise.all(Object.keys(srvs).map(async srvName => {
    const srv = srvs[name];
    try {
      if (srv[STOP_KEY]()) {
        await srv[STOP_KEY]();
      }
      emitter.emit(`${NAME}.stop.${srvName}`);
    } catch (error) {
      emitter.emit(`${NAME}.error`, { srvName, error });
      throw error;
    }
  }));
  emitter.emit(`${NAME}.stopAll`);
}
