globalThis.BILL_ANALYZER_CONFIG = {
  apiBaseUrl: location.hostname === "127.0.0.1" || location.hostname === "localhost"
    ? ""
    : "https://bill-analyzer-api.psc-docket-helper.workers.dev"
};
