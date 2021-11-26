# use-services

Use services gracefully

## Get Started

```ts
import useServices from "use-services";
import * as Echo from "@use-services/echo";

const options = {
  settings: {
    init: Echo.init,
    args: {},
  } as Echo.Option<typeof settings>,
};

const { srvs, init } = useServices("app", options);
export { srvs, init };
```