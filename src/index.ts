import { EventEmitter } from "events";
import * as pEvent from "p-event";

export let SERVICE_NAME = "service";
export const STOP_KEY = "__stop__";

export interface InitOption<A, S> {
  app: string;
  srvName: string;
  emitter: EventEmitter;
  args: A,
  deps: any[];
  ctor: Ctor<S>;
}

export interface Ctor<S> {
  new(...args): S;
}

export interface InitFn<A, S> {
  (option: InitOption<A, S>): Promise<S>;
}

export interface ServiceOption<A, S> {
  init: InitFn<A, S>;
  args: A;
  ctor?: Ctor<S>;
  deps?: string[],
}

type ExtractService<Type> = Type extends ServiceOption<infer A, infer S> ? S : never;

export type Services<T> = {[K in keyof T]: ExtractService<T[K]>};

export async function useServices<
  O extends {[k: string]: ServiceOption<any, any>}
>(srvs: Services<O>, app: string, emitter: EventEmitter, options: O): Promise<() => Promise<void>> {
  emitter.emit(eventNames.init);
  const srvDepents = {};
  await Promise.all(Object.keys(options).map(async srvName => {
    try {
      const { deps, args, init, ctor } = options[srvName];
      const option: InitOption<any, any> = {
          app,
          emitter,
          srvName,
          deps: [],
          ctor,
          args,
      };
      await Promise.all((deps || []).map(async depName => {
        const srv = deps[depName];
        if (!options[srv]) throw new Error(`service ${srv} is depent by ${srvName}.deps.${depName} but missed`);
        await pEvent(option.emitter, eventNames.srvInit(srv))
        if (!srvDepents[srv]) srvDepents[srv] = [];
        srvDepents[srv].push(srvName);
        option.deps.push(srv);
      }));
      const srv = await init(option);
      (srvs as any)[srvName] = srv;
      emitter.emit(eventNames.srvInit(srvName), { srv });
    } catch (error) {
      emitter.emit(eventNames.error, { srvName, error });
      throw error;
    }
  }));
  emitter.emit(`${SERVICE_NAME}.initAll`);
  const stop = async () => {
    emitter.emit(eventNames.stop);
    await Promise.all(Object.keys(srvs).map(async srvName => {
      const srv = srvs[srvName];
      try {
        if (srvDepents[srvName]) await Promise.all(srvDepents[srvName].map(depent => pEvent(emitter, eventNames.srvStop(depent))));
        if (srv[STOP_KEY]) {
          await srv[STOP_KEY]();
        }
        emitter.emit(eventNames.srvStop(srvName));
      } catch (error) {
        emitter.emit(eventNames.error, { srvName, error });
        throw error;
      }
    }));
    emitter.emit(eventNames.stop);
  };
  return stop
}

export const eventNames = {
  init: `${SERVICE_NAME}.init`,
  stop: `${SERVICE_NAME}.stop`,
  srvInit: srvName => `${SERVICE_NAME}.init.${srvName}`,
  srvStop: srvName => `${SERVICE_NAME}.stop.${srvName}`,
  error: `${SERVICE_NAME}.error`,
}

export default useServices;