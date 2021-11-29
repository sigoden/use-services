import { EventEmitter } from "events";
import pEvent from "p-event";
import * as debug from "debug";

export const SERVICE_NAME = "use-services";
export const INIT_KEY = Symbol("__init__");
export const STOP_KEY = Symbol("__stop__");

const dbg = debug(SERVICE_NAME);

export interface InitOption<A, S> {
  app: string;
  srvName: string;
  emitter: EventEmitter;
  args: A;
  deps: any[];
  ctor: Ctor<S>;
}

export interface Ctor<S> {
  new (...args): S;
}

export type InitFn<A, S> = (option: InitOption<A, S>) => Promise<S>;

export function createInitFn<A, S>(srvClass: Ctor<S>) {
  return async (option: InitOption<A, S>) => {
    return new (option.ctor || srvClass)(option) as S;
  };
}

export interface ServiceOption<A, S> {
  init: InitFn<A, S>;
  args: A;
  ctor?: Ctor<S>;
  deps?: string[];
}

type ExtractService<Type> = Type extends ServiceOption<infer A, infer S>
  ? S
  : never;

export type Services<T> = { [K in keyof T]: ExtractService<T[K]> };

export default function useServices<
  O extends { [k: string]: ServiceOption<any, any> }
>(app: string, options: O) {
  const srvs: Services<O> = {} as any;
  const emitter = new EventEmitter();
  const init = async () => {
    dbg("init");
    emitter.emit(SERVICES_EVENTS.INIT_START);
    const srvDepents = {};
    await Promise.all(
      Object.keys(options).map(async (srvName) => {
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
          option.deps = await Promise.all(
            (deps || []).map(async (depName) => {
              if (!options[depName])
                throw new Error(
                  `service ${depName} is depent by ${srvName}.deps.${depName} but missed`
                );
              await pEvent(option.emitter, SERVICES_EVENTS.SRV_INIT(depName));
              if (!srvDepents[depName]) srvDepents[depName] = [];
              srvDepents[depName].push(srvName);
              return srvs[depName];
            })
          );
          const srv = await init(option);
          if (srv[INIT_KEY]) await srv[INIT_KEY]();
          (srvs as any)[srvName] = srv;
          emitter.emit(SERVICES_EVENTS.SRV_INIT(srvName), { srv });
          dbg("%s is ready", srvName);
        } catch (error) {
          dbg("%s is fail to init", srvName);
          emitter.emit(SERVICES_EVENTS.ERROR, { srvName, error });
          error.message = `${srvName}: ${error.message}`;
          throw error;
        }
      })
    );
    dbg("initAll");
    emitter.emit(SERVICES_EVENTS.INIT_END);
    return async () => {
      dbg("stop");
      emitter.emit(SERVICES_EVENTS.STOP_START);
      await Promise.all(
        Object.keys(srvs).map(async (srvName) => {
          dbg("%s is stopping", srvName);
          const srv = srvs[srvName];
          try {
            if (srvDepents[srvName])
              await Promise.all(
                srvDepents[srvName].map((depent) =>
                  pEvent(emitter, SERVICES_EVENTS.SRV_STOP(depent))
                )
              );
            if (srv[STOP_KEY]) {
              await srv[STOP_KEY]();
            }
            emitter.emit(SERVICES_EVENTS.SRV_STOP(srvName));
            dbg("%s is stopped", srvName);
          } catch (error) {
            dbg("%s is fail to stop", srvName);
            emitter.emit(SERVICES_EVENTS.ERROR, { srvName, error });
            throw error;
          }
        })
      );
      dbg("stopAll");
      emitter.emit(SERVICES_EVENTS.STOP_END);
    };
  };
  return { srvs, init, emitter };
}

export const SERVICES_EVENTS = {
  INIT_START: `${SERVICE_NAME}.init.start`,
  INIT_END: `${SERVICE_NAME}.init.end`,
  STOP_START: `${SERVICE_NAME}.stop.start`,
  STOP_END: `${SERVICE_NAME}.stop.end`,
  SRV_INIT: (srvName) => `${SERVICE_NAME}.init.${srvName}`,
  SRV_STOP: (srvName) => `${SERVICE_NAME}.stop.${srvName}`,
  ERROR: `${SERVICE_NAME}.error`,
};
