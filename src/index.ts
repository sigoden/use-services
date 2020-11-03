import { EventEmitter } from "events";

export let SERVICE_NAME = "service";
export const STOP_KEY = "__stop__";

export interface Config {
  ns: string;
  emitter?: EventEmitter;
  srvName?: string;
}

export interface Ctor<S> {
  new(...args): S;
}

export interface InitFn<A, S> {
  (config: Config, args: A, ctor?: Ctor<S>): Promise<S>;
}

export interface ServiceOption<A, S, D = undefined> {
  init: InitFn<A, S>;
  args: A;
  ctor?: Ctor<S>;
  deps?: D,
}

type ExtractService<Type> = Type extends ServiceOption<infer A, infer S, infer D> ? S : never;

export type Services<T> = {[K in keyof T]: ExtractService<T[K]>};

export async function initAllServices<
  O extends {[k: string]: ServiceOption<any, any, any>}
>(config: Config, options: O): Promise<Services<O>> {
  const { emitter } = config;
  emitter.emit(eventNames.init);
  const srvs = {};
  await Promise.all(Object.keys(options).map(async srvName => {
    try {
      const option = options[srvName];
      const srv = await option.init({ ...config, srvName }, option.args, option.ctor);
      emitter.emit(eventNames.srvInit(srvName), { srv });
      srvs[srvName] = srv;
    } catch (error) {
      emitter.emit(eventNames.error, { srvName, error });
      throw error;
    }
  }));
  emitter.emit(`${SERVICE_NAME}.initAll`);
  return srvs as Services<O>;
}

export async function stopAllServices(config, srvs: any) {
  const { emitter } = config;
  emitter.emit(eventNames.stop);
  await Promise.all(Object.keys(srvs).map(async srvName => {
    const srv = srvs[srvName];
    try {
      if (srv[STOP_KEY]()) {
        await srv[STOP_KEY]();
      }
      emitter.emit(eventNames.srvStop(srvName));
    } catch (error) {
      emitter.emit(eventNames.error, { srvName, error });
      throw error;
    }
  }));
  emitter.emit(eventNames.stop);
}

export const eventNames = {
  init: `${SERVICE_NAME}.init`,
  stop: `${SERVICE_NAME}.stop`,
  srvInit: srvName => `${SERVICE_NAME}.init.${srvName}`,
  srvStop: srvName => `${SERVICE_NAME}.stop.${srvName}`,
  error: `${SERVICE_NAME}.error`,
}
