import {
  createRoutesFromChildren,
  matchRoutes,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import {
  initializeFaro,
  createReactRouterV6Options,
  ReactIntegration,
  getWebInstrumentations,
} from "@grafana/faro-react";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";
import config from "@/config/config";

initializeFaro({
  url: config.FARO_COLLECTOR_URL,
  app: {
    name: config.APP_NAME,
    version: config.APP_VERSION,
    environment: config.APP_ENV,
  },
  sessionTracking: {
    samplingRate: 1,
    persistent: true,
  },
  instrumentations: [
    ...getWebInstrumentations(),
    new TracingInstrumentation(),
    new ReactIntegration({
      router: createReactRouterV6Options({
        createRoutesFromChildren,
        matchRoutes,
        Routes,
        useLocation,
        useNavigationType,
      }),
    }),
  ],
});
