import {  InitOption, ServiceOption, Services } from "../src";


export async function init<A>(options: InitOption<A, A>): Promise<A> {
  return options.args;
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