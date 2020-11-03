import { Config, ServiceOption, Services } from "../src";

export type Service<S> = S;

export async function init<A>(config: Config, args: A): Promise<Service<A>> {
  return args;
}

const settings =  {
  k: "v",
}

const options = {
  settings: {
    args: settings,
    init,
  } as ServiceOption<typeof settings, typeof settings>,
}

let srvs: Services<typeof options>;
srvs.settings.k