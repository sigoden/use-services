import { EventEmitter } from "events";
import * as pEvent from "p-event";
import * as debug from "debug";

export let SERVICE_NAME = "use-services";
export const STOP_KEY = "__stop__";

const dbg = debug(SERVICE_NAME);

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
  dbg("init");
  emitter.emit(eventNames.init);
  const srvDepents = {};
  await Promise.all(Object.keys(options).map(async srvName => {
    dbg("%s init", srvName);
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
      option.deps = await Promise.all((deps || []).map(async depName => {
        if (!options[depName]) throw new Error(`service ${depName} is depent by ${srvName}.deps.${depName} but missed`);
        await pEvent(option.emitter, exports.eventNames.srvInit(depName));
        if (!srvDepents[depName]) srvDepents[depName] = [];
        srvDepents[depName].push(srvName);
        return srvs[depName];
      }));
      const srv = await init(option);
      (srvs as any)[srvName] = srv;
      emitter.emit(eventNames.srvInit(srvName), { srv });
      dbg("%s is ready", srvName);
    } catch (error) {
      dbg("%s is fail to init", srvName);
      emitter.emit(eventNames.error, { srvName, error });
      throw error;
    }
  }));
  dbg("initAll");
  emitter.emit(eventNames.initAll);
  const stop = async () => {
    dbg("stop");
    emitter.emit(eventNames.stop);
    await Promise.all(Object.keys(srvs).map(async srvName => {
      dbg("%s is stopping", srvName);
      const srv = srvs[srvName];
      try {
        if (srvDepents[srvName]) await Promise.all(srvDepents[srvName].map(depent => pEvent(emitter, eventNames.srvStop(depent))));
        if (srv[STOP_KEY]) {
          await srv[STOP_KEY]();
        }
        emitter.emit(eventNames.srvStop(srvName));
        dbg("%s is stopped", srvName);
      } catch (error) {
        dbg("%s is fail to stop", srvName);
        emitter.emit(eventNames.error, { srvName, error });
        throw error;
      }
    }));
    dbg("stopAll");
    emitter.emit(eventNames.stopAll);
  };
  return stop
}

export const eventNames = {
  init: `${SERVICE_NAME}.init`,
  initAll: `${SERVICE_NAME}.initAll`,
  stop: `${SERVICE_NAME}.stop`,
  srvInit: srvName => `${SERVICE_NAME}.init.${srvName}`,
  srvStop: srvName => `${SERVICE_NAME}.stop.${srvName}`,
  error: `${SERVICE_NAME}.error`,
  stopAll: `${SERVICE_NAME}.stopAll`,
}

export default useServices;