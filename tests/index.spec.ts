import useServices, { InitOption, ServiceOption } from "../src";

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

test("it works", async () => {
  const { srvs, init } = useServices("test", options);
  await init();
  expect(srvs.settings.k).toEqual("v");
});
