import useServices, { InitOption, ServiceOption, Services } from "../src";
import { EventEmitter } from "events";

export async function init<A>(options: InitOption<A, A>): Promise<A> {
  return options.args;
}

const settings = {
  k: "v",
};

const options = {
  settings: {
    args: settings,
    init,
  } as ServiceOption<typeof settings, typeof settings>,
};

const srvs: Services<typeof options> = {} as any;

test("it works", async () => {
  const emitter = new EventEmitter();
  await useServices(srvs, "app", emitter, options);
  expect(srvs.settings.k).toEqual("v");
});
